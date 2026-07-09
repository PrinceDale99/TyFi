import React from 'react';
import { ShieldCheck, AlertCircle, TrendingDown, Clock, MapPin, Loader2, Brain } from 'lucide-react';
import type { WeatherData, FarmData } from '../types';
import { useXlmToPhp } from '../hooks/useXlmToPhp';
import { calculateCombinedDamage } from '../utils/DamageCalculator';

interface PayoutStatusProps {
  weather: WeatherData | null;
  farms: FarmData[];
  onClaim?: (farm: FarmData) => void;
  network?: 'testnet' | 'mainnet';
}

const PayoutStatus: React.FC<PayoutStatusProps> = ({ weather, farms, onClaim, network = 'testnet' }) => {
  const { formatPhp } = useXlmToPhp();
  const isMainnet = network === 'mainnet';

  const [claimingFarmIds, setClaimingFarmIds] = React.useState<string[]>([]);

  // Clear claiming state for any farms that have finished claiming or reset
  React.useEffect(() => {
    setClaimingFarmIds(prev => prev.filter(id => {
      const farm = farms.find(f => f.id === id);
      return farm && !farm.hasClaimed;
    }));
  }, [farms]);

  if (!weather) return null;

  // Combined damage analysis matching the Soroban smart contract consensus:
  const ws = weather.windSpeed;
  const rf = weather.rainfall;
  
  const oracleDamage = weather.damageEstimation || 0;
  const aiDamage = weather.aiDamageEstimation;
  const combinedDamage = calculateCombinedDamage(oracleDamage, aiDamage);
  
  let payoutRatio = combinedDamage / 100;

  if (isMainnet) {
    // on mainnet it's 80% if ws >= 150 (parametric threshold), or based on consensus damage
    // For this simulation, we use the combined damage but could cap it
    payoutRatio = combinedDamage / 100;
  }

  const isTriggered = combinedDamage > 0;

  return (
    <div className="space-y-6">
      <div className={`glass-panel border-2 transition-all duration-500 ${isTriggered ? 'border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.1)]' : 'border-white/5'}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-white">Smart Contract Engine</h3>
          <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${isTriggered ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/5 text-slate-500'}`}>
            {isTriggered ? 'TRIGGER DETECTED' : 'MONITORING'}
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Combined Damage Analysis</span>
                <Brain size={12} className="text-indigo-400" />
              </div>
              <span className={`text-xs font-black ${combinedDamage > 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                {combinedDamage.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${combinedDamage > 30 ? 'bg-rose-500' : 'bg-sky-500'}`} 
                style={{ width: `${combinedDamage}%` }}
              ></div>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[9px] text-slate-500 uppercase font-bold">Physical: {oracleDamage}%</span>
              <span className="text-[9px] text-slate-500 uppercase font-bold">AI: {aiDamage ?? 0}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2">Your Insured Assets</h4>
        {farms.map((farm) => {
          const farmTriggered = isTriggered; // In real app, check proximity to weather event
          return (
            <div key={farm.id} className="glass-panel hover:border-white/10 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">{farm.farmName}</h5>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{farm.cropType} • {farm.farmSize} Hectares</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-white">{farm.totalCropValue.toLocaleString()} XLM</div>
                  <div className="text-[9px] text-slate-400 font-medium">≈ {formatPhp(farm.totalCropValue)}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Sum Insured</div>
                </div>
              </div>

              {farm.hasClaimed ? (
                <div className="w-full py-3 bg-emerald-500/10 rounded-xl flex flex-col items-center justify-center border border-emerald-500/30 text-emerald-400">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold">
                      Claim processed ({ (farm.claimedAmount || Math.round(farm.totalCropValue * (farm.claimedRatio || payoutRatio || 0.7))).toLocaleString() } XLM Paid)
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-500/80 font-medium mt-0.5">
                    ≈ {formatPhp(farm.claimedAmount || Math.round(farm.totalCropValue * (farm.claimedRatio || payoutRatio || 0.7)))}
                  </span>
                </div>
              ) : claimingFarmIds.includes(farm.id) ? (
                <button 
                  disabled
                  className="w-full py-3 bg-emerald-700/50 text-emerald-300 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  Processing Claim...
                  <Loader2 size={18} className="animate-spin" />
                </button>
              ) : farmTriggered ? (
                <div className="space-y-1.5 w-full">
                  <button 
                    onClick={() => {
                      setClaimingFarmIds(prev => [...prev, farm.id]);
                      onClaim?.(farm);
                    }}
                    className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    Claim {Math.round(farm.totalCropValue * payoutRatio).toLocaleString()} XLM ({Math.round(payoutRatio * 100)}% Payout)
                    <ShieldCheck size={18} className="group-hover:scale-110 transition-transform" />
                  </button>
                  <div className="text-[10px] text-emerald-400/80 text-center font-medium">
                    ≈ {formatPhp(Math.round(farm.totalCropValue * payoutRatio))}
                  </div>
                </div>
              ) : (
                <div className="w-full py-3 bg-white/5 rounded-xl flex items-center justify-center gap-2 border border-white/5">
                  <Clock size={16} className="text-slate-500" />
                  <span className="text-xs font-bold text-slate-500">Monitoring for Triggers...</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};


export default PayoutStatus;
