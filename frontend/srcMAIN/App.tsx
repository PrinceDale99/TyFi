import React, { useState, useEffect } from 'react';
import {
  Shield,
  Wind,
  CloudRain,
  TrendingUp,
  Wallet,
  Bell,
  Menu,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  Lock,
  ArrowUpRight,
  Database,
  Info,
  Calculator,
  MapPin,
  ShieldCheck
} from 'lucide-react';
import FarmerVerification from './components/FarmerVerification';
import WeatherWidget from './components/WeatherWidget';
import SmartCalculator from './components/SmartCalculator';
import AssetDistribution from './components/AssetDistribution';
import WeatherMap from './components/WeatherMap';
import PayoutStatus from './components/PayoutStatus';
import WalletModal from './components/WalletModal';
import { fetchWeather } from './services/weatherService';
import type { WeatherData, FarmData, Claim } from "./types";
import { connectWallet } from './lib/stellar';

interface Farm extends FarmData {
  id: string;
  isInsured: boolean;
}

function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'history' | 'calc' | 'vault'>('monitor');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<{ id: string, text: string, type: 'info' | 'success' | 'warning' }[]>([]);
  const [vaultBalance, setVaultBalance] = useState(8500000);
  const [claims, setClaims] = useState<Claim[]>([
    { id: 'TX-9021', date: '2025-11-12', amount: 125000, status: 'Paid', trigger: 'Wind Speed > 120km/h' },
  ]);

  useEffect(() => {
    const loadWeather = async () => {
      setIsLoading(true);
      try {
        // Default to Manila coordinates if no farm
        const lat = farms.length > 0 ? farms[0].latitude : 14.5995;
        const lon = farms.length > 0 ? farms[0].longitude : 120.9842;
        const data = await fetchWeather(lat, lon);
        setWeather(data);
      } catch (error) {
        console.error('Failed to fetch weather:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadWeather();

    // Refresh weather every 5 minutes
    const interval = setInterval(loadWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [farms]);

  const addNotification = (text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const handleConnectWallet = async () => {
    try {
      const address = await connectWallet();
      handleWalletConnected(address);
    } catch (error: any) {
      addNotification(error.message || 'Failed to connect wallet', 'warning');
    }
  };

  const handleWalletConnected = (address: string) => {
    setWalletAddress(address);
    setIsWalletConnected(true);

    // Load persisted data for this specific address
    const savedData = localStorage.getItem(`typhoon_vault_${address}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFarms(parsed.farms || []);
        setIsVerified(parsed.isVerified || false);
      } catch (e) {
        console.error("Failed to load account data", e);
      }
    } else {
      // Clear data if new account connects
      setFarms([]);
      setIsVerified(false);
    }

    addNotification('Securely connected to Stellar network', 'success');
  };

  // Persist data whenever farms or verification state changes
  useEffect(() => {
    if (isWalletConnected && walletAddress) {
      const data = { farms, isVerified };
      localStorage.setItem(`typhoon_vault_${walletAddress}`, JSON.stringify(data));
    }
  }, [farms, isVerified, isWalletConnected, walletAddress]);

  const formatAddress = (addr: string | null) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const handleDisconnect = () => {
    setWalletAddress('');
    setIsWalletConnected(false);
    setIsVerified(false);
    addNotification('Securely disconnected from TyFi.', 'warning');
  };

  const handleAddFarm = (farmData: FarmData) => {
    const newFarm: Farm = {
      ...farmData,
      id: `FARM-${Math.floor(Math.random() * 10000)}`,
      isInsured: true
    };
    setFarms(prev => [...prev, newFarm]);
    setIsVerified(true);
    addNotification(`${farmData.farmName} verified and secured`, 'success');
  };

  const handleClaim = (farmId: string) => {
    const farm = farms.find(f => f.id === farmId);
    if (!farm) return;

    const claimAmount = farm.totalCropValue * 0.8; // 80% payout
    const newClaim: Claim = {
      id: `TX-${Math.floor(Math.random() * 10000)}`,
      date: new Date().toISOString().split('T')[0],
      amount: claimAmount,
      status: 'Paid',
      trigger: `Wind ${weather?.windSpeed}km/h > Threshold`
    };

    setClaims(prev => [newClaim, ...prev]);
    addNotification(`Insurance payout of ₱${claimAmount.toLocaleString()} processed!`, 'success');
  };

  if (!isWalletConnected) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-panel text-center space-y-8 py-12">
          <div className="w-20 h-20 bg-sky-500 rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(14,165,233,0.3)] animate-pulse">
            <Shield className="text-white" size={40} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">
              Typhoon <span className="text-sky-500">Resilience</span> Vault
            </h1>
            <p className="text-slate-400 mt-4 text-sm font-medium">Parametric Agricultural Insurance Protocol</p>
          </div>
          <button
            onClick={handleConnectWallet}
            className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black py-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(14,165,233,0.2)] flex items-center justify-center gap-3 group"
          >
            <Wallet size={20} className="group-hover:rotate-12 transition-transform" />
            Connect Web3 Wallet
          </button>
        </div>

        <WalletModal
          isOpen={isWalletModalOpen}
          onClose={() => setIsWalletModalOpen(false)}
          onConnect={handleWalletConnected}
        />
      </div>
    );
  }

  if (!isVerified && farms.length === 0) {
    return <FarmerVerification onComplete={handleAddFarm} />;
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-sky-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(14,165,233,0.3)]">
              <Shield className="text-white" size={24} />
            </div>
            <div>
              <div className="text-sm font-black text-white tracking-tighter uppercase italic">TyFi</div>
              <div className="text-[10px] text-sky-400 font-bold uppercase tracking-widest">Protocol v2.4 Active</div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'monitor' ? 'text-sky-400' : 'text-slate-500 hover:text-white'}`}
            >
              Monitor
            </button>
            <button
              onClick={() => setActiveTab('calc')}
              className={`text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'calc' ? 'text-sky-400' : 'text-slate-500 hover:text-white'}`}
            >
              Calculator
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'history' ? 'text-sky-400' : 'text-slate-500 hover:text-white'}`}
            >
              Claims
            </button>
            <button
              onClick={() => setActiveTab('vault')}
              className={`text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'vault' ? 'text-sky-400' : 'text-slate-500 hover:text-white'}`}
            >
              Vault
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
              <Bell size={20} />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
              )}
            </button>
            <div className="h-8 w-[1px] bg-white/5 mx-2" />
            <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 group">
              <div className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
                <Wallet size={14} />
              </div>
              <span className="text-[10px] font-mono text-slate-400">{formatAddress(walletAddress)}</span>
              <button
                onClick={handleDisconnect}
                className="ml-2 p-1 text-slate-600 hover:text-rose-400 transition-colors"
                title="Disconnect Wallet"
              >
                <Lock size={12} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-4 max-w-7xl mx-auto">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Left Column - Main View */}
            <div className="lg:col-span-8 space-y-8">

              {/* Header section */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-black text-white tracking-tight">
                    {activeTab === 'monitor' ? 'Protocol Monitoring' :
                      activeTab === 'calc' ? 'Smart Calculator' :
                        activeTab === 'history' ? 'Claim History' : 'Vault Infrastructure'}
                  </h1>
                  <p className="text-slate-400 mt-1">
                    {activeTab === 'monitor' ? `Automated smart contracts for ${farms[0]?.farmName || 'your farms'}` :
                      activeTab === 'calc' ? 'Analyze damage and estimate recovery payouts' :
                        activeTab === 'history' ? 'Transparency report of all triggered payouts' :
                          'Proof of liquidity and capital reserves'}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold bg-white/5 p-1 rounded-lg border border-white/5">
                  <button
                    onClick={() => setActiveTab('monitor')}
                    className={`px-4 py-2 rounded-md transition-all ${activeTab === 'monitor' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                  >
                    Live Monitor
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 rounded-md transition-all ${activeTab === 'history' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                  >
                    Claims
                  </button>
                  <button
                    onClick={() => setActiveTab('vault')}
                    className={`px-4 py-2 rounded-md transition-all ${activeTab === 'vault' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                  >
                    Vault
                  </button>
                </div>
              </div>

              {/* Dynamic Content */}
              {activeTab === 'monitor' && (
                <>
                  <div className="glass-panel min-h-[400px] relative overflow-hidden">
                    <WeatherMap
                      weather={weather}
                      isLoading={isLoading}
                      regionName={farms[0]?.region}
                      farmName={farms[0]?.farmName}
                    />
                  </div>

                  {weather && (
                    <div className="glass-panel">
                      <WeatherWidget
                        weather={weather}
                        isLoading={isLoading}
                        onRefresh={() => {
                          addNotification('Refreshing live weather feeds...', 'info');
                        }}
                      />
                    </div>
                  )}
                </>
              )}
              {activeTab === 'calc' && (
                <div className="glass-panel">
                  <SmartCalculator farms={farms} />
                </div>
              )}

              {activeTab === 'history' && (
                <div className="glass-panel">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
                      <History size={20} />
                    </div>
                    <h3 className="font-black text-white">Immutable Payout Records</h3>
                  </div>

                  <div className="space-y-3">
                    {claims.map((claim) => (
                      <div key={claim.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-sky-500/30 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                            <CheckCircle2 size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">{claim.id}</div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest">{claim.date} • {claim.trigger}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-white">₱{claim.amount.toLocaleString()}</div>
                          <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Confirmed</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 p-4 bg-sky-500/5 border border-sky-500/10 rounded-2xl flex items-center gap-4">
                    <Info size={20} className="text-sky-400 shrink-0" />
                    <p className="text-xs text-slate-400 leading-relaxed">
                      All payouts are automatically processed by our Ethereum-compatible smart contract engine when weather triggers are met according to Open-Meteo oracle data.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'vault' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-panel border-sky-500/20">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
                          <Lock size={20} />
                        </div>
                        <h3 className="font-black text-white">Total Value Locked</h3>
                      </div>
                      <div className="text-4xl font-black text-white mb-2">₱{(vaultBalance / 1000000).toFixed(1)}M</div>
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                        <TrendingUp size={14} />
                        +12.4% this quarter
                      </div>
                    </div>

                    <div className="glass-panel border-indigo-500/20">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                          <Database size={20} />
                        </div>
                        <h3 className="font-black text-white">Reserve Ratio</h3>
                      </div>
                      <div className="text-4xl font-black text-white mb-2">342%</div>
                      <div className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                        Over-collateralized protection
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel">
                    <h3 className="font-black text-white mb-6">Liquidity Providers</h3>
                    <div className="space-y-4">
                      {[
                        { name: 'Swiss Re Capital', share: '45%', reliability: '100%' },
                        { name: 'Luzon Agriculture Fund', share: '22%', reliability: '100%' },
                        { name: 'Asian Development Bank', share: '18%', reliability: '100%' },
                        { name: 'Protocol Reserves', share: '15%', reliability: '100%' },
                      ].map((lp, i) => (
                        <div key={i} className="flex items-center justify-between p-3 border-b border-white/5 last:border-0">
                          <div className="text-sm font-bold text-slate-300">{lp.name}</div>
                          <div className="flex gap-6">
                            <div className="text-right">
                              <div className="text-[10px] text-slate-500 uppercase font-black">Share</div>
                              <div className="text-xs font-bold text-white">{lp.share}</div>
                            </div>
                            <div className="text-right w-20">
                              <div className="text-[10px] text-slate-500 uppercase font-black">Status</div>
                              <div className="text-xs font-bold text-emerald-400">Stable</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {weather && farms.length > 0 && (
                <PayoutStatus
                  weather={weather}
                  farms={farms}
                  onClaim={handleClaim}
                />
              )}

              {/* Farm Intel - Moved inside the left column for better layout */}
              <AssetDistribution farms={farms} />
            </div>

            {/* Right Column - Controls */}
            <div className="lg:col-span-4 space-y-6">
              <div className="glass-panel">
                <h3 className="font-black text-white mb-6">Quick Protocol Access</h3>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => setActiveTab('monitor')}
                    className={`w-full p-4 rounded-xl border flex items-center justify-between group transition-all ${activeTab === 'monitor' ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Wind size={20} />
                      <span className="font-bold">Live Monitor</span>
                    </div>
                    <ArrowUpRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => setActiveTab('history')}
                    className={`w-full p-4 rounded-xl border flex items-center justify-between group transition-all ${activeTab === 'history' ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'}`}
                  >
                    <div className="flex items-center gap-3">
                      <History size={20} />
                      <span className="font-bold">Claim History</span>
                    </div>
                    <ArrowUpRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => setActiveTab('vault')}
                    className={`w-full p-4 rounded-xl border flex items-center justify-between group transition-all ${activeTab === 'vault' ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Database size={20} />
                      <span className="font-bold">Vault Balance</span>
                    </div>
                    <ArrowUpRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={() => setActiveTab('calc')}
                    className={`w-full p-4 rounded-xl border flex items-center justify-between group transition-all ${activeTab === 'calc' ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Calculator size={20} />
                      <span className="font-bold">Smart Calculator</span>
                    </div>
                    <ArrowUpRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>

              {/* Oracle Status Card */}
              <div className="glass-panel border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                      <ShieldCheck size={20} />
                    </div>
                    <h3 className="font-black text-white">Oracle Integrity</h3>
                  </div>
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-tighter rounded border border-emerald-500/30">Verified</span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Node Operator</span>
                    <span className="text-white font-bold">Oracle.ph (Mainnet)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Source Consensus</span>
                    <span className="text-white font-bold">Open-Meteo + PAGASA</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Update Frequency</span>
                    <span className="text-white font-bold">Every 15m</span>
                  </div>
                  <div className="h-[1px] bg-white/5 my-2" />
                  <div className="flex items-center gap-3 text-[10px]">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-emerald-400/80 font-bold uppercase tracking-widest">Oracle heartbeat active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Notifications Overlay */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3 max-w-sm w-full">
        {notifications.map(note => (
          <div
            key={note.id}
            className={`p-4 rounded-2xl border flex items-center gap-4 animate-in slide-in-from-right shadow-2xl ${note.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' :
              note.type === 'warning' ? 'bg-amber-500 text-white border-amber-400' :
                'bg-slate-900 text-white border-white/10 backdrop-blur-xl'
              }`}
          >
            {note.type === 'success' ? <CheckCircle2 size={20} /> : note.type === 'warning' ? <AlertCircle size={20} /> : <Info size={20} />}
            <span className="text-sm font-bold">{note.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
