import React, { useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  LayersControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapPin, Navigation, Layers, Crosshair, Thermometer, Wind } from 'lucide-react';
import type { WeatherData, FarmData } from '../types';
import { PHILIPPINE_REGIONS } from '../constants';

const { BaseLayer, Overlay } = LayersControl;

interface Farm extends FarmData {
  id: string;
  isInsured: boolean;
}

interface WeatherMapProps {
  regionName?: string;
  farmName?: string;
  weather: WeatherData | null;
  isLoading?: boolean;
  farms?: Farm[];
}

// Calculate distance between two lat/lng coordinates in km (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const REGION_COORDS: Record<string, [number, number]> = {
  'Northern Samar': [12.4, 124.6],
  'Leyte': [10.8, 124.8],
  ...PHILIPPINE_REGIONS.reduce((acc, r) => {
    acc[r.name] = r.coordinates as [number, number];
    return acc;
  }, {} as Record<string, [number, number]>)
};

const CITIES = [
  { name: 'Manila', coords: [14.5995, 120.9842] as [number, number], baseTemp: 31 },
  { name: 'Legazpi', coords: [13.1372, 123.7438] as [number, number], baseTemp: 28 }, // Bicol
  { name: 'Tacloban', coords: [11.2444, 125.0038] as [number, number], baseTemp: 29 }, // Eastern Visayas
  { name: 'Tuguegarao', coords: [17.6132, 121.7270] as [number, number], baseTemp: 30 }, // Cagayan Valley
  { name: 'Cebu City', coords: [10.3157, 123.8854] as [number, number], baseTemp: 30 },
  { name: 'Davao City', coords: [7.1907, 125.4553] as [number, number], baseTemp: 32 },
  { name: 'Baguio', coords: [16.4023, 120.5960] as [number, number], baseTemp: 19 },
  { name: 'San Fernando', coords: [15.0286, 120.6898] as [number, number], baseTemp: 31 }, // Central Luzon
  { name: 'Catarman', coords: [12.4992, 124.6393] as [number, number], baseTemp: 28 }, // Northern Samar
];

const WIND_GRID_POINTS = [
  // North (Cagayan Valley / Central Luzon)
  { coords: [18.2, 122.8] as [number, number] },
  { coords: [17.5, 120.8] as [number, number] },
  { coords: [18.6, 121.5] as [number, number] },
  { coords: [16.8, 121.0] as [number, number] },
  { coords: [17.0, 124.5] as [number, number] },
  
  // Mid / Bicol / Central
  { coords: [15.5, 120.5] as [number, number] },
  { coords: [14.8, 122.3] as [number, number] },
  { coords: [13.8, 124.5] as [number, number] },
  { coords: [13.3, 123.0] as [number, number] },
  { coords: [13.0, 125.8] as [number, number] },
  { coords: [12.4, 122.5] as [number, number] },
  
  // South / Visayas
  { coords: [12.0, 124.6] as [number, number] },
  { coords: [10.8, 125.4] as [number, number] },
  { coords: [11.5, 123.5] as [number, number] },
  { coords: [11.2, 122.2] as [number, number] },
  { coords: [10.2, 124.0] as [number, number] },
  { coords: [9.2, 124.5] as [number, number] },
  { coords: [9.5, 121.0] as [number, number] },
];

/** A small component to auto-fly the map to a new center */
const FlyTo: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  map.flyTo(center, zoom, { duration: 1.2 });
  return null;
};

const WeatherMap: React.FC<WeatherMapProps> = ({ regionName, farmName, weather, isLoading, farms = [] }) => {
  const defaultCenter: [number, number] = [12.8797, 121.774]; // Philippines center
  const farmCenter: [number, number] = (regionName ? REGION_COORDS[regionName] : null) ?? defaultCenter;
  const [activeCenter, setActiveCenter] = useState<[number, number]>(farmCenter);
  const [activeZoom, setActiveZoom] = useState(7);
  const [flyTriggered, setFlyTriggered] = useState(false);

  if (isLoading || !weather) {
    return (
      <div className="w-full h-[460px] bg-slate-900/50 rounded-2xl flex flex-col items-center justify-center border border-white/5 animate-pulse">
        <Navigation className="text-sky-500 mb-4 animate-bounce" size={40} />
        <p className="text-slate-400 font-medium">Initializing Satellite Weather Feed...</p>
      </div>
    );
  }

  const isAlert = weather.windSpeed > 100 || weather.rainfall > 200;
  const dangerRadius = isAlert
    ? Math.min(350_000, (weather.windGusts / 200) * 400_000)
    : 150_000;

  // Custom farm icon
  const farmIcon = L.divIcon({
    html: renderToStaticMarkup(
      <div
        style={{
          background: '#0ea5e9',
          borderRadius: '50%',
          padding: 6,
          border: '2px solid white',
          boxShadow: '0 0 10px #0ea5e980',
          display: 'flex',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="white"
        >
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        </svg>
      </div>
    ),
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });

  // REAL or simulated storm position logic
  const activeStorm = weather.activeStorm;
  let rawStormPos: [number, number] | null = activeStorm 
    ? [activeStorm.lat, activeStorm.lon] 
    : null;

  // If the storm is simulated and starts exactly at the farm center, offset it to create a nice pathway
  if (isAlert && !rawStormPos) {
    rawStormPos = [farmCenter[0] - 1.2, farmCenter[1] + 2.2];
  }

  const isMockStorm = !isAlert;
  const visualStormPos: [number, number] = rawStormPos 
    ? (Math.abs(rawStormPos[0] - farmCenter[0]) < 0.1 && Math.abs(rawStormPos[1] - farmCenter[1]) < 0.1)
      ? [farmCenter[0] - 1.5, farmCenter[1] + 2.5]
      : rawStormPos
    : [11.5, 129.0]; // Developing storm in the Pacific

  const stormName = isMockStorm ? 'TROPICAL DEPRESSION (MONITORING)' : (activeStorm?.name ?? 'TYPHOON SIMULATOR');
  
  // Forecast Path
  const path: [number, number][] = isAlert 
    ? [
        [visualStormPos[0] - 1.0, visualStormPos[1] + 1.5],
        visualStormPos,
        farmCenter
      ] 
    : [
        [9.0, 131.0],
        visualStormPos,
        [12.0, 127.0]
      ];

  // Dynamic Multi-Layered Hurricane/Typhoon Icon
  const typhoonIcon = L.divIcon({
    html: renderToStaticMarkup(
      <div className="relative flex items-center justify-center pointer-events-none">
        {/* Outer Spinning Atmospheric Band */}
        <div 
          className="absolute animate-storm-spin-reverse" 
          style={{ 
            width: isMockStorm ? 90 : 130, 
            height: isMockStorm ? 90 : 130, 
            opacity: isMockStorm ? 0.25 : 0.35 
          }}
        >
          <svg viewBox="0 0 100 100" fill="none" stroke={isMockStorm ? '#38bdf8' : '#f43f5e'} strokeWidth="1.5" strokeDasharray="3 5">
            <circle cx="50" cy="50" r="45" />
          </svg>
        </div>
        
        {/* Rotating Storm Clouds/Arms */}
        <div 
          className="absolute animate-storm-spin" 
          style={{ 
            width: isMockStorm ? 70 : 100, 
            height: isMockStorm ? 70 : 100,
            opacity: isMockStorm ? 0.5 : 0.85
          }}
        >
          <svg viewBox="0 0 100 100" className={`w-full h-full ${isMockStorm ? 'text-sky-400' : 'text-rose-500'} fill-current`}>
            <path d="M50 50 C50 32, 35 20, 15 28 C22 42, 36 48, 50 50 Z" />
            <path d="M50 50 C68 50, 80 65, 72 85 C58 78, 52 64, 50 50 Z" />
            <path d="M50 50 C32 68, 20 52, 28 15 C42 22, 48 36, 50 50 Z" />
          </svg>
        </div>

        {/* Center core pulse */}
        <div className={`w-7 h-7 rounded-full ${isMockStorm ? 'bg-sky-500/10 border-sky-400/30' : 'bg-rose-600/30 border-rose-500 animate-ping'} flex items-center justify-center absolute`} />
        
        {/* Storm eye core */}
        <div className={`w-4.5 h-4.5 rounded-full ${isMockStorm ? 'bg-sky-500 shadow-[0_0_10px_#0ea5e9]' : 'bg-rose-600 shadow-[0_0_15px_#f43f5e]'} border-2 border-white flex items-center justify-center relative z-10`}>
          <span className="text-[6px] font-black text-white">{isMockStorm ? 'MON' : 'EYE'}</span>
        </div>
      </div>
    ),
    className: '',
    iconSize: [130, 130],
    iconAnchor: [65, 65],
  });

  const handleCenterFarm = () => {
    setActiveCenter(farmCenter);
    setActiveZoom(9);
    setFlyTriggered(v => !v);
  };

  const handleCenterPhilippines = () => {
    setActiveCenter(defaultCenter);
    setActiveZoom(6);
    setFlyTriggered(v => !v);
  };

  // Temperature calculations for cities based on storm proximity
  const getCityTemp = (city: typeof CITIES[0]) => {
    if (!isAlert) return city.baseTemp;
    const dx = city.coords[0] - visualStormPos[0];
    const dy = city.coords[1] - visualStormPos[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Closer to active storm = cooler temperature
    if (dist < 3.5) {
      const drop = (1 - dist / 3.5) * (weather.windSpeed / 165) * 6;
      return Math.round(city.baseTemp - drop);
    }
    return city.baseTemp;
  };

  // Wind calculation for vector fields spiraling counter-clockwise towards storm core
  const getWindVector = (lat: number, lon: number) => {
    if (isAlert) {
      const dy = visualStormPos[0] - lat;
      const dx = visualStormPos[1] - lon;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const radialX = dx / (dist || 1);
      const radialY = dy / (dist || 1);

      // Northern Hemisphere Coriolis effect: spiral counter-clockwise
      const tangentX = -radialY;
      const tangentY = radialX;

      // 75% tangent component + 25% radial inward suction
      const windX = tangentX * 0.75 + radialX * 0.25;
      const windY = tangentY * 0.75 + radialY * 0.25;

      let angle = Math.atan2(windY, windX) * (180 / Math.PI);
      const rotation = 90 - angle; // Adjust for SVG arrowhead alignment

      // Wind drops off exponentially from the storm wall
      let speed = weather.windSpeed;
      if (dist > 0.4) {
        speed = weather.windSpeed * Math.exp(-(dist - 0.4) / 2.2);
      }
      speed = Math.max(22, speed * (0.85 + Math.random() * 0.15));

      return { rotation, speed };
    } else {
      // Normal weather: Northeast monsoon (Amihan) flowing Southwest
      const baseAngle = 225;
      const rotation = baseAngle + Math.sin(lat) * 12;
      const speed = weather.windSpeed * 0.7 + (Math.cos(lon) * 4);
      return { rotation, speed: Math.max(12, speed) };
    }
  };

  // Custom Wind vector arrow component
  const createWindIcon = (rotation: number, speed: number) => {
    const color = speed > 130
      ? 'text-rose-500 fill-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]'
      : speed > 90
        ? 'text-amber-500 fill-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]'
        : speed > 40
          ? 'text-sky-400 fill-sky-400'
          : 'text-sky-300/40 fill-transparent';

    const duration = `${Math.max(0.4, 2.5 - (speed / 75))}s`;

    return L.divIcon({
      html: renderToStaticMarkup(
        <div 
          className="flex flex-col items-center justify-center pointer-events-none"
          style={{
            transform: `rotate(${rotation}deg)`,
            animation: `wind-pulse ${duration} infinite ease-in-out`
          }}
        >
          <svg 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            className={color}
          >
            <path 
              d="M12 2L22 22L12 17L2 22L12 2Z" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinejoin="round"
            />
          </svg>
          {speed > 20 && (
            <span 
              className="absolute text-[8px] font-black text-white bg-slate-950/85 px-1 py-0.5 rounded border border-white/10 whitespace-nowrap shadow-md"
              style={{ transform: `rotate(${-rotation}deg) translateY(13px)` }}
            >
              {Math.round(speed)}k
            </span>
          )}
        </div>
      ),
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  };

  // Custom Celsius city temperature label badge
  const createCityTempIcon = (cityName: string, temp: number) => {
    const tempColorClass = temp > 30 
      ? 'text-rose-400 bg-rose-950/85 border-rose-500/30' 
      : temp > 26 
        ? 'text-amber-400 bg-amber-950/85 border-amber-500/30' 
        : temp > 21 
          ? 'text-emerald-400 bg-emerald-950/85 border-emerald-500/30' 
          : 'text-sky-400 bg-sky-950/85 border-sky-500/30';

    return L.divIcon({
      html: renderToStaticMarkup(
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border shadow-lg pointer-events-auto transition-all hover:scale-105 ${tempColorClass}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          <span className="text-[9px] font-bold text-white uppercase tracking-wider">{cityName}</span>
          <span className="text-[9px] font-black pl-1.5 border-l border-white/10">{temp}°C</span>
        </div>
      ),
      className: '',
      iconSize: [110, 24],
      iconAnchor: [55, 12]
    });
  };

  return (
    <div className="relative z-0" style={{ height: 460 }}>
      {/* Map Controls */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <button
          id="map-center-farm-btn"
          onClick={handleCenterFarm}
          title="Zoom to my farm"
          className="p-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur border border-white/10 rounded-xl text-sky-400 hover:text-sky-300 transition-all shadow-lg"
        >
          <Crosshair size={16} />
        </button>
        <button
          id="map-center-ph-btn"
          onClick={handleCenterPhilippines}
          title="View all Philippines"
          className="p-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg"
        >
          <Navigation size={16} />
        </button>
      </div>

      <MapContainer
        center={farmCenter}
        zoom={7}
        scrollWheelZoom
        className="w-full h-full rounded-2xl overflow-hidden"
        zoomControl
      >
        {/* Fly animation */}
        <FlyTo center={activeCenter} zoom={activeZoom} key={`${activeCenter[0]}-${activeCenter[1]}-${flyTriggered}`} />

        <LayersControl position="topleft">
          {/* Base Layers */}
          <BaseLayer checked name="🛰️ Google Hybrid">
            <TileLayer
              attribution='© Google Maps'
              url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            />
          </BaseLayer>
          <BaseLayer name="📡 Google Satellite">
            <TileLayer
              attribution='© Google Maps'
              url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            />
          </BaseLayer>
          <BaseLayer name="🏔️ Google Terrain">
            <TileLayer
              attribution='© Google Maps'
              url="https://mt1.google.com/vt/lyrs=t,r&x={x}&y={y}&z={z}"
            />
          </BaseLayer>
          <BaseLayer name="🗺️ Google Roadmap">
            <TileLayer
              attribution='© Google Maps'
              url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            />
          </BaseLayer>
          <BaseLayer name="🌙 Dark Mode (CartoDB)">
            <TileLayer
              attribution='© <a href="https://carto.com">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </BaseLayer>

          {/* Core Interactive Weather Overlays */}
          <Overlay checked name="🌀 Animated Typhoon Radar">
            <>
              {/* Typhoon Icon */}
              <Marker position={visualStormPos} icon={typhoonIcon}>
                <Popup>
                  <div className="font-sans p-1">
                    <p className="font-black text-rose-500 text-sm mb-0.5">{stormName}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                      {isMockStorm ? 'Monitoring Area' : `Status: ${activeStorm?.severity || 'Severe'} Tropical Cyclone`}
                    </p>
                    <p className="text-xs text-slate-700 mt-1">
                      💨 Max Winds: {weather.windGusts.toFixed(0)} km/h<br />
                      🌧 Event Rain: {weather.rainfall.toFixed(0)} mm
                    </p>
                  </div>
                </Popup>
              </Marker>

              {/* Dotted path track */}
              {path.length > 0 && (
                <Polyline
                  positions={path}
                  pathOptions={{
                    color: isMockStorm ? '#38bdf8' : '#f43f5e',
                    weight: 3,
                    dashArray: '8 12',
                  }}
                />
              )}

              {/* Risk zone circles */}
              <Circle
                center={farmCenter}
                radius={dangerRadius}
                pathOptions={{
                  color: isAlert ? '#f43f5e' : '#38bdf8',
                  fillColor: isAlert ? '#f43f5e' : '#38bdf8',
                  fillOpacity: 0.05,
                  weight: 1.5,
                  dashArray: isAlert ? undefined : '4 8',
                }}
              />
            </>
          </Overlay>

          <Overlay checked name="💨 Wind Vectors (Dynamic)">
            <>
              {WIND_GRID_POINTS.map((pt, idx) => {
                const vector = getWindVector(pt.coords[0], pt.coords[1]);
                return (
                  <Marker 
                    key={`wind-${idx}`}
                    position={pt.coords}
                    icon={createWindIcon(vector.rotation, vector.speed)}
                  />
                );
              })}
            </>
          </Overlay>

          <Overlay checked name="🌡️ City Temperatures (°C)">
            <>
              {CITIES.map((city, idx) => {
                const temp = getCityTemp(city);
                return (
                  <Marker 
                    key={`temp-${idx}`}
                    position={city.coords}
                    icon={createCityTempIcon(city.name, temp)}
                  />
                );
              })}
            </>
          </Overlay>

          {/* Legacy OpenWeather tiles for raw map reference */}
          <Overlay name="☔ Precipitation Grid (OWM)">
            <TileLayer
              url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${import.meta.env.VITE_OPENWEATHER_API_KEY}`}
              opacity={0.5}
              attribution="© OpenWeatherMap"
            />
          </Overlay>
          <Overlay name="💨 Wind Intensity Grid (OWM)">
            <TileLayer
              url={`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${import.meta.env.VITE_OPENWEATHER_API_KEY}`}
              opacity={0.5}
              attribution="© OpenWeatherMap"
            />
          </Overlay>
          <Overlay name="🌡️ Temp Color Map (OWM)">
            <TileLayer
              url={`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${import.meta.env.VITE_OPENWEATHER_API_KEY}`}
              opacity={0.5}
              attribution="© OpenWeatherMap"
            />
          </Overlay>
        </LayersControl>

        {/* Dynamic Multi-Farm Pins */}
        {farms && farms.length > 0 ? (
          farms.map((f) => {
            const fLat = f.latitude || farmCenter[0];
            const fLon = f.longitude || farmCenter[1];
            const dist = calculateDistance(visualStormPos[0], visualStormPos[1], fLat, fLon);
            const inDanger = isAlert && dist <= 180; // 180km danger core

            const customFarmIcon = L.divIcon({
              html: renderToStaticMarkup(
                <div
                  className={`p-1.5 rounded-full border-2 border-white shadow-lg relative ${
                    inDanger ? 'bg-rose-500 animate-pulse' : 'bg-sky-500'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  </svg>
                  {inDanger && <span className="absolute -inset-1 rounded-full border-2 border-rose-500 animate-ping opacity-75" />}
                </div>
              ),
              className: '',
              iconSize: [30, 30],
              iconAnchor: [15, 30],
              popupAnchor: [0, -30],
            });

            return (
              <Marker key={f.id} position={[fLat, fLon]} icon={customFarmIcon}>
                <Popup>
                  <div className="font-sans p-1">
                    <p className="font-black text-slate-950 text-sm mb-0.5">{f.farmName}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                      Crop: {f.cropType} | Region: {f.region}
                    </p>
                    <p className="text-[10px] text-slate-700 font-bold mt-1">
                      💨 Local wind: {weather.windSpeed.toFixed(1)} km/h<br />
                      🌧 Local rain: {weather.rainfall.toFixed(1)} mm
                    </p>
                    <div className={`text-[9px] font-black uppercase px-2 py-0.5 mt-1 rounded text-center inline-block ${
                      inDanger ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-sky-100 text-sky-700'
                    }`}>
                      {inDanger ? `⚠️ Threat Proximity: ${Math.round(dist)}km` : '✅ Safe / Monitoring'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })
        ) : (
          <Marker position={farmCenter} icon={farmIcon}>
            <Popup>
              <div className="font-sans p-1">
                <p className="font-bold text-slate-900 mb-0.5">{farmName ?? 'Your Farm'}</p>
                <p className="text-xs text-slate-500">{regionName}</p>
                <p className="text-xs text-slate-700 mt-1 font-bold">
                  💨 Local wind: {weather.windSpeed.toFixed(1)} km/h<br />
                  🌧 Local rain: {weather.rainfall.toFixed(1)} mm
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Legend Card */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/85 backdrop-blur-md px-3 py-2.5 rounded-xl border border-white/10 text-[10px] space-y-1.5 shadow-xl select-none">
        <div className="text-slate-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
          <Layers size={10} /> Meteorological Radar
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
          <span className="text-slate-300">Farm Location</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isAlert ? 'bg-rose-500' : 'bg-sky-400 animate-spin-slow'}`} />
          <span className="text-slate-300">{isAlert ? 'Active Typhoon core' : 'Developing depression'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-5 h-0.5 border-t-2 border-dashed ${isAlert ? 'border-rose-500' : 'border-sky-400'}`} />
          <span className="text-slate-300">Storm Forecast Path</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full border"
            style={{
              borderColor: isAlert ? '#f43f5e' : '#38bdf8',
              backgroundColor: isAlert ? '#f43f5e20' : '#38bdf820',
            }}
          />
          <span className="text-slate-300">{isAlert ? 'Severe Wind Risk Zone' : 'Parametric Monitoring Zone'}</span>
        </div>
      </div>

      {/* Alert Header Badge */}
      {isAlert && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-rose-600/90 backdrop-blur px-4 py-1.5 rounded-full border border-rose-500/50 text-white text-[11px] font-black tracking-wider animate-pulse shadow-lg flex items-center gap-2">
          <Wind size={12} className="animate-spin" style={{ animationDuration: '3s' }} /> 
          ⚠ TYPHOON WARNING ACTIVE
        </div>
      )}
    </div>
  );
};

export default WeatherMap;
