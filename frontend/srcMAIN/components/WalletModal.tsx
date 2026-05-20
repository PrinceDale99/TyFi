import React from 'react';
import { X, Shield, Activity, ChevronRight } from 'lucide-react';
import { isConnected, getAddress, setAllowed } from "@stellar/freighter-api";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (address: string) => void;
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onConnect }) => {
  if (!isOpen) return null;

  const handleFreighterConnect = async () => {
    try {
      // 1. Check if Freighter is installed
      const connected = await isConnected();
      if (!connected) {
        window.open("https://chromewebstore.google.com/detail/freighter/kaojnmgeecghoocplkaeoojagghgocho", "_blank");
        return;
      }

      // 2. Trigger authorization / unlock dialogue
      // This will open the Freighter popup if the user is locked or not authorized
      const allowed = await setAllowed();
      
      if (!allowed) {
        // User might have closed the window or rejected
        return;
      }

      // 4. Get the address
      const { address, error } = await getAddress();
      
      if (address) {
        onConnect(address);
        onClose();
      } else {
        console.error("Freighter error:", error);
        if (error && error.includes("User declined")) {
          // Silent fail or toast if user explicitly declined
          return;
        }
        alert("Failed to get address from Freighter. Please make sure you are logged in.");
      }
    } catch (err) {
      console.error("Connection error:", err);
      alert("An error occurred while connecting to Freighter.");
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
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
            <Shield className="text-blue-400" size={32} />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white mb-2">Connect Wallet</h3>
            <p className="text-slate-400 text-sm">
              Select your preferred Stellar wallet to interact with the Resilience Vault.
            </p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button
              onClick={handleFreighterConnect}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/50 transition-all group"
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
                  <div className="font-bold text-white group-hover:text-blue-400 transition-colors">Freighter Wallet</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Stellar Network</div>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            </button>

            <button
              onClick={() => {
                onConnect("DEMO_MODE_STEL...RESILIENCE");
                onClose();
              }}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-500/20 rounded-lg flex items-center justify-center">
                  <Activity size={20} className="text-sky-400" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-white group-hover:text-sky-400 transition-colors">Demo Mode</div>
                  <div className="text-[10px] text-sky-500 font-bold uppercase">Explore without wallet</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-sky-500/50 group-hover:text-sky-400 transition-colors" />
            </button>

            <button
              disabled
              className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 opacity-50 cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                  <Shield size={20} className="text-slate-500" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-slate-500">Other Wallets</div>
                  <div className="text-[10px] text-slate-600 font-bold uppercase">Coming Soon</div>
                </div>
              </div>
            </button>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            By connecting your wallet, you agree to the protocol's 
            <span className="text-blue-400 hover:underline cursor-pointer mx-1">Terms of Service</span> 
            and automated payout triggers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
