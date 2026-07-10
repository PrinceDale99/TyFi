import re

with open('src/components/FarmerDashboard.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Make sure AiCopilot is imported
if 'import AiCopilot' not in text:
    text = text.replace("import { WeatherChart } from './WeatherChart';", "import { WeatherChart } from './WeatherChart';\nimport AiCopilot from './AiCopilot';\nimport { Wind, Sun, AlertTriangle, X } from 'lucide-react';")

state_injection = """
  // Sandbox State
  const [isSandboxEnabled, setIsSandboxEnabled] = React.useState(false);
  const [isSimulatingWeather, setIsSimulatingWeather] = React.useState(false);
  const [simulatedWeather, setSimulatedWeather] = React.useState<any>(null);

  const displayWeather = isSimulatingWeather && simulatedWeather ? simulatedWeather : weather;

  const handleSimulateWeather = (type: string) => {
    if (!isSandboxEnabled) {
      alert("Sandbox mode is disabled. The Oracle detects no typhoons or hurricanes or any destructive natural disaster.");
      return;
    }
    setIsSimulatingWeather(true);
    let sim: any = { ...weather };
    if (type === 'normal') {
      sim.windSpeed = 45;
      sim.rainfall = 25;
      sim.condition = 'Clear';
      sim.agromonitorStatus = 'Normal';
    } else if (type === 'wind_trigger') {
      sim.windSpeed = 115;
      sim.rainfall = 80;
      sim.condition = 'Stormy';
      sim.agromonitorStatus = 'High Risk - Wind Damage';
    } else if (type === 'rain_trigger') {
      sim.windSpeed = 50;
      sim.rainfall = 250;
      sim.condition = 'Heavy Rain';
      sim.agromonitorStatus = 'Flood Risk - Saturated Soil';
    } else if (type === 'double_trigger') {
      sim.windSpeed = 165;
      sim.rainfall = 300;
      sim.condition = 'Super Typhoon';
      sim.agromonitorStatus = 'Critical - Severe Typhoon Impact';
    }
    setSimulatedWeather(sim);
  };

  const handleResetWeather = () => {
    setIsSimulatingWeather(false);
    setSimulatedWeather(null);
  };
"""

idx_start = text.find('export const FarmerDashboard = ({')
idx_brace = text.find('{', idx_start)
idx_end_brace = text.find(') => {', idx_brace)

if idx_end_brace != -1:
    text = text[:idx_end_brace + 6] + state_injection + text[idx_end_brace + 6:]

idx_return = text.find('return (', idx_end_brace)

new_jsx = """return (
    <div className="w-full max-w-7xl mx-auto space-y-6 lg:space-y-8 pb-32 animate-in fade-in duration-700">
      
      {/* 1. Total Insured Value */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ParallaxCard className="lg:col-span-12 p-8 flex flex-col justify-between min-h-[300px]">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Shield size={160} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={w-3 h-3 rounded-full animate-pulse }></span>
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
        </ParallaxCard>
      </div>

      {/* 2. The Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ParallaxCard className="lg:col-span-12 p-0">
          <div className="glass-panel min-h-[400px] relative overflow-hidden border-0">
            <WeatherMap 
              weather={displayWeather} 
              isLoading={isLoadingWeather} 
              regionName={farms[0]?.region}
              farmName={farms[0]?.farmName}
              farms={farms}
            />
          </div>
        </ParallaxCard>
      </div>

      {/* 3. Open Meteo Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ParallaxCard className="lg:col-span-12 p-0">
          {displayWeather ? (
             <WeatherWidget weather={displayWeather} isLoading={isLoadingWeather} onRefresh={() => {}} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-900/50">
               <CloudRain size={48} className="text-slate-600 mb-4" />
               <p className="text-slate-400 font-medium">Fetching Live Oracle Data...</p>
            </div>
          )}
        </ParallaxCard>
      </div>

      {/* 4. Parametric Telemetry Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ParallaxCard className="lg:col-span-12 p-6">
           <WeatherChart weather={displayWeather} />
        </ParallaxCard>
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ParallaxCard className="lg:col-span-8 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-white uppercase tracking-widest">Farm Portfolio</h3>
            <TrendingUp className="text-slate-500" size={20} />
          </div>
          <AssetDistribution farms={farms} />
        </ParallaxCard>
        
        <ParallaxCard className="lg:col-span-4 p-0 flex flex-col h-[600px]">
          <AiCopilot weather={displayWeather} farms={farms} addNotification={() => {}} network={network} />
        </ParallaxCard>
      </div>

      {/* 7. Payouts and Weather Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ParallaxCard className="lg:col-span-8 p-6 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-white uppercase tracking-widest">Payouts</h3>
            <FileText className="text-slate-500" size={20} />
          </div>
          <div className="flex-1">
             <PayoutStatus weather={displayWeather} farms={farms} />
          </div>
        </ParallaxCard>

        <ParallaxCard className="lg:col-span-4 p-6 flex flex-col h-[600px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-2 w-2 relative">
              <span className={bsolute inline-flex h-full w-full rounded-full opacity-75 }></span>
              <span className={elative inline-flex rounded-full h-2 w-2 }></span>
            </span>
            <h3 className="font-black text-white text-sm uppercase tracking-wider flex-1">Weather Sandbox</h3>
            
            <button 
              onClick={() => {
                setIsSandboxEnabled(!isSandboxEnabled);
                if (isSandboxEnabled) {
                  handleResetWeather();
                }
              }}
              className={w-10 h-5 rounded-full p-1 transition-colors duration-300 }
            >
              <div className={w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-300 } />
            </button>
          </div>

          {!isSandboxEnabled ? (
            <div className="py-6 text-center bg-emerald-500/5 border border-emerald-500/10 rounded-xl mt-8">
              <Wind className="mx-auto text-emerald-400 mb-2" size={24} />
              <h4 className="text-emerald-400 font-bold text-sm mb-1 uppercase tracking-widest">Oracle Active</h4>
              <p className="text-[10px] text-slate-400 font-medium px-4">Simulator disabled. Strictly relying on decentralized Oracle feeds. The Oracle detects no typhoons or hurricanes or any destructive natural disaster.</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
                Trigger simulated weather events to test the Soroban contract parametric payout logic.
              </p>
              
              <div className="space-y-2.5">
                <button onClick={() => handleSimulateWeather('normal')} className="w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]">
                  <div className="flex items-center gap-2.5"><Sun size={16} /> Normal Weather</div>
                </button>
                <button onClick={() => handleSimulateWeather('wind_trigger')} className="w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]">
                  <div className="flex items-center gap-2.5"><Wind size={16} /> Wind Trigger</div>
                </button>
                <button onClick={() => handleSimulateWeather('rain_trigger')} className="w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]">
                  <div className="flex items-center gap-2.5"><CloudRain size={16} /> Rain Trigger</div>
                </button>
                <button onClick={() => handleSimulateWeather('double_trigger')} className="w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]">
                  <div className="flex items-center gap-2.5"><AlertTriangle size={16} /> Super Typhoon</div>
                </button>
                {isSimulatingWeather && (
                  <button onClick={handleResetWeather} className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 mt-4">
                    <X size={12} /> Reset to Oracle
                  </button>
                )}
              </div>
            </>
          )}
        </ParallaxCard>
      </div>

    </div>
  );
};
"""

text = text[:idx_return] + new_jsx

with open('src/components/FarmerDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Constructed new layout")
