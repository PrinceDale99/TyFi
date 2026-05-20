import React, { useState, useEffect } from 'react';
import { Wind, CloudRain, Thermometer, Droplets, Navigation, Shield } from 'lucide-react';

interface WeatherMonitorProps {
  regionName: string;
  onWeatherUpdate: (wind: number, rain: number, flood: number) => void;
}

const WeatherMonitor: React.FC<WeatherMonitorProps> = ({ regionName, onWeatherUpdate }) => {
  const [windSpeed, setWindSpeed] = useState(45);
  const [rainfall, setRainfall] = useState(12);
  const [floodDepth, setFloodDepth] = useState(0);

  useEffect(() => {
    onWeatherUpdate(windSpeed, rainfall, floodDepth);
  }, [windSpeed, rainfall, floodDepth, onWeatherUpdate]);

  return (
    <div className="glass-panel">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Navigation size={20} className="text-sky-400" /> Weather Matrix
          </h3>
          <p className="text-xs text-slate-500 font-medium">{regionName} • Real-time Feeds</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${windSpeed > 100 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {windSpeed > 100 ? 'Warning' : 'Normal'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center text-center">
          <Wind className={windSpeed > 100 ? 'text-rose-400' : 'text-sky-400'} size={24} />
          <div className="text-2xl font-black text-white mt-2">{windSpeed} <span className="text-sm font-medium text-slate-500">km/h</span></div>
          <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">Wind Speed</div>
        </div>
        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center text-center">
          <CloudRain className="text-sky-400" size={24} />
          <div className="text-2xl font-black text-white mt-2">{rainfall} <span className="text-sm font-medium text-slate-500">mm/h</span></div>
          <div className="text-[10px] text-slate-500 uppercase font-bold mt-1">Precipitation</div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="px-1 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wind Velocity (km/h)</span>
            <span className={`text-[10px] font-black ${windSpeed > 120 ? 'text-rose-400' : 'text-slate-500'}`}>
              {windSpeed < 60 ? 'BREEZE' : windSpeed < 120 ? 'GALE' : 'TYPHOON'}
            </span>
          </div>
          <input 
            type="range" 
            min="20" 
            max="250" 
            value={windSpeed} 
            onChange={(e) => setWindSpeed(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>

        <div className="px-1 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rain Intensity (mm/h)</span>
            <span className="text-[10px] font-black text-slate-500">{rainfall} MM/H</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="300" 
            value={rainfall} 
            onChange={(e) => setRainfall(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>

        <div className="px-1 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Flood Saturation (cm)</span>
            <span className="text-[10px] font-black text-slate-500">{floodDepth} CM</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="150" 
            value={floodDepth} 
            onChange={(e) => setFloodDepth(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="flex items-center gap-3">
            <Thermometer size={14} className="text-slate-500" />
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase">Temp</div>
              <div className="text-xs text-white font-bold">28°C</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Droplets size={14} className="text-slate-500" />
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase">Humidity</div>
              <div className="text-xs text-white font-bold">84%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-sky-500/5 rounded-2xl border border-sky-500/10 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400">
          <Shield size={20} />
        </div>
        <div>
          <p className="text-[10px] text-sky-400 font-black uppercase tracking-widest">Vault Protection</p>
          <p className="text-[11px] text-slate-400 font-medium">Auto-payout enabled for {regionName}.</p>
        </div>
      </div>
    </div>
  );
};

export default WeatherMonitor;
