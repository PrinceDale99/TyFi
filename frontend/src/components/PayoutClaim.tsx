import React, { useState, useEffect, useCallback } from 'react';
import { 
  Zap, 
  Wallet, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  ExternalLink,
  Loader2,
  AlertCircle,
  Brain,
  RefreshCw,
  TrendingDown,
} from 'lucide-react';
import type { FarmData, WeatherData } from '../types';
import { claimPayoutOnChain } from '../lib/stellar';
import { useXlmToPhp } from '../hooks/useXlmToPhp';
import { analyzeWeatherImpact, type AiPredictionResult } from '../services/aiService';
import { calculateCombinedDamage } from '../utils/DamageCalculator';

interface PayoutClaimProps {
  isVerified: boolean;
  windSpeed: number;
  farmData: FarmData | null;
  weather?: WeatherData | null;
}

const RISK_COLORS: Record<string, string> = {
  Low:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Moderate: 'text-amber-400   bg-amber-500/10   border-amber-500/20',
  High:     'text-orange-400  bg-orange-500/10  border-orange-500/20',
  Critical: 'text-rose-400    bg-rose-500/10    border-rose-500/20',
};

const PayoutClaim: React.FC<PayoutClaimProps> = ({ isVerified, windSpeed, farmData, weather }) => {
  const { formatPhp } = useXlmToPhp();
  const [step, setStep]           = useState<'review' | 'processing' | 'success' | 'offline_queued'>('review');
  const [txHash, setTxHash]       = useState('');
  const [aiResult, setAiResult]   = useState<AiPredictionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const canClaim = isVerified && windSpeed > 100;

  // ─── AI-driven damage estimation ──────────────────────────────────────────
  const runAiAnalysis = useCallback(async () => {
    if (!farmData || !weather) return;
    setIsAnalyzing(true);
    setAnalyzeError(false);
    try {
      const result = await analyzeWeatherImpact(farmData, weather);
      setAiResult(result);
    } catch {
      setAnalyzeError(true);
    } finally {
      setIsAnalyzing(false);
    }
  }, [farmData, weather]);

  useEffect(() => {
    if (isVerified && farmData && weather) {
      runAiAnalysis();
    }
  }, [isVerified, farmData, weather, runAiAnalysis]);

  // Payout = Combined analysis (Physical Oracle + Gemini AI)
  const oracleDamage = windSpeed > 150 ? 100
    : windSpeed > 120 ? 70
    : windSpeed > 100 ? 30
    : 0;

  const damagePercent = calculateCombinedDamage(
    oracleDamage,
    aiResult?.estimatedDamage,
    aiResult?.confidenceScore
  );

  const estimatedPayout = farmData
    ? Math.round((farmData.totalCropValue * damagePercent) / 100)
    : 0;

  const handleClaim = async () => {
    if (isOffline) {
      const intent = {
        type: 'claim_payout',
        farmName: farmData?.farmName || 'My Farm',
        amount: estimatedPayout,
        timestamp: Date.now(),
        data: {
          farmId: farmData?.id || '',
          season: farmData?.season || 'Wet Season 2026',
        }
      };
      const queue = JSON.parse(localStorage.getItem('vault_pending_claims') || '[]');
      queue.push(intent);
      localStorage.setItem('vault_pending_claims', JSON.stringify(queue));
      setStep('offline_queued');
      return;
    }

    setStep('processing');
    try {
      const pubkey    = localStorage.getItem('stellar_pubkey') || '';
      const isMainnet = localStorage.getItem('network_state') === 'mainnet';
      const tx = await claimPayoutOnChain(
        pubkey, 
        farmData?.id || '', 
        farmData?.season || 'Wet Season 2026', 
        isMainnet ? 'mainnet' : 'testnet'
      );
      setTxHash(tx);
      setStep('success');
    } catch (err) {
      console.error('Error executing claim payout:', err);
      // Fallback or retry logic
      setStep('review');
    }
  };

  // ─── Offline Queued ────────────────────────────────────────────────────────
  if (step === 'offline_queued') {
    return (
      <div className="glass-panel p-10 text-center">
        <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="text-amber-400" size={40} />
        </div>
        <h3 className="text-2xl font-black text-white mb-2">Claim Queued</h3>
        <p className="text-slate-400 text-sm mb-8 max-w-xs mx-auto">
          You are currently offline. Your claim for <span className="text-white font-bold">{estimatedPayout.toLocaleString()} XLM</span> has been saved locally and will be processed once your connection is restored.
        </p>
        <button 
          onClick={() => setStep('review')}
          className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all border border-white/5"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // ─── Not verified ──────────────────────────────────────────────────────────
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

  // ─── Processing ────────────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <div className="glass-panel p-16 text-center">
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 bg-sky-500/20 blur-3xl rounded-full animate-pulse" />
          <Loader2 className="w-full h-full text-sky-400 animate-spin" />
        </div>
        <h3 className="text-2xl font-black text-white mb-3">Disbursing Funds</h3>
        <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
          Executing smart contract. Verifying oracle + AI signatures and triggering instant Stellar transaction…
        </p>
      </div>
    );
  }

  // ─── Success ───────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="glass-panel p-10 overflow-hidden relative">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full" />
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
            <CheckCircle2 className="text-emerald-400" size={40} />
          </div>
          <h3 className="text-3xl font-black text-white mb-2">Payout Successful</h3>
          <p className="text-emerald-400/60 font-bold text-sm uppercase tracking-widest mb-8">
            Disbursed to Stellar Wallet
          </p>
          <div className="bg-black/40 rounded-3xl p-6 border border-white/5 text-left mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Transaction ID</span>
              <span className="text-xs font-mono text-sky-400 flex items-center gap-1">
                {txHash} <ExternalLink size={10} />
              </span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Amount Disbursed</span>
              <div className="text-right">
                <span className="text-2xl font-black text-white font-mono">{estimatedPayout.toLocaleString()} XLM</span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">≈ {formatPhp(estimatedPayout)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Damage Assessment</span>
              <span className="text-xs font-bold text-rose-400">{damagePercent.toFixed(0)}% estimated loss</span>
            </div>
          </div>
          {aiResult && (
            <div className="text-left bg-sky-500/5 border border-sky-500/10 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Brain size={13} className="text-sky-400" />
                <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">AI Assessment used for this payout</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{aiResult.reasoning}</p>
            </div>
          )}
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

  // ─── Review (main) ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="glass-panel p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <Wallet size={120} />
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-sky-500/20 rounded-xl border border-sky-500/30">
              <Zap className="text-sky-400" size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">Claim Settlement</h3>
              <p className="text-slate-400 text-xs font-medium">Payout = AI-estimated damage % × insured crop value</p>
            </div>
          </div>

          {/* Live readings */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Live Wind Speed</span>
              <div className={`text-2xl font-black ${windSpeed > 100 ? 'text-rose-400' : 'text-slate-400'}`}>
                {windSpeed} km/h
              </div>
            </div>
            <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Trigger Status</span>
              <div className={`text-2xl font-black ${windSpeed > 100 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {windSpeed > 100 ? 'TRIGGERED' : 'MONITORING'}
              </div>
            </div>
          </div>

          {/* AI analysis panel */}
          <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-indigo-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Oracle + AI Damage Analysis
                </span>
              </div>
              <button
                onClick={runAiAnalysis}
                disabled={isAnalyzing}
                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all disabled:opacity-40"
                title="Re-run AI analysis"
              >
                <RefreshCw size={12} className={isAnalyzing ? 'animate-spin' : ''} />
              </button>
            </div>

            {isAnalyzing ? (
              <div className="flex items-center gap-3 py-2">
                <Loader2 size={16} className="animate-spin text-indigo-400" />
                <span className="text-xs text-slate-400 animate-pulse">Gemini analyzing weather + storm data…</span>
              </div>
            ) : analyzeError ? (
              <div className="flex items-center gap-2 text-amber-400 text-xs py-1">
                <AlertCircle size={13} />
                <span>AI unavailable — using oracle-only wind-speed bands</span>
              </div>
            ) : aiResult ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Risk Level</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${RISK_COLORS[aiResult.riskLevel] || RISK_COLORS.Low}`}>
                    {aiResult.riskLevel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Hit Probability</span>
                  <span className="text-xs font-bold text-white">{aiResult.hitProbability}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Estimated Crop Damage</span>
                  <div className="flex items-center gap-1">
                    <TrendingDown size={11} className="text-rose-400" />
                    <span className="text-xs font-black text-rose-400">{aiResult.estimatedDamage.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/5">
                  <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{aiResult.reasoning}</p>
                </div>
                {aiResult.advisory && (
                  <div className="mt-1 p-2 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                    <p className="text-[10px] text-amber-400/80 leading-relaxed">{aiResult.advisory}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-600 py-1">Connect weather feed to enable AI analysis.</p>
            )}
          </div>

          {/* Payout breakdown */}
          <div className="p-6 bg-sky-500/10 rounded-3xl border border-sky-500/20 mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-sky-300">Projected Payout</span>
              <span className="text-xs font-medium text-sky-500/60 flex items-center gap-1">
                <Clock size={12} /> Instant Disbursal
              </span>
            </div>
            <div className="text-5xl font-black text-white tracking-tighter">
              {estimatedPayout.toLocaleString()} XLM
            </div>
            <div className="text-sm text-sky-300/80 mb-4 font-medium">
              ≈ {formatPhp(estimatedPayout)}
            </div>
            <div className="flex items-center justify-between text-xs text-sky-200/50">
              <span>
                {damagePercent.toFixed(0)}% damage × {farmData?.totalCropValue.toLocaleString()} XLM insured value
              </span>
              <span className="flex items-center gap-1">
                {aiResult ? <><Brain size={10} /> AI</> : 'Oracle'}
              </span>
            </div>
          </div>

          {/* Claim button */}
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
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
          Oracle + Gemini AI Protocol Active
        </span>
      </div>
    </div>
  );
};

export default PayoutClaim;
