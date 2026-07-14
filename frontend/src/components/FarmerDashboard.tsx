import React from 'react';
import { Shield, Zap, Info, Sprout, Wind, Droplets, MapPin, CheckCircle2, ChevronRight, Activity, AlertTriangle, ArrowUpRight, CloudRain, Clock, Camera, Crosshair, TrendingUp, FileText } from 'lucide-react';
import { useCountUp } from '../hooks/useCountUp';
import MagneticButton from './MagneticButton';
import WeatherWidget from './WeatherWidget';
import AssetDistribution from './AssetDistribution';
import PayoutStatus from './PayoutStatus';
import WeatherMap from './WeatherMap';
import { WeatherChart } from './WeatherChart';
import AiCopilot from './AiCopilot';
import { MapContainer, TileLayer } from 'react-leaflet';
import { PHILIPPINE_REGIONS } from '../constants';

export const FarmerDashboard = ({ 
  farms, profile, network, walletAddress, notificationHistory, 
  onAddFarm, onDeleteFarm, weather, isLoadingWeather,
  isSandboxToggleEnabled, setIsSandboxToggleEnabled,
  isSimulatingWeather, handleResetWeather, handleSimulateWeather,
  claims, addNotification, setWeather
}: any) => {
  const totalInsuredValue = farms.reduce((acc: any, farm: any) => acc + Number(farm.totalCropValue || 0), 0);
  const totalAreaValue = farms.reduce((acc: any, farm: any) => acc + Number(farm.farmSize || 0), 0);
  const activeFarmsCount = farms.length;

  const { value: animatedInsuredValue } = useCountUp(totalInsuredValue, 1100, 0);
  const { value: animatedAreaValue } = useCountUp(totalAreaValue, 1100, 1);
  const { value: animatedFarmsCount } = useCountUp(activeFarmsCount, 1100, 0);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 lg:space-y-8 pb-32 animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl lg:text-5xl font-black text-white tracking-tighter uppercase italic">
            Farmer <span className={network === 'mainnet' ? 'text-emerald-400' : 'text-sky-400'}>Command</span>
          </h2>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-widest mt-1">Active Shield Overview</p>
        </div>
        <MagneticButton 
          onClick={onAddFarm}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-sm uppercase tracking-wider transition-all shadow-lg hover:shadow-xl ${
            network === 'mainnet' 
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-emerald-500/20' 
              : 'bg-sky-500 hover:bg-sky-400 text-slate-900 shadow-sky-500/20'
          }`}
        >
          <Zap size={16} />
          Register New Farm
        </MagneticButton>
      </div>

      {/* Oracle Status Banner */}
      {weather && (
        <div className={`rounded-2xl border px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest transition-all ${
          weather.isTyphoonActive
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 animate-pulse'
            : weather.oracleWindSpeed != null
            ? 'bg-sky-500/10 border-sky-500/20 text-sky-300'
            : 'bg-white/5 border-white/5 text-slate-500'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${weather.isTyphoonActive ? 'bg-rose-400' : weather.oracleWindSpeed != null ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            <span>
              {weather.isTyphoonActive
                ? '⚠️ Oracle: Active Typhoon Detected'
                : weather.oracleWindSpeed != null
                ? '✅ Oracle: Clear — No Active Typhoon'
                : '⏳ Oracle: Awaiting First Scrape (runs every 15 min)'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            {weather.oracleMaxWindSpeed != null && (
              <span>Max Wind: <span className="text-white">{weather.oracleMaxWindSpeed} km/h</span></span>
            )}
            {weather.oracleWindSpeed != null && (
              <span>Avg Wind: <span className="text-white">{(weather.oracleWindSpeed as number).toFixed(1)} km/h</span></span>
            )}
            {weather.oracleTriggerMet && (
              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-lg">
                🚨 Trigger Threshold Met
              </span>
            )}
            {weather.oracleTimestamp && (
              <span className="text-slate-500">
                Updated: {new Date(weather.oracleTimestamp as string).toLocaleTimeString()}
              </span>
            )}
            <a
              href="https://tyfi-oracle.onrender.com/api/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
            >
              Raw →
            </a>
          </div>
        </div>
      )}

      {/* 1. Total Insured Value */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="glass-panel border-white/10 lg:col-span-12 p-8 flex flex-col justify-between min-h-[300px]">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Shield size={160} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-3 h-3 rounded-full animate-pulse ${network === 'mainnet' ? 'bg-emerald-400' : 'bg-sky-400'}`}></span>
              <span className="text-xs font-black uppercase tracking-widest text-slate-300">Total Insured Value</span>
            </div>
            <div className="text-5xl lg:text-7xl font-black text-white tracking-tighter">
              {animatedInsuredValue.toLocaleString()} <span className={network === 'mainnet' ? 'text-emerald-500' : 'text-sky-500'}>XLM</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-md">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Active Farms</div>
              <div className="text-2xl font-black text-white">{animatedFarmsCount}</div>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-md">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Total Area</div>
              <div className="text-2xl font-black text-white">{animatedAreaValue} <span className="text-sm text-slate-500">Ha</span></div>
            </div>
            <div className="col-span-2 bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-md flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Network Status</div>
                <div className="text-sm font-black text-white flex items-center gap-1.5">
                  <CheckCircle2 size={16} className={network === 'mainnet' ? 'text-emerald-400' : 'text-sky-400'} />
                  {network === 'mainnet' ? 'MAINNET ACTIVE' : 'TESTNET ACTIVE'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. The Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12 glass-panel min-h-[400px] relative overflow-hidden border-0 p-0">
            <WeatherMap 
              weather={weather} 
              isLoading={isLoadingWeather} 
              regionName={farms[0]?.region}
              farmName={farms[0]?.farmName}
              farms={farms}
            />
        </div>
      </div>

      {/* 3. Open Meteo Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="glass-panel border-white/10 lg:col-span-12 p-0">
          {weather ? (
             <WeatherWidget weather={weather} isLoading={isLoadingWeather} onRefresh={() => {}} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-900/50">
               <CloudRain size={48} className="text-slate-600 mb-4" />
               <p className="text-slate-400 font-medium">Fetching Live Oracle Data...</p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Parametric Telemetry Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="glass-panel border-white/10 lg:col-span-12 p-6">
           <WeatherChart weather={weather} />
        </div>
      </div>

      {/* 5. Live Satellite Surveillance */}
      {farms.length > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Camera size={16} className={network === 'mainnet' ? 'text-emerald-400' : 'text-sky-400'} />
            Live Satellite Surveillance
          </h3>
          <p className="text-xs text-slate-400 mb-4">Real-time satellite feed of your registered agricultural zones. Positioned and locked directly over the designated farm coordinates.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {farms.map((farm: any) => {
              const lat = farm.latitude || (PHILIPPINE_REGIONS.find((r: any) => r.name === farm.region)?.coordinates[0] || 12.8797);
              const lng = farm.longitude || (PHILIPPINE_REGIONS.find((r: any) => r.name === farm.region)?.coordinates[1] || 121.774);
              
              return (
                <div key={farm.id} className="glass-panel p-3 border border-white/10 relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-xs font-black text-white truncate max-w-[150px]">{farm.farmName}</h4>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest">{farm.region} - {farm.cropType}</p>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-[9px] font-black text-rose-500 uppercase tracking-widest animate-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                        LIVE
                      </div>
                  </div>
                  <div className="w-full h-48 rounded-xl overflow-hidden relative pointer-events-none border border-white/5">
                      <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
                        <Crosshair className="text-white/60 drop-shadow-md" size={32} strokeWidth={1.5} />
                      </div>
                      <MapContainer
                        center={[lat, lng]}
                        zoom={16}
                        zoomControl={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        dragging={false}
                        touchZoom={false}
                        attributionControl={false}
                        style={{ height: '100%', width: '100%', zIndex: 1 }}
                      >
                        <TileLayer 
                          url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" 
                        />
                      </MapContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Farm Portfolio and AI Chatbot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
        <div className="glass-panel border-white/10 lg:col-span-12 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-white uppercase tracking-widest">Farm Portfolio</h3>
            <TrendingUp className="text-slate-500" size={20} />
          </div>
          <AssetDistribution farms={farms} />
        </div>
      </div>

      {/* 7. Payouts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
        <div className="glass-panel border-white/10 lg:col-span-12 p-6 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-white uppercase tracking-widest">Payouts</h3>
            <FileText className="text-slate-500" size={20} />
          </div>
          <div className="flex-1">
             <PayoutStatus weather={weather} farms={farms} />
          </div>
        </div>
      </div>

    </div>
  );
};
