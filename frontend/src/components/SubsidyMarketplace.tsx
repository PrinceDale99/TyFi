import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Globe, 
  Users, 
  Sprout, 
  ShieldCheck, 
  ExternalLink, 
  Loader2, 
  ArrowRight,
  HandHeart,
  Search,
  MapPin,
  Calendar
} from 'lucide-react';
import { getActiveSubsidyRequests } from '../services/firebaseService';
import { registerPolicyOnChain } from '../lib/stellar';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface SubsidyRequest {
  id: string;
  farmerAddress: string;
  farmerName: string;
  farmName: string;
  cropType: string;
  region: string;
  farmSize: number;
  totalPremium?: number;
  govSubsidyPercent?: number;
  ngoSubsidyPercent?: number;
  premiumNeeded: number;
  harvestValue: number;
  season: string;
  timestamp: any;
}

interface SubsidyMarketplaceProps {
  sponsorAddress: string;
  network?: 'testnet' | 'mainnet';
  addNotification: (text: string, type?: 'info' | 'success' | 'warning') => void;
  userFarms?: any[];
}

const SubsidyMarketplace: React.FC<SubsidyMarketplaceProps> = ({ 
  sponsorAddress, 
  network = 'testnet',
  addNotification,
  userFarms = []
}) => {
  const [requests, setRequests] = useState<SubsidyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchRequests();
  }, [network]);

  const fetchRequests = async () => {
    setIsLoading(true);
    const data = await getActiveSubsidyRequests(network);
    setRequests(data);
    setIsLoading(false);
  };

  const handleSponsor = async (request: SubsidyRequest) => {
    if (!sponsorAddress) {
      addNotification('Please connect your wallet to sponsor a farmer.', 'warning');
      return;
    }

    if (sponsorAddress.startsWith('DEMO_')) {
      addNotification('You are on a demo account, unable to fund. Please connect your real wallet via a Stellar extension.', 'warning');
      return;
    }

    setIsProcessing(request.id);
    try {
      addNotification(`Initiating sponsorship for ${request.farmerName}...`, 'info');
      
      // Construct the transaction: Sponsor pays, but policy is registered to Farmer
      const success = await registerPolicyOnChain(
        request.farmerAddress, // The beneficiary is the farmer
        request.farmName.replace(/\s+/g, '_'),
        request.region,
        request.premiumNeeded,
        request.season,
        network
      );

      if (success) {
        // Update Firestore to mark as funded
        const requestRef = doc(db, "subsidy_requests", request.id);
        await updateDoc(requestRef, {
          isFunded: true,
          fundedBy: sponsorAddress,
          fundedAt: new Date().toISOString()
        });

        addNotification(`Sponsorship successful! ${request.farmerName}'s farm is now protected.`, 'success');
        setRequests(prev => prev.filter(r => r.id !== request.id));
      }
    } catch (error: any) {
      console.error('Sponsorship failed:', error);
      addNotification('Sponsorship transaction failed. Please try again.', 'warning');
    } finally {
      setIsProcessing(null);
    }
  };

  const filteredRequests = requests.filter(r => 
    r.farmerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.cropType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight uppercase italic flex items-center gap-3">
            <Heart className="text-rose-500 animate-pulse" />
            Subsidy Marketplace
          </h2>
          <p className="text-slate-400 text-sm font-medium">Sponsor verified Filipino farmers and provide climate resilience.</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input 
            type="text" 
            placeholder="Search by name, region, or crop..."
            className="bg-slate-900 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-rose-500/50 w-full md:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* User's Own Farms Configuration Section */}
      {userFarms.length > 0 && (
        <div className="glass-panel p-6 bg-white/5 border-white/10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4">
            <Sprout size={16} className={network === 'mainnet' ? 'text-emerald-400' : 'text-sky-400'} />
            List Your Farms For Subsidy
          </h3>
          <p className="text-xs text-slate-400 mb-4">Select which of your active farms to list publicly so institutional donors can sponsor your premiums.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userFarms.map((farm) => {
              const listedRequest = requests.find(r => r.farmerAddress === sponsorAddress && r.farmName === farm.farmName);
              
              return (
                <div key={farm.id} className="p-4 rounded-xl bg-slate-950/50 border border-white/5 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">{farm.farmName}</h4>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">{farm.cropType} • {farm.farmSize} Hectares</p>
                  </div>
                  {listedRequest ? (
                    <button
                      disabled={isProcessing === farm.id}
                      onClick={async () => {
                        setIsProcessing(farm.id);
                        try {
                          addNotification(`Unlisting ${farm.farmName} from the marketplace...`, 'info');
                          const { unlistFromSubsidy } = await import('../services/firebaseService');
                          await unlistFromSubsidy(listedRequest.id);
                          addNotification(`${farm.farmName} has been removed from the marketplace.`, 'success');
                          fetchRequests(); // Refresh the list
                        } catch (e) {
                          addNotification(`Failed to unlist ${farm.farmName}.`, 'warning');
                        } finally {
                          setIsProcessing(null);
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                        isProcessing === farm.id 
                          ? 'bg-rose-900/50 text-rose-500/50 cursor-wait border border-rose-900/30'
                          : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                      }`}
                    >
                      {isProcessing === farm.id ? 'Unlisting...' : 'Unlist Farm'}
                    </button>
                  ) : (
                    <button
                      disabled={isProcessing === farm.id}
                      onClick={async () => {
                        setIsProcessing(farm.id);
                        try {
                          addNotification(`Registering ${farm.farmName} for financial assistance...`, 'info');
                          const { registerForSubsidy } = await import('../services/firebaseService');
                          await registerForSubsidy(sponsorAddress, farm, network);
                          addNotification(`${farm.farmName} successfully listed in the Subsidy Marketplace.`, 'success');
                          fetchRequests(); // Refresh the list
                        } catch (e) {
                          addNotification(`Failed to list ${farm.farmName}.`, 'warning');
                        } finally {
                          setIsProcessing(null);
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                        isProcessing === farm.id 
                          ? 'bg-slate-700 text-slate-400 cursor-wait'
                          : network === 'mainnet' 
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                            : 'bg-sky-500 hover:bg-sky-400 text-white shadow-[0_0_15px_rgba(14,165,233,0.2)]'
                      }`}
                    >
                      {isProcessing === farm.id ? 'Listing...' : 'List Farm'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-rose-500" size={40} />
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Loading Verified Requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-20 text-center glass-panel border-dashed border-2 border-white/5">
          <Users size={48} className="mx-auto mb-4 text-slate-700" />
          <h3 className="text-lg font-bold text-slate-500 mb-1">No pending subsidy requests</h3>
          <p className="text-sm text-slate-600">All currently verified farmers are already protected.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRequests.map((request) => (
            <div key={request.id} className="glass-panel p-5 bg-white/5 border-white/10 hover:border-rose-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center text-rose-400 border border-white/5">
                    <Users size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-white text-sm uppercase italic">{request.farmerName}</h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                      <ShieldCheck size={10} className="text-emerald-400" />
                      RSBSA Verified
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <MapPin size={10} /> Region
                  </span>
                  <span className="text-slate-200 font-black">{request.region}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <Sprout size={10} /> Crop & Size
                  </span>
                  <span className="text-slate-200 font-black">{request.cropType} • {request.farmSize} ha</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar size={10} /> Season
                  </span>
                  <span className="text-slate-200 font-black">{request.season}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 mb-6 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-slate-500">Base Premium</span>
                  <span className="text-slate-300">{request.totalPremium?.toLocaleString() || Math.round(request.harvestValue * 0.1).toLocaleString()} XLM</span>
                </div>
                
                {((request.govSubsidyPercent || 0) > 0 || (request.ngoSubsidyPercent || 0) > 0) && (
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <span>Applied Subsidies</span>
                    <span>-{((request.govSubsidyPercent || 0) + (request.ngoSubsidyPercent || 0))}%</span>
                  </div>
                )}

                <div className="pt-2 border-t border-rose-500/10 flex justify-between items-end">
                  <div>
                    <span className="text-[9px] font-black text-rose-400/70 uppercase tracking-widest block mb-1">Remaining Sponsoring</span>
                    <div className="text-2xl font-black text-white">{request.premiumNeeded.toLocaleString()} XLM</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Total Coverage</span>
                    <div className="text-sm font-black text-slate-300">{request.harvestValue.toLocaleString()} XLM</div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => handleSponsor(request)}
                disabled={isProcessing !== null}
                className={`w-full py-3.5 rounded-xl font-black text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${
                  isProcessing === request.id
                    ? 'bg-slate-800 text-slate-500 cursor-wait'
                    : 'bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/20 hover:scale-[1.02]'
                }`}
              >
                {isProcessing === request.id ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Processing...
                  </>
                ) : (
                  <>
                    <HandHeart size={16} />
                    Sponsor This Farmer
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info Panel */}
      <div className="glass-panel p-6 bg-indigo-950/20 border-indigo-500/20 flex gap-4">
        <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 shrink-0 self-start">
          <Globe size={24} />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-black text-white uppercase italic tracking-wider">Direct Global Solidarity</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Sponsorships are trustless. Your XLM goes directly to the <strong>TyFi Soroban Vault</strong> to activate the farmer's parametric policy.
            If a typhoon hits, the smart contract pays out <strong>directly to the farmer's wallet</strong>, not a middleman.            Verification is backed by Philippine Department of Agriculture (RSBSA) credentials.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubsidyMarketplace;
