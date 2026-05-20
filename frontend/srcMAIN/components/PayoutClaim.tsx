import React, { useState } from 'react';
import { 
  Zap, 
  Wallet, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  ExternalLink,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { claimPayoutOnChain } from '../lib/stellar';
import { FarmData } from '../types';

interface PayoutClaimProps {
  isVerified: boolean;
  windSpeed: number;
  farmData: FarmData | null;
  userPublicKey: string | null;
}

const PayoutClaim: React.FC<PayoutClaimProps> = ({ isVerified, windSpeed, farmData, userPublicKey }) => {
  const [step, setStep] = useState<'review' | 'processing' | 'success'>('review');
  const [txHash, setTxHash] = useState('');

  const canClaim = isVerified && windSpeed > 100;
  
  const estimatedPayout = farmData ? (
    windSpeed > 180 ? farmData.expectedHarvestValue : 
    windSpeed > 150 ? farmData.expectedHarvestValue * 0.7 :
    windSpeed > 100 ? farmData.expectedHarvestValue * 0.3 : 0
  ) : 0;

  const handleClaim = async () => {
    if (!userPublicKey) return;
    setStep('processing');
    try {
      const result = await claimPayoutOnChain(userPublicKey);
      if (result.status === 'success') {
        setTxHash(result.txHash);
        setStep('success');
      }
    } catch (error) {
      console.error('Claim failed:', error);
      setStep('review');
      alert('On-chain claim execution failed. Please check your wallet.');
    }
  };

  if (!isVerified) {
    return (
      <div className="glass-panel p-12 text-center border-amber-500/20 bg-amber-500/5">
        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="text-amber-400" size={32} />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Verification Required</h3>
        <p className="text-slate-400 text-sm mb-8 max-w-xs mx-auto">
          You must verify your farm identity and location before you can access the payout vault.
        </p>
        <button className="px-6 py-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl font-bold hover:bg-amber-500/30 transition-all text-sm">
          Go to Verification
        </button>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="glass-panel p-16 text-center">
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 bg-sky-500/20 blur-3xl rounded-full animate-pulse"></div>
          <Loader2 className="w-full h-full text-sky-400 animate-spin" />
        </div>
        <h3 className="text-2xl font-black text-white mb-3">Disbursing Funds</h3>
        <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
          Executing smart contract #TV-829. 
          Verifying oracle signatures and triggering instant GCash transfer...
        </p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="glass-panel p-10 overflow-hidden relative">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>
        
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/30 animate-bounce-subtle">
            <CheckCircle2 className="text-emerald-400" size={40} />
          </div>
          <h3 className="text-3xl font-black text-white mb-2">Payout Successful</h3>
          <p className="text-emerald-400/60 font-bold text-sm uppercase tracking-widest mb-8">Disbursed to GCash (+63 917 **** 123)</p>
          
          <div className="bg-black/40 rounded-3xl p-6 border border-white/5 text-left mb-8">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Transaction ID</span>
              <span className="text-xs font-mono text-sky-400 flex items-center gap-1">
                {txHash} <ExternalLink size={10} />
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Amount Disbursed</span>
              <span className="text-2xl font-black text-white font-mono">₱{estimatedPayout.toLocaleString()}</span>
            </div>
          </div>

          <button 
            onClick={() => setStep('review')}
            className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all border border-white/5"
          >
            View Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <Wallet size={120} />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-sky-500/20 rounded-xl border border-sky-500/30">
              <Zap className="text-sky-400" size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">Claim Settlement</h3>
              <p className="text-slate-400 text-xs font-medium">Parametric insurance trigger: Wind Speed &gt; 100km/h</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Live Wind Speed</span>
              <div className={`text-2xl font-black ${windSpeed > 100 ? 'text-rose-400' : 'text-slate-400'}`}>
                {windSpeed} km/h
              </div>
            </div>
            <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Status</span>
              <div className={`text-2xl font-black ${windSpeed > 100 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {windSpeed > 100 ? 'TRIGGERED' : 'MONITORING'}
              </div>
            </div>
          </div>

          <div className="p-6 bg-sky-500/10 rounded-3xl border border-sky-500/20 mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-sky-300">Projected Payout</span>
              <span className="text-xs font-medium text-sky-500/60 flex items-center gap-1">
                <Clock size={12} /> Instant Disbursal
              </span>
            </div>
            <div className="text-5xl font-black text-white tracking-tighter mb-4">
              ₱{estimatedPayout.toLocaleString()}
            </div>
            <p className="text-xs text-sky-200/50 leading-relaxed">
              Based on your verified {farmData?.cropType} crop and current typhoon intensity. 
              Payout covers {windSpeed > 180 ? '100%' : windSpeed > 150 ? '70%' : '30%'} of your total exposure.
            </p>
          </div>

          <button
            disabled={!canClaim}
            onClick={handleClaim}
            className={`w-full py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 ${
              canClaim 
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-xl shadow-sky-500/20 hover:scale-[1.02] active:scale-[0.98]' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
            }`}
          >
            {canClaim ? (
              <>Execute Instant Claim <ArrowRight size={20} /></>
            ) : (
              <>Threshold Not Met <ShieldCheck size={20} /></>
            )}
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-3 px-6 py-4 bg-slate-900/50 rounded-2xl border border-white/5">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Oracle Protocol: 0x82...f92a Active</span>
      </div>
    </div>
  );
};

export default PayoutClaim;
