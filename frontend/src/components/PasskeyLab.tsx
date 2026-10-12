import React, { useState } from 'react';
import { ArrowLeft, ExternalLink, Fingerprint, Layers, ServerCog, ShieldCheck } from 'lucide-react';

import { PasskeyOnboarding } from './PasskeyOnboarding';
import { PasskeyWalletCard } from './PasskeyWalletCard';
import { clearPasskeySession, loadPasskeySession, PASSKEY_STATIC_CONFIG, type CreatedWallet, type PasskeySession } from '../lib/passkey';

/**
 * Public prototype page (/passkey) for reviewers: create a seedless smart
 * account with device biometrics on Stellar Testnet, then authorize a real
 * transaction with it — no extension, no seed phrase, no XLM needed.
 */
export const PasskeyLab: React.FC = () => {
  const [session, setSession] = useState<PasskeySession | null>(() => loadPasskeySession());
  const [created, setCreated] = useState<CreatedWallet | undefined>();
  const explorer = PASSKEY_STATIC_CONFIG.explorerUrl;

  const steps = [
    { icon: Fingerprint, title: 'Device biometric', body: 'Your phone or laptop creates a passkey (secp256r1). The private key never leaves its secure chip.' },
    { icon: Layers, title: 'Factory deploys your wallet', body: 'smart_wallet_factory deploys a smart account bound to that passkey. Its address is derived from your public key.' },
    { icon: ShieldCheck, title: 'On-chain WebAuthn check', body: 'Every transaction is authorized by __check_auth, which verifies your WebAuthn signature with Protocol 21 secp256r1_verify.' },
    { icon: ServerCog, title: 'Sponsored fees', body: 'A TyFi relayer pays network fees. It can never authorize anything: only your passkey can.' },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        <a href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} /> Back to TyFi
        </a>

        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-black uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live on Stellar Testnet
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Seedless Passkey Wallet</h1>
          <p className="text-slate-400 max-w-2xl">
            Create a Stellar smart account with Face ID, Touch ID, Windows Hello or your phone’s fingerprint — then approve a real
            transaction with the same biometric. No seed phrase is ever created.
          </p>
        </header>

        <div className="grid md:grid-cols-[1.1fr_1fr] gap-8 items-start">
          <section className="glass-panel p-6 rounded-3xl border border-white/10 bg-slate-900/60">
            {session ? (
              <PasskeyWalletCard
                session={session}
                extraTxs={created?.fundingTxHash ? [{ label: 'Welcome test XLM (sponsor → wallet)', hash: created.fundingTxHash }] : []}
                onDisconnect={() => {
                  clearPasskeySession();
                  setSession(null);
                  setCreated(undefined);
                }}
              />
            ) : (
              <PasskeyOnboarding
                onConnected={(s, c) => {
                  setSession(s);
                  setCreated(c);
                }}
              />
            )}
          </section>

          <section className="space-y-4">
            {steps.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-sky-500/10 text-sky-300 flex items-center justify-center">
                  <Icon size={20} />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{title}</div>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">{body}</p>
                </div>
              </div>
            ))}

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-xs space-y-2">
              <div className="font-black uppercase tracking-widest text-slate-500">Deployed contracts</div>
              <a className="flex items-center justify-between text-sky-300 hover:text-sky-200" href={`${explorer}/contract/${PASSKEY_STATIC_CONFIG.factoryId}`} target="_blank" rel="noopener noreferrer">
                <span>smart_wallet_factory</span>
                <span className="font-mono flex items-center gap-1">{PASSKEY_STATIC_CONFIG.factoryId.slice(0, 8)}… <ExternalLink size={12} /></span>
              </a>
              <div className="flex items-center justify-between text-slate-400">
                <span>smart_wallet WASM</span>
                <span className="font-mono">{PASSKEY_STATIC_CONFIG.walletWasmHash.slice(0, 12)}…</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PasskeyLab;
