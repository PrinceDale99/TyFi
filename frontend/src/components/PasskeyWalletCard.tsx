import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Fingerprint, Loader2, LogOut, RefreshCw, Send } from 'lucide-react';

import {
  describePasskeyError,
  getXlmBalance,
  invokeWithPasskey,
  parseXlmAmount,
  PASSKEY_STATIC_CONFIG,
  xlmTransfer,
  type AuthorizeStage,
  type PasskeySession,
} from '../lib/passkey';
import { capturePostHogEvent } from '../lib/posthog';

interface PasskeyWalletCardProps {
  session: PasskeySession;
  /** Extra transaction links to show (e.g. welcome funding). */
  extraTxs?: { label: string; hash: string }[];
  onDisconnect?: () => void;
}

const STAGE_LABEL: Record<AuthorizeStage, string> = {
  simulation: 'Preparing payment…',
  wallet_signing: 'Confirm the payment with your fingerprint or face',
  submission: 'Sending on Stellar — TyFi pays the fee…',
};

const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-6)}`;

/** A connected seedless wallet: address, balance, proofs and a biometric-signed payment. */
export const PasskeyWalletCard: React.FC<PasskeyWalletCardProps> = ({ session, extraTxs = [], onDisconnect }) => {
  const explorer = PASSKEY_STATIC_CONFIG.explorerUrl;
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('1');
  const [stage, setStage] = useState<AuthorizeStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<{ hash: string; amount: string }[]>([]);

  const refresh = useCallback(async () => {
    try {
      setBalance(await getXlmBalance(session.walletAddress));
    } catch {
      setBalance(null);
    }
  }, [session.walletAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const copy = async () => {
    await navigator.clipboard.writeText(session.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const send = async () => {
    setError(null);
    try {
      const stroops = parseXlmAmount(amount);
      const hostFunction = xlmTransfer(session.walletAddress, to.trim(), stroops);
      const result = await invokeWithPasskey(session, hostFunction, setStage);
      setPayments(p => [{ hash: result.hash, amount }, ...p]);
      capturePostHogEvent('passkey_payment_sent', { amount_xlm: Number(amount) });
      refresh();
    } catch (err) {
      setError(describePasskeyError(err));
    } finally {
      setStage(null);
    }
  };

  const txLinks = [
    ...(session.createdTxHash ? [{ label: 'Wallet created by factory', hash: session.createdTxHash }] : []),
    ...extraTxs,
    ...payments.map(p => ({ label: `Passkey-signed payment · ${p.amount} XLM`, hash: p.hash })),
  ];

  return (
    <div className="space-y-5">
      <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <Fingerprint size={22} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-emerald-300">Seedless passkey wallet</div>
              <button onClick={copy} className="font-mono text-sm text-white hover:text-emerald-200 flex items-center gap-1.5" title="Copy address">
                {short(session.walletAddress)} {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-white">{balance === null ? '—' : balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
            <button onClick={refresh} className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-white flex items-center gap-1 ml-auto">
              XLM <RefreshCw size={10} />
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <a href={`${explorer}/contract/${session.walletAddress}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-300 hover:text-sky-200">
            View wallet on Stellar Expert <ExternalLink size={12} />
          </a>
          {onDisconnect && (
            <button onClick={onDisconnect} className="flex items-center gap-1 text-slate-400 hover:text-white ml-auto">
              <LogOut size={12} /> Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
        <div className="text-sm font-black text-white">Send XLM — approved with your biometrics</div>
        <input
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="Recipient address (G… or C…)"
          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder:text-slate-500 focus:border-sky-500 outline-none"
        />
        <div className="flex gap-3">
          <input
            value={amount}
            onChange={e => setAmount(e.target.value)}
            inputMode="decimal"
            className="w-32 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-sky-500 outline-none"
          />
          <button
            onClick={send}
            disabled={!!stage || !to.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black uppercase tracking-wider"
          >
            {stage ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send
          </button>
        </div>
        {stage && <p className="text-sm text-sky-200" aria-live="polite">{STAGE_LABEL[stage]}</p>}
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      </div>

      {txLinks.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">On-chain proof</div>
          {txLinks.map(tx => (
            <a
              key={tx.hash}
              href={`${explorer}/tx/${tx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-sky-500/30 text-sm"
            >
              <span className="text-slate-200">{tx.label}</span>
              <span className="font-mono text-xs text-sky-300 flex items-center gap-1">{short(tx.hash)} <ExternalLink size={12} /></span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default PasskeyWalletCard;
