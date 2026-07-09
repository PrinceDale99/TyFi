import React, { useEffect } from 'react';
import { Sprout, MapPin, Upload, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';

import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';

const FlyToCenter = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, map.getZoom());
  }, [center[0], center[1], map]);
  return null;
};

const MapEventsHandler = ({ onChange }: { onChange: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

interface AddFarmModalProps {
  isAddFarmModalOpen: boolean;
  setIsAddFarmModalOpen: (open: boolean) => void;
  isMainnet: boolean;
  handleAddFarmSubmit: (e: React.FormEvent) => void;
  newFarmForm: any;
  setNewFarmForm: any;
  profileForm: any;
  regionCoordinates: Record<string, { lat: number, lng: number }>;
  modalLandDocType: 'land_title' | 'deed_of_sale';
  setModalLandDocType: (type: 'land_title' | 'deed_of_sale') => void;
  modalIsUploadingLandDoc: boolean;
  setModalIsUploadingLandDoc: (uploading: boolean) => void;
  modalUploadedLandDoc: string | null;
  setModalUploadedLandDoc: (doc: string | null) => void;
  modalIsValuing: boolean; modalValuationExplanation: string; modalValuationConfidence: number;
}

export const AddFarmModal: React.FC<AddFarmModalProps> = ({
  isAddFarmModalOpen,
  setIsAddFarmModalOpen,
  isMainnet,
  handleAddFarmSubmit,
  newFarmForm,
  setNewFarmForm,
  profileForm,
  regionCoordinates,
  modalLandDocType,
  setModalLandDocType,
  modalIsUploadingLandDoc,
  setModalIsUploadingLandDoc,
  modalUploadedLandDoc,
  setModalUploadedLandDoc,
  modalIsValuing,
  modalValuationExplanation,
  modalValuationConfidence
}) => {
  if (!isAddFarmModalOpen) return null;

  // Custom marker icon
  const customIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
  });

  return (
    <>
      {isAddFarmModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Sprout className={isMainnet ? 'text-emerald-400' : 'text-sky-400'} size={20} />
                Register & Insure New Farm
              </h3>
              <button 
                onClick={() => setIsAddFarmModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-bold"
              >
                Γ£ò
              </button>
            </div>
            
            <form onSubmit={handleAddFarmSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Farm Identity & Location */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Farm Name / Identifier</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        type="text" 
                        value={newFarmForm.farmName}
                        onChange={(e) => setNewFarmForm({ ...newFarmForm, farmName: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                        placeholder="e.g. Albay Paradise Farm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Crop Type</label>
                      <select 
                        value={newFarmForm.cropType}
                        onChange={(e) => setNewFarmForm({ ...newFarmForm, cropType: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                      >
                        <option>Rice</option>
                        <option>Corn</option>
                        <option>Coconut</option>
                        <option>Abaca</option>
                        <option>Banana</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Planting Date</label>
                      <input 
                        type="date" 
                        value={newFarmForm.plantingDate}
                        onChange={(e) => setNewFarmForm({ ...newFarmForm, plantingDate: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Size (Ha)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={newFarmForm.farmSize}
                        onChange={(e) => setNewFarmForm({ ...newFarmForm, farmSize: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono font-bold"
                        required
                      />
                    </div>
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Cost (XLM)</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={newFarmForm.initialInvestment}
                          readOnly
                          className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-2.5 py-2 text-xs text-slate-400 cursor-not-allowed font-mono font-bold"
                        />
                      </div>
                    </div>
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Val (XLM)</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={newFarmForm.expectedHarvestValue}
                          readOnly
                          className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-2.5 py-2 text-xs text-slate-400 cursor-not-allowed font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {modalValuationExplanation && (
                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[10px] text-slate-400 leading-relaxed">
                      <span className="font-extrabold text-white block mb-0.5">≡ƒî╛ Crop Valuation Model (Confidence: {modalValuationConfidence}%)</span>
                      {modalValuationExplanation}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-slate-400 font-black uppercase tracking-wider">≡ƒôì Farm Location Search (OpenStreetMap)</span>
                      {newFarmForm.latitude !== undefined && (
                        <span className="text-[8px] text-emerald-400 font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                          {newFarmForm.latitude.toFixed(4)}, {newFarmForm.longitude.toFixed(4)}
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        id="modal-location-search-input"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-bold" 
                        placeholder="e.g. Guinobatan, Albay" 
                      />
                      <button
                        type="button"
                        id="modal-location-search-btn"
                        onClick={async () => {
                          const input = document.getElementById("modal-location-search-input") as HTMLInputElement;
                          const btn = document.getElementById("modal-location-search-btn") as HTMLButtonElement;
                          const query = input?.value?.trim();
                          if (!query) return;
                          btn.textContent = '...';
                          btn.disabled = true;
                          try {
                            const res = await fetch(
                              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Philippines')}&format=json&limit=1&countrycodes=ph`,
                              { headers: { 'Accept-Language': 'en', 'User-Agent': 'TyphoonResilienceVault/1.0' } }
                            );
                            const data = await res.json();
                            if (data && data.length > 0) {
                              const lat = parseFloat(data[0].lat);
                              const lng = parseFloat(data[0].lon);
                              const displayName = data[0].display_name;
                              setNewFarmForm((prev: any) => ({
                                ...prev,
                                latitude: lat,
                                longitude: lng
                              }));
                              input.value = displayName;
                            } else {
                              input.style.borderColor = 'rgb(239 68 68 / 0.5)';
                              setTimeout(() => { input.style.borderColor = ''; }, 2000);
                            }
                          } catch (err) {
                            console.error("Nominatim geocoding error:", err);
                          } finally {
                            btn.textContent = 'Search';
                            btn.disabled = false;
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                          isMainnet 
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20' 
                            : 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20'
                        }`}
                      >
                        Search
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Sat Hybrid Map & Land Ownership Upload */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">≡ƒù║∩╕Å Pinpoint Farm Location</label>
                    <div className="h-[150px] w-full rounded-xl overflow-hidden border border-white/10 relative z-10">
                      <MapContainer
                        center={[
                          newFarmForm.latitude ?? (regionCoordinates[profileForm.region]?.lat ?? 13.421),
                          newFarmForm.longitude ?? (regionCoordinates[profileForm.region]?.lng ?? 123.413)
                        ]}
                        zoom={12}
                        scrollWheelZoom={false}
                        className="w-full h-full"
                      >
                        <TileLayer
                          attribution='┬⌐ Google Maps'
                          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                        />
                        <MapEventsHandler 
                          onChange={(lat, lng) => {
                            setNewFarmForm((prev: any) => ({ ...prev, latitude: lat, longitude: lng }));
                          }}
                        />
                        <FlyToCenter 
                          center={[
                            newFarmForm.latitude ?? (regionCoordinates[profileForm.region]?.lat ?? 13.421),
                            newFarmForm.longitude ?? (regionCoordinates[profileForm.region]?.lng ?? 123.413)
                          ]} 
                        />
                        <Marker
                          position={[
                            newFarmForm.latitude ?? (regionCoordinates[profileForm.region]?.lat ?? 13.421),
                            newFarmForm.longitude ?? (regionCoordinates[profileForm.region]?.lng ?? 123.413)
                          ]}
                          draggable={true}
                          eventHandlers={{
                            dragend(e) {
                              const marker = e.target;
                              if (marker) {
                                const latLng = marker.getLatLng();
                                setNewFarmForm((prev: any) => ({
                                  ...prev,
                                  latitude: latLng.lat,
                                  longitude: latLng.lng
                                }));
                              }
                            }
                          }}
                          icon={L.divIcon({
                            html: renderToStaticMarkup(
                              <div style={{ color: isMainnet ? '#10b981' : '#0ea5e9', filter: `drop-shadow(0 0 6px ${isMainnet ? '#10b98180' : '#0ea5e980'})` }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                              </div>
                            ),
                            className: '',
                            iconSize: [24, 24],
                            iconAnchor: [12, 24],
                          })}
                        />
                      </MapContainer>
                    </div>
                  </div>

                  {/* Land Ownership Proof Section */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <FileText size={12} className={isMainnet ? 'text-emerald-400' : 'text-sky-400'} />
                      Land Ownership Proof
                      <span className="text-rose-400">*</span>
                    </label>

                    {/* Doc Type Selector */}
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 gap-1">
                      <button
                        type="button"
                        onClick={() => setModalLandDocType('land_title')}
                        className={`w-1/2 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                          modalLandDocType === 'land_title'
                            ? (isMainnet ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-sky-500 text-white shadow-lg shadow-sky-500/20')
                            : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        ≡ƒÅ¢∩╕Å Land Title
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalLandDocType('deed_of_sale')}
                        className={`w-1/2 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                          modalLandDocType === 'deed_of_sale'
                            ? (isMainnet ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-sky-500 text-white shadow-lg shadow-sky-500/20')
                            : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        ≡ƒôä Deed of Sale
                      </button>
                    </div>

                    {/* File Picker */}
                    <input
                      type="file"
                      id="modal-land-doc-upload"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setModalIsUploadingLandDoc(true);
                          setTimeout(() => {
                            setModalIsUploadingLandDoc(false);
                            setModalUploadedLandDoc(file.name);
                          }, 1500);
                        }
                      }}
                    />
                    <label
                      htmlFor="modal-land-doc-upload"
                      className={`file-upload-container group block cursor-pointer border border-dashed border-white/10 hover:border-white/20 rounded-2xl p-4 text-center transition-all bg-white/[0.02] ${modalUploadedLandDoc ? 'bg-emerald-500/5 border-emerald-500/20' : ''}`}
                    >
                      {modalIsUploadingLandDoc ? (
                        <div className="py-1 flex flex-col items-center">
                          <Loader2
                            className={`animate-spin mb-1 ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`}
                            size={20}
                          />
                          <p className={`font-bold text-[10px] animate-pulse ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`}>
                            Scanning Document...
                          </p>
                        </div>
                      ) : modalUploadedLandDoc ? (
                        <div className="py-1 flex flex-col items-center">
                          <CheckCircle2 className="text-emerald-500 mb-1" size={20} />
                          <p className="text-white font-bold text-[10px] truncate max-w-[180px]">
                            {modalUploadedLandDoc}
                          </p>
                          <p className="text-emerald-400 text-[8px] font-bold mt-0.5">
                            Γ£ô {modalLandDocType === 'land_title' ? 'Land Title' : 'Deed of Sale'} Verified
                          </p>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setModalUploadedLandDoc(null); }}
                            className="mt-1 text-[8px] text-slate-500 hover:text-rose-400 font-bold uppercase transition-colors"
                          >
                            Replace file
                          </button>
                        </div>
                      ) : (
                        <div className="py-1 flex flex-col items-center">
                          <Upload
                            className={`upload-icon mb-1 text-slate-400 transition-colors ${isMainnet ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'}`}
                            size={20}
                          />
                          <p className="text-white font-bold text-[10px] mb-0.5">
                            Upload {modalLandDocType === 'land_title' ? 'Land Title' : 'Deed of Sale'}
                          </p>
                          <p className="text-slate-500 text-[8px]">PDF, JPG, PNG up to 10MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsAddFarmModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!modalUploadedLandDoc || !newFarmForm.farmName}
                  className={`flex-1 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isMainnet 
                      ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20' 
                      : 'bg-sky-500 hover:bg-sky-400 shadow-sky-500/20'
                  }`}
                >
                  {!modalUploadedLandDoc ? 'Upload Land Document' : 'Insure Farm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
