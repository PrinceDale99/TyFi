import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

interface InteractiveMapProps {
  regionName: string;
  farmName?: string;
  isAlert?: boolean;
}

const REGION_COORDS: Record<string, [number, number]> = {
  'Bicol Region': [13.4, 123.4],
  'Eastern Visayas': [11.2, 125.0],
  'Cagayan Valley': [17.6, 121.8],
  'Central Luzon': [15.5, 120.7],
  'Northern Samar': [12.4, 124.6],
  'Leyte': [10.8, 124.8]
};

const InteractiveMap: React.FC<InteractiveMapProps> = ({ regionName, farmName, isAlert }) => {
  const center = REGION_COORDS[regionName] || [12.8797, 121.7740]; // Default to Philippines center
  
  // Custom Icon
  const farmIcon = L.divIcon({
    html: renderToStaticMarkup(<div className="p-1.5 bg-sky-500 rounded-full border-2 border-white shadow-lg farm-marker"><MapPin size={16} color="white" fill="white" /></div>),
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

  const typhoonIcon = L.divIcon({
    html: renderToStaticMarkup(<div className="animate-spin-slow"><Navigation size={24} className="text-rose-500 fill-rose-500" /></div>),
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  // Simulated Typhoon Path (Moving towards the farm)
  const typhoonPos: [number, number] = [center[0] - 2, center[1] + 3];
  const path: [number, number][] = [
    [typhoonPos[0] - 2, typhoonPos[1] + 3],
    [typhoonPos[0] - 1, typhoonPos[1] + 1.5],
    typhoonPos,
    [center[0], center[1]]
  ];

  return (
    <div className="map-container relative">
      <MapContainer 
        center={center} 
        zoom={7} 
        scrollWheelZoom={false}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Farm Marker */}
        <Marker position={center} icon={farmIcon}>
          <Popup>
            <div className="text-slate-900 p-2">
              <p className="font-bold">{farmName || 'Your Farm'}</p>
              <p className="text-xs text-slate-500">{regionName}</p>
            </div>
          </Popup>
        </Marker>

        {/* Typhoon Current Position */}
        <Marker position={typhoonPos} icon={typhoonIcon} />

        {/* Forecast Path */}
        <Polyline 
          positions={path} 
          pathOptions={{ 
            color: '#f43f5e', 
            weight: 3, 
            dashArray: '8, 12', 
            className: 'typhoon-path' 
          }} 
        />

        {/* Danger Zone */}
        {isAlert && (
          <Circle 
            center={typhoonPos} 
            radius={200000} // 200km
            pathOptions={{ 
              color: '#f43f5e', 
              fillColor: '#f43f5e', 
              fillOpacity: 0.1,
              weight: 1
            }} 
          />
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-white/10 text-[10px] space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-500"></div>
          <span className="text-slate-300">Target Farm Asset</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rose-500"></div>
          <span className="text-slate-300">Typhoon Core (PAGASA)</span>
        </div>
      </div>
    </div>
  );
};

export default InteractiveMap;
