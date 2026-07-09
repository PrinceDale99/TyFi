import React, { useState } from 'react';
import { Wallet, TrendingUp, BarChart3, ArrowRight, ShieldCheck, PieChart, Activity } from 'lucide-react';

const ParallaxCard = ({ children, className = '' }: any) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = React.useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const rotateY = ((mouseX / width) - 0.5) * 10;
    const rotateX = ((mouseY / height) - 0.5) * -10;
    setRotation({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transformStyle: "preserve-3d",
        transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        transition: rotation.x === 0 && rotation.y === 0 ? "transform 0.5s ease-out" : "transform 0.1s ease-out"
      }}
      className={`glass-panel border-white/10 shadow-2xl relative overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50 pointer-events-none" style={{ transform: "translateZ(20px)" }} />
      <div style={{ transform: "translateZ(40px)" }} className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
};

export const LPDashboard = ({ sponsorInfo, network, walletAddress, userLpBalance, totalVaultTVL, onAddLiquidity, onWithdrawLiquidity }: any) => {
  const [amount, setAmount] = useState('');
  const [actionType, setActionType] = useState<'add' | 'withdraw'>('add');

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 lg:space-y-8 pb-32 animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl lg:text-5xl font-black text-white tracking-tighter uppercase italic">
            Capital <span className="text-indigo-400">Command</span>
          </h2>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-widest mt-1">Institutional Liquidity Provision</p>
        </div>
      </div>

      {/* Hero Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* The Vault Backing Widget */}
        <ParallaxCard className="lg:col-span-8 p-8 flex flex-col justify-between min-h-[300px]">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-indigo-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-300">Total Vault Backing</span>
            </div>
            <div className="text-5xl lg:text-7xl font-black text-white tracking-tighter">
              {Number(totalVaultTVL).toLocaleString()} <span className="text-indigo-500">XLM</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-md">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Your Contribution</div>
              <div className="text-2xl font-black text-white">{Number(userLpBalance || 0).toLocaleString()} <span className="text-sm text-slate-500">XLM</span></div>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-md">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Current APY</div>
              <div className="text-2xl font-black text-emerald-400">12.5%</div>
            </div>
            <div className="col-span-2 bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-md">
               <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Entity Details</div>
               <div className="text-sm font-bold text-white truncate">{sponsorInfo?.name || 'Loading...'}</div>
               <div className="text-[10px] text-slate-500 font-mono truncate mt-1">{walletAddress}</div>
            </div>
          </div>
        </ParallaxCard>

        {/* Funding Console Widget */}
        <ParallaxCard className="lg:col-span-4 p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
             <button 
                onClick={() => setActionType('add')}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${actionType === 'add' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
             >
                Deposit
             </button>
             <button 
                onClick={() => setActionType('withdraw')}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${actionType === 'withdraw' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
             >
                Withdraw
             </button>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-6">
             <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2">Amount (XLM)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-4 text-2xl font-black text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                  <button onClick={() => setAmount(actionType === 'withdraw' ? userLpBalance : '1000')} className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg text-slate-300 transition-colors">
                    Max
                  </button>
                </div>
             </div>
             
             <button
               disabled={!amount || isNaN(Number(amount)) || Number(amount) <= 0}
               onClick={() => {
                 if (actionType === 'add') onAddLiquidity(amount);
                 else onWithdrawLiquidity(amount);
               }}
               className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 disabled:shadow-none flex items-center justify-center gap-2"
             >
               {actionType === 'add' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
               <ArrowRight size={18} />
             </button>
          </div>
        </ParallaxCard>
      </div>

      {/* Analytics / Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ParallaxCard className="p-6 h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-white uppercase tracking-widest">Risk / Return Visualizer</h3>
            <Activity className="text-slate-500" size={20} />
          </div>
          <div className="flex-1 bg-slate-900/50 rounded-xl border border-white/5 flex items-center justify-center relative overflow-hidden">
             {/* Mock Chart Area */}
             <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-emerald-500/20 to-transparent"></div>
             <svg className="w-full h-full opacity-50" preserveAspectRatio="none" viewBox="0 0 100 100">
               <path d="M0,100 L0,80 Q25,70 50,85 T100,60 L100,100 Z" fill="rgba(16, 185, 129, 0.2)" />
               <path d="M0,80 Q25,70 50,85 T100,60" fill="none" stroke="#10b981" strokeWidth="2" />
             </svg>
             <div className="absolute inset-0 flex items-center justify-center flex-col">
                <BarChart3 size={48} className="text-slate-700 mb-2" />
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Historical Data Syncing...</p>
             </div>
          </div>
        </ParallaxCard>

        <ParallaxCard className="p-6 h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-white uppercase tracking-widest">Global Exposure</h3>
            <PieChart className="text-slate-500" size={20} />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-48 h-48 rounded-full border-[16px] border-slate-800 relative">
               <div className="absolute inset-[-16px] rounded-full border-[16px] border-transparent border-t-indigo-500 border-r-indigo-500 transform rotate-45"></div>
               <div className="absolute inset-[-16px] rounded-full border-[16px] border-transparent border-b-emerald-500 transform rotate-12"></div>
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white">4</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Active Regions</span>
               </div>
            </div>
          </div>
        </ParallaxCard>
      </div>

    </div>
  );
};
