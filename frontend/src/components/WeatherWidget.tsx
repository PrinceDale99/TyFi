import React, { useRef, useEffect } from 'react';
import { Wind, CloudRain, Zap, RefreshCw, Activity } from 'lucide-react';
import type { WeatherData } from '../types';

interface WeatherWidgetProps {
  weather: WeatherData;
  isLoading?: boolean;
  onRefresh?: () => void;
}

/** Draw a small sparkline on a canvas */
function drawSparkline(
  canvas: HTMLCanvasElement,
  data: number[],
  color: string
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || data.length < 2) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts: [number, number][] = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / range) * h * 0.8 - h * 0.1,
  ]);

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color + '60');
  grad.addColorStop(1, color + '00');

  ctx.beginPath();
  ctx.moveTo(pts[0][0], h);
  pts.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(pts[pts.length - 1][0], h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

const WMO_LABELS: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Heavy thunderstorm',
};

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, isLoading, onRefresh }) => {
  const windRef = useRef<HTMLCanvasElement>(null);
  const rainRef = useRef<HTMLCanvasElement>(null);

  // Draw sparklines from the last 24-hours of hourly data
  useEffect(() => {
    if (!weather.hourlyTime || !weather.hourlyWindSpeed || !weather.hourlyPrecipitation) return;

    const now = new Date();
    const indices: number[] = [];
    weather.hourlyTime.forEach((t, i) => {
      const diffH = (now.getTime() - t.getTime()) / 3_600_000;
      if (diffH >= 0 && diffH <= 24) indices.push(i);
    });

    if (windRef.current && weather.hourlyWindSpeed) {
      const slice = indices.map(i => weather.hourlyWindSpeed![i]);
      drawSparkline(windRef.current, slice, '#38bdf8');
    }
    if (rainRef.current && weather.hourlyPrecipitation) {
      const slice = indices.map(i => weather.hourlyPrecipitation![i]);
      drawSparkline(rainRef.current, slice, '#818cf8');
    }
  }, [weather]);

  const wmoLabel = WMO_LABELS[weather.weatherCode] ?? `Code ${weather.weatherCode}`;
  const updatedStr = weather.updatedAt
    ? weather.updatedAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold">
          <Activity size={14} className="text-emerald-400" />
          <span className="text-slate-400">Open-Meteo Live Feed</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">Updated {updatedStr}</span>
          {isLoading && <RefreshCw size={12} className="text-sky-400 animate-spin ml-1" />}
        </div>
        {onRefresh && (
          <button
            id="weather-refresh-btn"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400 hover:text-white transition-all disabled:opacity-40"
            title="Refresh weather data"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* Condition pill */}
      <div className="flex items-center gap-3">
        <div className={`px-4 py-1.5 rounded-full text-sm font-black border ${
          weather.condition === 'Stormy' || weather.condition === 'Thunder'
            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
            : weather.condition === 'Rainy'
            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
            : weather.condition === 'Cloudy'
            ? 'bg-slate-500/20 border-slate-500/40 text-slate-300'
            : 'bg-sky-500/20 border-sky-500/40 text-sky-300'
        }`}>
          {wmoLabel}
        </div>
        {weather.condition === 'Thunder' && <Zap size={16} className="text-amber-400" />}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Wind Speed */}
        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl">
              <Wind size={16} />
            </div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Wind</span>
          </div>
          <div className="text-2xl font-black text-white">
            {weather.windSpeed.toFixed(1)}
            <span className="text-xs text-slate-500 ml-1">km/h</span>
          </div>
          <canvas ref={windRef} width={120} height={32} className="w-full mt-2 opacity-70" />
          <div className="text-[10px] text-slate-600 mt-1">24h trend</div>
        </div>

        {/* Wind Gusts */}
        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
              <Wind size={16} />
            </div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Gusts</span>
          </div>
          <div className="text-2xl font-black text-white">
            {weather.windGusts.toFixed(1)}
            <span className="text-xs text-slate-500 ml-1">km/h</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-3">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (weather.windGusts / 200) * 100)}%`,
                backgroundColor:
                  weather.windGusts > 120
                    ? '#f43f5e'
                    : weather.windGusts > 60
                    ? '#f59e0b'
                    : '#38bdf8',
              }}
            />
          </div>
          <div className="text-[10px] text-slate-600 mt-1">threshold 120 km/h</div>
        </div>

        {/* Precipitation */}
        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <CloudRain size={16} />
            </div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Rain</span>
          </div>
          <div className="text-2xl font-black text-white">
            {weather.rainfall.toFixed(1)}
            <span className="text-xs text-slate-500 ml-1">mm</span>
          </div>
          <canvas ref={rainRef} width={120} height={32} className="w-full mt-2 opacity-70" />
          <div className="text-[10px] text-slate-600 mt-1">24h trend</div>
        </div>

        {/* Rain (liquid component) */}
        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <CloudRain size={16} />
            </div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Liquid</span>
          </div>
          <div className="text-2xl font-black text-white">
            {weather.rain.toFixed(1)}
            <span className="text-xs text-slate-500 ml-1">mm</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (weather.rain / 50) * 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-600 mt-1">liquid rain only</div>
        </div>

        {/* Agromonitor Damage Estimation */}
        {weather.damageEstimation !== undefined && (
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-red-500/10 text-red-400 rounded-xl">
                <Activity size={16} />
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Est. Damage</span>
            </div>
            <div className="text-2xl font-black text-white">
              {weather.damageEstimation.toFixed(0)}
              <span className="text-xs text-slate-500 ml-1">%</span>
            </div>
            <div className="text-[10px] text-slate-600 mt-2 truncate">Status: {weather.agromonitorStatus}</div>
          </div>
        )}

        {/* Agromonitor Crop Health Index */}
        {weather.cropHealthIndex !== undefined && (
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-green-500/10 text-green-400 rounded-xl">
                <Activity size={16} />
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Crop Health</span>
            </div>
            <div className="text-2xl font-black text-white">
              {(weather.cropHealthIndex * 100).toFixed(0)}
              <span className="text-xs text-slate-500 ml-1">/100</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-700"
                style={{ width: `${weather.cropHealthIndex * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Visibility */}
        {weather.visibility !== undefined && (
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-slate-500/10 text-slate-400 rounded-xl">
                <Wind size={16} />
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Visibility</span>
            </div>
            <div className="text-2xl font-black text-white">
              {(weather.visibility / 1000).toFixed(1)}
              <span className="text-xs text-slate-500 ml-1">km</span>
            </div>
            <div className="text-[10px] text-slate-600 mt-2">OpenWeather</div>
          </div>
        )}

        {/* Cloud Cover */}
        {weather.cloudCover !== undefined && (
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-slate-500/10 text-slate-400 rounded-xl">
                <Wind size={16} />
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Clouds</span>
            </div>
            <div className="text-2xl font-black text-white">
              {weather.cloudCover}
              <span className="text-xs text-slate-500 ml-1">%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-slate-400 rounded-full transition-all duration-700"
                style={{ width: `${weather.cloudCover}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherWidget;
