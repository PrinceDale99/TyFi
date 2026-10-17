import React from 'react';
import { X, Shield, Compass, Wallet, ChevronRight, Smartphone, Globe } from 'lucide-react';
import { FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { ALBEDO_ID } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { WALLET_CONNECT_ID } from '@creit.tech/stellar-wallets-kit/modules/wallet-connect';
import { capturePostHogEvent, logPostHogInfo } from '../lib/posthog';
import { PasskeyOnboarding } from './PasskeyOnboarding';
import type { PasskeySession } from '../lib/passkey';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (walletId: string) => void;
  /** Called when a seedless passkey wallet is created or signed in (testnet). */
  onPasskeyConnected?: (session: PasskeySession) => void;
  /** Demo version 1 (testnet): explore with a simulated account, no wallet, no Didit. */
  onDemoSandbox?: () => void;
  /** Demo version 2 (testnet): connect a real wallet via the Stellar Wallets Kit, no Didit. */
  onDemoWallet?: () => void;
  network?: 'testnet' | 'mainnet';
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onConnect, onPasskeyConnected, onDemoSandbox, onDemoWallet, network = 'testnet' }) => {
  // Hooks must run before the early return so the hook order is stable across open/close.
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMainnet = network === 'mainnet';

  const handleConnect = async (walletId: string) => {
    try {
      setError(null);
      onConnect(walletId);
      const walletProvider = walletId === FREIGHTER_ID ? 'freighter' : walletId === WALLET_CONNECT_ID ? 'walletconnect' : walletId === ALBEDO_ID ? 'albedo' : 'in_app';
      capturePostHogEvent('wallet_connection_selected', {
        wallet_provider: walletProvider,
        network,
      });
      logPostHogInfo('wallet connection selected', {
        wallet_provider: walletProvider,
        network,
      });
      onClose();
    } catch (err) {
      console.error("Connection error:", err);
      setError("An error occurred while connecting to the wallet.");
    }
  };

  const handleDemo = (version: 'sandbox' | 'wallet') => {
    capturePostHogEvent('wallet_connection_selected', { wallet_provider: `demo_${version}`, network });
    logPostHogInfo('wallet connection selected', { wallet_provider: `demo_${version}`, network });
    // Close first: the wallet demo opens the Stellar Wallets Kit's own modal.
    onClose();
    if (version === 'sandbox') onDemoSandbox?.();
    else onDemoWallet?.();
  };

  const showDemo = !isMainnet && (onDemoSandbox || onDemoWallet);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-slate-900/60 backdrop-blur-2xl rounded-3xl p-6 md:p-10 border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300">
        
        {/* Animated Glow Backdrops */}
        <div className={`absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none ${isMainnet ? 'bg-emerald-500' : 'bg-sky-500'}`} />
        <div className={`absolute -bottom-32 -left-32 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none ${isMainnet ? 'bg-emerald-500' : 'bg-sky-500'}`} />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 md:top-6 md:right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 text-slate-400 hover:text-white transition-all z-20"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center gap-8 relative z-10">
          <div className="relative">
            <div className={`absolute inset-0 rounded-3xl blur-xl opacity-50 animate-pulse ${
              isMainnet ? 'bg-emerald-500' : 'bg-sky-500'
            }`} />
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center border transition-all duration-700 relative bg-slate-950 ${
              isMainnet ? 'border-emerald-500/50 text-emerald-400' : 'border-sky-500/50 text-sky-400'
            }`}>
              <Shield size={36} strokeWidth={1.5} />
            </div>
          </div>

          <div>
            <h3 id="wallet-modal-title" className="text-3xl font-black text-white mb-3 tracking-tight">Connect Wallet</h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
              Select your preferred Stellar wallet to interact with the Vault on <span className={isMainnet ? 'text-emerald-400 font-bold' : 'text-sky-400 font-bold'}>{isMainnet ? 'Production Mainnet' : 'Developer Testnet'}</span>.
            </p>
            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                {error}
              </div>
            )}
          </div>

          {!isMainnet && onPasskeyConnected && (
            <div className="w-full text-left">
              <PasskeyOnboarding
                onConnected={session => {
                  onPasskeyConnected(session);
                  onClose();
                }}
              />
              <div className="flex items-center gap-3 mt-6 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span className="flex-1 h-px bg-white/10" /> or use a wallet extension <span className="flex-1 h-px bg-white/10" />
              </div>
            </div>
          )}

          <div className="w-full flex flex-col gap-4 mt-2">
            <button
              onClick={() => handleConnect(FREIGHTER_ID)}
              className={`w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition-all group overflow-hidden relative ${
                isMainnet ? 'hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]' : 'hover:border-sky-500/50 hover:shadow-[0_0_30px_rgba(14,165,233,0.15)]'
              }`}
            >
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r ${isMainnet ? 'from-emerald-500 to-transparent' : 'from-sky-500 to-transparent'}`} />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shadow-lg border border-white/5 group-hover:scale-110 transition-transform">
                  <img 
                    src="https://www.freighter.app/static/media/freighter-logo.71c50826.svg" 
                    alt="Freighter" 
                    className="w-7 h-7"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://cryptologos.cc/logos/stellar-xlm-logo.png';
                    }}
                  />
                </div>
                <div className="text-left">
                  <div className="font-black text-white text-lg tracking-wide group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-400 transition-all">Freighter</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Recommended Extension</div>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-600 group-hover:text-white transition-colors relative z-10" />
            </button>

            <button
              onClick={() => handleConnect(WALLET_CONNECT_ID)}
              className={`w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition-all group overflow-hidden relative ${
                isMainnet ? 'hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]' : 'hover:border-sky-500/50 hover:shadow-[0_0_30px_rgba(14,165,233,0.15)]'
              }`}
            >
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r ${isMainnet ? 'from-emerald-500 to-transparent' : 'from-sky-500 to-transparent'}`} />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 shadow-lg border border-indigo-500/20 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                  <Smartphone size={24} strokeWidth={1.5} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-white text-lg tracking-wide">WalletConnect</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Mobile • LOBSTR</div>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-600 group-hover:text-white transition-colors relative z-10" />
            </button>

            <button
              onClick={() => handleConnect(ALBEDO_ID)}
              className={`w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition-all group overflow-hidden relative ${
                isMainnet ? 'hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]' : 'hover:border-sky-500/50 hover:shadow-[0_0_30px_rgba(14,165,233,0.15)]'
              }`}
            >
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r ${isMainnet ? 'from-emerald-500 to-transparent' : 'from-sky-500 to-transparent'}`} />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-400 shadow-lg border border-sky-500/20 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white transition-all">
                  <Globe size={24} strokeWidth={1.5} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-white text-lg tracking-wide">Albedo</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Web Wallet</div>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-600 group-hover:text-white transition-colors relative z-10" />
            </button>

          </div>

          {showDemo && (
            <div className="w-full text-left">
              <div className="flex items-center gap-3 mb-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span className="flex-1 h-px bg-white/10" /> or try the demo <span className="flex-1 h-px bg-white/10" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {onDemoSandbox && (
                  <button
                    type="button"
                    onClick={() => handleDemo('sandbox')}
                    className="flex flex-col gap-3 p-4 rounded-2xl text-left transition-all group border bg-sky-500/10 border-sky-500/30 hover:bg-sky-500/20 hover:border-sky-500/60 shadow-[0_0_20px_rgba(14,165,233,0.1)]"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-500 text-white shadow-lg shadow-sky-500/30 group-hover:scale-110 transition-transform">
                      <Compass size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="font-bold text-white tracking-wide">Explore Demo</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mt-0.5">No wallet needed</div>
                      <p className="text-[11px] text-slate-400 leading-snug mt-2">Simulated account. Nothing is signed or sent on-chain.</p>
                    </div>
                  </button>
                )}
                {onDemoWallet && (
                  <button
                    type="button"
                    onClick={() => handleDemo('wallet')}
                    className="flex flex-col gap-3 p-4 rounded-2xl text-left transition-all group border bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 hover:border-indigo-500/60 shadow-[0_0_20px_rgba(99,102,241,0.1)]"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform">
                      <Wallet size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="font-bold text-white tracking-wide">Demo with My Wallet</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 mt-0.5">Any Stellar wallet</div>
                      <p className="text-[11px] text-slate-400 leading-snug mt-2">Real testnet transactions from your own wallet.</p>
                    </div>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-3 text-center">Both demos skip identity verification (Didit) and run on testnet only.</p>
            </div>
          )}

          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mt-2">
            By connecting, you agree to the protocol's 
            <span className={`hover:underline cursor-pointer mx-1 transition-colors ${
              isMainnet ? 'text-emerald-400' : 'text-sky-400'
            }`}>Terms of Service</span> 
            and automated ZK triggers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
