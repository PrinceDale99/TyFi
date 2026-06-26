import React from 'react';
import { X, Shield, Activity, ChevronRight, Smartphone, Globe } from 'lucide-react';
import { FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { ALBEDO_ID } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { WALLET_CONNECT_ID } from '@creit.tech/stellar-wallets-kit/modules/wallet-connect';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (walletId: string) => void;
  network?: 'testnet' | 'mainnet';
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onConnect, network = 'testnet' }) => {
  if (!isOpen) return null;

  const isMainnet = network === 'mainnet';

  const handleConnect = async (walletId: string) => {
    try {
      onConnect(walletId);
      onClose();
    } catch (err) {
      console.error("Connection error:", err);
      alert("An error occurred while connecting to the wallet.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-slate-900/60 backdrop-blur-2xl rounded-3xl p-8 md:p-10 border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Animated Glow Backdrops */}
        <div className={`absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none ${isMainnet ? 'bg-emerald-500' : 'bg-sky-500'}`} />
        <div className={`absolute -bottom-32 -left-32 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none ${isMainnet ? 'bg-emerald-500' : 'bg-sky-500'}`} />

        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 text-slate-400 hover:text-white transition-all z-10"
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
            <h3 className="text-3xl font-black text-white mb-3 tracking-tight">Connect Wallet</h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
              Select your preferred Stellar wallet to interact with the Vault on <span className={isMainnet ? 'text-emerald-400 font-bold' : 'text-sky-400 font-bold'}>{isMainnet ? 'Production Mainnet' : 'Developer Testnet'}</span>.
            </p>
          </div>

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

            {!isMainnet && (
              <button
                onClick={() => {
                  onConnect("DEMO_TESTNET_STEL...VAULT");
                  onClose();
                }}
                className="w-full flex items-center justify-between p-5 rounded-2xl transition-all group border bg-sky-500/10 border-sky-500/30 hover:bg-sky-500/20 hover:border-sky-500/60 shadow-[0_0_20px_rgba(14,165,233,0.1)] relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-sky-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-sky-500 text-white shadow-lg shadow-sky-500/30 group-hover:scale-110 transition-transform">
                    <Activity size={24} strokeWidth={1.5} />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-white text-lg tracking-wide">Demo Mode</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mt-0.5">Explore without wallet</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-sky-400/50 group-hover:text-white transition-colors relative z-10" />
              </button>
            )}

          </div>

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
