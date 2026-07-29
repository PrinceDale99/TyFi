import React, { useState, useEffect } from 'react';
import { Wallet, CheckCircle2, Save, Zap, AlertTriangle, X } from 'lucide-react';
import axios from 'axios';

interface PaymentSetupProps {
  isMainnet: boolean;
  walletAddress: string;
}

export const PaymentSetup: React.FC<PaymentSetupProps> = ({ isMainnet, walletAddress }) => {
  const [isAutoCollectEnabled, setIsAutoCollectEnabled] = useState(false);
  const [showAutoCollectModal, setShowAutoCollectModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      setIsLoading(true);
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://tyfi-yzbn.onrender.com';
        const response = await axios.get(`${backendUrl}/api/preferences/${walletAddress}`);
        const prefs = response.data;
        if (prefs && Object.keys(prefs).length > 0) {
          setIsAutoCollectEnabled(prefs.is_auto_collect_enabled || false);
        } else {
          const saved = localStorage.getItem(`typhoon_vault_payment_${walletAddress}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            setIsAutoCollectEnabled(parsed.autoCollect || false);
          }
        }
      } catch (error) {
        console.error('Failed to load preferences from backend, falling back to local storage', error);
        const saved = localStorage.getItem(`typhoon_vault_payment_${walletAddress}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setIsAutoCollectEnabled(parsed.autoCollect || false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (walletAddress) {
      loadPreferences();
    }
  }, [walletAddress]);

  const handleSave = async (override?: any) => {
    const autoCol = override?.isAutoCollectEnabled !== undefined ? override.isAutoCollectEnabled : isAutoCollectEnabled;

    const config = {
      method: 'wallet',
      provider: null,
      accountNumber: null,
      accountName: null,
      autoCollect: autoCol,
    };

    // Save to LocalStorage fallback
    localStorage.setItem(`typhoon_vault_payment_${walletAddress}`, JSON.stringify(config));

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://tyfi-yzbn.onrender.com';
      await axios.post(`${backendUrl}/api/preferences`, {
        walletAddress,
        paymentMethod: 'wallet',
        fiatProvider: null,
        accountNumber: null,
        accountName: null,
        isAutoCollectEnabled: autoCol,
      });
    } catch (error) {
      console.error('Failed to save to backend', error);
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleToggleAutoCollect = () => {
    if (!isAutoCollectEnabled) {
      setShowAutoCollectModal(true);
    } else {
      setIsAutoCollectEnabled(false);
      handleSave({ isAutoCollectEnabled: false });
    }
  };

  if (isLoading) {
    return <div className="text-slate-400 p-8 text-center animate-pulse">Loading preferences...</div>;
  }

  return (
    <div className="space-y-6 relative">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Payout Configuration</h2>
        <p className="text-sm text-slate-400">Configure how you receive your parametric payouts when a weather trigger executes.</p>
      </div>

      {/* Web3 Wallet — only payout method */}
      <div
        className={`relative p-6 rounded-2xl border text-left ${
          isMainnet
            ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]'
            : 'bg-sky-500/10 border-sky-500 shadow-[0_0_30px_rgba(14,165,233,0.1)]'
        }`}
      >
        <div className={`absolute top-4 right-4 ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`}>
          <CheckCircle2 size={24} />
        </div>
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
            isMainnet ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'
          }`}
        >
          <Wallet size={24} />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Direct to TyFi Wallet</h3>
        <p className="text-sm text-slate-400">
          Receive payouts directly in XLM to your connected Freighter wallet. Fully on-chain, no third-party bridge required.
        </p>
      </div>

      {/* Automation Settings */}
      <div className="glass-panel p-6 border border-white/10 rounded-2xl flex items-center justify-between gap-6">
        <div>
          <h3 className="text-md font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-1">
            <Zap size={16} className={isAutoCollectEnabled ? 'text-amber-400' : 'text-slate-500'} />
            Auto Collect Payouts
          </h3>
          <p className="text-sm text-slate-400 max-w-xl">
            Automatically claim and route funds to your connected wallet when a parametric weather trigger is met.
          </p>
        </div>
        <button
          onClick={handleToggleAutoCollect}
          className={`relative w-14 h-8 rounded-full transition-colors flex items-center px-1 shrink-0 ${
            isAutoCollectEnabled ? (isMainnet ? 'bg-emerald-500' : 'bg-sky-500') : 'bg-slate-700'
          }`}
        >
          <div className={`w-6 h-6 rounded-full bg-white transition-transform duration-300 ${isAutoCollectEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          className={`px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 transition-all ${
            isSaved
              ? 'bg-green-500 text-white'
              : isMainnet
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
          }`}
        >
          {isSaved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {isSaved ? 'Configuration Saved' : 'Save Payout Configuration'}
        </button>
      </div>

      {/* Auto-Collect Confirmation Modal */}
      {showAutoCollectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in zoom-in-95">
            <button
              onClick={() => setShowAutoCollectModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-black text-white">Enable Auto-Collect</h3>
            </div>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              By enabling this feature, you authorize the TyFi Oracle to automatically trigger claim payouts on your behalf when
              a weather trigger is met. Your payout will be routed directly to your connected TyFi Wallet.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAutoCollectModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 font-bold hover:bg-white/5 transition-all text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsAutoCollectEnabled(true);
                  setShowAutoCollectModal(false);
                  handleSave({ isAutoCollectEnabled: true });
                }}
                className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                  isMainnet ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                }`}
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
