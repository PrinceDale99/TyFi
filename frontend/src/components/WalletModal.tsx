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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm glass-panel p-8 border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center gap-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-700 ${
            isMainnet 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-sky-500/10 border-sky-500/20 text-sky-400'
          }`}>
            <Shield size={32} />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white mb-2">Connect Wallet</h3>
            <p className="text-slate-400 text-sm">
              Select your preferred Stellar wallet to interact with the Resilience Vault on <span className={isMainnet ? 'text-emerald-400 font-bold' : 'text-sky-400 font-bold'}>{isMainnet ? 'Mainnet' : 'Testnet'}</span>.
            </p>
          </div>

          <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-left space-y-1.5 w-full">
            <div className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
              isMainnet ? 'text-emerald-400' : 'text-sky-400'
            }`}>
              <Activity size={12} />
              Native XLM Flow
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Funding premium policies directly decreases your Freighter wallet's <span className="font-bold text-white">XLM</span> balance. Approved weather claims will instantly deposit native <span className="font-bold text-white">XLM</span> directly back into your wallet.
            </p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button
              onClick={() => handleConnect(FREIGHTER_ID)}
              className={`w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group ${
                isMainnet ? 'hover:border-emerald-500/50' : 'hover:border-sky-500/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#211b5a] rounded-lg flex items-center justify-center">
                  <img 
                    src="https://www.freighter.app/static/media/freighter-logo.71c50826.svg" 
                    alt="Freighter" 
                    className="w-6 h-6"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://cryptologos.cc/logos/stellar-xlm-logo.png';
                    }}
                  />
                </div>
                <div className="text-left">
                  <div className={`font-bold text-white transition-colors ${
                    isMainnet ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
                  }`}>Freighter Wallet</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Stellar Network</div>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            </button>

            <button
              onClick={() => handleConnect(WALLET_CONNECT_ID)}
              className={`w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group ${
                isMainnet ? 'hover:border-emerald-500/50' : 'hover:border-sky-500/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400">
                  <Smartphone size={20} />
                </div>
                <div className="text-left">
                  <div className={`font-bold text-white transition-colors ${
                    isMainnet ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
                  }`}>WalletConnect (Mobile)</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">LOBSTR, xBull, etc.</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-500 group-hover:text-white transition-colors" />
            </button>

            <button
              onClick={() => handleConnect(ALBEDO_ID)}
              className={`w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group ${
                isMainnet ? 'hover:border-emerald-500/50' : 'hover:border-sky-500/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-500/20 rounded-lg flex items-center justify-center text-sky-400">
                  <Globe size={20} />
                </div>
                <div className="text-left">
                  <div className={`font-bold text-white transition-colors ${
                    isMainnet ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
                  }`}>Albedo</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Web Wallet</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-500 group-hover:text-white transition-colors" />
            </button>

            {!isMainnet && (
              <button
                onClick={() => {
                  onConnect("DEMO_TESTNET_STEL...VAULT");
                  onClose();
                }}
                className="w-full flex items-center justify-between p-4 rounded-xl transition-all group border bg-sky-500/10 border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-sky-500/20 text-sky-400">
                    <Activity size={20} />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-white transition-colors group-hover:text-sky-400">Demo Mode</div>
                    <div className="text-[10px] font-bold uppercase text-sky-400">Explore without wallet</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-sky-500/50 group-hover:text-sky-400 transition-colors" />
              </button>
            )}


          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            By connecting your wallet, you agree to the protocol's 
            <span className={`hover:underline cursor-pointer mx-1 transition-colors ${
              isMainnet ? 'text-emerald-400' : 'text-sky-400'
            }`}>Terms of Service</span> 
            and automated payout triggers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
