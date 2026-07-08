import React, { useState } from 'react';
import { Shield, Wind, Zap, Activity, ArrowRight, ShieldCheck, Globe, Coins, ShieldAlert, Check } from 'lucide-react';

interface LandingPageProps {
  onConnect: () => void;
  isLoading: boolean;
  tvl: number;
  subsidy: number;
}

const LandingPage: React.FC<LandingPageProps> = ({ onConnect, isLoading, tvl, subsidy }) => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 overflow-x-hidden font-sans selection:bg-sky-500/30">
      
      {/* Navbar */}
      <nav className="fixed w-full z-50 top-0 transition-all duration-300 bg-[#0f172a]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 p-0.5 shadow-lg shadow-sky-500/20">
                <div className="w-full h-full bg-[#0f172a] rounded-[10px] flex items-center justify-center">
                  <Wind className="w-6 h-6 text-sky-400" />
                </div>
              </div>
              <span className="text-2xl font-bold tracking-tight text-white display-font">TyFi Vault</span>
            </div>
            
            <div>
              <button 
                onClick={onConnect}
                disabled={isLoading}
                className="group relative inline-flex items-center justify-center px-8 py-3 font-semibold text-white transition-all duration-200 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-white/20 hover:scale-105 overflow-hidden disabled:opacity-50 disabled:hover:scale-100"
              >
                <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                  <div className="relative h-full w-8 bg-white/20" />
                </div>
                <span className="relative flex items-center gap-2">
                  {isLoading ? 'Connecting...' : 'Connect Wallet'}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-sm font-medium text-slate-300">Testnet Live: v2.0 Protocol</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-white mb-8 display-font leading-tight animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Weather the Storm.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]">
              Trust the Code.
            </span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 mb-10 leading-relaxed animate-fade-in" style={{ animationDelay: '0.3s' }}>
            The first autonomous, ZK-verified micro-insurance protocol protecting farmers against climate disasters. No middlemen. No claims process. Instant payouts.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <button 
              onClick={onConnect}
              disabled={isLoading}
              className="px-8 py-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-lg w-full sm:w-auto justify-center"
            >
              <Shield className="w-5 h-5" />
              Enter the Vault
            </button>
            <a href="#stats" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-2xl border border-white/10 transition-all hover:border-white/20 text-lg w-full sm:w-auto text-center flex items-center justify-center gap-2">
              View Protocol Stats
            </a>
          </div>
        </div>
      </div>

      {/* Bento Grid Features */}
      <div className="py-24 bg-[#090e1a] relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 display-font">The Resilience Network</h2>
            <p className="text-slate-400 text-lg">Smart contracts that react faster than the storm.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[250px]">
            {/* Feature 1: Wide */}
            <div className="md:col-span-2 glass-panel group flex flex-col justify-end p-8 relative overflow-hidden">
              <div className="absolute top-6 left-6 w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center border border-sky-500/30 group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6 text-sky-400" />
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-[60px] group-hover:bg-sky-500/20 transition-colors" />
              <h3 className="text-2xl font-bold text-white mb-2 relative z-10">ZK Weather Oracles</h3>
              <p className="text-slate-400 relative z-10 max-w-md">Real-time climate data secured by zero-knowledge proofs. If PAGASA or NASA detects a severe storm, the contract knows instantly.</p>
            </div>
            
            {/* Feature 2: Square */}
            <div className="glass-panel group flex flex-col justify-end p-8 relative overflow-hidden">
              <div className="absolute top-6 left-6 w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Parametric Payouts</h3>
              <p className="text-slate-400 text-sm">No claims to file. When weather thresholds are breached, funds are unlocked autonomously.</p>
            </div>

            {/* Feature 3: Square */}
            <div className="glass-panel group flex flex-col justify-end p-8 relative overflow-hidden">
              <div className="absolute top-6 left-6 w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center border border-purple-500/30 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Cross-Device Sync</h3>
              <p className="text-slate-400 text-sm">Smart identity profiles linked to your wallet. Seamlessly access your farms from any device.</p>
            </div>

            {/* Feature 4: Wide */}
            <div className="md:col-span-2 glass-panel group flex flex-col justify-end p-8 relative overflow-hidden">
              <div className="absolute top-6 left-6 w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30 group-hover:scale-110 transition-transform">
                <Coins className="w-6 h-6 text-amber-400" />
              </div>
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[60px] group-hover:bg-amber-500/20 transition-colors" />
              <h3 className="text-2xl font-bold text-white mb-2 relative z-10">DAO Treasury & Subsidies</h3>
              <p className="text-slate-400 relative z-10 max-w-md">Global donors and liquidity providers can supply capital to back insurance pools, earning yields while protecting vulnerable farmers.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live Stats */}
      <div id="stats" className="py-24 relative border-t border-white/5">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] z-0 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-panel text-center p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-sky-500/20 rounded-full mb-4">
                <ShieldAlert className="w-6 h-6 text-sky-400" />
              </div>
              <h4 className="text-slate-400 font-medium mb-2 uppercase tracking-wider text-sm">Total Value Locked</h4>
              <div className="text-4xl font-bold text-white display-font">{tvl.toLocaleString()} <span className="text-2xl text-sky-400">XLM</span></div>
            </div>
            
            <div className="glass-panel text-center p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-500/20 rounded-full mb-4">
                <Activity className="w-6 h-6 text-amber-400" />
              </div>
              <h4 className="text-slate-400 font-medium mb-2 uppercase tracking-wider text-sm">Available Subsidy</h4>
              <div className="text-4xl font-bold text-white display-font">{subsidy.toLocaleString()} <span className="text-2xl text-amber-400">XLM</span></div>
            </div>

            <div className="glass-panel text-center p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/20 rounded-full mb-4">
                <Check className="w-6 h-6 text-emerald-400" />
              </div>
              <h4 className="text-slate-400 font-medium mb-2 uppercase tracking-wider text-sm">Active Oracles</h4>
              <div className="text-4xl font-bold text-white display-font">2 <span className="text-2xl text-emerald-400">Syncs</span></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#020617] py-12 text-center">
        <p className="text-slate-500">TyFi Resilience Vault © {new Date().getFullYear()}. Built on Stellar.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
