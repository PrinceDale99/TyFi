import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add ParallaxCard before App
if 'const ParallaxCard' not in content:
    parallax_card_code = """
const ParallaxCard = ({ children, className }: any) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = React.useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const rotateY = ((mouseX / width) - 0.5) * 10;
    const rotateX = ((mouseY / height) - 0.5) * -10;
    setRotation({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transformStyle: "preserve-3d",
        transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        transition: rotation.x === 0 && rotation.y === 0 ? "transform 0.5s ease-out" : "transform 0.1s ease-out"
      }}
      className={`glass-panel border-white/10 shadow-2xl relative overflow-hidden ${className || ''}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50 pointer-events-none" style={{ transform: "translateZ(20px)" }} />
      <div style={{ transform: "translateZ(40px)" }} className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
};

function App() {"""
    content = content.replace('function App() {', parallax_card_code)

# 2. Add isSandboxEnabled state
if 'const [isSandboxEnabled' not in content:
    content = content.replace('const [isSimulatingWeather, setIsSimulatingWeather] = useState(false);', 'const [isSandboxEnabled, setIsSandboxEnabled] = useState(false);\n  const [isSimulatingWeather, setIsSimulatingWeather] = useState(false);')

# 3. Replace Sandbox Simulator Box
sandbox_pattern = re.compile(r'\{isTestnet && \(\s*<div className="glass-panel border border-indigo-500/20 shadow-\[0_0_25px_rgba\(99,102,241,0\.05\)\] relative overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">.*?</div>\s*\)\}', re.DOTALL)

sandbox_replacement = """{isTestnet && (
                  <ParallaxCard className="border-indigo-500/20 shadow-[0_0_25px_rgba(99,102,241,0.05)] animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl" />
                    
                    <div className="flex items-center gap-2 mb-4">
                      <span className="flex h-2 w-2 relative">
                        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isSandboxEnabled ? 'animate-ping bg-indigo-400' : 'bg-emerald-400 animate-pulse'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isSandboxEnabled ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
                      </span>
                      <h3 className="font-black text-white text-sm uppercase tracking-wider flex-1">Sandbox Simulator</h3>
                      
                      {/* TOGGLE SWITCH */}
                      <button 
                        onClick={() => {
                          setIsSandboxEnabled(!isSandboxEnabled);
                          if (isSandboxEnabled) {
                            handleResetWeather();
                          }
                        }}
                        className={`w-10 h-5 rounded-full p-1 transition-colors duration-300 ${isSandboxEnabled ? 'bg-indigo-500' : 'bg-white/10'}`}
                      >
                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-300 ${isSandboxEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {!isSandboxEnabled ? (
                      <div className="py-6 text-center bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                        <Wind className="mx-auto text-emerald-400 mb-2" size={24} />
                        <h4 className="text-emerald-400 font-bold text-sm mb-1 uppercase tracking-widest">Oracle Active</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Relying on decentralized Open-Meteo feeds</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
                          Trigger simulated weather events to test the Soroban contract parametric payout logic and ledger updates in an isolated sandbox.
                        </p>
                        
                        <div className="space-y-2.5">
                          <button
                            onClick={() => handleSimulateWeather('normal')}
                            className={`w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group ${
                              isSimulatingWeather && weather?.windSpeed === 45
                                ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                                : 'bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Sun size={16} />
                              Normal Weather (45 km/h)
                            </div>
                            <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
                          </button>

                          <button
                            onClick={() => handleSimulateWeather('wind_trigger')}
                            className={`w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group ${
                              isSimulatingWeather && weather?.windSpeed === 115
                                ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                                : 'bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Wind size={16} />
                              Wind Trigger (>= 110 km/h)
                            </div>
                            <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
                          </button>
                          
                          <button
                            onClick={() => handleSimulateWeather('rain_trigger')}
                            className={`w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group ${
                              isSimulatingWeather && weather?.windSpeed === 135
                                ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                                : 'bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <CloudRain size={16} />
                              Rain Trigger (>= 200 mm)
                            </div>
                            <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
                          </button>
                          
                          <button
                            onClick={() => handleSimulateWeather('double_trigger')}
                            className={`w-full py-2.5 px-4 rounded-xl text-left border text-xs font-bold transition-all flex items-center justify-between group ${
                              isSimulatingWeather && weather?.windSpeed === 165
                                ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                                : 'bg-white/5 border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/[0.07]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <AlertTriangle size={16} />
                              Super Typhoon (Both)
                            </div>
                            <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
                          </button>

                          {isSimulatingWeather && (
                            <button
                              onClick={handleResetWeather}
                              className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5"
                            >
                              <X size={12} />
                              Reset to Oracle
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </ParallaxCard>
                )}"""
content = sandbox_pattern.sub(sandbox_replacement, content)

# 4. Wrap WeatherWidget and AssetDistribution in ParallaxCard
if '<ParallaxCard className="p-0"><WeatherWidget' not in content:
    content = content.replace('<WeatherWidget', '<ParallaxCard className="p-0"><WeatherWidget')
    content = content.replace('      />\n                <AssetDistribution', '      /></ParallaxCard>\n                <ParallaxCard className="p-0"><AssetDistribution')
    content = content.replace('farms={farms} />\n              </div>', 'farms={farms} /></ParallaxCard>\n              </div>')


# Save file, avoiding surrogates issues
with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
