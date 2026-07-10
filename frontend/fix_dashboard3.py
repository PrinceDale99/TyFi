import re

with open('src/components/FarmerDashboard.tsx.bak', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Extract ParallaxCard (everything before the first injected block)
idx1 = text.find('      {/* Weather Mapping')
parallax_card = text[:idx1] + "      </div>\n    </div>\n  );\n};\n\n"

# 2. Extract FarmerDashboard body (everything from 'export const FarmerDashboard' up to the SECOND injected block)
idx2 = text.find('export const FarmerDashboard')
idx3 = text.find('      {/* Weather Mapping', idx2)

farmer_dashboard_part1 = text[idx2:idx3]

# 3. Add the injection block
injection = """      {/* Weather Mapping & Charts (Monitoring) */}
      <div className="grid grid-cols-1 gap-6">
        <div className="glass-panel min-h-[400px] relative overflow-hidden">
          <WeatherMap 
            weather={weather} 
            isLoading={isLoadingWeather} 
            regionName={farms[0]?.region}
            farmName={farms[0]?.farmName}
            farms={farms}
          />
        </div>
        <WeatherChart weather={weather} />
      </div>

      {/* Satellite Live Imagery */}
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
                      {/* Crosshair overlay */}
                      <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
                        <Crosshair className="text-white/60 drop-shadow-md" size={32} strokeWidth={1.5} />
                      </div>
                      
                      {/* Leaflet Static Satellite Map */}
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

    </div>
  );
};
"""

final_text = parallax_card + farmer_dashboard_part1 + "      </div>\n" + injection

with open('src/components/FarmerDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(final_text)

print("Restored nicely!")
