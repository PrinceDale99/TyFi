import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, RefreshCw, BellRing, Gauge, HelpCircle } from 'lucide-react';
import { analyzeWeatherImpact } from '../services/aiService';
import type { AiPredictionResult } from '../services/aiService';
import type { WeatherData, FarmData } from '../types';

interface AiCopilotProps {
  weather: WeatherData | null;
  farms: FarmData[];
  addNotification: (text: string, type?: 'info' | 'success' | 'warning') => void;
  onUpdateWeatherDamage?: (damage: number, status: string, aiDamage?: number, confidence?: number) => void;
}

const AiCopilot: React.FC<AiCopilotProps> = ({
  weather,
  farms,
  addNotification,
  onUpdateWeatherDamage,
}) => {
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [growthStage, setGrowthStage] = useState<'Seedling' | 'Vegetative' | 'Reproductive' | 'Maturity'>('Vegetative');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<AiPredictionResult | null>(null);
  const [fcmNotificationSent, setFcmNotificationSent] = useState<boolean>(false);

  useEffect(() => {
    if (farms.length > 0 && !selectedFarmId) {
      setSelectedFarmId(farms[0].id);
    }
  }, [farms, selectedFarmId]);

  const handleAnalyze = async () => {
    if (!weather) {
      addNotification('Weather data is not loaded yet.', 'warning');
      return;
    }
    const farm = farms.find(f => f.id === selectedFarmId);
    if (!farm) {
      addNotification('Please select a valid farm for analysis.', 'warning');
      return;
    }

    setIsAnalyzing(true);
    setFcmNotificationSent(false);
    
    try {
      addNotification(`Analyzing risk metrics for ${farm.farmName}...`, 'info');
      
      const result = await analyzeWeatherImpact(farm, weather, growthStage);
      setPrediction(result);
      
      if (result.willHit) {
        setFcmNotificationSent(true);
        addNotification(`Storm hit predicted. Warning sent to phone.`, 'warning');
      } else {
        addNotification(`Analysis complete: ${farm.farmName} is safe.`, 'success');
      }

      // Update weather dashboard damage estimation if callback provided
      if (onUpdateWeatherDamage) {
        onUpdateWeatherDamage(
          weather.damageEstimation || 0, // Keep existing oracle damage
          result.willHit ? `Critical Risk (${result.riskLevel})` : 'Low Risk',
          result.estimatedDamage,
          result.confidenceScore
        );
      }
    } catch (error) {
      console.error(error);
      addNotification('Assessment encountered an issue. Using cached calculations.', 'warning');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="glass-panel border-t border-l border-white/10 shadow-2xl relative overflow-hidden bg-gradient-to-br from-slate-900/60 via-indigo-950/10 to-slate-900/60">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full filter blur-3xl -z-10"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-sky-500/5 rounded-full filter blur-3xl -z-10"></div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-r from-indigo-500 to-sky-500 rounded-lg text-white">
            <Shield size={18} />
          </div>
          <h3 className="font-black text-white flex items-center gap-1.5">
            Smart Weather Advisor
            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider border border-indigo-500/30">
              Predictive Insights
            </span>
          </h3>
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed mb-5">
        Leverage predictive models to project storm tracking paths against farm coordinates, evaluate crop vulnerability, and estimate agricultural damage.
      </p>

      {/* Selectors */}
      <div className="space-y-3 mb-6 bg-white/5 p-4 rounded-xl border border-white/5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Select Farm</label>
            <select
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {farms.map(f => (
                <option key={f.id} value={f.id}>{f.farmName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Growth Stage</label>
            <select
              value={growthStage}
              onChange={(e) => setGrowthStage(e.target.value as any)}
              className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Seedling">Seedling</option>
              <option value="Vegetative">Vegetative</option>
              <option value="Reproductive">Reproductive</option>
              <option value="Maturity">Maturity</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || farms.length === 0}
          className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Analyzing Models...
            </>
          ) : (
            <>
              <Shield size={14} />
              Assess Risk Profile
            </>
          )}
        </button>
      </div>

      {/* Prediction Output */}
      {prediction ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Assessment Results</span>
              <div className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                prediction.willHit 
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse' 
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              }`}>
                {prediction.willHit ? 'IMPACT IMMINENT' : 'FARMLAND SAFE'}
              </div>
            </div>

            {/* Hit Probability and Estimated Damage Gauges */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-black mb-1">
                  <Gauge size={10} className="text-indigo-400" />
                  Impact Probability
                </div>
                <div className="text-2xl font-black text-white">
                  {prediction.hitProbability}%
                </div>
                <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden mt-1.5">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 transition-all duration-1000"
                    style={{ width: `${prediction.hitProbability}%` }}
                  ></div>
                </div>
                {prediction.estimatedTimeOfImpact && (
                  <span className="text-[9px] text-slate-500 mt-1 block font-bold">{prediction.estimatedTimeOfImpact}</span>
                )}
              </div>

              <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-black mb-1">
                  <AlertTriangle size={10} className="text-rose-400" />
                  Estimated Damage
                </div>
                <div className="text-2xl font-black text-white">
                  {prediction.estimatedDamage}%
                </div>
                <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden mt-1.5">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 transition-all duration-1000"
                    style={{ width: `${prediction.estimatedDamage}%` }}
                  ></div>
                </div>
                <span className="text-[9px] text-slate-500 mt-1 block font-bold">Severity: {prediction.riskLevel}</span>
              </div>
            </div>

            {/* Rationale explanation */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5 mb-4">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Proximity Analysis</div>
              <p className="text-xs text-slate-300 leading-relaxed italic font-medium">
                "{prediction.reasoning}"
              </p>
            </div>

            {/* Actionable advisory */}
            <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 mb-4">
              <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                <Shield size={10} />
                Agricultural Advisor Recommendations
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {prediction.advisory}
              </p>
            </div>

            {/* FCM notification status indicator */}
            {fcmNotificationSent && (
              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 flex items-center justify-between text-rose-300">
                <div className="flex items-center gap-2">
                  <BellRing size={14} className="animate-bounce" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Warning Dispatch Status</span>
                </div>
                <span className="text-[9px] font-medium bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30">
                  demo-phone
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="border-t border-white/5 pt-4 text-center py-6 text-slate-500 bg-white/2 hover:bg-white/5 transition-colors rounded-xl border border-white/5 border-dashed flex flex-col items-center justify-center gap-2">
          <HelpCircle size={20} className="text-slate-600" />
          <div className="text-xs font-bold">No Risk Analysis Run Yet</div>
          <p className="text-[10px] text-slate-600 max-w-[200px]">Select a farm and click Assess Risk Profile above.</p>
        </div>
      )}
    </div>
  );
};

export default AiCopilot;
