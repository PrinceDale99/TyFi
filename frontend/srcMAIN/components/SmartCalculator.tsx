import React, { useState, useEffect } from 'react';
import { Calculator, TrendingDown, AlertTriangle, CheckCircle2, DollarSign, Sprout, BarChart3 } from 'lucide-react';
import type { CalculatorData } from '../types';

interface SmartCalculatorProps {
  farms: any[];
}

const SmartCalculator: React.FC<SmartCalculatorProps> = ({ farms }) => {
  const [data, setData] = useState<CalculatorData>({
    cropType: 'Rice',
    area: 1.5,
    stage: 'Vegetative',
    destructionLevel: 0,
    marketPrice: 20, // PHP per kg
  });

  const [selectedFarmId, setSelectedFarmId] = useState<string>('');

  const handleFarmSelect = (farmId: string) => {
    setSelectedFarmId(farmId);
    const farm = farms.find(f => f.id === farmId);
    if (farm) {
      setData({
        ...data,
        cropType: farm.cropType,
        area: farm.hectares,
        // We could also try to infer stage if it was in farm data, but for now we keep the rest
      });
    }
  };

  const [result, setResult] = useState<{
    estimatedLoss: number;
    recommendedPayout: number;
    recoveryPotential: number;
  } | null>(null);

  const calculateDamage = () => {
    // Basic simulation of damage assessment logic
    const yieldPerHectare = data.cropType === 'Rice' ? 4000 : 
                           data.cropType === 'Corn' ? 3500 :
                           data.cropType === 'Coconut' ? 2500 : 3000; // kg
    const totalYield = yieldPerHectare * data.area;
    const totalValue = totalYield * data.marketPrice;

    // Stage multipliers for damage impact
    const stageMultiplier = {
      'Seedling': 0.9,
      'Vegetative': 0.7,
      'Reproductive': 1.0,
      'Maturity': 0.8
    }[data.stage];

    const loss = totalValue * (data.destructionLevel / 100) * (stageMultiplier || 1);
    const payout = loss * 0.85; // 85% coverage
    const recovery = 100 - (data.destructionLevel * 0.8);

    setResult({
      estimatedLoss: loss,
      recommendedPayout: payout,
      recoveryPotential: Math.max(0, recovery)
    });
  };

  useEffect(() => {
    calculateDamage();
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-500/20 rounded-lg">
            <Calculator className="text-sky-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Smart Damage Calculator</h2>
            <p className="text-slate-400 text-sm">Estimate losses and potential payouts based on field data</p>
          </div>
        </div>

        {farms.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase font-black">Pre-fill from Farm:</span>
            <select
              value={selectedFarmId}
              onChange={(e) => handleFarmSelect(e.target.value)}
              className="bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
            >
              <option value="">Select a farm...</option>
              {farms.map(farm => (
                <option key={farm.id} value={farm.id}>{farm.farmName}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Sprout size={16} className="text-sky-400" />
            Crop Parameters
          </h3>

          <div className="space-y-5">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Crop Type</label>
              <select
                value={data.cropType}
                onChange={(e) => setData({ ...data, cropType: e.target.value })}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all appearance-none cursor-pointer"
              >
                <option value="Rice">Rice (Palay)</option>
                <option value="Corn">Corn (Maize)</option>
                <option value="Coconut">Coconut</option>
                <option value="Banana">Banana</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Area (Hectares)</label>
                <input
                  type="number"
                  value={data.area}
                  onChange={(e) => setData({ ...data, area: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Market Price (PHP/kg)</label>
                <input
                  type="number"
                  value={data.marketPrice}
                  onChange={(e) => setData({ ...data, marketPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Growth Stage</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['Seedling', 'Vegetative', 'Reproductive', 'Maturity'] as const).map((stage) => (
                  <button
                    key={stage}
                    onClick={() => setData({ ...data, stage })}
                    className={`py-2 px-1 rounded-lg text-xs font-medium border transition-all ${data.stage === stage
                        ? 'bg-sky-500/20 border-sky-500 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.2)]'
                        : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/20'
                      }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-400">Destruction Estimation</label>
                <span className={`text-sm font-bold ${data.destructionLevel > 70 ? 'text-red-400' : data.destructionLevel > 30 ? 'text-orange-400' : 'text-emerald-400'}`}>
                  {data.destructionLevel}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={data.destructionLevel}
                onChange={(e) => setData({ ...data, destructionLevel: parseInt(e.target.value) })}
                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>None</span>
                <span>Moderate</span>
                <span>Severe</span>
                <span>Total Loss</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="flex flex-col gap-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[60px] -mr-16 -mt-16 rounded-full"></div>

            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
              <BarChart3 size={16} className="text-sky-400" />
              Assessment Results
            </h3>

            {result && (
              <div className="space-y-6">
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-xs text-slate-500 uppercase tracking-tight mb-1">Estimated Financial Loss</div>
                  <div className="text-3xl font-bold text-white flex items-baseline gap-2">
                    <span className="text-slate-400 text-lg font-normal">₱</span>
                    {result.estimatedLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-4 bg-sky-500/10 rounded-xl border border-sky-500/20">
                  <div className="text-xs text-sky-400/70 uppercase tracking-tight mb-1">Recommended Vault Payout</div>
                  <div className="text-3xl font-bold text-sky-400 flex items-baseline gap-2">
                    <span className="text-sky-500 text-lg font-normal">₱</span>
                    {result.recommendedPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Recovery Potential</span>
                    <span className="text-white font-medium">{result.recoveryPotential.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-1000"
                      style={{ width: `${result.recoveryPotential}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${data.destructionLevel > 50
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
            {data.destructionLevel > 50 ? <AlertTriangle className="shrink-0 mt-0.5" size={18} /> : <CheckCircle2 className="shrink-0 mt-0.5" size={18} />}
            <div className="text-sm">
              {data.destructionLevel > 50
                ? "Severe damage detected. We recommend filing an immediate payout claim through the Vault."
                : "Damage levels are within manageable limits. Continue monitoring weather conditions."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartCalculator;
