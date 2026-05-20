import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, CheckCircle2, AlertCircle, MapPin, Sprout, Bell, BellOff, Phone, Upload, Loader2, FileText } from 'lucide-react';
import axios from 'axios';
import { requestNotificationPermission } from '../firebase';
import { registerPolicyOnChain } from '../lib/stellar';

interface FarmerVerificationProps {
  onVerificationComplete: (data: any) => void;
  walletAddress: string;
}

const FarmerVerification: React.FC<FarmerVerificationProps> = ({ onVerificationComplete, walletAddress }) => {
  const [step, setStep] = useState(1);
    rsbsaNumber: '',
    farmName: '',
    region: 'Bicol Region',
    cropType: 'Rice',
    plantingDate: new Date().toISOString().split('T')[0],
    farmSize: 5,
    initialInvestment: 50000,
    expectedHarvestValue: 250000,
    totalCropValue: 250000,
    latitude: 13.4,
    longitude: 123.4,
    phoneNumber: ''
  });

  const regionCoordinates: Record<string, { lat: number, lng: number }> = {
    'Bicol Region': { lat: 13.421, lng: 123.413 },
    'Central Luzon': { lat: 15.482, lng: 120.712 },
    'Eastern Visayas': { lat: 11.244, lng: 125.003 },
    'Cagayan Valley': { lat: 17.733, lng: 121.644 },
    'Western Visayas': { lat: 10.720, lng: 122.562 },
  };

  const handleRegionChange = (region: string) => {
    const coords = regionCoordinates[region] || regionCoordinates['Bicol Region'];
    setFormData({ 
      ...formData, 
      region,
      latitude: coords.lat,
      longitude: coords.lng
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'region') {
      handleRegionChange(value);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: name === 'farmSize' || name.includes('Value') || name.includes('Investment') ? Number(value) : value
      }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      // Simulate upload and AI scanning
      setTimeout(() => {
        setIsUploading(false);
        setUploadedFile(file.name);
      }, 2000);
    }
  };

  const startAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setStep(3);
    }, 4000);
  };

  const handleSubmit = async () => {
    const totalCropValue = formData.expectedHarvestValue + (formData.farmSize * 10000);
    
    // Register on Stellar blockchain
    try {
      await registerPolicyOnChain(
        walletAddress,
        formData.farmName,
        totalCropValue
      );
      console.log('Registered on Stellar blockchain');
    } catch (error) {
      console.error('Failed to register on blockchain:', error);
      // We continue anyway for demo purposes, but in real app we might want to block
    }

    // Register for SMS notifications
    try {
      const pubkey = localStorage.getItem('stellar_pubkey') || walletAddress;
      await fetch('http://localhost:3001/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: pubkey,
          phoneNumber: formData.phoneNumber
        })
      });
      console.log('Registered for SMS notifications');
    } catch (error) {
      console.error('Failed to register for SMS:', error);
    }

    onVerificationComplete({
      ...formData,
      totalCropValue
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 relative z-10">
      <div className="glass-panel border-t border-l border-white/10 shadow-2xl relative overflow-hidden">
        {/* Glow effect in background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/20 rounded-full filter blur-[80px] -z-10 translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full filter blur-[80px] -z-10 -translate-x-1/2 translate-y-1/2"></div>

        <div className="absolute top-0 right-0 p-6 hidden md:block">
           <div className="rsbsa-badge">
             <Shield size={12} />
             Verified DA System
           </div>
        </div>
        
        {/* Progress Stepper */}
        <div className="flex justify-between mb-16 relative px-8">
          <div className="absolute top-1/2 left-8 right-8 h-[2px] bg-white/5 -translate-y-1/2 z-0 rounded-full"></div>
          <div className="absolute top-1/2 left-8 h-[2px] bg-gradient-to-r from-sky-400 to-indigo-500 -translate-y-1/2 z-0 rounded-full transition-all duration-500" style={{ width: `${(step - 1) * 50}%` }}></div>
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-500 ${
                step >= s ? 'bg-gradient-to-br from-sky-400 to-blue-600 text-white scale-110 shadow-[0_0_30px_rgba(56,189,248,0.4)] ring-4 ring-sky-500/20' : 'bg-slate-800 text-slate-500 ring-4 ring-slate-800/50'
              }`}
            >
              {step > s ? <CheckCircle2 size={24} /> : s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">Identity Verification</h3>
                <p className="text-slate-400 font-medium">Link your government RSBSA profile.</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label>Farmer's Full Name</label>
                  <input 
                    type="text" 
                    name="farmerName"
                    className="premium-input" 
                    placeholder="Juan Dela Cruz" 
                    value={formData.farmerName}
                    onChange={handleInputChange}
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
                    value={formData.rsbsaNumber}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label>Region</label>
                  <select 
                    name="region"
                    className="premium-input"
                    value={formData.region}
                    onChange={handleInputChange}
                  >
                    <option>Bicol Region</option>
                    <option>Eastern Visayas</option>
                    <option>Cagayan Valley</option>
                    <option>Central Luzon</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="flex items-center gap-2">
                    <Phone size={14} className="text-sky-400" />
                    Phone Number (for SMS Alerts)
                  </label>
                  <input 
                    type="tel" 
                    name="phoneNumber"
                    className="premium-input" 
                    placeholder="+63 9XX XXX XXXX" 
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Farm Size (Hectares)</label>
                <input 
                  type="number" 
                  name="farmSize"
                  className="premium-input" 
                  value={formData.farmSize}
                  onChange={handleInputChange}
                />
              </div>

              <div className="relative">
                <input 
                  type="file" 
                  id="rsbsa-upload" 
                  className="hidden" 
                  onChange={handleFileUpload}
                  accept=".pdf,.jpg,.png"
                />
                <label 
                  htmlFor="rsbsa-upload"
                  className={`file-upload-container group block ${uploadedFile ? 'active' : ''}`}
                >
                  {isUploading ? (
                    <div className="py-4">
                      <div className="scanner mb-8"></div>
                      <Loader2 className="animate-spin text-sky-400 mx-auto mb-4" size={40} />
                      <p className="text-sky-400 font-bold animate-pulse">AI Scanning RSBSA Credentials...</p>
                    </div>
                  ) : uploadedFile ? (
                    <div className="py-4 animate-success">
                      <CheckCircle2 className="text-emerald-500 mx-auto mb-4" size={40} />
                      <p className="text-white font-bold">{uploadedFile}</p>
                      <p className="text-emerald-400 text-sm">✓ Credentials Verified by DA-OCR</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="upload-icon mx-auto mb-4 group-hover:text-sky-400 transition-colors" size={40} />
                      <p className="text-white font-bold mb-1">Upload RSBSA Proof</p>
                      <p className="text-slate-500 text-sm">PDF or Image of your enrollment form</p>
                    </>
                  )}
                </label>
              </div>

              <button 
                onClick={() => setStep(2)}
                disabled={!formData.farmerName || !formData.rsbsaNumber || !uploadedFile || !formData.phoneNumber}
                className="w-full py-4 btn-primary rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed mt-8 flex items-center justify-center gap-2"
              >
                Continue to Crop Data
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400">
                <Sprout size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">Crop & Financial Setup</h3>
                <p className="text-slate-400 font-medium">Define your asset value for parametric calculation.</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label>Primary Crop</label>
                  <select 
                    name="cropType"
                    className="premium-input"
                    value={formData.cropType}
                    onChange={handleInputChange}
                  >
                    <option>Rice</option>
                    <option>Corn</option>
                    <option>Coconut</option>
                    <option>Sugarcane</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Planting Date</label>
                  <input 
                    type="date" 
                    name="plantingDate"
                    className="premium-input"
                    value={formData.plantingDate}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label>Production Cost (₱)</label>
                  <input 
                    type="number" 
                    name="initialInvestment"
                    className="premium-input"
                    value={formData.initialInvestment}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Market Value Goal (₱)</label>
                  <input 
                    type="number" 
                    name="expectedHarvestValue"
                    className="premium-input"
                    value={formData.expectedHarvestValue}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Farm Name / Location Alias</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="text" 
                    name="farmName"
                    className="premium-input pl-12" 
                    placeholder="e.g. Purok 4 North Field" 
                    value={formData.farmName}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-all border border-white/10"
                >
                  Back
                </button>
                <button 
                  onClick={startAnalysis}
                  className="flex-[2] py-4 btn-primary rounded-xl font-bold text-lg flex items-center justify-center gap-3"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Mapping Satellite Poly...
                    </>
                  ) : (
                    'Finalize Registration'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in text-center py-8">
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8 relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
              <CheckCircle2 className="text-emerald-500" size={48} />
            </div>
            
            <h3 className="text-3xl font-black text-white mb-2 tracking-tight">Vault Secured!</h3>
            <p className="text-slate-400 mb-12 max-w-md mx-auto">
              Your farm has been registered in the Resilience Vault. The smart contract is now monitoring weather triggers.
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-12">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <FileText className="text-sky-400 mx-auto mb-2" size={20} />
                <div className="text-[10px] text-slate-500 uppercase font-bold">Policy</div>
                <div className="text-xs text-white font-bold">Active</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <Sprout className="text-sky-400 mx-auto mb-2" size={20} />
                <div className="text-[10px] text-slate-500 uppercase font-bold">Crop</div>
                <div className="text-xs text-white font-bold">{formData.cropType}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <Shield className="text-sky-400 mx-auto mb-2" size={20} />
                <div className="text-[10px] text-slate-500 uppercase font-bold">Payout</div>
                <div className="text-xs text-white font-bold">Enabled</div>
              </div>
            </div>

            <button 
              onClick={handleSubmit}
              className="w-full py-4 btn-primary rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02]"
            >
              Enter Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FarmerVerification;
