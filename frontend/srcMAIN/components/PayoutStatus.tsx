import React from 'react';
import { Clock, MapPin } from 'lucide-react';
import type { WeatherData, FarmData } from '../types';
import PayoutClaim from './PayoutClaim';

interface PayoutStatusProps {
  weather: WeatherData | null;
  farms: FarmData[];
  onClaim?: (farmId: string) => void;
  userPublicKey: string | null;
}

const PayoutStatus: React.FC<PayoutStatusProps> = ({ weather, farms }) => {
  if (!weather) return null;
  const isTriggered = weather.windSpeed > 100 || weather.rainfall > 200;

  return (
    <div className="space-y-6">
      <div className={`glass-panel border-2 transition-all duration-500 ${isTriggered ? 'border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.1)]' : 'border-white/5'}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-white">Smart Contract Engine</h3>
          <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${isTriggered ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/5 text-slate-500'}`}>
            {isTriggered ? 'CRITICAL TRIGGER' : 'MONITORING'}
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <div className="justify-between flex items-center mb-2">
              <span className="text-xs font-bold text-slate-400">Wind Trigger (&gt;100km/h)</span>
              <span className={`text-xs font-black ${weather.windSpeed > 100 ? 'text-rose-500' : 'text-slate-500'}`}>
                {weather.windSpeed.toFixed(0)} km/h
              </span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${weather.windSpeed > 100 ? 'bg-rose-500' : 'bg-sky-500'}`}
                style={{ width: `${Math.min(100, (weather.windSpeed / 100) * 100)}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-400">Rainfall Trigger (&gt;200mm)</span>
              <span className={`text-xs font-black ${weather.rainfall > 200 ? 'text-rose-500' : 'text-slate-500'}`}>
                {weather.rainfall.toFixed(0)} mm
              </span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${weather.rainfall > 200 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                style={{ width: `${Math.min(100, (weather.rainfall / 200) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2">Your Insured Assets</h4>
        {farms.map((farm) => (
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
                <div className="text-sm font-black text-white">₱{farm.totalCropValue.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Sum Insured</div>
              </div>
            </div>

            {isTriggered ? (
              <PayoutClaim
                isVerified={true}
                windSpeed={weather.windSpeed}
                farmData={farm}
                weather={weather}
              />
            ) : (
              <div className="w-full py-3 bg-white/5 rounded-xl flex items-center justify-center gap-2 border border-white/5">
                <Clock size={16} className="text-slate-500" />
                <span className="text-xs font-bold text-slate-500">Monitoring for Triggers...</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PayoutStatus;
