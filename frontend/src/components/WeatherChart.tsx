import React, { useState } from 'react';
import type { WeatherData } from '../types';

interface WeatherChartProps {
  weather: WeatherData | null;
}

export const WeatherChart: React.FC<WeatherChartProps> = ({ weather }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Generate mock historical data if actual hourly data is unavailable or empty
  const defaultTimes = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setHours(d.getHours() - (11 - i));
    return d;
  });

  const times = weather?.hourlyTime && weather.hourlyTime.length >= 12 
    ? weather.hourlyTime.slice(0, 12) 
    : defaultTimes;

  const windTrend = weather?.hourlyWindSpeed && weather.hourlyWindSpeed.length >= 12
    ? weather.hourlyWindSpeed.slice(0, 12)
    : [12, 18, 35, 45, 62, 80, 105, 126, 95, 75, 40, 22]; // Default simulated typhoon curve

  const rainTrend = weather?.hourlyPrecipitation && weather.hourlyPrecipitation.length >= 12
    ? weather.hourlyPrecipitation.slice(0, 12)
    : [5, 12, 28, 45, 70, 110, 160, 215, 140, 90, 45, 15]; // Default simulated flood curve

  const maxWind = Math.max(...windTrend, 150); // Scale up to at least 150 km/h
  const maxRain = Math.max(...rainTrend, 250); // Scale up to at least 250 mm

  // Chart configuration
  const width = 600;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 40;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Helper coordinate converters
  const getX = (index: number) => paddingLeft + (index / (times.length - 1)) * chartWidth;
  const getYWind = (val: number) => height - paddingBottom - (val / maxWind) * chartHeight;
  const getYRain = (val: number) => height - paddingBottom - (val / maxRain) * chartHeight;

  // Generate SVG Path
  const getLinePath = (data: number[], getYFunc: (v: number) => number) => {
    return data.reduce((acc, val, i) => {
      const x = getX(i);
      const y = getYFunc(val);
      return acc + `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }, '');
  };

  const getAreaPath = (data: number[], getYFunc: (v: number) => number) => {
    const path = getLinePath(data, getYFunc);
    if (!path) return '';
    return `${path} L ${getX(data.length - 1)} ${height - paddingBottom} L ${getX(0)} ${height - paddingBottom} Z`;
  };

  // Threshold Y positions
  const windThresholdY = getYWind(100);
  const rainThresholdY = getYRain(200);

  const formatHour = (d: Date) => {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm shadow-xl space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-black text-white text-sm uppercase tracking-wider">Parametric Telemetry Trends</h3>
          <p className="text-slate-400 text-xs">Real-time wind speed vs cumulative rainfall triggers</p>
        </div>
        <div className="flex gap-4 text-[10px] font-black uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-sky-400 rounded-full" />
            <span className="text-sky-400">Wind Speed (km/h)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-indigo-500 rounded-full" />
            <span className="text-indigo-400">Rainfall (mm)</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto overflow-visible select-none"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const relativeX = (mouseX / rect.width) * width;
            
            // Find closest index
            let closestIndex = 0;
            let minDiff = Infinity;
            for (let i = 0; i < times.length; i++) {
              const diff = Math.abs(getX(i) - relativeX);
              if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
              }
            }
            if (relativeX >= paddingLeft - 10 && relativeX <= width - paddingRight + 10) {
              setHoverIndex(closestIndex);
            } else {
              setHoverIndex(null);
            }
          }}
        >
          {/* Gradients */}
          <defs>
            <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="white" strokeOpacity="0.05" strokeDasharray="4 4" />
          <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="white" strokeOpacity="0.1" />

          {/* Threshold marker: Wind speed 100 km/h */}
          <line 
            x1={paddingLeft} 
            y1={windThresholdY} 
            x2={width - paddingRight} 
            y2={windThresholdY} 
            stroke="#f43f5e" 
            strokeOpacity="0.3" 
            strokeWidth={1.5}
            strokeDasharray="4 4" 
          />
          <text 
            x={width - paddingRight + 4} 
            y={windThresholdY + 3} 
            fill="#f43f5e" 
            fontSize={8} 
            fontWeight="bold"
            alignmentBaseline="middle"
          >
            100 km/h (Wind Trigger)
          </text>

          {/* Threshold marker: Rainfall 200 mm */}
          <line 
            x1={paddingLeft} 
            y1={rainThresholdY} 
            x2={width - paddingRight} 
            y2={rainThresholdY} 
            stroke="#ec4899" 
            strokeOpacity="0.3" 
            strokeWidth={1.5}
            strokeDasharray="4 4" 
          />
          <text 
            x={paddingLeft - 4} 
            y={rainThresholdY + 3} 
            fill="#ec4899" 
            fontSize={8} 
            fontWeight="bold"
            textAnchor="end"
            alignmentBaseline="middle"
          >
            200mm (Rain)
          </text>

          {/* Area under curves */}
          <path d={getAreaPath(windTrend, getYWind)} fill="url(#windGrad)" />
          <path d={getAreaPath(rainTrend, getYRain)} fill="url(#rainGrad)" />

          {/* Trend lines */}
          <path d={getLinePath(windTrend, getYWind)} fill="none" stroke="#38bdf8" strokeWidth={2.5} strokeLinecap="round" />
          <path d={getLinePath(rainTrend, getYRain)} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" />

          {/* X Axis Labels */}
          {times.map((time, i) => (
            i % 2 === 0 && (
              <text 
                key={i} 
                x={getX(i)} 
                y={height - 10} 
                fill="#64748b" 
                fontSize={8} 
                textAnchor="middle" 
                fontWeight="bold"
              >
                {formatHour(time)}
              </text>
            )
          ))}

          {/* Hover interactive overlay */}
          {hoverIndex !== null && (
            <>
              {/* Vertical line indicator */}
              <line 
                x1={getX(hoverIndex)} 
                y1={paddingTop} 
                x2={getX(hoverIndex)} 
                y2={height - paddingBottom} 
                stroke="white" 
                strokeOpacity="0.25" 
                strokeWidth={1}
              />
              
              {/* Wind marker dot */}
              <circle 
                cx={getX(hoverIndex)} 
                cy={getYWind(windTrend[hoverIndex])} 
                r={4} 
                fill="#38bdf8" 
                stroke="white" 
                strokeWidth={1.5} 
              />

              {/* Rain marker dot */}
              <circle 
                cx={getX(hoverIndex)} 
                cy={getYRain(rainTrend[hoverIndex])} 
                r={4} 
                fill="#6366f1" 
                stroke="white" 
                strokeWidth={1.5} 
              />
            </>
          )}
        </svg>

        {/* Hover Tooltip Overlay (HTML absolute container) */}
        {hoverIndex !== null && (
          <div 
            className="absolute z-20 pointer-events-none bg-slate-900/90 border border-white/10 p-2.5 rounded-xl shadow-xl text-[10px] space-y-1 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `${(getX(hoverIndex) / width) * 100}%`,
              top: `${(Math.min(getYWind(windTrend[hoverIndex]), getYRain(rainTrend[hoverIndex])) / height) * 100 - 35}%`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="font-bold text-white text-center pb-0.5 border-b border-white/5">
              {formatHour(times[hoverIndex])}
            </div>
            <div className="flex justify-between gap-4 text-sky-400 font-bold">
              <span>💨 Wind:</span>
              <span className="font-mono">{windTrend[hoverIndex].toFixed(1)} km/h</span>
            </div>
            <div className="flex justify-between gap-4 text-indigo-400 font-bold">
              <span>🌧️ Rainfall:</span>
              <span className="font-mono">{rainTrend[hoverIndex].toFixed(1)} mm</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
