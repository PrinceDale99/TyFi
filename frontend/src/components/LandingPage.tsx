import React, { useState, MouseEvent as ReactMouseEvent } from 'react';
import { Shield, Wind, Zap, Activity, ArrowRight, ShieldCheck, Globe, Coins, ShieldAlert, Check } from 'lucide-react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';

interface LandingPageProps {
  onConnect: () => void;
  isLoading: boolean;
  tvl: number;
  subsidy: number;
}

const LandingPage: React.FC<LandingPageProps> = ({ onConnect, isLoading, tvl, subsidy }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: ReactMouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  // Animation variants
  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };
  
  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  return (
    <div 
      className="min-h-screen bg-[#020617] text-slate-200 overflow-x-hidden font-sans selection:bg-sky-500/30 relative"
      onMouseMove={handleMouseMove}
    >
      {/* Interactive Global Background Glow */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-30 transition duration-300 z-0"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              650px circle at ${mouseX}px ${mouseY}px,
              rgba(56, 189, 248, 0.15),
              transparent 80%
            )
          `,
        }}
      />
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0 pointer-events-none" />

      {/* Navbar */}
      <motion.nav 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="fixed w-full z-50 top-0 transition-all duration-300 bg-[#0f172a]/70 backdrop-blur-xl border-b border-white/5"
      >
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
                className="group relative inline-flex items-center justify-center px-6 py-2.5 sm:px-8 sm:py-3 font-semibold text-white transition-all duration-200 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-white/20 hover:scale-105 overflow-hidden disabled:opacity-50 disabled:hover:scale-100 text-sm sm:text-base"
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
      </motion.nav>

      {/* Hero Section */}
      <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden z-10">
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-sm font-medium text-slate-300">Testnet Live: v2.0 Protocol</span>
          </motion.div>
          
          <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-white mb-8 display-font leading-tight">
            Weather the Storm.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-500 drop-shadow-[0_0_30px_rgba(56,189,248,0.3)]">
              Trust the Code.
            </span>
          </motion.h1>
          
          <motion.p variants={fadeUp} className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 mb-10 leading-relaxed px-2">
            The first autonomous, ZK-verified micro-insurance protocol protecting farmers against climate disasters. No middlemen. No claims process. Instant payouts.
          </motion.p>
          
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center items-center px-4">
            <button 
              onClick={onConnect}
              disabled={isLoading}
              className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-300 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-2xl shadow-[0_0_30px_rgba(56,189,248,0.3)] hover:shadow-[0_0_50px_rgba(56,189,248,0.5)] hover:scale-105 overflow-hidden text-lg w-full sm:w-auto"
            >
              <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-150%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(150%)]">
                <div className="relative h-full w-12 bg-white/20" />
              </div>
              <Shield className="w-5 h-5 mr-2 relative z-10" />
              <span className="relative z-10">Enter the Vault</span>
            </button>
            <a href="#stats" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-2xl border border-white/10 transition-all hover:border-white/20 text-lg w-full sm:w-auto text-center flex items-center justify-center gap-2 hover:scale-105">
              View Protocol Stats
            </a>
          </motion.div>
        </motion.div>
      </div>

      {/* Bento Grid Features */}
      <div className="py-24 bg-[#090e1a]/80 relative z-10 border-t border-white/5 backdrop-blur-sm">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          <motion.div variants={fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 display-font">The Resilience Network</h2>
            <p className="text-slate-400 text-lg">Smart contracts that react faster than the storm.</p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[auto] md:auto-rows-[250px]">
            {/* Feature 1: Wide */}
            <motion.div 
              variants={fadeUp}
              whileHover={{ scale: 1.02 }}
              className="md:col-span-2 glass-panel group flex flex-col justify-end p-8 relative overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(56,189,248,0.15)] min-h-[250px]"
            >
              <div className="absolute top-6 left-6 w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center border border-sky-500/30 group-hover:scale-110 transition-transform duration-300">
                <Globe className="w-6 h-6 text-sky-400" />
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-[60px] group-hover:bg-sky-500/20 transition-colors duration-500" />
              <h3 className="text-2xl font-bold text-white mb-2 relative z-10 mt-12 md:mt-0">ZK Weather Oracles</h3>
              <p className="text-slate-400 relative z-10 max-w-md">Real-time climate data secured by zero-knowledge proofs. If PAGASA or NASA detects a severe storm, the contract knows instantly.</p>
            </motion.div>
            
            {/* Feature 2: Square */}
            <motion.div 
              variants={fadeUp}
              whileHover={{ scale: 1.03 }}
              className="glass-panel group flex flex-col justify-end p-8 relative overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] min-h-[250px]"
            >
              <div className="absolute top-6 left-6 w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 mt-12 md:mt-0">Parametric Payouts</h3>
              <p className="text-slate-400 text-sm">No claims to file. When weather thresholds are breached, funds are unlocked autonomously.</p>
            </motion.div>

            {/* Feature 3: Square */}
            <motion.div 
              variants={fadeUp}
              whileHover={{ scale: 1.03 }}
              className="glass-panel group flex flex-col justify-end p-8 relative overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(168,85,247,0.15)] min-h-[250px]"
            >
              <div className="absolute top-6 left-6 w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center border border-purple-500/30 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-300">
                <ShieldCheck className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 mt-12 md:mt-0">Cross-Device Sync</h3>
              <p className="text-slate-400 text-sm">Smart identity profiles linked to your wallet. Seamlessly access your farms from any device.</p>
            </motion.div>

            {/* Feature 4: Wide */}
            <motion.div 
              variants={fadeUp}
              whileHover={{ scale: 1.02 }}
              className="md:col-span-2 glass-panel group flex flex-col justify-end p-8 relative overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(245,158,11,0.15)] min-h-[250px]"
            >
              <div className="absolute top-6 left-6 w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30 group-hover:scale-110 transition-transform duration-300">
                <Coins className="w-6 h-6 text-amber-400" />
              </div>
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[60px] group-hover:bg-amber-500/20 transition-colors duration-500" />
              <h3 className="text-2xl font-bold text-white mb-2 relative z-10 mt-12 md:mt-0">DAO Treasury & Subsidies</h3>
              <p className="text-slate-400 relative z-10 max-w-md">Global donors and liquidity providers can supply capital to back insurance pools, earning yields while protecting vulnerable farmers.</p>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Live Stats */}
      <div id="stats" className="py-24 relative border-t border-white/5 z-10">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div variants={fadeUp} className="glass-panel text-center p-8 hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
              <div className="absolute inset-0 bg-sky-500/0 group-hover:bg-sky-500/5 transition-colors duration-500" />
              <div className="inline-flex items-center justify-center w-12 h-12 bg-sky-500/20 rounded-full mb-4 shadow-[0_0_15px_rgba(56,189,248,0.2)] group-hover:scale-110 transition-transform duration-300">
                <ShieldAlert className="w-6 h-6 text-sky-400" />
              </div>
              <h4 className="text-slate-400 font-medium mb-2 uppercase tracking-wider text-xs sm:text-sm">Total Value Locked</h4>
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
                className="text-4xl sm:text-5xl font-bold text-white display-font"
              >
                {tvl.toLocaleString()} <span className="text-xl sm:text-2xl text-sky-400">XLM</span>
              </motion.div>
            </motion.div>
            
            <motion.div variants={fadeUp} className="glass-panel text-center p-8 hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
              <div className="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/5 transition-colors duration-500" />
              <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-500/20 rounded-full mb-4 shadow-[0_0_15px_rgba(245,158,11,0.2)] group-hover:scale-110 transition-transform duration-300">
                <Activity className="w-6 h-6 text-amber-400" />
              </div>
              <h4 className="text-slate-400 font-medium mb-2 uppercase tracking-wider text-xs sm:text-sm">Available Subsidy</h4>
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
                className="text-4xl sm:text-5xl font-bold text-white display-font"
              >
                {subsidy.toLocaleString()} <span className="text-xl sm:text-2xl text-amber-400">XLM</span>
              </motion.div>
            </motion.div>

            <motion.div variants={fadeUp} className="glass-panel text-center p-8 hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
              <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-colors duration-500" />
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/20 rounded-full mb-4 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:scale-110 transition-transform duration-300">
                <Check className="w-6 h-6 text-emerald-400" />
              </div>
              <h4 className="text-slate-400 font-medium mb-2 uppercase tracking-wider text-xs sm:text-sm">Active Oracles</h4>
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
                className="text-4xl sm:text-5xl font-bold text-white display-font"
              >
                2 <span className="text-xl sm:text-2xl text-emerald-400">Syncs</span>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
      
      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#020617] py-12 text-center relative z-10">
        <p className="text-slate-500">TyFi Resilience Vault © {new Date().getFullYear()}. Built on Stellar.</p>
      </footer>
    </div>
  );
};

export default LandingPage;

