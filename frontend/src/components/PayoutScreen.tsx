import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Lock, Unlock, ArrowRight } from 'lucide-react';
import { useXlmToPhp } from '../hooks/useXlmToPhp';

interface PayoutScreenProps {
  amount: number;
  onReset: () => void;
}

const PayoutScreen: React.FC<PayoutScreenProps> = ({ amount, onReset }) => {
  const { formatPhp } = useXlmToPhp();
  const [step, setStep] = useState(1);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(2), 1500),
      setTimeout(() => setIsUnlocked(true), 2500),
      setTimeout(() => setStep(3), 4000),
      setTimeout(() => setStep(4), 6000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
      <div className="max-w-md w-full glass-panel border-sky-500/30 text-center relative overflow-hidden">
        {/* Success Rays */}
        {step >= 3 && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.1),transparent_70%)] animate-pulse"></div>
        )}

        <div className="relative z-10">
          <div className="mb-8 flex justify-center">
            <div className={`p-6 rounded-full transition-all duration-1000 ${
              isUnlocked ? 'bg-sky-500/20 scale-110 shadow-[0_0_50px_rgba(56,189,248,0.3)]' : 'bg-slate-800'
            }`}>
              {isUnlocked ? (
                <Unlock className="w-16 h-16 text-sky-400 animate-bounce" />
              ) : (
                <Lock className="w-16 h-16 text-slate-500" />
              )}
            </div>
          </div>

          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">
            {step === 1 && "Verifying Impact..."}
            {step === 2 && "Vault Unlocking..."}
            {step === 3 && "Payout Authorized"}
            {step === 4 && "Funds Transferred"}
          </h2>
          
          <p className="text-slate-400 mb-8 px-4">
            {step === 1 && "Comparing satellite data with smart contract parameters."}
            {step === 2 && "Smart contract conditions met. Triggering resilience vault."}
            {step === 3 && `A payout of ${amount.toLocaleString()} XLM is being processed.`}
            {step === 4 && "Resilience funds have been sent to your registered Stellar wallet."}
          </p>

          <div className="space-y-4 mb-8">
            <div className={`p-4 rounded-2xl border transition-all duration-500 ${
              step >= 3 ? 'bg-sky-500/10 border-sky-500/30' : 'bg-white/5 border-white/10'
            }`}>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-bold">Payout Amount</div>
              <div className={`text-4xl font-black ${step >= 3 ? 'text-sky-400' : 'text-slate-400'}`}>
                {amount.toLocaleString()} XLM
              </div>
              {step >= 3 && (
                <div className="text-xs text-sky-400/80 mt-1 font-medium">
                  ≈ {formatPhp(amount)}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-4 text-xs">
              <div className="flex items-center gap-2 text-slate-500">
                <ShieldCheck size={14} className="text-sky-500" />
                <span>SECURED BY SMART CONTRACT</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <CheckCircle2 size={14} className={step >= 4 ? 'text-green-500' : 'text-slate-700'} />
                <span className={step >= 4 ? 'text-green-500 font-bold' : ''}>TX: 0x82...f91</span>
              </div>
            </div>
          </div>

          {step >= 4 && (
            <button 
              onClick={onReset}
              className="w-full py-4 bg-white text-slate-950 rounded-xl font-bold hover:bg-sky-400 transition-colors flex items-center justify-center gap-2"
            >
              Back to Dashboard <ArrowRight size={18} />
            </button>
          )}

          {step < 4 && (
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-sky-500 transition-all duration-[6000ms] ease-linear"
                style={{ width: '100%' }}
              ></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PayoutScreen;
