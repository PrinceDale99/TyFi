import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Fingerprint, KeyRound, Link2, Loader2, Unlink } from 'lucide-react';
import { StrKey } from '@stellar/stellar-sdk';

import {
  createSeedlessWallet,
  describePasskeyError,
  getLinkedAccount,
  getLinkedWallet,
  isPasskeySupported,
  linkPasskeyToAccount,
  PASSKEY_STATIC_CONFIG,
  signInWithPasskey,
  unlinkFromAccount,
  type LinkStage,
  type PasskeySession,
} from '../lib/passkey';
import { capturePostHogEvent } from '../lib/posthog';

interface PasskeyLinkCardProps {
  /** The connected address: a G… account (extension) or a C… passkey wallet. */
  walletAddress: string;
  network: 'testnet' | 'mainnet';
  /** Signs a transaction envelope with the connected extension wallet. */
  signEnvelope: (txXdr: string) => Promise<string>;
  /** Called after a successful link so the app can carry the profile over. */
  onLinked: (session: PasskeySession, account: string) => void | Promise<void>;
}

const STAGE_LABEL: Record<LinkStage | 'passkey_setup', string> = {
  passkey_setup: 'Set up your passkey — confirm with your fingerprint, face or PIN',
  preparing: 'Preparing the link…',
  passkey: 'Confirm with your fingerprint or face (approves for your passkey wallet)',
  account: 'Approve in your wallet extension (approves for this account)',
  confirming: 'Recording the link on Stellar…',
};

const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-6)}`;
const explorer = PASSKEY_STATIC_CONFIG.explorerUrl;

/**
 * Link the connected Freighter / WalletConnect / Albedo account to a seedless
 * passkey wallet, so the user can sign in with Face ID / fingerprint next time
 * and keep their TyFi profile. The link is recorded on-chain with consent from
 * both sides.
 */
export const PasskeyLinkCard: React.FC<PasskeyLinkCardProps> = ({ walletAddress, network, signEnvelope, onLinked }) => {
  const isPasskeyWallet = StrKey.isValidContract(walletAddress);
  const [linked, setLinked] = useState<string | null | undefined>(undefined);
  const [stage, setStage] = useState<LinkStage | 'passkey_setup' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLinked(isPasskeyWallet ? await getLinkedAccount(walletAddress) : await getLinkedWallet(walletAddress));
    } catch {
      setLinked(null);
    }
  }, [walletAddress, isPasskeyWallet]);

  useEffect(() => {
    setLinked(undefined);
    refresh();
  }, [refresh]);

  if (network !== 'testnet' || !walletAddress) return null;

  const link = async (mode: 'create' | 'existing') => {
    setError(null);
    setTxHash(null);
    try {
      setStage('passkey_setup');
      const session =
        mode === 'create'
          ? (await createSeedlessWallet(`TyFi · ${short(walletAddress)}`)).session
          : await signInWithPasskey();
      const hash = await linkPasskeyToAccount(session, walletAddress, signEnvelope, setStage);
      setTxHash(hash);
      capturePostHogEvent('passkey_account_linked', { mode });
      await onLinked(session, walletAddress);
      await refresh();
    } catch (err) {
      setError(describePasskeyError(err));
    } finally {
      setStage(null);
    }
  };

  const unlink = async () => {
    if (!linked) return;
    setError(null);
    try {
      setStage('account');
      setTxHash(await unlinkFromAccount(linked, walletAddress, signEnvelope));
      capturePostHogEvent('passkey_account_unlinked');
      await refresh();
    } catch (err) {
      setError(describePasskeyError(err));
    } finally {
      setStage(null);
    }
  };

  return (
    <div className="glass-panel p-5 border border-violet-500/20 bg-violet-500/[0.03] space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-violet-500/10 text-violet-300">
          <Fingerprint size={18} />
        </div>
        <div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Passkey sign-in</h3>
          <p className="text-sm text-white font-bold">
            {isPasskeyWallet ? 'Seedless passkey wallet' : 'Sign in with Face ID / fingerprint instead of an extension'}
          </p>
        </div>
      </div>

      {linked === undefined && <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Checking links…</p>}

      {isPasskeyWallet && linked !== undefined && (
        <p className="text-sm text-slate-300">
          {linked ? (
            <>Linked to your account{' '}
              <a className="font-mono text-violet-300 hover:text-violet-200" href={`${explorer}/account/${linked}`} target="_blank" rel="noopener noreferrer">{short(linked)}</a>.
              To unlink, connect that account with its wallet extension.</>
          ) : (
            <>Not linked to another account. To link one, connect it with Freighter or WalletConnect and open this panel there.</>
          )}
        </p>
      )}

      {!isPasskeyWallet && linked && !stage && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
          <span className="text-sm text-slate-200 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" /> Linked passkey wallet{' '}
            <a className="font-mono text-violet-300 hover:text-violet-200" href={`${explorer}/contract/${linked}`} target="_blank" rel="noopener noreferrer">{short(linked)}</a>
          </span>
          <button onClick={unlink} className="text-xs font-bold text-rose-300 hover:text-rose-200 flex items-center gap-1">
            <Unlink size={14} /> Unlink
          </button>
        </div>
      )}

      {!isPasskeyWallet && linked === null && !stage && (
        isPasskeySupported() ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 leading-relaxed">
              Link a passkey to this account. Next time you can sign in with just your fingerprint or face — no extension, no seed phrase —
              and your TyFi profile comes with you. Funds in this account stay here; your passkey wallet is a separate Stellar smart account.
            </p>
            <button onClick={() => link('create')} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-violet-500/20 border border-violet-500/40 hover:border-violet-400 text-sm font-black text-white">
              <Link2 size={16} /> Create a passkey and link it
            </button>
            <button onClick={() => link('existing')} className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-white/10 text-sm font-bold text-slate-200 hover:bg-white/5">
              <KeyRound size={16} /> Link a passkey wallet I already have
            </button>
          </div>
        ) : (
          <p className="text-xs text-amber-200">This browser can’t use passkeys. Try an up-to-date Chrome, Safari or Edge.</p>
        )
      )}

      {stage && (
        <p className="text-sm text-violet-200 flex items-center gap-2" aria-live="polite">
          <Loader2 size={16} className="animate-spin" /> {STAGE_LABEL[stage]}
        </p>
      )}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {txHash && (
        <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1">
          View the on-chain link transaction <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
};

export default PasskeyLinkCard;
