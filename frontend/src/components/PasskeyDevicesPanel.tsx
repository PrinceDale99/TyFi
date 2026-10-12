import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check, Copy, Eye, EyeOff, Fingerprint, Loader2, Monitor, Plus, ShieldAlert, ShieldCheck, Smartphone, Tablet, Trash2, X,
} from 'lucide-react';

import {
  approvePairing,
  createPairingCode,
  describePasskeyError,
  getPairingState,
  listDevices,
  PasskeyApiError,
  rejectPairing,
  removeDevice,
  startDeviceSession,
  type DeviceInfo,
  type DeviceSession,
  type PairingState,
  type PasskeySession,
} from '../lib/passkey';
import { capturePostHogEvent } from '../lib/posthog';

interface PasskeyDevicesPanelProps {
  session: PasskeySession;
}

const PAIRING_POLL_MS = 3_000;

const DeviceIcon: React.FC<{ type: string; size?: number }> = ({ type, size = 18 }) =>
  type === 'mobile' ? <Smartphone size={size} /> : type === 'tablet' ? <Tablet size={size} /> : <Monitor size={size} />;

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** An IP address that stays hidden until the user taps the eye. */
const HiddenIp: React.FC<{ ip: string; label: string }> = ({ ip, label }) => {
  const [shown, setShown] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-300">{shown ? ip : '•••.•••.•••.•••'}</span>
      <button
        onClick={() => setShown(s => !s)}
        className="text-slate-400 hover:text-white"
        aria-label={shown ? `Hide ${label} IP address` : `Show ${label} IP address`}
        title={shown ? 'Hide IP address' : 'Show IP address'}
      >
        {shown ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </span>
  );
};

/**
 * "Your devices": every passkey that can sign for this wallet, with device
 * type, when it was added/last used and IP addresses (hidden by default), a
 * remove button, and secure pairing of another device with a one-time code.
 */
export const PasskeyDevicesPanel: React.FC<PasskeyDevicesPanelProps> = ({ session }) => {
  const [ds, setDs] = useState<DeviceSession | null>(null);
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pairing, setPairing] = useState<{ code: string; expiresAt: number } | null>(null);
  const [pairingState, setPairingState] = useState<PairingState | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [confirmRemove, setConfirmRemove] = useState<DeviceInfo | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof PasskeyApiError && err.code === 'SESSION_REQUIRED') {
      setDs(null);
      setDevices(null);
      setError('For your security, please confirm it’s you again.');
      return;
    }
    setError(describePasskeyError(err));
  }, []);

  const refresh = useCallback(async (current: DeviceSession) => {
    try {
      setDevices(await listDevices(current));
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const unlock = async (): Promise<DeviceSession | null> => {
    setError(null);
    setBusy('unlock');
    try {
      const next = await startDeviceSession(session);
      setDs(next);
      await refresh(next);
      return next;
    } catch (err) {
      handleError(err);
      return null;
    } finally {
      setBusy(null);
    }
  };

  // Lock again when the 15-minute session ends; tick the pairing countdown.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      if (ds && Date.now() > ds.expiresAt) {
        setDs(null);
        setDevices(null);
        setPairing(null);
      }
    }, 1_000);
    return () => clearInterval(t);
  }, [ds]);

  // While a code is open, watch for the new device to claim it.
  useEffect(() => {
    if (!ds || !pairing) return;
    pollRef.current = setInterval(async () => {
      try {
        const state = await getPairingState(ds);
        setPairingState(state);
        if (state.status === 'expired') setPairing(null);
      } catch (err) {
        handleError(err);
      }
    }, PAIRING_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [ds, pairing, handleError]);

  const startPairing = async () => {
    setError(null);
    setNotice(null);
    const current = ds ?? (await unlock());
    if (!current) return;
    setBusy('pair');
    try {
      setPairing(await createPairingCode(current));
      setPairingState({ status: 'open' });
      capturePostHogEvent('passkey_pairing_code_created');
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const copyCode = async () => {
    if (!pairing) return;
    await navigator.clipboard.writeText(pairing.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  const approve = async () => {
    const pending = pairingState?.request;
    if (!ds || !pending) return;
    setError(null);
    setBusy('approve');
    try {
      await approvePairing(session, ds, pending);
      capturePostHogEvent('passkey_device_paired', { device_type: pending.device.deviceType });
      setNotice(`${pending.device.deviceName} can now sign in to this wallet with its own passkey.`);
      setPairing(null);
      setPairingState(null);
      await refresh(ds);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const decline = async () => {
    const pending = pairingState?.request;
    if (!ds || !pending) return;
    await rejectPairing(ds, pending.requestId).catch(() => undefined);
    setPairing(null);
    setPairingState(null);
    setNotice('Request declined. Nothing was added to your wallet.');
  };

  const remove = async (device: DeviceInfo) => {
    if (!ds) return;
    setConfirmRemove(null);
    setError(null);
    setBusy(`remove:${device.keyId}`);
    try {
      await removeDevice(session, ds, device.keyId);
      capturePostHogEvent('passkey_device_removed');
      setNotice(`${device.deviceName} was removed and can no longer sign for this wallet.`);
      await refresh(ds);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const secondsLeft = pairing ? Math.max(0, Math.round((pairing.expiresAt - now) / 1000)) : 0;
  const pending = pairingState?.status === 'claimed' ? pairingState.request : undefined;

  return (
    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-300" />
          <div className="text-sm font-black text-white">Your devices</div>
        </div>
        {ds && !pairing && (
          <button
            onClick={startPairing}
            disabled={!!busy || (devices?.length ?? 0) >= 10}
            className="flex items-center gap-1.5 text-xs font-bold text-sky-300 hover:text-sky-200 disabled:opacity-50"
          >
            <Plus size={14} /> Add another device
          </button>
        )}
      </div>

      {!ds && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            See every device that can sign for this wallet, where it was used from, and remove any you don’t recognise.
          </p>
          <button
            onClick={startPairing}
            disabled={!!busy}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-sm font-black text-white disabled:opacity-60"
          >
            <Plus size={16} /> Add another device (phone, tablet, laptop)
          </button>
          <button
            onClick={() => unlock()}
            disabled={busy === 'unlock'}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-sm font-bold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
          >
            {busy === 'unlock' ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
            Confirm it’s you to view devices
          </button>
        </div>
      )}

      {/* Pairing: show the one-time code, then the approval request. */}
      {ds && pairing && !pending && (
        <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/20 space-y-3">
          <div className="text-xs font-bold text-sky-200">Your one-time device code</div>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 min-w-0 break-all p-3 rounded-lg bg-black/40 text-[11px] leading-relaxed text-white font-mono select-all">{pairing.code}</code>
            <button onClick={copyCode} className="px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-white" aria-label="Copy code" title="Copy code">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside">
            <li>On your other device, open TyFi → Connect Wallet → “Use a code from another device”.</li>
            <li>Paste this code. That device creates its own passkey.</li>
            <li>Approve it here with your fingerprint or face.</li>
          </ol>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Waiting for your other device…</span>
            <span>Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
          </div>
          <p className="text-[11px] text-amber-200/90 flex gap-1.5">
            <ShieldAlert size={13} className="shrink-0 mt-0.5" />
            Only share this code with yourself. It works once, and nothing is added until you approve here.
          </p>
          <button onClick={() => { setPairing(null); setPairingState(null); }} className="text-xs text-slate-400 hover:text-white">Cancel</button>
        </div>
      )}

      {ds && pending && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3" role="alert">
          <div className="text-sm font-black text-amber-100">A new device wants to use your wallet</div>
          <div className="flex items-center gap-3 text-sm text-white">
            <DeviceIcon type={pending.device.deviceType} /> {pending.device.deviceName}
          </div>
          <div className="text-xs space-y-1">
            <HiddenIp ip={pending.ipAddress} label="IP" />
            <div className="text-slate-500">Requested {when(pending.claimedAt)}</div>
          </div>
          <p className="text-xs text-amber-200/90">Only approve if this is you, on a device you just set up with the code.</p>
          <div className="flex gap-2">
            <button
              onClick={approve}
              disabled={busy === 'approve'}
              className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-black disabled:opacity-60"
            >
              {busy === 'approve' ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />} Approve
            </button>
            <button onClick={decline} disabled={busy === 'approve'} className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border border-white/15 text-sm font-bold text-slate-200 hover:bg-white/5">
              <X size={16} /> Decline
            </button>
          </div>
        </div>
      )}

      {ds && devices === null && <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading devices…</p>}

      {ds && devices && (
        <ul className="space-y-2">
          {devices.map(d => (
            <li key={d.keyId} className="p-3 rounded-xl bg-black/20 border border-white/5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 text-slate-300"><DeviceIcon type={d.deviceType} /></div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                      {d.deviceName}
                      {d.current && <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider">This device</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 capitalize">{d.deviceType} · added {when(d.addedAt)}</div>
                    <div className="text-[11px] text-slate-400">Last used {when(d.lastSeenAt)}</div>
                    <div className="text-[11px] mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <HiddenIp ip={d.lastSeenIp} label="Last IP" />
                      {d.addedIp !== d.lastSeenIp && <HiddenIp ip={d.addedIp} label="Added from" />}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmRemove(d)}
                  disabled={devices.length <= 1 || !!busy}
                  className="shrink-0 flex items-center gap-1 text-xs font-bold text-rose-300 hover:text-rose-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={devices.length <= 1 ? 'You can’t remove your only device' : 'Remove this device'}
                >
                  {busy === `remove:${d.keyId}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Remove
                </button>
              </div>

              {confirmRemove?.keyId === d.keyId && (
                <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 space-y-2">
                  <p className="text-xs text-rose-100">
                    {d.current
                      ? 'This is the device you’re using. After removing it you’ll need another of your devices to use this wallet. Continue?'
                      : `Remove ${d.deviceName}? It will immediately stop being able to sign for this wallet.`}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => remove(d)} className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-black">Remove with my fingerprint</button>
                    <button onClick={() => setConfirmRemove(null)} className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-slate-200">Keep</button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {devices.length === 0 && <li className="text-xs text-slate-400">No device records yet.</li>}
        </ul>
      )}

      {notice && <p className="text-sm text-emerald-300" aria-live="polite">{notice}</p>}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    </div>
  );
};

export default PasskeyDevicesPanel;
