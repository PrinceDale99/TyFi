import React, { useEffect, useState } from 'react';
import { Fingerprint, Puzzle } from 'lucide-react';

import {
  getApprovalMode,
  getLinkedAccount,
  onApprovalModeChange,
  setApprovalMode,
  type ApprovalMode,
  type PasskeySession,
} from '../lib/passkey';
import { capturePostHogEvent } from '../lib/posthog';

const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-6)}`;

/**
 * "Approve transactions with passkey" — chooses whether TyFi transacts from the
 * passkey wallet (biometric approval for every transaction, fees sponsored) or
 * from the linked extension account (approval in Freighter / WalletConnect).
 */
export const PasskeyApprovalToggle: React.FC<{ session: PasskeySession }> = ({ session }) => {
  const [mode, setMode] = useState<ApprovalMode>(getApprovalMode);
  const [linked, setLinked] = useState<string | null | undefined>(undefined);

  useEffect(() => onApprovalModeChange(setMode), []);
  useEffect(() => {
    getLinkedAccount(session.walletAddress).then(setLinked).catch(() => setLinked(null));
  }, [session.walletAddress]);

  const enabled = mode === 'passkey';
  const toggle = () => {
    const next: ApprovalMode = enabled ? 'extension' : 'passkey';
    setApprovalMode(next);
    capturePostHogEvent('passkey_approval_mode_changed', { mode: next });
  };

  return (
    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'}`}>
            {enabled ? <Fingerprint size={20} /> : <Puzzle size={20} />}
          </div>
          <div>
            <div className="text-sm font-black text-white">Approve transactions with passkey</div>
            <div className="text-xs text-slate-400">
              {enabled ? 'On — every transaction asks for your fingerprint, face or PIN.' : 'Off — your wallet extension approves transactions.'}
            </div>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="Approve transactions with passkey"
          onClick={toggle}
          className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
        >
          <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {linked === undefined ? null : linked ? (
        <p className="text-xs text-slate-400 leading-relaxed">
          When you connect with your linked account <span className="font-mono text-slate-200">{short(linked)}</span>,
          TyFi will {enabled
            ? <>switch to this passkey wallet, so <b className="text-slate-200">all transactions</b> — deposits, policies, claims, votes and payments — are approved with your passkey and TyFi pays the network fees.</>
            : <>stay on that account and ask your wallet extension to approve each transaction.</>}
        </p>
      ) : (
        <p className="text-xs text-slate-400 leading-relaxed">
          This wallet only has passkeys, so its transactions are always approved with your passkey. The setting matters once you
          link a Freighter or WalletConnect account (Settings → Passkey sign-in, while connected with that account).
        </p>
      )}
      <p className="text-[11px] text-slate-500">
        Funds stay where they are: the passkey wallet and your extension account are separate Stellar accounts.
      </p>
    </div>
  );
};

export default PasskeyApprovalToggle;
