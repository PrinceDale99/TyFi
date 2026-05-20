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
import { MapPin, Navigation, Layers, Crosshair } from 'lucide-react';
import type { WeatherData } from '../types';

const { BaseLayer, Overlay } = LayersControl;

interface WeatherMapProps {
  regionName?: string;
  farmName?: string;
  weather: WeatherData | null;
  isLoading?: boolean;
}

const REGION_COORDS: Record<string, [number, number]> = {
  'Bicol Region': [13.4, 123.4],
  'Eastern Visayas': [11.2, 125.0],
  'Cagayan Valley': [17.6, 121.8],
  'Central Luzon': [15.5, 120.7],
  'Northern Samar': [12.4, 124.6],
  'Leyte': [10.8, 124.8],
};

/** A small component to auto-fly the map to a new center */
const FlyTo: React.FC<{ center: [number, number]; zoom: number }> = ({
  center,
  zoom,
}) => {
  const map = useMap();
  map.flyTo(center, zoom, { duration: 1.2 });
  return null;
};

const WeatherMap: React.FC<WeatherMapProps> = ({ regionName, farmName, weather, isLoading }) => {
  const defaultCenter: [number, number] = [12.8797, 121.774]; // Philippines center
  const farmCenter: [number, number] = (regionName && REGION_COORDS[regionName]) ?? defaultCenter;
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

  // Simulated typhoon position (east of farm)
  const typhoonPos: [number, number] = [farmCenter[0] - 1.5, farmCenter[1] + 4];
  const path: [number, number][] = [
    [typhoonPos[0] - 3, typhoonPos[1] + 5],
    [typhoonPos[0] - 1.5, typhoonPos[1] + 2],
    typhoonPos,
    farmCenter,
  ];

  const typhoonIcon = L.divIcon({
    html: renderToStaticMarkup(
      <div
        style={{
          color: '#f43f5e',
          fontSize: 28,
          lineHeight: 1,
          filter: 'drop-shadow(0 0 6px #f43f5e80)',
        }}
      >
        ⊕
      </div>
    ),
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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

  // Open-Meteo / Rain Viewer tiles for precipitation radar
  // Using open-source rainviewer API (free, no key needed)
  const precipTileUrl =
    'https://tilecache.rainviewer.com/v2/coverage/0/512/{z}/{x}/{y}/0/0_0.png';

  return (
    <div className="relative" style={{ height: 460 }}>
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
          <BaseLayer checked name="🗺️ OSM Standard">
            <TileLayer
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>
          <BaseLayer name="🌙 Dark Mode (CartoDB)">
            <TileLayer
              attribution='© <a href="https://carto.com">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </BaseLayer>
          <BaseLayer name="🛰️ Satellite (Esri)">
            <TileLayer
              attribution='© <a href="https://www.esri.com">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </BaseLayer>

          {/* Overlays */}
          <Overlay checked name="☔ Precipitation Radar">
            <TileLayer
              url={precipTileUrl}
              opacity={0.6}
              attribution="© RainViewer"
            />
          </Overlay>
        </LayersControl>

        {/* Farm Marker */}
        <Marker position={farmCenter} icon={farmIcon}>
          <Popup>
            <div className="font-sans p-1">
              <p className="font-bold text-slate-900 mb-0.5">{farmName ?? 'Your Farm'}</p>
              <p className="text-xs text-slate-500">{regionName}</p>
              <p className="text-xs text-slate-700 mt-1">
                💨 {weather.windSpeed.toFixed(1)} km/h · 🌧 {weather.rainfall.toFixed(1)} mm
              </p>
            </div>
          </Popup>
        </Marker>

        {/* Typhoon marker */}
        {isAlert && <Marker position={typhoonPos} icon={typhoonIcon} />}

        {/* Forecast path */}
        {isAlert && (
          <Polyline
            positions={path}
            pathOptions={{
              color: '#f43f5e',
              weight: 3,
              dashArray: '8 12',
            }}
          />
        )}

        {/* Wind danger zone circle */}
        <Circle
          center={farmCenter}
          radius={dangerRadius}
          pathOptions={{
            color: isAlert ? '#f43f5e' : '#38bdf8',
            fillColor: isAlert ? '#f43f5e' : '#38bdf8',
            fillOpacity: 0.06,
            weight: 1,
            dashArray: isAlert ? undefined : '4 8',
          }}
        />
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-[10px] space-y-1.5">
        <div className="text-slate-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
          <Layers size={10} /> Legend
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
          <span className="text-slate-300">Farm Location</span>
        </div>
        {isAlert && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-300">Typhoon Core</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-0.5 border-t-2 border-dashed border-rose-500" />
              <span className="text-slate-300">Forecast Path</span>
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full border"
            style={{
              borderColor: isAlert ? '#f43f5e' : '#38bdf8',
              backgroundColor: isAlert ? '#f43f5e30' : '#38bdf830',
            }}
          />
          <span className="text-slate-300">Wind Risk Zone</span>
        </div>
      </div>

      {/* Alert badge */}
      {isAlert && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-rose-600/90 backdrop-blur px-4 py-1.5 rounded-full border border-rose-500/50 text-white text-[11px] font-black tracking-wider animate-pulse shadow-lg">
          ⚠ TYPHOON ALERT ACTIVE
        </div>
      )}
    </div>
  );
};

export default WeatherMap;
