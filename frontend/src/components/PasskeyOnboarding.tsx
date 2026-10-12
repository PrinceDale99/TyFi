import React, { useEffect, useState } from 'react';
import { CheckCircle2, Fingerprint, KeyRound, Loader2, ShieldCheck, Smartphone } from 'lucide-react';

import {
  createSeedlessWallet,
  describePasskeyError,
  isPasskeySupported,
  onServiceWaking,
  joinWithPairingCode,
  signInWithPasskey,
  type ClaimStage,
  type CreateStage,
  type CreatedWallet,
  type PasskeySession,
  type SignInStage,
} from '../lib/passkey';
import { capturePostHogEvent } from '../lib/posthog';

interface PasskeyOnboardingProps {
  /** Called once a wallet is created or signed in. */
  onConnected: (session: PasskeySession, created?: CreatedWallet) => void;
}

const CREATE_STEPS: { stage: CreateStage; label: string }[] = [
  { stage: 'biometric', label: 'Confirm with your fingerprint, face or device PIN' },
  { stage: 'deploying', label: 'Creating your wallet on Stellar — TyFi pays the fee' },
  { stage: 'funding', label: 'Adding free test XLM so you can try it' },
];

const SIGN_IN_LABEL: Record<SignInStage, string> = {
  biometric: 'Choose your TyFi passkey and confirm it’s you',
  locating: 'Finding your wallet on Stellar…',
  done: 'Signed in',
};

const JOIN_LABEL: Record<ClaimStage, string> = {
  biometric: 'Create this device’s passkey — confirm with your fingerprint, face or PIN',
  waiting: 'Now approve this device on your other device…',
  verifying: 'Confirming on Stellar…',
  done: 'Signed in',
};

type Busy =
  | { kind: 'create'; stage: CreateStage }
  | { kind: 'signin'; stage: SignInStage }
  | { kind: 'join'; stage: ClaimStage }
  | null;

/**
 * "Continue with Face ID / fingerprint" — seedless onboarding.
 *
 * Copy is deliberately plain: users are never shown keys, seed phrases or
 * contract jargon, only what their device is about to ask and why.
 */
export const PasskeyOnboarding: React.FC<PasskeyOnboardingProps> = ({ onConnected }) => {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [waking, setWaking] = useState(false);
  const supported = isPasskeySupported();

  useEffect(() => onServiceWaking(setWaking), []);

  const wakingNotice = waking && (
    <p className="text-xs text-amber-200" aria-live="polite">
      Waking up TyFi’s servers — the first request after a quiet period can take up to a minute.
    </p>
  );

  const create = async () => {
    setError(null);
    capturePostHogEvent('passkey_wallet_create_started');
    try {
      const name = nickname.trim() || `TyFi wallet ${new Date().toLocaleDateString()}`;
      const created = await createSeedlessWallet(name, stage => setBusy({ kind: 'create', stage }));
      capturePostHogEvent('passkey_wallet_created', { funded: !!created.fundingTxHash });
      onConnected(created.session, created);
    } catch (err) {
      capturePostHogEvent('passkey_wallet_create_failed', { reason: (err as Error)?.name });
      setError(describePasskeyError(err));
    } finally {
      setBusy(null);
    }
  };

  const signIn = async () => {
    setError(null);
    try {
      const session = await signInWithPasskey(stage => setBusy({ kind: 'signin', stage }));
      capturePostHogEvent('passkey_wallet_signed_in');
      onConnected(session);
    } catch (err) {
      setError(describePasskeyError(err));
    } finally {
      setBusy(null);
    }
  };

  const join = async () => {
    setError(null);
    try {
      const session = await joinWithPairingCode(joinCode, stage => setBusy({ kind: 'join', stage }));
      capturePostHogEvent('passkey_device_joined');
      onConnected(session);
    } catch (err) {
      setError(describePasskeyError(err));
    } finally {
      setBusy(null);
    }
  };

  if (!supported) {
    return (
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
        This browser can’t use passkeys. Open TyFi in an up-to-date Chrome, Safari or Edge over HTTPS to create a seedless wallet.
      </div>
    );
  }

  if (busy?.kind === 'create') {
    const current = CREATE_STEPS.findIndex(s => s.stage === busy.stage);
    return (
      <div className="p-5 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-3" aria-live="polite">
        {CREATE_STEPS.map((step, i) => (
          <div key={step.stage} className={`flex items-center gap-3 text-sm ${i < current ? 'text-emerald-300' : i === current ? 'text-white font-bold' : 'text-slate-500'}`}>
            {i < current ? <CheckCircle2 size={18} /> : i === current ? <Loader2 size={18} className="animate-spin text-sky-400" /> : <span className="w-[18px] h-[18px] rounded-full border border-slate-600" />}
            {step.label}
          </div>
        ))}
        {busy.stage === 'checking' && !waking && <p className="text-xs text-slate-400">Connecting to TyFi…</p>}
        {wakingNotice}
      </div>
    );
  }

  if (busy?.kind === 'join') {
    return (
      <div className="p-5 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-2" aria-live="polite">
        <div className="flex items-center gap-3 text-sm text-white font-bold">
          <Loader2 size={18} className="animate-spin text-sky-400" /> {JOIN_LABEL[busy.stage]}
        </div>
        {busy.stage === 'waiting' && (
          <p className="text-xs text-slate-400">Keep this screen open. On the device that made the code, tap Approve and confirm with your biometric.</p>
        )}
        {wakingNotice}
      </div>
    );
  }

  if (busy?.kind === 'signin') {
    return (
      <div className="p-5 rounded-2xl bg-sky-500/5 border border-sky-500/20 flex items-center gap-3 text-sm text-white font-bold" aria-live="polite">
        <Loader2 size={18} className="animate-spin text-sky-400" /> {SIGN_IN_LABEL[busy.stage]}
        {wakingNotice}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={create}
        className="w-full flex items-center gap-4 p-5 rounded-2xl text-left bg-gradient-to-r from-sky-500/20 to-indigo-500/20 border border-sky-500/40 hover:border-sky-400 hover:from-sky-500/30 transition-all group"
      >
        <div className="w-12 h-12 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 group-hover:scale-110 transition-transform">
          <Fingerprint size={26} strokeWidth={1.5} />
        </div>
        <div>
          <div className="font-black text-white text-lg">Create wallet with Face ID / fingerprint</div>
          <div className="text-xs text-sky-200/80 mt-0.5">No seed phrase, no extension, no fees. Your device keeps the key.</div>
        </div>
      </button>

      <input
        value={nickname}
        onChange={e => setNickname(e.target.value)}
        maxLength={40}
        placeholder="Wallet nickname (optional, shown in your passkey list)"
        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 outline-none"
      />

      <button
        onClick={signIn}
        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-white/10 text-sm font-bold text-slate-200 hover:bg-white/5 hover:text-white transition-all"
      >
        <KeyRound size={16} /> I already have a passkey wallet — sign in
      </button>

      {!showJoin ? (
        <button
          onClick={() => setShowJoin(true)}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-white/10 text-sm font-bold text-slate-200 hover:bg-white/5 hover:text-white transition-all"
        >
          <Smartphone size={16} /> Use a code from another device
        </button>
      ) : (
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
          <p className="text-xs text-slate-400">
            On a device that already has your wallet, open <b>Your devices → Add another device</b> and copy the code here.
          </p>
          <textarea
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            rows={2}
            spellCheck={false}
            autoComplete="off"
            placeholder="tyfi-pair-…"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-slate-500 focus:border-sky-500 outline-none break-all"
          />
          <button
            onClick={join}
            disabled={!joinCode.trim()}
            className="w-full p-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-black"
          >
            Set up this device
          </button>
        </div>
      )}

      <p className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
        <ShieldCheck size={14} className="shrink-0 mt-0.5 text-emerald-400" />
        Every transaction asks for your fingerprint or face. TyFi never sees your biometrics or holds a key that can move your funds.
      </p>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default PasskeyOnboarding;
