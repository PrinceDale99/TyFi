import React, { useState } from 'react';
import { 
  User, 
  MapPin, 
  Sprout, 
  Calendar, 
  Maximize2, 
  DollarSign, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft,
  Search,
  CheckCircle2,
  Phone,
  Trash2,
  Plus,
  Shield,
  Upload,
  Loader2,
  FileText,
  TrendingUp,
  Heart,
  AlertCircle
} from 'lucide-react';
import type { FarmData } from '../types';
import { registerPolicyOnChain } from '../lib/stellar';
import { estimateCropMetrics } from '../services/aiService';
import { PHILIPPINE_REGIONS } from '../constants';
import { registerForSubsidy } from '../services/firebaseService';

// Leaflet & React-Leaflet Imports
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderToStaticMarkup } from 'react-dom/server';

// Helper components for Leaflet map interaction
const FlyToCenter = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  React.useEffect(() => {
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


interface FarmerVerificationProps {
  walletAddress: string;
  isMainnet: boolean;
  onVerificationComplete: (farmerInfo?: any) => void;
  network?: 'testnet' | 'mainnet';
  onBack?: () => void;
}

const FarmerVerification: React.FC<FarmerVerificationProps> = ({ onVerificationComplete, walletAddress, network = 'testnet', onBack }) => {
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isUploadingRsbsa, setIsUploadingRsbsa] = useState(false);
  const [uploadedRsbsa, setUploadedRsbsa] = useState<string | null>(null);
  const [isUploadingValidId, setIsUploadingValidId] = useState(false);
  const [uploadedValidId, setUploadedValidId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsSubsidy, setNeedsSubsidy] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Payment & Subsidy States
  const [paymentPlan, setPaymentPlan] = useState<'full' | '2-parts' | '4-parts'>('full');
  const [govSubsidyPercent, setGovSubsidyPercent] = useState(0); // e.g. 30% from DA
  const [ngoSubsidyPercent, setNgoSubsidyPercent] = useState(0); // e.g. 20% from Red Cross

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const isMainnet = network === 'mainnet';

  // Farmer Common Info
  const [farmerInfo, setFarmerInfo] = useState({
    farmerName: '',
    rsbsaNumber: '',
    region: 'Central Luzon',
    phoneNumber: ''
  });

  const [isConfirmSkipOpen, setIsConfirmSkipOpen] = useState(false);

  // Farms List
  const [farms, setFarms] = useState<FarmData[]>([]);

  // Derivations for Step 3
  const totalPremium = Math.round(farms.reduce((acc, f) => acc + (f.expectedHarvestValue || 0), 0) * 0.1);
  const subsidyPercent = govSubsidyPercent + ngoSubsidyPercent;
  const subsidyAmount = Math.round(totalPremium * (subsidyPercent / 100));
  const finalPremium = Math.max(0, totalPremium - subsidyAmount);
  
  const installmentAmount = paymentPlan === 'full' ? finalPremium 
    : paymentPlan === '2-parts' ? Math.round(finalPremium / 2)
    : Math.round(finalPremium / 4);

  // Current Farm being edited
  const [currentFarm, setCurrentFarm] = useState<{
    farmName: string;
    cropType: string;
    plantingDate: string;
    farmSize: number;
    initialInvestment: number;
    expectedHarvestValue: number;
    season: string;
    latitude?: number;
    longitude?: number;
  }>({
    farmName: '',
    cropType: 'Rice',
    plantingDate: new Date().toISOString().split('T')[0],
    season: 'Wet Season 2026',
    farmSize: 1.5,
    initialInvestment: 1000,
    expectedHarvestValue: 3000,
  });

  // Per-farm land document upload state
  const [landDocType, setLandDocType] = useState<'deed_of_sale' | 'land_title'>('land_title');
  const [isUploadingLandDoc, setIsUploadingLandDoc] = useState(false);
  const [uploadedLandDoc, setUploadedLandDoc] = useState<string | null>(null);

  const [isValuing, setIsValuing] = useState(false);
  const [valuationExplanation, setValuationExplanation] = useState<string>('');
  const [valuationConfidence, setValuationConfidence] = useState<number>(100);

  React.useEffect(() => {
    // Only run if we are on step 2 and have a valid farm size
    if (step !== 2 || !currentFarm.farmSize || currentFarm.farmSize <= 0) return;

    let active = true;
    const fetchValuation = async () => {
      setIsValuing(true);
      try {
        const result = await estimateCropMetrics(
          currentFarm.cropType,
          currentFarm.farmSize,
          farmerInfo.region
        );
        if (active) {
          setCurrentFarm(prev => ({
            ...prev,
            initialInvestment: result.initialInvestment,
            expectedHarvestValue: result.expectedHarvestValue
          }));
          setValuationExplanation(result.explanation);
          setValuationConfidence(result.confidenceScore);
        }
      } catch (err) {
        console.error('Error auto-valuing crop:', err);
      } finally {
        if (active) {
          setIsValuing(false);
        }
      }
    };

    const timer = setTimeout(() => {
      fetchValuation();
    }, 600);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentFarm.cropType, currentFarm.farmSize, farmerInfo.region, step]);


  const regionCoordinates: Record<string, { lat: number, lng: number }> = PHILIPPINE_REGIONS.reduce((acc, r) => {
    acc[r.name] = { lat: r.coordinates[0], lng: r.coordinates[1] };
    return acc;
  }, {} as Record<string, { lat: number, lng: number }>);

  const handleFarmerInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'rsbsaNumber') {
      const cleaned = value.replace(/[^A-Za-z0-9]/g, '');
      const limited = cleaned.slice(0, 14);
      let formatted = '';
      
      for (let i = 0; i < limited.length; i++) {
        if (i === 2 || i === 4 || i === 6 || i === 9) {
          formatted += '-';
        }
        formatted += limited[i];
      }
      setFarmerInfo(prev => ({ ...prev, rsbsaNumber: formatted }));
    } else {
      setFarmerInfo(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFarmInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentFarm(prev => ({
      ...prev,
      [name]: name === 'farmSize' || name.includes('Value') || name.includes('Investment') ? Number(value) : value
    }));
  };

  const addFarm = () => {
    if (!currentFarm.farmName) return;
    
    const coords = regionCoordinates[farmerInfo.region] || regionCoordinates['Bicol Region'];
    const totalCropValue = currentFarm.expectedHarvestValue + (currentFarm.farmSize * 500);
    
    const newFarm: FarmData = {
      id: `FARM-${Math.floor(Math.random() * 10000)}`,
      ...farmerInfo,
      ...currentFarm,
      latitude: currentFarm.latitude ?? (coords.lat + (Math.random() - 0.5) * 0.1),
      longitude: currentFarm.longitude ?? (coords.lng + (Math.random() - 0.5) * 0.1),
      totalCropValue,
      ...(uploadedLandDoc ? {
        landDocument: {
          fileName: uploadedLandDoc,
          docType: landDocType,
          uploadedAt: new Date().toISOString()
        }
      } : {})
    };

    setFarms([...farms, newFarm]);
    setCurrentFarm({
      farmName: '',
      cropType: 'Rice',
      plantingDate: new Date().toISOString().split('T')[0],
      season: 'Wet Season 2026',
      farmSize: 1.5,
      initialInvestment: 1000,
      expectedHarvestValue: 3000,
      latitude: undefined,
      longitude: undefined
    });
    // Reset per-farm land document after adding
    setUploadedLandDoc(null);
    setLandDocType('land_title');
  };

  const removeFarm = (id: string | undefined) => {
    setFarms(farms.filter(f => f.id !== id));
  };

  const startAnalysis = () => {
    if (farms.length === 0 && currentFarm.farmName) {
        addFarm();
    }
    
    setIsAnalyzing(true);
    // Simulate checking for available subsidies based on region/RSBSA
    setTimeout(() => {
      setGovSubsidyPercent(30); // Demo: 30% Government Subsidy found
      setNgoSubsidyPercent(15); // Demo: 15% NGO Support found
      setIsAnalyzing(false);
      setStep(3);
    }, 4000);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Enrich farms with payment data
    const enrichedFarms = farms.map(f => ({
      ...f,
      ...farmerInfo,
      paymentPlan,
      govSubsidyPercent,
      ngoSubsidyPercent,
      premiumPaid: needsSubsidy ? 0 : installmentAmount,
      isInsured: !needsSubsidy, // Insured immediately if they pay the first installment
    }));

    try {
      if (isOffline) {
        // Queue intents for when we return online
        const intents = enrichedFarms.map(farm => ({
          type: needsSubsidy ? 'subsidy_request' : 'policy_registration',
          farmName: farm.farmName,
          data: { ...farmerInfo, ...farm },
          timestamp: Date.now()
        }));
        const existing = JSON.parse(localStorage.getItem('vault_pending_actions') || '[]');
        localStorage.setItem('vault_pending_actions', JSON.stringify([...existing, ...intents]));
        
        // Even if offline, registerForSubsidy uses Firestore persistence which will sync automatically
        if (needsSubsidy) {
          for (const farm of enrichedFarms) {
            registerForSubsidy(walletAddress, { ...farmerInfo, ...farm }, network).catch(console.error);
          }
        }
        console.log('Offline: Queued farm registration intents');
      } else {
        if (needsSubsidy) {
          // Register for subsidy instead of paying immediately
          for (const farm of enrichedFarms) {
            await registerForSubsidy(walletAddress, {
              ...farmerInfo,
              ...farm
            }, network);
          }
          console.log('Farms registered for subsidy requests');
        } else {
          // Original immediate payment flow
          for (const farm of enrichedFarms) {
            await registerPolicyOnChain(
              walletAddress,
              farm.farmName.replace(/\s+/g, '_'),
              farm.region || 'Albay',
              installmentAmount, // Pay the first installment
              farm.season || 'Wet Season 2026',
              network
            );
          }
        }

        const pubkey = localStorage.getItem('stellar_pubkey') || walletAddress;
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        fetch(`${BACKEND_URL}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: pubkey,
            fcmToken: `testnet-fcm-${farmerInfo.phoneNumber}`
          })
        }).catch(console.error);
      }
    } catch (error) {
      console.error('Failed to complete submission:', error);
    }

    setIsSubmitting(false);
    onVerificationComplete(enrichedFarms);
  };

  return (
    <div className={`mx-auto px-4 py-6 relative z-10 transition-all duration-500 ${step === 2 ? 'max-w-6xl' : 'max-w-4xl'}`}>
      <div className="glass-panel border-t border-l border-white/10 shadow-2xl relative overflow-hidden">
        {/* Glow effect in background */}
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full filter blur-[80px] -z-10 translate-x-1/2 -translate-y-1/2 transition-colors duration-1000 ${
          isMainnet ? 'bg-emerald-500/20' : 'bg-sky-500/20'
        }`}></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full filter blur-[80px] -z-10 -translate-x-1/2 translate-y-1/2"></div>

        <div className="absolute top-0 right-0 p-6 hidden md:block">
           <div className={`rsbsa-badge border ${
             isMainnet 
               ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' 
               : 'text-sky-400 border-sky-500/20 bg-sky-500/5'
           }`}>
             <Shield size={12} />
             Verified DA System
           </div>
        </div>
        
        {/* Progress Stepper */}
        <div className="flex justify-between mb-16 relative px-8 pt-8">
          <div className="absolute top-[calc(50%+16px)] left-8 right-8 h-[2px] bg-white/5 -translate-y-1/2 z-0 rounded-full"></div>
          <div className={`absolute top-[calc(50%+16px)] left-8 h-[2px] -translate-y-1/2 z-0 rounded-full transition-all duration-1000 ${
            isMainnet ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-sky-400 to-indigo-500'
          }`} style={{ width: `${(step - 1) * 50}%` }}></div>
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-500 ${
                step >= s 
                  ? (isMainnet 
                      ? 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white scale-110 shadow-[0_0_30px_rgba(16,185,129,0.4)] ring-4 ring-emerald-500/20' 
                      : 'bg-gradient-to-br from-sky-400 to-blue-600 text-white scale-110 shadow-[0_0_30px_rgba(56,189,248,0.4)] ring-4 ring-sky-500/20')
                  : 'bg-slate-800 text-slate-500 ring-4 ring-slate-800/50'
              }`}
            >
              {step > s ? <CheckCircle2 size={24} /> : s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="animate-fade-in p-8 pt-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${isMainnet ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'}`}>
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight uppercase italic">Identity Verification</h3>
                  <p className="text-slate-400 font-medium">Link your government RSBSA profile and upload credentials.</p>
                </div>
              </div>
              
              {!isMainnet && (
                <button
                  onClick={() => {
                    setFarmerInfo({
                      farmerName: 'Juan Dela Cruz (Demo)',
                      rsbsaNumber: '04-21-02-001-00012',
                      region: 'Central Luzon',
                      phoneNumber: '+63 912 345 6789'
                    });
                    setUploadedRsbsa('testnet-rsbsa-form.pdf');
                    setUploadedValidId('testnet-passport-id.png');
                    setCurrentFarm({
                      farmName: 'Albay Paradise Farm',
                      cropType: 'Rice',
                      plantingDate: new Date().toISOString().split('T')[0],
                      farmSize: 5.0,
                      initialInvestment: 5000,
                      expectedHarvestValue: 15000,
                      season: 'Wet Season 2026',
                      latitude: 13.421,
                      longitude: 123.413
                    });
                    showToast("Demo profile details pre-populated! Please verify them and click 'Continue to Farm Details'.", "success");
                  }}
                  className="px-4 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 hover:border-sky-500/50 text-sky-400 text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 shadow-[0_0_15px_rgba(14,165,233,0.1)] self-start sm:self-center cursor-pointer"
                >
                  ⚡ Pre-populate (Demo Mode)
                </button>
              )}
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label>Farmer's Full Name</label>
                  <input 
                    type="text" 
                    name="farmerName"
                    className="premium-input focus:border-emerald-500" 
                    placeholder="Juan Dela Cruz" 
                    value={farmerInfo.farmerName}
                    onChange={handleFarmerInfoChange}
                  />
                </div>
                <div className="form-group">
                  <label className="flex items-center gap-2">
                    RSBSA ID Number
                  </label>
                  <input 
                    type="text" 
                    name="rsbsaNumber"
                    className="premium-input" 
                    placeholder="05-16-01-000-00000" 
                    value={farmerInfo.rsbsaNumber}
                    onChange={handleFarmerInfoChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label>Region</label>
                  <select 
                    name="region"
                    className="premium-input"
                    value={farmerInfo.region}
                    onChange={handleFarmerInfoChange}
                  >
                    {PHILIPPINE_REGIONS.map(r => (
                      <option key={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="flex items-center gap-2">
                    <Phone size={14} className={isMainnet ? 'text-emerald-400' : 'text-sky-400'} />
                    Phone Number (for SMS Alerts)
                  </label>
                  <input 
                    type="tel" 
                    name="phoneNumber"
                    className="premium-input" 
                    placeholder="+63 9XX XXX XXXX" 
                    value={farmerInfo.phoneNumber}
                    onChange={handleFarmerInfoChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* RSBSA Upload */}
                <div className="relative">
                  <input 
                    type="file" 
                    id="rsbsa-upload" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setIsUploadingRsbsa(true);
                        setTimeout(() => {
                          setIsUploadingRsbsa(false);
                          setUploadedRsbsa(file.name);
                        }, 1500);
                      }
                    }}
                    accept=".pdf,.jpg,.png"
                  />
                  <label 
                    htmlFor="rsbsa-upload"
                    className={`file-upload-container group block ${uploadedRsbsa ? 'active' : ''}`}
                  >
                    {isUploadingRsbsa ? (
                      <div className="py-2">
                        <div className="scanner mb-4"></div>
                        <Loader2 className={`animate-spin mx-auto mb-2 ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`} size={32} />
                        <p className={`font-bold text-sm animate-pulse ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`}>Verifying RSBSA Credentials...</p>
                      </div>
                    ) : uploadedRsbsa ? (
                      <div className="py-2 animate-success">
                        <CheckCircle2 className="text-emerald-500 mx-auto mb-2" size={32} />
                        <p className="text-white font-bold text-sm truncate max-w-full">{uploadedRsbsa}</p>
                        <p className="text-emerald-400 text-xs font-bold">✓ Credentials Verified by DA-OCR</p>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Upload className={`upload-icon mx-auto mb-2 transition-colors ${isMainnet ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'}`} size={32} />
                        <p className="text-white font-bold text-sm mb-0.5">Upload RSBSA Proof</p>
                        <p className="text-slate-500 text-xs">PDF or Image of enrollment form</p>
                      </div>
                    )}
                  </label>
                </div>

                {/* Valid ID Upload */}
                <div className="relative">
                  <input 
                    type="file" 
                    id="valid-id-upload" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setIsUploadingValidId(true);
                        setTimeout(() => {
                          setIsUploadingValidId(false);
                          setUploadedValidId(file.name);
                        }, 1500);
                      }
                    }}
                    accept=".pdf,.jpg,.png"
                  />
                  <label 
                    htmlFor="valid-id-upload"
                    className={`file-upload-container group block ${uploadedValidId ? 'active' : ''}`}
                  >
                    {isUploadingValidId ? (
                      <div className="py-2">
                        <div className="scanner mb-4"></div>
                        <Loader2 className={`animate-spin mx-auto mb-2 ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`} size={32} />
                        <p className={`font-bold text-sm animate-pulse ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`}>Verifying Valid ID...</p>
                      </div>
                    ) : uploadedValidId ? (
                      <div className="py-2 animate-success">
                        <CheckCircle2 className="text-emerald-500 mx-auto mb-2" size={32} />
                        <p className="text-white font-bold text-sm truncate max-w-full">{uploadedValidId}</p>
                        <p className="text-emerald-400 text-xs font-bold">✓ Valid ID Verified</p>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Upload className={`upload-icon mx-auto mb-2 transition-colors ${isMainnet ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'}`} size={32} />
                        <p className="text-white font-bold text-sm mb-0.5">Upload Valid ID</p>
                        <p className="text-slate-500 text-xs">Gov ID: Passport, Driver's, UMID</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                {onBack && (
                  <button 
                    onClick={onBack}
                    className="p-3.5 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-all border border-white/10"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <button 
                  onClick={() => setStep(2)}
                  disabled={!farmerInfo.farmerName || !farmerInfo.rsbsaNumber || !uploadedRsbsa || !uploadedValidId || !farmerInfo.phoneNumber}
                  className={`flex-1 py-3.5 rounded-xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isMainnet 
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                      : 'bg-sky-500 hover:bg-sky-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.2)]'
                  }`}
                >
                  Continue to Farm Details
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in p-8 pt-0">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isMainnet ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'}`}>
                        <Sprout size={24} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white tracking-tight uppercase italic">Manage Your Farms</h3>
                        <p className="text-slate-400 font-medium">Add one or more farms to protect.</p>
                    </div>
                </div>
                {farms.length > 0 && (
                     <div className={`px-3 py-1 rounded-full text-sm font-black border transition-all duration-700 ${
                       isMainnet 
                         ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                         : 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                     }`}>
                        {farms.length} Farm{farms.length > 1 ? 's' : ''} Added
                     </div>
                )}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Form Side */}
                <div className="lg:col-span-3 space-y-6 bg-white/5 p-6 rounded-3xl border border-white/10">
                    <h4 className="text-white font-black uppercase text-sm tracking-widest flex items-center gap-2">
                        <Plus size={16} className={isMainnet ? 'text-emerald-400' : 'text-sky-400'} />
                        Add New Farm
                    </h4>
                    
                    <div className="form-group">
                        <label>Farm Name / Location Alias</label>
                        <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                            type="text" 
                            name="farmName"
                            className="premium-input pl-12" 
                            placeholder="e.g. North Rice Field, Purok 7" 
                            value={currentFarm.farmName}
                            onChange={handleFarmInputChange}
                        />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-300 font-bold uppercase tracking-wider">📍 Precise Farm Location (Global Geocoder)</span>
                          {currentFarm.latitude !== undefined && (
                            <span className="text-[10px] text-emerald-400 font-extrabold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
                              Resolved: {currentFarm.latitude.toFixed(4)}, {currentFarm.longitude?.toFixed(4)}
                            </span>
                          )}
                        </label>
                        <div className="flex gap-2">
                          <input 
                              type="text" 
                              id="location-search-input"
                              className="premium-input flex-1" 
                              placeholder="e.g. Guinobatan, Albay, Philippines" 
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  document.getElementById("location-search-btn")?.click();
                                }
                              }}
                          />
                          <button
                              type="button"
                              id="location-search-btn"
                              onClick={async () => {
                                  const input = document.getElementById("location-search-input") as HTMLInputElement;
                                  const btn = document.getElementById("location-search-btn") as HTMLButtonElement;
                                  const query = input?.value?.trim();
                                  if (!query) return;
                                  
                                  const originalText = btn.innerHTML;
                                  btn.innerHTML = '<span class="animate-spin inline-block">⏳</span>';
                                  btn.disabled = true;
                                  
                                  try {
                                      // Free Nominatim API — no key required, Philippines biased
                                      const res = await fetch(
                                        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Philippines')}&format=json&limit=1&countrycodes=ph`,
                                        { headers: { 'Accept-Language': 'en', 'User-Agent': 'TyphoonResilienceVault/1.0' } }
                                      );
                                      const data = await res.json();
                                      if (data && data.length > 0) {
                                          const lat = parseFloat(data[0].lat);
                                          const lng = parseFloat(data[0].lon);
                                          const displayName = data[0].display_name;
                                          setCurrentFarm(prev => ({
                                              ...prev,
                                              latitude: lat,
                                              longitude: lng
                                          }));
                                          input.value = displayName;
                                          input.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                                          setTimeout(() => { input.style.borderColor = ''; }, 2000);
                                      } else {
                                          input.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                                          const originalPlaceholder = input.placeholder;
                                          input.value = "";
                                          input.placeholder = "Location not found. Try adding city/province.";
                                          setTimeout(() => { 
                                            input.style.borderColor = ''; 
                                            input.placeholder = originalPlaceholder;
                                          }, 3000);
                                      }
                                  } catch (err) {
                                      console.error("Geocoding error:", err);
                                      input.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                                  } finally {
                                      btn.innerHTML = originalText;
                                      btn.disabled = false;
                                  }
                              }}
                              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center min-w-[80px] ${
                                isMainnet 
                                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20' 
                                  : 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20'
                              }`}
                          >
                              Search
                          </button>
                        </div>
                    </div>

                    {/* Interactive Manual Pin Map */}
                    <div className="form-group mt-2">
                        <label className="text-xs mb-1.5 block text-slate-300 font-bold uppercase tracking-wider">
                          🗺️ Manual Drag-and-Drop Pin Map
                        </label>
                        <p className="text-[10px] text-slate-400 mb-2">
                          Not finding the location? Click anywhere on the map or drag the pin to place your farm boundary manually.
                        </p>
                        <div className="h-[200px] w-full rounded-2xl overflow-hidden border border-white/10 relative z-10 shadow-inner">
                          <MapContainer
                            center={[
                              currentFarm.latitude ?? (regionCoordinates[farmerInfo.region]?.lat ?? 13.421),
                              currentFarm.longitude ?? (regionCoordinates[farmerInfo.region]?.lng ?? 123.413)
                            ]}
                            zoom={12}
                            scrollWheelZoom={false}
                            className="w-full h-full"
                          >
                            <TileLayer
                              attribution='© Google Maps'
                              url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                            />
                            <MapEventsHandler 
                              onChange={(lat, lng) => {
                                setCurrentFarm(prev => ({ ...prev, latitude: lat, longitude: lng }));
                              }}
                            />
                            <FlyToCenter 
                              center={[
                                currentFarm.latitude ?? (regionCoordinates[farmerInfo.region]?.lat ?? 13.421),
                                currentFarm.longitude ?? (regionCoordinates[farmerInfo.region]?.lng ?? 123.413)
                              ]} 
                            />
                            <Marker
                              position={[
                                currentFarm.latitude ?? (regionCoordinates[farmerInfo.region]?.lat ?? 13.421),
                                currentFarm.longitude ?? (regionCoordinates[farmerInfo.region]?.lng ?? 123.413)
                              ]}
                              draggable={true}
                              eventHandlers={{
                                dragend(e) {
                                  const marker = e.target;
                                  if (marker) {
                                    const latLng = marker.getLatLng();
                                    setCurrentFarm(prev => ({
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
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                  </div>
                                ),
                                className: '',
                                iconSize: [28, 28],
                                iconAnchor: [14, 28],
                              })}
                            />
                          </MapContainer>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-group">
                            <label>Primary Crop</label>
                            <select 
                                name="cropType"
                                className="premium-input"
                                value={currentFarm.cropType}
                                onChange={handleFarmInputChange}
                            >
                                <option>Rice</option>
                                <option>Corn</option>
                                <option>Coconut</option>
                                <option>Sugarcane</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Planting Season</label>
                            <select 
                                name="season"
                                className="premium-input"
                                value={currentFarm.season}
                                onChange={handleFarmInputChange}
                            >
                                <option>Wet Season 2026</option>
                                <option>Dry Season 2026</option>
                                <option>Wet Season 2027</option>
                                <option>Dry Season 2027</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-group">
                            <label>Farm Size (Hectares)</label>
                            <input 
                                type="number" 
                                name="farmSize"
                                className="premium-input" 
                                value={currentFarm.farmSize}
                                onChange={handleFarmInputChange}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-group relative">
                            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                Production Cost (XLM)
                            </label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    name="initialInvestment"
                                    className="premium-input read-only bg-slate-900/50 border-white/5 text-slate-300 focus:border-white/5 cursor-not-allowed pl-10"
                                    value={currentFarm.initialInvestment}
                                    readOnly
                                />
                                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            </div>
                        </div>
                        <div className="form-group relative">
                            <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                Expected Harvest (XLM)
                            </label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    name="expectedHarvestValue"
                                    className="premium-input read-only bg-slate-900/50 border-white/5 text-slate-300 focus:border-white/5 cursor-not-allowed pl-10"
                                    value={currentFarm.expectedHarvestValue}
                                    readOnly
                                />
                                <TrendingUp className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            </div>
                        </div>
                    </div>

                    {/* Seasonal Premium Deposit Info */}
                    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                                    <ShieldCheck size={16} />
                                </div>
                                <span className="text-xs font-black text-white uppercase tracking-wider">Seasonal Protection Deposit</span>
                            </div>
                            <span className="text-[10px] text-indigo-300 font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30">
                                10% Coverage Rate
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            To activate protection for this {currentFarm.season}, a premium deposit of <strong>{Math.round(currentFarm.expectedHarvestValue * 0.1)} XLM</strong> is required. This covers up to <strong>{currentFarm.expectedHarvestValue} XLM</strong> in potential typhoon damages.
                        </p>
                    </div>

                    {/* ─── Land Ownership Document Upload ─── */}
                    <div className="space-y-3 pt-1">
                      <label className="text-xs text-slate-300 font-black uppercase tracking-wider flex items-center gap-2">
                        <FileText size={13} className={isMainnet ? 'text-emerald-400' : 'text-sky-400'} />
                        Land Ownership Proof
                        <span className="text-rose-400">*</span>
                        <span className="text-slate-500 text-[9px] font-medium normal-case tracking-normal">— required to verify farm ownership</span>
                      </label>

                      {/* Doc-type selector */}
                      <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 gap-1">
                        <button
                          type="button"
                          onClick={() => setLandDocType('land_title')}
                          className={`w-1/2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                            landDocType === 'land_title'
                              ? (isMainnet ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-sky-500 text-white shadow-lg shadow-sky-500/20')
                              : 'text-slate-500 hover:text-white'
                          }`}
                        >
                          🏛️ Land Title
                        </button>
                        <button
                          type="button"
                          onClick={() => setLandDocType('deed_of_sale')}
                          className={`w-1/2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                            landDocType === 'deed_of_sale'
                              ? (isMainnet ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-sky-500 text-white shadow-lg shadow-sky-500/20')
                              : 'text-slate-500 hover:text-white'
                          }`}
                        >
                          📄 Deed of Sale
                        </button>
                      </div>

                      {/* File picker */}
                      <input
                        type="file"
                        id="land-doc-upload"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setIsUploadingLandDoc(true);
                            setTimeout(() => {
                              setIsUploadingLandDoc(false);
                              setUploadedLandDoc(file.name);
                            }, 1500);
                          }
                        }}
                      />
                      <label
                        htmlFor="land-doc-upload"
                        className={`file-upload-container group block cursor-pointer ${uploadedLandDoc ? 'active' : ''}`}
                      >
                        {isUploadingLandDoc ? (
                          <div className="py-3 flex flex-col items-center">
                            <div className="scanner mb-3" />
                            <Loader2
                              className={`animate-spin mb-2 ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`}
                              size={28}
                            />
                            <p className={`font-bold text-xs animate-pulse ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`}>
                              Scanning Document...
                            </p>
                          </div>
                        ) : uploadedLandDoc ? (
                          <div className="py-3 animate-success flex flex-col items-center">
                            <CheckCircle2 className="text-emerald-500 mb-2" size={28} />
                            <p className="text-white font-bold text-xs truncate max-w-[220px]">
                              {uploadedLandDoc}
                            </p>
                            <p className="text-emerald-400 text-[10px] font-bold mt-0.5">
                              ✓ {landDocType === 'land_title' ? 'Land Title' : 'Deed of Sale'} Verified
                            </p>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); setUploadedLandDoc(null); }}
                              className="mt-1 text-[9px] text-slate-500 hover:text-rose-400 font-bold uppercase transition-colors"
                            >
                              Replace file
                            </button>
                          </div>
                        ) : (
                          <div className="py-3 flex flex-col items-center">
                            <Upload
                              className={`upload-icon mb-2 transition-colors ${isMainnet ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'}`}
                              size={28}
                            />
                            <p className="text-white font-bold text-xs mb-0.5">
                              Upload {landDocType === 'land_title' ? 'Land Title' : 'Deed of Sale'}
                            </p>
                            <p className="text-slate-500 text-[10px]">PDF, JPG, or PNG — max 10 MB</p>
                          </div>
                        )}
                      </label>
                    </div>

                    <button 
                        onClick={addFarm}
                        disabled={!currentFarm.farmName || !uploadedLandDoc}
                        className={`w-full py-3 rounded-xl font-bold border transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                          isMainnet 
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 disabled:hover:bg-emerald-500/10' 
                            : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border-sky-500/30 disabled:hover:bg-sky-500/10'
                        }`}
                    >
                        <Plus size={18} />
                        {!uploadedLandDoc ? 'Upload Land Document to Continue' : 'Add Farm to List'}
                    </button>
                </div>

                {/* List Side */}
                <div className="lg:col-span-2 space-y-4">
                     <h4 className="text-slate-400 font-black uppercase text-xs tracking-widest">Added Farms</h4>
                     
                     <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {farms.length === 0 ? (
                            <div className="h-32 rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-slate-600 gap-2">
                                <Sprout size={32} opacity={0.2} />
                                <span className="text-xs font-bold">No farms added yet</span>
                            </div>
                        ) : (
                            farms.map((farm, index) => (
                            <div key={farm.id || index} className={`p-4 rounded-2xl bg-slate-900/50 border border-white/5 flex flex-col gap-3 group transition-all ${
                                  isMainnet ? 'hover:border-emerald-500/30' : 'hover:border-sky-500/30'
                                }`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-all ${
                                            isMainnet ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'
                                          }`}>
                                              <Sprout size={20} />
                                          </div>
                                          <div>
                                              <div className="text-white font-bold text-sm">{farm.farmName}</div>
                                              <div className="text-slate-500 text-[10px] uppercase font-black tracking-tighter">
                                                  {farm.cropType} • {farm.season} • {farm.farmSize} Hectares
                                              </div>
                                          </div>
                                      </div>
                                      <button 
                                          onClick={() => removeFarm(farm.id)}
                                          className="p-2 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                                      >
                                          <Trash2 size={16} />
                                      </button>
                                    </div>

                                    {/* Land document badge */}
                                    {farm.landDocument ? (
                                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                        <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                                            {farm.landDocument.docType === 'land_title' ? '🏛️ Land Title' : '📄 Deed of Sale'}
                                          </p>
                                          <p className="text-slate-400 text-[9px] truncate font-mono">
                                            {farm.landDocument.fileName}
                                          </p>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                        <Upload size={12} className="text-amber-400 flex-shrink-0" />
                                        <p className="text-amber-400 text-[9px] font-black uppercase tracking-wider">
                                          No land document uploaded
                                        </p>
                                      </div>
                                    )}
                                </div>
                            ))
                        )}
                     </div>

                     <div className="pt-4 border-t border-white/5 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Seasonal Coverage</span>
                            <span className="text-white font-black text-sm">{farms.reduce((acc, f) => acc + (f.expectedHarvestValue || 0), 0).toLocaleString()} XLM</span>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-indigo-400 text-[10px] font-black uppercase tracking-wider">Total Premium Deposit</span>
                            <span className="text-indigo-400 font-black text-lg">{Math.round(farms.reduce((acc, f) => acc + (f.expectedHarvestValue || 0), 0) * 0.1).toLocaleString()} XLM</span>
                        </div>
                        
                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => setStep(1)}
                                className="p-4 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-all border border-white/10"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <button 
                                onClick={() => {
                                  if (farms.length === 0) {
                                    setIsConfirmSkipOpen(true);
                                  } else {
                                    startAnalysis();
                                  }
                                }}
                                disabled={isAnalyzing}
                                className={`flex-1 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                                  isMainnet 
                                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                                    : 'bg-sky-500 hover:bg-sky-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.2)]'
                                }`}
                            >
                                {isAnalyzing ? (
                                    <>
                                    <Loader2 className="animate-spin" />
                                    Analyzing Satellite Polygons...
                                    </>
                                ) : (
                                    farms.length === 0 && !currentFarm.farmName ? 'Add farms later' : 'Add all farms'
                                )}
                            </button>
                        </div>
                     </div>
                </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in py-8 px-8">
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                <ShieldCheck className="text-emerald-500" size={40} />
              </div>
              <h3 className="text-3xl font-black text-white mb-2 tracking-tight uppercase italic">Activation Pending</h3>
              <p className="text-slate-400 max-w-md mx-auto font-medium">
                Your {farms.length} farm{farms.length > 1 ? 's are' : ' is'} mapped. Deposit the protection premium to activate your parametric coverage.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              {/* Premium Breakdown */}
              <div className="glass-panel bg-white/5 border-white/10 p-6 space-y-6">
                <h4 className="text-white font-black uppercase text-xs tracking-widest flex items-center gap-2">
                  <DollarSign size={14} className="text-indigo-400" />
                  Premium Breakdown
                </h4>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 font-medium">Base Seasonal Premium</span>
                    <span className="text-white font-bold">{totalPremium.toLocaleString()} XLM</span>
                  </div>
                  
                  {govSubsidyPercent > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-medium">Government Subsidy (DA)</span>
                        <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">-{govSubsidyPercent}%</span>
                      </div>
                      <span className="text-emerald-400 font-bold">-{Math.round(totalPremium * (govSubsidyPercent / 100)).toLocaleString()} XLM</span>
                    </div>
                  )}

                  {ngoSubsidyPercent > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-sky-400 font-medium">NGO Resilience Grant</span>
                        <span className="text-[10px] font-black bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded">-{ngoSubsidyPercent}%</span>
                      </div>
                      <span className="text-sky-400 font-bold">-{Math.round(totalPremium * (ngoSubsidyPercent / 100)).toLocaleString()} XLM</span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                    <span className="text-lg font-black text-white uppercase italic tracking-tight">Final Premium</span>
                    <div className="text-right">
                      <div className="text-2xl font-black text-indigo-400">{finalPremium.toLocaleString()} XLM</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">For {farms[0]?.season}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Plan */}
              <div className="glass-panel bg-white/5 border-white/10 p-6 space-y-6">
                <h4 className="text-white font-black uppercase text-xs tracking-widest flex items-center gap-2">
                  <Calendar size={14} className="text-emerald-400" />
                  Select Payment Plan
                </h4>
                
                <div className="grid grid-cols-1 gap-3">
                  {(['full', '2-parts', '4-parts'] as const).map((plan) => (
                    <button
                      key={plan}
                      onClick={() => setPaymentPlan(plan)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        paymentPlan === plan 
                          ? (isMainnet ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-sky-500/10 border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.1)]')
                          : 'bg-slate-900/50 border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className={`text-xs font-black uppercase tracking-wider ${paymentPlan === plan ? (isMainnet ? 'text-emerald-400' : 'text-sky-400') : 'text-white'}`}>
                            {plan === 'full' ? 'Single Payment' : plan === '2-parts' ? '2 Installments' : '4 Installments'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {plan === 'full' ? 'Pay entire premium now' : `Pay in ${plan.split('-')[0]} monthly parts`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-white">
                            {plan === 'full' ? finalPremium : plan === '2-parts' ? Math.round(finalPremium / 2) : Math.round(finalPremium / 4)} XLM
                          </div>
                          <div className="text-[9px] text-slate-500 font-bold uppercase">per deposit</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Marketplace Option */}
            <div className="max-w-2xl mx-auto mb-10 p-6 rounded-3xl bg-rose-500/5 border border-rose-500/10 flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1 text-center md:text-left">
                <h4 className="text-sm font-black text-white uppercase italic mb-1 flex items-center justify-center md:justify-start gap-2">
                  <Heart size={16} className="text-rose-500" />
                  Cannot afford the deposit?
                </h4>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  List your farm on the <strong>Subsidy Marketplace</strong>. Global donors and NGOs can sponsor your premium. Your protection activates once a sponsor pays the first installment.
                </p>
              </div>
              <button 
                onClick={() => setNeedsSubsidy(!needsSubsidy)}
                className={`w-14 h-7 rounded-full relative transition-all flex-shrink-0 ${needsSubsidy ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${needsSubsidy ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setStep(2)}
                className="px-8 py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-black hover:bg-white/10 transition-all"
              >
                <ArrowLeft size={24} />
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`flex-1 py-5 rounded-2xl font-black text-xl transition-all transform tracking-tight uppercase italic ${
                  isSubmitting 
                    ? 'bg-slate-700 cursor-not-allowed' 
                    : (isMainnet 
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:scale-[1.01]' 
                        : 'bg-sky-500 hover:bg-sky-400 text-white shadow-[0_20px_50px_rgba(14,165,233,0.3)] hover:scale-[1.01]')
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="animate-spin" size={24} />
                    {needsSubsidy ? 'Listing...' : 'Processing Deposit...'}
                  </div>
                ) : (
                  needsSubsidy ? "List on Marketplace" : `Pay ${installmentAmount.toLocaleString()} XLM & Activate`
                )}
              </button>
            </div>
          </div>
        )}
        {/* Confirm Skip Modal Overlay */}
        {isConfirmSkipOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-6 ${isMainnet ? 'bg-amber-500/10 text-amber-500' : 'bg-sky-500/10 text-sky-400'}`}>
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">Proceed without farms?</h3>
              <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                Are you sure you want to proceed without registering any farms? You can always add them later from your profile dashboard.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsConfirmSkipOpen(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setIsConfirmSkipOpen(false);
                    onVerificationComplete([]);
                  }}
                  className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                    isMainnet ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20' : 'bg-sky-500 hover:bg-sky-400 shadow-sky-500/20'
                  }`}
                >
                  Yes, Proceed
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-fade-in">
          <div className={`px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-md flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
            toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
            'bg-sky-500/10 border-sky-500/30 text-sky-400'
          }`}>
            {toast.type === 'success' && <CheckCircle2 size={20} />}
            {toast.type === 'error' && <AlertCircle size={20} />}
            {toast.type === 'info' && <Shield size={20} />}
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmerVerification;
