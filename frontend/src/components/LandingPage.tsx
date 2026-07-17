import React, { useState, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { Shield, Wind, Zap, Activity, ArrowRight, ShieldCheck, Globe, Coins, ShieldAlert, Check, Network, Database, Server, Smartphone, Lock, MapPin, Satellite, Banknote, TerminalSquare, Calculator, Vote, ArrowUpRight, Github, FileText, Video } from 'lucide-react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import MagneticButton from './MagneticButton';

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

  const oracleLogs = [
    "[OPEN-METEO] SCAN: Region 3 (Central Luzon) - Sustained Winds: 45km/h - Status: NOMINAL",
    "[GDACS] UPDATE: TS Carina approaching PAR - Sustained Winds: 85km/h - Threshold: NOT MET",
    "[TYFI-ORACLE] PING: Validating Node Consensus on 14.599, 120.984 - Status: VERIFIED",
    "[OPEN-METEO] ALERT: Sustained Winds: 110km/h - Threshold: WARNING",
    "[TYFI-ORACLE] SYNC: 12,450 active policies indexed and collateralized 1:1."
  ];
  const [logIndex, setLogIndex] = useState(0);
  const [sponsorAmount, setSponsorAmount] = useState(5000);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogIndex((prev) => (prev + 1) % oracleLogs.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

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
              <MagneticButton 
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
              </MagneticButton>
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
            Guaranteed Crop Protection.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 drop-shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              Instant Payouts.
            </span>
          </motion.h1>
          
          <motion.p variants={fadeUp} className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 mb-10 leading-relaxed px-2">
            The first autonomous micro-insurance protocol protecting farmers against climate disasters. No middlemen. No claims process. Just instant support when the storm hits.
          </motion.p>
          
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center items-center px-4">
            <MagneticButton 
              onClick={onConnect}
              disabled={isLoading}
              className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-300 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-2xl shadow-[0_0_30px_rgba(56,189,248,0.3)] hover:shadow-[0_0_50px_rgba(56,189,248,0.5)] hover:scale-105 overflow-hidden text-lg w-full sm:w-auto"
            >
              <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-150%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(150%)]">
                <div className="relative h-full w-12 bg-white/20" />
              </div>
              <Shield className="w-5 h-5 mr-2 relative z-10" />
              <span className="relative z-10">Enter the Vault</span>
            </MagneticButton>
            <a href="#stats" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-2xl border border-white/10 transition-all hover:border-white/20 text-lg w-full sm:w-auto text-center flex items-center justify-center gap-2 hover:scale-105">
              View Protocol Stats
            </a>
          </motion.div>
          
          {/* Live Oracle Feed Ticker */}
          <motion.div variants={fadeUp} className="mt-16 max-w-3xl mx-auto hidden md:block">
            <div className="glass-panel p-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur-md flex items-center gap-4 text-left shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              <div className="shrink-0">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <TerminalSquare className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <div className="flex-grow overflow-hidden relative h-6">
                <motion.p
                  key={logIndex}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="text-emerald-400 font-mono text-sm absolute inset-0 whitespace-nowrap truncate"
                >
                  <span className="animate-pulse mr-2">_</span>{oracleLogs[logIndex]}
                </motion.p>
              </div>
              <div className="shrink-0 flex items-center gap-2 text-xs font-mono text-slate-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                LIVE SYNC
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* How Parametric Insurance Works (Visual Journey) */}
      <div className="py-24 bg-[#090e1a]/80 relative z-10 border-t border-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 display-font tracking-tight">How Parametric Insurance Works</h2>
            <p className="text-slate-400 text-xl max-w-2xl mx-auto">A completely autonomous, trustless system. No claims adjusters, no paperwork, no waiting.</p>
          </motion.div>

          <div className="relative max-w-4xl mx-auto">
            {/* Connecting Line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-sky-500/0 via-sky-500/50 to-sky-500/0 hidden md:block"></div>
            
            <div className="space-y-24 relative">
              {/* Step 1 */}
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="flex flex-col md:flex-row items-center gap-8 md:gap-16 group"
              >
                <div className="md:w-1/2 flex justify-end">
                  <div className="text-right hidden md:block">
                    <h3 className="text-2xl font-bold text-white mb-2">Step 1: Stake & Subsidize</h3>
                    <p className="text-slate-400">LPs provide capital to the vault. Farmers register their exact geographic coordinates on-chain.</p>
                  </div>
                </div>
                <div className="relative z-10 w-16 h-16 rounded-full bg-sky-900 border-2 border-sky-500 flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(56,189,248,0.4)] group-hover:scale-110 transition-transform duration-300">
                  <MapPin className="w-8 h-8 text-sky-400" />
                </div>
                <div className="md:w-1/2 w-full">
                  <div className="glass-panel p-6 text-left md:hidden mb-4">
                    <h3 className="text-2xl font-bold text-white mb-2">Step 1: Stake & Subsidize</h3>
                    <p className="text-slate-400">LPs provide capital to the vault. Farmers register their exact geographic coordinates on-chain.</p>
                  </div>
                  <div className="glass-panel p-6 w-full max-w-sm rounded-2xl border border-sky-500/20 bg-sky-950/20 mx-auto md:mx-0">
                    <div className="flex justify-between text-sm text-slate-300 mb-2"><span>Farmer ID: 8944</span><span className="text-sky-400">Registered</span></div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-sky-500 w-3/4"></div></div>
                  </div>
                </div>
              </motion.div>

              {/* Step 2 */}
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                className="flex flex-col md:flex-row-reverse items-center gap-8 md:gap-16 group"
              >
                <div className="md:w-1/2 flex justify-start">
                  <div className="text-left hidden md:block">
                    <h3 className="text-2xl font-bold text-white mb-2">Step 2: Oracle Monitoring</h3>
                    <p className="text-slate-400">Space-grade satellites and Open-Meteo constantly scan the registered coordinates for severe weather data.</p>
                  </div>
                </div>
                <div className="relative z-10 w-16 h-16 rounded-full bg-purple-900 border-2 border-purple-500 flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(168,85,247,0.4)] group-hover:scale-110 transition-transform duration-300">
                  <Satellite className="w-8 h-8 text-purple-400" />
                </div>
                <div className="md:w-1/2 flex justify-end w-full">
                  <div className="glass-panel p-6 text-left md:hidden mb-4 w-full">
                    <h3 className="text-2xl font-bold text-white mb-2">Step 2: Oracle Monitoring</h3>
                    <p className="text-slate-400">Space-grade satellites and Open-Meteo constantly scan the registered coordinates for severe weather data.</p>
                  </div>
                  <div className="glass-panel p-6 w-full max-w-sm rounded-2xl border border-purple-500/20 bg-purple-950/20 flex flex-col gap-3 mx-auto md:mx-0">
                     <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></div><span className="text-sm font-mono text-purple-300">Scanning Grid [14.599, 120.984]</span></div>
                     <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-slate-600"></div><span className="text-sm font-mono text-slate-400">Wind Speed: 84 km/h</span></div>
                  </div>
                </div>
              </motion.div>

              {/* Step 3 */}
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
                className="flex flex-col md:flex-row items-center gap-8 md:gap-16 group"
              >
                <div className="md:w-1/2 flex justify-end">
                  <div className="text-right hidden md:block">
                    <h3 className="text-2xl font-bold text-white mb-2">Step 3: Autonomous Payout</h3>
                    <p className="text-slate-400">The moment wind speeds breach the Cat 3 threshold, the smart contract triggers an instant XLM transfer directly to the farmer's wallet.</p>
                  </div>
                </div>
                <div className="relative z-10 w-16 h-16 rounded-full bg-emerald-900 border-2 border-emerald-500 flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(16,185,129,0.4)] group-hover:scale-110 transition-transform duration-300">
                  <Banknote className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="md:w-1/2 w-full">
                  <div className="glass-panel p-6 text-left md:hidden mb-4">
                    <h3 className="text-2xl font-bold text-white mb-2">Step 3: Autonomous Payout</h3>
                    <p className="text-slate-400">The moment wind speeds breach the Cat 3 threshold, the smart contract triggers an instant XLM transfer directly to the farmer's wallet.</p>
                  </div>
                  <div className="glass-panel p-6 w-full max-w-sm rounded-2xl border border-emerald-500/20 bg-emerald-950/20 text-center mx-auto md:mx-0">
                     <span className="text-3xl font-bold text-emerald-400 font-mono">+ 5,000 XLM</span>
                     <p className="text-xs text-emerald-500 mt-2 uppercase tracking-widest">Transaction Confirmed</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* The Protocol Matrix */}
      <div className="py-32 bg-[#020617] relative z-10 border-t border-white/5 overflow-hidden">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
        
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
        >
          <motion.div variants={fadeUp} className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 display-font tracking-tight">The Protocol Matrix</h2>
            <p className="text-slate-400 text-xl max-w-3xl mx-auto">An ultra-resilient, dual-backend architecture designed for zero downtime and incorruptible parametric execution.</p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* 1. Consensus Layer */}
            <motion.div variants={fadeUp} className="glass-panel group p-8 relative overflow-hidden transition-all duration-500 hover:shadow-[0_0_50px_rgba(56,189,248,0.15)] hover:-translate-y-2">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-[50px] group-hover:bg-sky-500/20 transition-colors duration-500" />
              <div className="w-14 h-14 bg-sky-500/10 rounded-2xl flex items-center justify-center border border-sky-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Network className="w-7 h-7 text-sky-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">The Consensus Layer</h3>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">Powered by Soroban on the Stellar network for sub-second finality and Byzantine fault tolerance.</p>
              <div className="flex gap-3 text-xs font-mono text-sky-300 bg-sky-950/30 p-2 rounded-lg border border-sky-500/20">
                <span>1000+ TPS</span>
                <span>•</span>
                <span>$0.00001 Fee</span>
              </div>
            </motion.div>

            {/* 2. Decentralized Oracle */}
            <motion.div variants={fadeUp} className="glass-panel group p-8 relative overflow-hidden transition-all duration-500 hover:shadow-[0_0_50px_rgba(16,185,129,0.15)] hover:-translate-y-2">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[50px] group-hover:bg-emerald-500/20 transition-colors duration-500" />
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Database className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Oracle Network <span className="text-xs align-top text-emerald-400 font-mono border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 rounded-full ml-2">tyfi-oracle</span></h3>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">An isolated backend dedicated purely to pulling space-grade telemetry from Open-Meteo & GDACS.</p>
              <div className="flex gap-3 text-xs font-mono text-emerald-300 bg-emerald-950/30 p-2 rounded-lg border border-emerald-500/20">
                <span>10km Res</span>
                <span>•</span>
                <span>15min Latency</span>
              </div>
            </motion.div>

            {/* 3. Main Engine */}
            <motion.div variants={fadeUp} className="glass-panel group p-8 relative overflow-hidden transition-all duration-500 hover:shadow-[0_0_50px_rgba(168,85,247,0.15)] hover:-translate-y-2">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[50px] group-hover:bg-purple-500/20 transition-colors duration-500" />
              <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Server className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Application Engine <span className="text-xs align-top text-purple-400 font-mono border border-purple-500/30 bg-purple-950/30 px-2 py-0.5 rounded-full ml-2">tyfi-yzbn</span></h3>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">The core backend handling UI routing, profiles, and logic, kept safely separate from oracle operations.</p>
              <div className="flex gap-3 text-xs font-mono text-purple-300 bg-purple-950/30 p-2 rounded-lg border border-purple-500/20">
                <span>99.99% Uptime</span>
                <span>•</span>
                <span>Stateless API</span>
              </div>
            </motion.div>

            {/* 4. Capital Vaults */}
            <motion.div variants={fadeUp} className="glass-panel group p-8 relative overflow-hidden transition-all duration-500 hover:shadow-[0_0_50px_rgba(245,158,11,0.15)] hover:-translate-y-2">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[50px] group-hover:bg-amber-500/20 transition-colors duration-500" />
              <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Coins className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Capital Vaults</h3>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">Algorithmically segments LP capital into Base Reserves, Active Subsidies, and Yield bearing pools.</p>
              <div className="flex gap-3 text-xs font-mono text-amber-300 bg-amber-950/30 p-2 rounded-lg border border-amber-500/20">
                <span>1:1 Collateralized</span>
                <span>•</span>
                <span>Isolated Risk</span>
              </div>
            </motion.div>

            {/* 5. Alert Infra */}
            <motion.div variants={fadeUp} className="glass-panel group p-8 relative overflow-hidden transition-all duration-500 hover:shadow-[0_0_50px_rgba(239,68,68,0.15)] hover:-translate-y-2">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[50px] group-hover:bg-red-500/20 transition-colors duration-500" />
              <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Smartphone className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Redundant Alerts</h3>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">Triple-fallback off-chain engine ensuring zero-downtime SMS delivery to rural farmers via PH Gateways.</p>
              <div className="flex gap-3 text-xs font-mono text-red-300 bg-red-950/30 p-2 rounded-lg border border-red-500/20">
                <span>Twilio ⭢ API PH 1 ⭢ API PH 2</span>
              </div>
            </motion.div>

            {/* 6. Governance */}
            <motion.div variants={fadeUp} className="glass-panel group p-8 relative overflow-hidden transition-all duration-500 hover:shadow-[0_0_50px_rgba(255,255,255,0.15)] hover:-translate-y-2">
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/10 rounded-full blur-[50px] group-hover:bg-slate-500/20 transition-colors duration-500" />
              <div className="w-14 h-14 bg-slate-500/10 rounded-2xl flex items-center justify-center border border-slate-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Lock className="w-7 h-7 text-slate-300" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Non-Custodial Rules</h3>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">WASM smart contract constraints. No admin override, no manual claims adjuster, no central pause button.</p>
              <div className="flex gap-3 text-xs font-mono text-slate-300 bg-slate-800/50 p-2 rounded-lg border border-slate-500/20">
                <span>Code is Law</span>
                <span>•</span>
                <span>Zero Admin Keys</span>
              </div>
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
      {/* Interactive Calculator & DAO Section */}
      <div className="py-24 relative border-t border-white/5 z-10 bg-gradient-to-b from-[#090e1a]/80 to-[#020617] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            {/* ROI Calculator Teaser */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="glass-panel p-8 md:p-12 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px] group-hover:bg-amber-500/20 transition-colors duration-700" />
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30">
                  <Calculator className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-3xl font-bold text-white display-font">Impact Calculator</h3>
              </div>
              
              <div className="space-y-8 relative z-10">
                <div>
                  <div className="flex justify-between text-slate-300 mb-4">
                    <span className="font-medium">If I sponsor:</span>
                    <span className="text-amber-400 font-mono text-xl">{sponsorAmount.toLocaleString()} XLM</span>
                  </div>
                  <input 
                    type="range" 
                    min="1000" max="50000" step="1000"
                    value={sponsorAmount}
                    onChange={(e) => setSponsorAmount(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/40 border border-white/5 p-4 rounded-xl">
                    <p className="text-slate-500 text-sm mb-1">Farmers Covered</p>
                    <p className="text-2xl font-bold text-white font-mono">{Math.floor(sponsorAmount / 500)}</p>
                  </div>
                  <div className="bg-black/40 border border-white/5 p-4 rounded-xl">
                    <p className="text-slate-500 text-sm mb-1">Est. Yield (APY)</p>
                    <p className="text-2xl font-bold text-emerald-400 font-mono">8.5%</p>
                  </div>
                </div>
                
                <button onClick={onConnect} className="w-full py-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold rounded-xl border border-amber-500/30 transition-all hover:scale-[1.02]">
                  Provide Liquidity Now
                </button>
              </div>
            </motion.div>

            {/* DAO Governance */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="glass-panel p-8 md:p-12 relative overflow-hidden group flex flex-col">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] group-hover:bg-purple-500/20 transition-colors duration-700" />
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center border border-purple-500/30">
                    <Vote className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-3xl font-bold text-white display-font">Live Governance</h3>
                </div>
                <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              
              <div className="flex-grow space-y-4 relative z-10">
                <div className="bg-black/40 border border-purple-500/20 p-5 rounded-xl transition-all hover:border-purple-500/40">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono text-purple-400 bg-purple-950/50 px-2 py-1 rounded">Proposal #12</span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3"/> PASSED</span>
                  </div>
                  <p className="text-white font-medium mb-1">Lower Wind Threshold for Region 3</p>
                  <p className="text-sm text-slate-400">Adjusted Cat 3 parameter from 140km/h to 135km/h.</p>
                </div>

                <div className="bg-black/40 border border-white/5 p-5 rounded-xl transition-all hover:border-white/10 opacity-70">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono text-slate-400 bg-slate-800/50 px-2 py-1 rounded">Proposal #11</span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3"/> PASSED</span>
                  </div>
                  <p className="text-white font-medium mb-1">Expand Oracle to Open-Meteo Integration</p>
                </div>
              </div>

              <button className="mt-6 w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2">
                View All Proposals <ArrowUpRight className="w-4 h-4" />
              </button>
            </motion.div>

          </div>
        </div>
      </div>
      
      {/* Footer & Trust Center */}
      <footer className="border-t border-white/10 bg-[#020617] pt-20 pb-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16 border-b border-white/10 pb-16">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-8 h-8 text-sky-400" />
                <span className="text-2xl font-bold text-white tracking-tight">TyFi<span className="text-sky-400">.</span></span>
              </div>
              <p className="text-slate-400 max-w-sm leading-relaxed mb-8">
                The decentralized parametric insurance protocol protecting the world's most vulnerable farmers against climate disaster.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                  <Github className="w-5 h-5" />
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6">Resources</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-slate-400 hover:text-sky-400 transition-colors flex items-center gap-2"><FileText className="w-4 h-4" /> Documentation</a></li>
                <li><a href="#" className="text-slate-400 hover:text-sky-400 transition-colors flex items-center gap-2"><FileText className="w-4 h-4" /> Whitepaper</a></li>
                <li><a href="#" className="text-slate-400 hover:text-sky-400 transition-colors flex items-center gap-2"><Video className="w-4 h-4" /> Demo Video</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6">Protocol</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-slate-400 hover:text-sky-400 transition-colors">Smart Contracts (GitHub)</a></li>
                <li><a href="#" className="text-slate-400 hover:text-sky-400 transition-colors">DAO Governance</a></li>
                <li><a href="#" className="text-slate-400 hover:text-sky-400 transition-colors">Oracle Status</a></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
            <p>TyFi Resilience Vault © {new Date().getFullYear()}. Built on Stellar.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-slate-300">Terms of Service</a>
              <a href="#" className="hover:text-slate-300">Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

