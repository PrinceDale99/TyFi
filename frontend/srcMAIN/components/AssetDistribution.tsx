import React from 'react';
import { TrendingUp, PieChart, ShieldCheck } from 'lucide-react';
import type { FarmData } from '../types';

interface AssetDistributionProps {
  farms: FarmData[];
}

const AssetDistribution: React.FC<AssetDistributionProps> = ({ farms }) => {
  const totalArea = farms.reduce((sum, f) => sum + f.farmSize, 0);
  const totalValue = farms.reduce((sum, f) => sum + (f.farmSize * 50000), 0);

  return (
    <div className="glass-panel h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <TrendingUp className="text-sky-400" size={20} />
          Asset Distribution
        </h3>
        <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
          <ShieldCheck size={12} />
          Protected
        </div>
      </div>

      {farms.length > 0 ? (
        <div className="space-y-6 flex-1">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Total Area</div>
              <div className="text-lg font-bold text-white">{totalArea.toFixed(2)} <span className="text-xs text-slate-500 font-normal">ha</span></div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Total Insured Value</div>
              <div className="text-lg font-bold text-sky-400">₱{totalValue.toLocaleString()}</div>
            </div>
          </div>

          {/* Progress Bars for Distribution */}
          <div className="space-y-4">
            <div className="text-[10px] text-slate-500 uppercase font-black">By Crop Type</div>
            <div className="space-y-3">
              {Array.from(new Set(farms.map(f => f.cropType))).map(crop => {
                const cropArea = farms.filter(f => f.cropType === crop).reduce((sum, f) => sum + f.farmSize, 0);
                const percentage = (cropArea / totalArea) * 100;
                
                return (
                  <div key={crop} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">{crop}</span>
                      <span className="text-white font-medium">{percentage.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-sky-500 transition-all duration-1000"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* List of Farms */}
          <div className="space-y-2 mt-4">
            <div className="text-[10px] text-slate-500 uppercase font-black">Individual Holdings</div>
            <div className="max-h-[200px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
              {farms.map(farm => (
                <div key={farm.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-xs">
                      {farm.cropType[0]}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white">{farm.farmName}</div>
                      <div className="text-[10px] text-slate-500">{farm.farmSize} ha</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-white">₱{(farm.farmSize * 50000).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white/5 rounded-2xl border border-dashed border-white/10">
          <PieChart className="text-slate-700 mb-3" size={40} />
          <p className="text-slate-500 text-sm italic">No holdings detected. Register your farm to see your asset distribution.</p>
        </div>
      )}
    </div>
  );
};

export default AssetDistribution;
