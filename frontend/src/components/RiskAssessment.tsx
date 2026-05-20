import React, { useMemo, useState, useEffect } from 'react';
import { 
  Info, Zap, ShieldAlert, Cpu, 
  Eye, BarChart3, Layers
} from 'lucide-react';
import type { FarmData } from '../types';

interface DamageAssessmentProps {
  farmData: FarmData;
  windSpeed: number;
  rainfall: number;
}

const DamageAssessment: React.FC<DamageAssessmentProps> = ({ farmData, windSpeed, rainfall }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnalyzing(false), 2000);
    return () => clearTimeout(timer);
  }, [windSpeed, rainfall]);

  const assessment = useMemo(() => {
    const windImpact = Math.max(0, (windSpeed - 60) / 140); 
    const rainImpact = Math.max(0, (rainfall - 50) / 250); 
    
    const damagePercentage = Math.min(1, (windImpact * 0.7 + rainImpact * 0.3));
    const totalValue = farmData.expectedHarvestValue;
    const financialDamage = totalValue * damagePercentage;
    
    let payout = 0;
    let status: 'safe' | 'warning' | 'critical' = 'safe';

    if (damagePercentage > 0.7) {
      payout = totalValue;
      status = 'critical';
    } else if (damagePercentage > 0.3) {
      payout = Math.max(farmData.initialInvestment, financialDamage);
      status = 'warning';
    } else if (damagePercentage > 0.1) {
      payout = financialDamage;
      status = 'safe';
    }

    // Split payout into Seed Subsidy (40%) and Income Replacement (60%)
    const seedSubsidy = payout * 0.4;
    const incomeReplacement = payout * 0.6;

    return {
      damagePercentage: damagePercentage * 100,
      financialDamage,
      payout,
      status,
      seedSubsidy,
      incomeReplacement,
      windImpact: windImpact * 100,
      rainImpact: rainImpact * 100
    };
  }, [farmData, windSpeed, rainfall]);

  if (isAnalyzing) {
    return (
      <div className="glass-panel p-12 flex flex-col items-center justify-center text-center">
        <div className="relative mb-6">
          <Layers className="w-16 h-16 text-sky-500 animate-pulse" />
          <div className="absolute inset-0 bg-sky-500/20 blur-2xl rounded-full"></div>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Satellite Image Synthesis</h3>
        <p className="text-slate-400 text-sm max-w-xs">
          Cross-referencing pre-storm NDVI vegetation indices with current SAR radar telemetry...
        </p>
        <div className="mt-6 flex gap-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-2 h-2 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className={`p-6 rounded-3xl border-2 overflow-hidden relative ${
        assessment.status === 'critical' ? 'bg-rose-500/10 border-rose-500/30' : 
        assessment.status === 'warning' ? 'bg-amber-500/10 border-amber-500/30' : 
        'bg-emerald-500/10 border-emerald-500/30'
      }`}>
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <ShieldAlert className="w-32 h-32" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${
              assessment.status === 'critical' ? 'bg-rose-500/20 text-rose-400' : 
              assessment.status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 
              'bg-emerald-500/20 text-emerald-400'
            }`}>
              <Cpu size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">Loss Assessment</h3>
              <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                <Eye size={14} /> AI-Verified damage index
              </div>
            </div>
          </div>
          <div className="text-left md:text-right">
            <div className={`text-5xl font-black tracking-tighter ${
              assessment.status === 'critical' ? 'text-rose-400' : 
              assessment.status === 'warning' ? 'text-amber-400' : 
              'text-emerald-400'
            }`}>
              {assessment.damagePercentage.toFixed(1)}%
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Estimated Field Loss</span>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex justify-between items-end">
            <div className="flex gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Wind Stress</span>
                <span className="text-sm font-bold text-white">{assessment.windImpact.toFixed(0)}%</span>
              </div>
              <div className="w-[1px] h-8 bg-white/10"></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Flood Risk</span>
                <span className="text-sm font-bold text-white">{assessment.rainImpact.toFixed(0)}%</span>
              </div>
            </div>
          </div>
          <div className="h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div 
              className={`h-full transition-all duration-1000 ease-out ${
                assessment.status === 'critical' ? 'bg-rose-500' : assessment.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${assessment.damagePercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 bg-slate-900/40 border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <BarChart3 className="w-5 h-5 text-sky-400" />
            </div>
            <h4 className="font-bold text-white">Value At Risk</h4>
          </div>
          
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Exposure</p>
                <p className="text-xl font-bold text-white">{farmData.expectedHarvestValue.toLocaleString()} XLM</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-bold uppercase">Projected Loss</p>
                <p className="text-xl font-bold text-rose-400">{assessment.financialDamage.toLocaleString()} XLM</p>
              </div>
            </div>
            
            <div className="p-4 bg-black/20 rounded-2xl border border-white/5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Replanting Cost</span>
                <span className="text-white font-medium">{farmData.initialInvestment.toLocaleString()} XLM</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Yield Multiplier</span>
                <span className="text-white font-medium">x3.2</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.05)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <h4 className="font-bold text-white">Smart Payout</h4>
          </div>
          
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-xs text-emerald-500/60 font-black uppercase tracking-widest mb-1">Total Instant Claim</p>
              <div className="text-5xl font-black text-emerald-400 tracking-tighter">
                {assessment.payout.toLocaleString()} XLM
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-emerald-500/10">
              <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                <p className="text-[10px] text-emerald-500/70 font-bold uppercase mb-1">Seed Subsidy</p>
                <p className="text-lg font-bold text-white">{assessment.seedSubsidy.toLocaleString()} XLM</p>
              </div>
              <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                <p className="text-[10px] text-emerald-500/70 font-bold uppercase mb-1">Income Recovery</p>
                <p className="text-lg font-bold text-white">{assessment.incomeReplacement.toLocaleString()} XLM</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-sky-500/10 rounded-2xl border border-sky-500/20 flex gap-4">
        <Info className="w-6 h-6 text-sky-400 shrink-0" />
        <div className="text-xs text-sky-200/70 leading-relaxed">
          <strong className="text-sky-300 block mb-1">Parametric Trigger Note:</strong>
          Our oracle has detected regional wind speeds exceeding your policy threshold. 
          Payouts are calculated per-hectare and will be disbursed via your registered 
          Stellar wallet within 1 minute of typhoon exit.
        </div>
      </div>
    </div>
  );
};

export default DamageAssessment;
