import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PHILIPPINE_REGIONS } from '../constants';
import type { Farm } from '../types';

interface InteractiveMapProps {
  regionName: string;
  farmName?: string;
  isAlert?: boolean;
  farms?: Farm[];
  activeStorm?: {
    name: string;
    lat: number;
    lon: number;
    severity: string;
  } | null;
}

const REGION_COORDS: Record<string, [number, number]> = {
  'Northern Samar': [12.4, 124.6],
  'Leyte': [10.8, 124.8],
  ...PHILIPPINE_REGIONS.reduce((acc, r) => {
    acc[r.name] = r.coordinates as [number, number];
    return acc;
  }, {} as Record<string, [number, number]>)
};

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

const InteractiveMap: React.FC<InteractiveMapProps> = ({ regionName, farmName, isAlert, farms = [], activeStorm }) => {
  const center = REGION_COORDS[regionName] || [12.8797, 121.7740]; // Default to Philippines center

  // Dynamic storm positioning
  const stormPos: [number, number] = activeStorm 
    ? [activeStorm.lat, activeStorm.lon] 
    : [center[0] - 1.5, center[1] + 2.5]; // Default warning positioning

  const stormRadiusKm = 180; // 180km storm core impact radius

  // Leaflet custom icons using Tailwind and SVG components
  const getFarmIcon = (inDanger: boolean) => L.divIcon({
    html: renderToStaticMarkup(
      <div className={`p-1.5 rounded-full border-2 border-white shadow-lg relative ${
        inDanger ? 'bg-rose-500 animate-pulse' : 'bg-sky-500'
      }`}>
        <MapPin size={16} color="white" fill="white" />
        {inDanger && <span className="absolute -inset-1 rounded-full border-2 border-rose-500 animate-ping opacity-75" />}
      </div>
    ),
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

  const typhoonIcon = L.divIcon({
    html: renderToStaticMarkup(
      <div className="animate-spin-slow bg-rose-500/10 p-2 rounded-full border border-rose-500/30">
        <Navigation size={24} className="text-rose-500 fill-rose-500 rotate-[45deg]" />
      </div>
    ),
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  // Simulated forecasted path leading to the active region center
  const path: [number, number][] = [
    [stormPos[0] - 1.5, stormPos[1] + 3.0],
    [stormPos[0] - 0.7, stormPos[1] + 1.5],
    stormPos,
    [center[0], center[1]]
  ];

  return (
    <div className="map-container relative w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      <MapContainer 
        center={center} 
        zoom={farms.length > 1 ? 6 : 7} 
        scrollWheelZoom={false}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Render all registered farms */}
        {farms.length > 0 ? (
          farms.map((f) => {
            const fLat = f.latitude || center[0];
            const fLon = f.longitude || center[1];
            const dist = calculateDistance(stormPos[0], stormPos[1], fLat, fLon);
            const inDanger = (isAlert || !!activeStorm) && dist <= stormRadiusKm;

            return (
              <Marker key={f.id} position={[fLat, fLon]} icon={getFarmIcon(inDanger)}>
                <Popup>
                  <div className="text-slate-900 p-2 min-w-[140px] text-xs">
                    <p className="font-black text-sm uppercase tracking-tight mb-1">{f.farmName}</p>
                    <p className="text-slate-500 font-bold mb-0.5">Crop: <span className="text-slate-700">{f.cropType}</span></p>
                    <p className="text-slate-500 font-bold mb-1">Region: <span className="text-slate-700">{f.region}</span></p>
                    <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded text-center inline-block ${
                      inDanger ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-sky-100 text-sky-700'
                    }`}>
                      {inDanger ? `⚠️ Storm Proximity: ${Math.round(dist)}km` : '✅ Safe / Monitoring'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })
        ) : (
          /* Fallback Single Marker */
          <Marker position={center} icon={getFarmIcon(isAlert || false)}>
            <Popup>
              <div className="text-slate-900 p-2 text-xs">
                <p className="font-bold">{farmName || 'Your Farm'}</p>
                <p className="text-slate-500">{regionName}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Active Storm Center */}
        {(isAlert || !!activeStorm) && (
          <>
            <Marker position={stormPos} icon={typhoonIcon} />
            
            {/* Danger Coverage Radius Overlay */}
            <Circle 
              center={stormPos} 
              radius={stormRadiusKm * 1000} // meters
              pathOptions={{ 
                color: '#f43f5e', 
                fillColor: '#f43f5e', 
                fillOpacity: 0.1,
                weight: 1,
                className: 'typhoon-coverage-zone'
              }} 
            />

            {/* Storm Track Path */}
            <Polyline 
              positions={path} 
              pathOptions={{ 
                color: '#f43f5e', 
                weight: 2, 
                dashArray: '5, 8', 
                className: 'typhoon-track' 
              }} 
            />
          </>
        )}
      </MapContainer>

      {/* Map Legend Details */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-[10px] space-y-2.5 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-500 border border-white/10" />
          <span className="text-slate-300 font-bold">Insured Farms (Safe)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white/10 animate-pulse" />
          <span className="text-slate-300 font-bold">Farms in Threat Radius</span>
        </div>
        {(isAlert || !!activeStorm) && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-rose-500/10 rounded-full border border-rose-500/20 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            </div>
            <span className="text-slate-300 font-bold">Parametric Core Zone ({stormRadiusKm}km)</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveMap;
