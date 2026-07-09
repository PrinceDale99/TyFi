import React from 'react';
import { Shield, CloudRain, Clock, ArrowUpRight, Zap, TrendingUp, Sun, FileText, CheckCircle2, Camera, Crosshair, Wind, AlertTriangle, X } from 'lucide-react';
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
        <button 
          onClick={onAddFarm}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm uppercase tracking-wider transition-all shadow-lg hover:shadow-xl ${
            network === 'mainnet' 
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-emerald-500/20' 
              : 'bg-sky-500 hover:bg-sky-400 text-slate-900 shadow-sky-500/20'
          }`}
        >
          <Zap size={16} />
          Register New Farm
        </button>
      </div>

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
              {farms.reduce((acc: any, farm: any) => acc + Number(farm.coverageAmount || 0), 0).toLocaleString()} <span className={network === 'mainnet' ? 'text-emerald-500' : 'text-sky-500'}>XLM</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-md">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Active Farms</div>
              <div className="text-2xl font-black text-white">{farms.length}</div>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-md">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Total Area</div>
              <div className="text-2xl font-black text-white">{farms.reduce((acc: any, farm: any) => acc + Number(farm.size || 0), 0)} <span className="text-sm text-slate-500">Ha</span></div>
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
        <div className="glass-panel border-white/10 lg:col-span-8 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-white uppercase tracking-widest">Farm Portfolio</h3>
            <TrendingUp className="text-slate-500" size={20} />
          </div>
          <AssetDistribution farms={farms} />
        </div>
        
        {/* Sandbox and AI Copilot side column */}
        <div className="lg:col-span-4 space-y-6">
          {network === 'testnet' && (
            <div className="glass-panel border border-indigo-500/20 shadow-[0_0_25px_rgba(99,102,241,0.05)] relative overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl" />
              
              <div className="flex items-center gap-2 mb-4">
                <span className="flex h-2 w-2 relative">
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isSandboxToggleEnabled ? 'animate-ping bg-indigo-400' : 'bg-emerald-400 animate-pulse'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isSandboxToggleEnabled ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
                </span>
                <h3 className="font-black text-white text-sm uppercase tracking-wider flex-1">🧪 Sandbox Weather Simulator</h3>
                
                <button 
                  onClick={() => {
                    setIsSandboxToggleEnabled(!isSandboxToggleEnabled);
                    if (isSandboxToggleEnabled && handleResetWeather) {
                      handleResetWeather();
                    }
                  }}
                  className={`w-10 h-5 rounded-full p-1 transition-colors duration-300 ${isSandboxToggleEnabled ? 'bg-indigo-500' : 'bg-white/10'}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-300 ${isSandboxToggleEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>

                {isSimulatingWeather && (
                  <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">Active</span>
                )}
              </div>
              
              <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
                Trigger simulated weather events to test the Soroban contract parametric payout logic and ledger updates in an isolated sandbox.
              </p>
              
              <div className="space-y-2.5">
                <button
                  onClick={() => handleSimulateWeather && handleSimulateWeather('normal')}
                  className={`w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group ${
                    isSimulatingWeather && weather?.windSpeed === 45
                      ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🌤️</span>
                    <div>
                      <div className="font-bold">Normal Conditions</div>
                      <div className="text-[9px] text-slate-500 font-medium">45 km/h Wind | 25mm Rain (0% Payout)</div>
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
                </button>

                <button
                  onClick={() => handleSimulateWeather && handleSimulateWeather('wind_trigger')}
                  className={`w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group ${
                    isSimulatingWeather && weather?.windSpeed === 115
                      ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">💨</span>
                    <div>
                      <div className="font-bold">Moderate Typhoon</div>
                      <div className="text-[9px] text-slate-500 font-medium">115 km/h Wind | 80mm Rain (30% Payout)</div>
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
                </button>

                <button
                  onClick={() => handleSimulateWeather && handleSimulateWeather('rain_trigger')}
                  className={`w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group ${
                    isSimulatingWeather && weather?.windSpeed === 135
                      ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🌧️</span>
                    <div>
                      <div className="font-bold">Severe Typhoon</div>
                      <div className="text-[9px] text-slate-500 font-medium">135 km/h Wind | 220mm Rain (70% Payout)</div>
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
                </button>

                <button
                  onClick={() => handleSimulateWeather && handleSimulateWeather('double_trigger')}
                  className={`w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group ${
                    isSimulatingWeather && weather?.windSpeed === 165
                      ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🌀</span>
                    <div>
                      <div className="font-bold">Super Typhoon</div>
                      <div className="text-[9px] text-slate-500 font-medium">165 km/h Wind | 350mm Rain (100% Payout)</div>
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
                </button>

                {isSimulatingWeather && handleResetWeather && (
                  <button
                    onClick={handleResetWeather}
                    className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5"
                  >
                    Revert to Live API Feeds
                  </button>
                )}
              </div>
            </div>
          )}

          {farms.length > 0 && typeof setWeather === 'function' && (
            <AiCopilot
              accountId={walletAddress}
              weather={weather}
              farms={farms}
              claims={claims}
              addNotification={addNotification}
              onUpdateWeatherDamage={(damage: number, status: string, aiDamage?: number, confidence?: number) => {
                setWeather((prev: any) => prev ? {
                  ...prev,
                  damageEstimation: damage,
                  aiDamageEstimation: aiDamage,
                  agromonitorStatus: status
                } : null);
              }}
              network={network}
            />
          )}
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
