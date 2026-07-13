import React, { useState, useEffect } from 'react';
import { Wallet, Smartphone, Building, CheckCircle2, ChevronRight, Save, Zap, AlertTriangle, X } from 'lucide-react';
import axios from 'axios';

interface PaymentSetupProps {
  isMainnet: boolean;
  walletAddress: string;
}

export const PaymentSetup: React.FC<PaymentSetupProps> = ({ isMainnet, walletAddress }) => {
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'fiat'>('wallet');
  const [fiatProvider, setFiatProvider] = useState<'gcash' | 'paymaya'>('gcash');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isAutoCollectEnabled, setIsAutoCollectEnabled] = useState(false);
  const [showAutoCollectModal, setShowAutoCollectModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/preferences/${walletAddress}`);
        const prefs = response.data;
        if (prefs && Object.keys(prefs).length > 0) {
          setPaymentMethod(prefs.payment_method || 'wallet');
          if (prefs.payment_method === 'fiat') {
            setFiatProvider(prefs.fiat_provider || 'gcash');
            setAccountNumber(prefs.account_number || '');
            setAccountName(prefs.account_name || '');
          }
          setIsAutoCollectEnabled(prefs.is_auto_collect_enabled || false);
        } else {
          // Fallback to local storage if not found in DB
          const saved = localStorage.getItem(`typhoon_vault_payment_${walletAddress}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            setPaymentMethod(parsed.method || 'wallet');
            if (parsed.method === 'fiat') {
              setFiatProvider(parsed.provider || 'gcash');
              setAccountNumber(parsed.accountNumber || '');
              setAccountName(parsed.accountName || '');
            }
            setIsAutoCollectEnabled(parsed.autoCollect || false);
          }
        }
      } catch (error) {
        console.error("Failed to load preferences from backend, falling back to local storage", error);
        const saved = localStorage.getItem(`typhoon_vault_payment_${walletAddress}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setPaymentMethod(parsed.method || 'wallet');
          if (parsed.method === 'fiat') {
            setFiatProvider(parsed.provider || 'gcash');
            setAccountNumber(parsed.accountNumber || '');
            setAccountName(parsed.accountName || '');
          }
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

  const handleSave = async () => {
    const config = {
      method: paymentMethod,
      provider: paymentMethod === 'fiat' ? fiatProvider : null,
      accountNumber: paymentMethod === 'fiat' ? accountNumber : null,
      accountName: paymentMethod === 'fiat' ? accountName : null,
      autoCollect: isAutoCollectEnabled
    };
    
    // Save to LocalStorage fallback
    localStorage.setItem(`typhoon_vault_payment_${walletAddress}`, JSON.stringify(config));
    
    try {
      // Save to Supabase via Backend API
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/preferences`, {
        walletAddress,
        paymentMethod,
        fiatProvider: paymentMethod === 'fiat' ? fiatProvider : null,
        accountNumber: paymentMethod === 'fiat' ? accountNumber : null,
        accountName: paymentMethod === 'fiat' ? accountName : null,
        isAutoCollectEnabled
      });
    } catch (error) {
      console.error("Failed to save to backend", error);
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleToggleAutoCollect = () => {
    if (!isAutoCollectEnabled) {
      setShowAutoCollectModal(true);
    } else {
      setIsAutoCollectEnabled(false);
    }
  };

  if (isLoading) {
    return <div className="text-slate-400 p-8 text-center animate-pulse">Loading preferences...</div>;
  }

  return (
    <div className="space-y-6 relative">
      {/* Auto Collect Modal */}
      {showAutoCollectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-amber-500">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-black uppercase tracking-wider">Enable Auto Collect?</h3>
            </div>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              By enabling Auto Collect, you authorize the protocol to automatically process your claim and withdraw funds to your selected payment method the moment a typhoon trigger is met. You will not need to manually claim it.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowAutoCollectModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 font-bold hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setIsAutoCollectEnabled(true);
                  setShowAutoCollectModal(false);
                }}
                className={`flex-1 py-3 rounded-xl font-bold transition-colors ${isMainnet ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-sky-500 hover:bg-sky-400 text-slate-950'}`}
              >
                Authorize
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Payout Configuration</h2>
        <p className="text-sm text-slate-400">Configure how you receive your parametric payouts when a weather trigger executes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Web3 Native Option */}
        <button
          onClick={() => setPaymentMethod('wallet')}
          className={`relative p-6 rounded-2xl border text-left transition-all duration-300 ${
            paymentMethod === 'wallet'
              ? isMainnet ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'bg-sky-500/10 border-sky-500 shadow-[0_0_30px_rgba(14,165,233,0.1)]'
              : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
          }`}
        >
          {paymentMethod === 'wallet' && (
            <div className={`absolute top-4 right-4 ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`}>
              <CheckCircle2 size={24} />
            </div>
          )}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
            paymentMethod === 'wallet' 
              ? isMainnet ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'
              : 'bg-white/10 text-slate-300'
          }`}>
            <Wallet size={24} />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Direct to Wallet</h3>
          <p className="text-sm text-slate-400">Receive payouts directly in USDC or XLM to your connected Freighter wallet.</p>
        </button>

        {/* Fiat Bridge Option */}
        <button
          onClick={() => setPaymentMethod('fiat')}
          className={`relative p-6 rounded-2xl border text-left transition-all duration-300 ${
            paymentMethod === 'fiat'
              ? isMainnet ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'bg-sky-500/10 border-sky-500 shadow-[0_0_30px_rgba(14,165,233,0.1)]'
              : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
          }`}
        >
          {paymentMethod === 'fiat' && (
            <div className={`absolute top-4 right-4 ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`}>
              <CheckCircle2 size={24} />
            </div>
          )}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
            paymentMethod === 'fiat' 
              ? isMainnet ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'
              : 'bg-white/10 text-slate-300'
          }`}>
            <Building size={24} />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">InstaPay / E-Wallet</h3>
          <p className="text-sm text-slate-400">Auto-convert yield to PHP and route directly to GCash or PayMaya via PDAX.</p>
        </button>
      </div>

      {paymentMethod === 'fiat' && (
        <div className="glass-panel p-6 border border-white/10 animate-in fade-in slide-in-from-top-4 duration-500 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-md font-bold text-white uppercase tracking-widest">Fiat Routing Details</h3>
            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              <span className="text-[10px] text-blue-200 uppercase font-bold tracking-widest">Powered by</span>
              <span className="text-xs font-black text-blue-400 tracking-tighter">PDAX</span>
            </div>
          </div>
          
          <div className="space-y-5">
            <div className="form-group">
              <label className="text-xs mb-2 block text-slate-300 font-bold uppercase tracking-wider">Provider</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setFiatProvider('gcash')}
                  className={`flex-1 py-3 px-4 rounded-xl border font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                    fiatProvider === 'gcash'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <Smartphone size={16} />
                  GCash
                </button>
                <button
                  onClick={() => setFiatProvider('paymaya')}
                  className={`flex-1 py-3 px-4 rounded-xl border font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                    fiatProvider === 'paymaya'
                      ? 'bg-green-600/20 border-green-500 text-green-400'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <Smartphone size={16} />
                  PayMaya
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="form-group">
                <label className="text-xs mb-2 block text-slate-300 font-bold uppercase tracking-wider">Account Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Juan Dela Cruz"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
              <div className="form-group">
                <label className="text-xs mb-2 block text-slate-300 font-bold uppercase tracking-wider">Mobile Number</label>
                <input 
                  type="text" 
                  placeholder="09XX XXX XXXX"
                  value={accountNumber}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length > 0 && val[0] !== '0') val = '0' + val;
                    if (val.length > 1 && val[1] !== '9') val = '09' + val.substring(2);
                    if (val.length > 11) val = val.substring(0, 11);
                    let formatted = val;
                    if (val.length > 4) formatted = val.substring(0, 4) + ' ' + val.substring(4);
                    if (val.length > 7) formatted = val.substring(0, 4) + ' ' + val.substring(4, 7) + ' ' + val.substring(7);
                    setAccountNumber(formatted);
                  }}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Automation Settings */}
      <div className="glass-panel p-6 border border-white/10 rounded-2xl flex items-center justify-between gap-6">
        <div>
          <h3 className="text-md font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-1">
            <Zap size={16} className={isAutoCollectEnabled ? 'text-amber-400' : 'text-slate-500'} />
            Auto Collect Payouts
          </h3>
          <p className="text-sm text-slate-400 max-w-xl">
            Automatically claim and route funds to your preferred payment method when a parametric weather trigger is met.
          </p>
        </div>
        <button 
          onClick={handleToggleAutoCollect}
          className={`relative w-14 h-8 rounded-full transition-colors flex items-center px-1 shrink-0 ${isAutoCollectEnabled ? (isMainnet ? 'bg-emerald-500' : 'bg-sky-500') : 'bg-slate-700'}`}
        >
          <div className={`w-6 h-6 rounded-full bg-white transition-transform duration-300 ${isAutoCollectEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={paymentMethod === 'fiat' && (!accountName || !accountNumber)}
          className={`px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isSaved 
              ? 'bg-green-500 text-white' 
              : isMainnet ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
          }`}
        >
          {isSaved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {isSaved ? 'Configuration Saved' : 'Save Payout Configuration'}
        </button>
      </div>
    </div>
  );
};
