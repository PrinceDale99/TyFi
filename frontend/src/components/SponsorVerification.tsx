import React, { useState } from 'react';
import { ArrowLeft, Globe, Upload, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { registerSponsor } from '../services/firebaseService';
import { DiditSdk } from '@didit-protocol/sdk-web';

interface SponsorVerificationProps {
  onVerificationComplete: (sponsorInfo: {name: string, email: string, sponsorType: string, birthDate: string}) => void;
  walletAddress: string;
  network?: 'testnet' | 'mainnet';
  onBack?: () => void;
}

const SponsorVerification: React.FC<SponsorVerificationProps> = ({ onVerificationComplete, walletAddress, network = 'testnet', onBack }) => {
  const isMainnet = network === 'mainnet';
  
  const [sponsorInfo, setSponsorInfo] = useState({
    name: '',
    email: '',
    birthDate: '',
    sponsorType: 'Donor'
  });

  

  const [isDiditVerified, setIsDiditVerified] = useState(false);
  const [diditSessionId, setDiditSessionId] = useState<string | null>(null);
  const [isDiditLoading, setIsDiditLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Didit KYC Handler
  const startDiditVerification = async () => {
    setIsDiditLoading(true);
    const sdk = DiditSdk.shared;
    
    let sessionUrl = `https://verify.didit.me/session/tyfi-demo-${Date.now()}`;
    try {
      const apiKey = import.meta.env.VITE_DIDIT_API_KEY;
      if (apiKey) {
        const response = await fetch('https://api.didit.me/v1/session/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${apiKey}`,
            'x-api-key': apiKey
          },
          body: JSON.stringify({ vendor_data: walletAddress || 'sponsor' })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.url) sessionUrl = data.url;
        }
      }
    } catch (e) {
      console.warn("Didit API fetch failed (likely CORS or missing workflow_id), falling back to mock session", e);
    }

    sdk.onComplete = (result: any) => {
      if (result.type === 'completed' && result.session) {
        setIsDiditVerified(true);
        setDiditSessionId(result.session.sessionId);
      }
      setIsDiditLoading(false);
    };
    
    sdk.onEvent = (event: any) => {
      if (event.type === 'didit:error' || event.type === 'didit:cancelled' || event.type === 'didit:close_request') {
        setIsDiditLoading(false);
      }
    };

    sdk.startVerification({ url: sessionUrl }).catch((e: any) => {
      console.error('Failed to start Didit SDK', e);
      setIsDiditLoading(false);
    });
  };

  const handleCompleteRegistration = async () => {
    setIsRegistering(true);
    try {
      await registerSponsor(walletAddress, sponsorInfo, network);
      onVerificationComplete(sponsorInfo);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className={`absolute inset-0 bg-grid-slate-900/[0.04] bg-[bottom_1px_center] ${isMainnet ? 'bg-grid-emerald-500/[0.02]' : 'bg-grid-sky-500/[0.02]'}`} style={{ maskImage: 'linear-gradient(to bottom, transparent, black)' }} />
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full filter blur-[120px] transition-colors duration-1000 -z-10 ${
        isMainnet ? 'bg-emerald-500/10' : 'bg-sky-500/10'
      }`} />

      <div className="relative z-10 max-w-2xl w-full mt-12 md:mt-0">
        {onBack && (
          <button 
            onClick={onBack}
            className="absolute -top-12 md:-top-16 left-0 text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="text-sm font-bold uppercase tracking-wider">Back to Profiles</span>
          </button>
        )}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${isMainnet ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'}`}>
            <Globe size={32} />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-4">Institutional & Sponsor Onboarding</h1>
          <p className="text-slate-400 text-sm">Complete your institutional profile to securely deploy liquidity and subsidize agricultural resilience.</p>
        </div>

        <div className="glass-panel p-6 md:p-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 border border-white/10">
          <div className="space-y-6">
            <div className="form-group">
              <label className="text-xs mb-1.5 block text-slate-300 font-bold uppercase tracking-wider">Full Name / Organization Name</label>
              <input 
                type="text" 
                value={sponsorInfo.name}
                onChange={e => setSponsorInfo(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 transition-colors ${isMainnet ? 'focus:border-emerald-500/50' : 'focus:border-sky-500/50'}`}
                placeholder="Juan Dela Cruz or Global NGO"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="text-xs mb-1.5 block text-slate-300 font-bold uppercase tracking-wider">Email Address</label>
                <input 
                  type="email" 
                  value={sponsorInfo.email}
                  onChange={e => setSponsorInfo(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 transition-colors ${isMainnet ? 'focus:border-emerald-500/50' : 'focus:border-sky-500/50'}`}
                  placeholder="contact@example.com"
                />
              </div>

              <div className="form-group">
                <label className="text-xs mb-1.5 block text-slate-300 font-bold uppercase tracking-wider">Date of Birth / Incorp. Date</label>
                <input 
                  type="date" 
                  value={sponsorInfo.birthDate}
                  onChange={e => setSponsorInfo(prev => ({ ...prev, birthDate: e.target.value }))}
                  className={`w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 transition-colors ${isMainnet ? 'focus:border-emerald-500/50' : 'focus:border-sky-500/50'} [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]`}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="text-xs mb-1.5 block text-slate-300 font-bold uppercase tracking-wider">Entity Type</label>
              <select 
                value={sponsorInfo.sponsorType}
                onChange={e => setSponsorInfo(prev => ({ ...prev, sponsorType: e.target.value }))}
                className={`w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 transition-colors appearance-none ${isMainnet ? 'focus:border-emerald-500/50' : 'focus:border-sky-500/50'}`}
              >
                <option value="Donor">Individual Donor</option>
                <option value="NGO">Non-Governmental Organization (NGO)</option>
                <option value="Investor">Liquidity Provider / Investor</option>
                <option value="Government">Government Agency</option>
              </select>
            </div>

            {/* Didit KYC Verification */}
            <div className="relative pt-2">
              <div 
                onClick={!isDiditVerified && !isDiditLoading ? startDiditVerification : undefined}
                className={`file-upload-container group block transition-all ${isDiditVerified ? 'active border-emerald-500/50 bg-emerald-500/10 cursor-default' : 'cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5'}`}
              >
                {isDiditLoading ? (
                  <div className="py-2">
                    <div className="scanner mb-4"></div>
                    <Loader2 className={`animate-spin mx-auto mb-2 ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`} size={32} />
                    <p className={`font-bold text-sm animate-pulse ${isMainnet ? 'text-emerald-400' : 'text-sky-400'}`}>Initializing Didit Secure KYC...</p>
                  </div>
                ) : isDiditVerified ? (
                  <div className="py-2 animate-success">
                    <CheckCircle2 className="text-emerald-500 mx-auto mb-2" size={32} />
                    <p className="text-emerald-400 text-sm font-bold truncate max-w-full">Identity Verified</p>
                    <p className="text-emerald-500/70 text-xs font-medium flex items-center justify-center gap-1 mt-1">
                      <ShieldCheck size={12} /> Secure Web3 KYC by Didit
                    </p>
                  </div>
                ) : (
                  <div className="py-4">
                    <ShieldCheck className={`upload-icon mx-auto mb-2 transition-colors ${isMainnet ? 'group-hover:text-emerald-400' : 'group-hover:text-blue-400'}`} size={32} />
                    <p className="text-white font-bold text-sm mb-0.5">Verify Identity with Didit</p>
                    <p className="text-slate-500 text-xs">Secure, fast & decentralized KYC</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              {onBack && (
                <button 
                  onClick={onBack}
                  className="p-3.5 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-all border border-white/10"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <button 
                onClick={handleCompleteRegistration}
                disabled={!sponsorInfo.name || !sponsorInfo.email || !sponsorInfo.birthDate || !isDiditVerified || isRegistering}
                className={`flex-1 py-3.5 rounded-xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isMainnet 
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                    : 'bg-sky-500 hover:bg-sky-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.2)]'
                }`}
              >
                {isRegistering ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                {isRegistering ? 'Registering on Firebase...' : 'Complete Registration'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default SponsorVerification;
