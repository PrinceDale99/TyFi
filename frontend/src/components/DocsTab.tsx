import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Shield, CloudLightning, Coins, Users, Globe, TrendingUp } from 'lucide-react';

const DocsTab: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      id: 0,
      title: "The Problem",
      icon: <CloudLightning className="w-8 h-8 text-rose-400" />,
      description: "Typhoons devastate farms, leaving farmers with nothing. Traditional insurance is slow, bureaucratic, and relies on manual damage assessment, taking months to pay out.",
      animation: "shake"
    },
    {
      id: 1,
      title: "Liquidity Pools (The Vault)",
      icon: <Coins className="w-8 h-8 text-emerald-400" />,
      description: "Sponsors (NGOs, Gov, Retail) lock XLM into the Reinsurance Pool to earn yields, or donate to the Subsidy Pool to help farmers pay their premiums.",
      animation: "pulse"
    },
    {
      id: 2,
      title: "Smart Contracts",
      icon: <Shield className="w-8 h-8 text-blue-400" />,
      description: "Farmers register their farms (GPS coordinates) on the blockchain. The terms are mathematically locked in a Soroban Smart Contract—no human intervention required.",
      animation: "lock"
    },
    {
      id: 3,
      title: "Decentralized Oracle Network",
      icon: <Globe className="w-8 h-8 text-indigo-400" />,
      description: "During a storm, Chainlink nodes constantly feed weather data (wind speed, rainfall) into the contract. If thresholds are met, the contract automatically triggers.",
      animation: "spin"
    },
    {
      id: 4,
      title: "Instant Payouts",
      icon: <TrendingUp className="w-8 h-8 text-amber-400" />,
      description: "Within minutes of the storm passing, funds are released directly to the farmer's digital wallet as USDC/XLM, empowering them to instantly buy seeds and rebuild.",
      animation: "up"
    }
  ];

  // Auto-advance the animation every 5 seconds if not hovered
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-16">
      
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
          How <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">TyFi</span> Works
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
          Parametric insurance powered by Soroban Smart Contracts and Decentralized Oracles.
        </p>
      </div>

      {/* Interactive Infographic Section */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6 md:p-12 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-emerald-500/5 pointer-events-none" />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Side: Step List */}
          <div className="space-y-4 relative z-10">
            {steps.map((step, idx) => {
              const isActive = activeStep === step.id;
              return (
                <div 
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={`p-5 rounded-2xl cursor-pointer transition-all duration-300 border backdrop-blur-sm ${
                    isActive 
                      ? 'bg-slate-800 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.15)] scale-[1.02]' 
                      : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800 hover:border-slate-700 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isActive ? 'bg-slate-700' : 'bg-slate-800'}`}>
                      {step.icon}
                    </div>
                    <div>
                      <h3 className={`font-bold text-lg ${isActive ? 'text-white' : 'text-slate-300'}`}>
                        {step.title}
                      </h3>
                      <AnimatePresence>
                        {isActive && (
                          <motion.p 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="text-slate-400 text-sm mt-2 leading-relaxed"
                          >
                            {step.description}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right Side: Visual Canvas */}
          <div className="relative h-[400px] rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden group">
            
            {/* Connection Lines (Background) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M 20 50 C 50 20, 50 80, 80 50" fill="none" stroke="url(#gradient)" strokeWidth="0.5" strokeDasharray="2,2">
                <animate attributeName="stroke-dashoffset" from="10" to="0" dur="2s" repeatCount="indefinite" />
              </path>
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>

            {/* Central Animated Graphic */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                className="relative z-10 flex flex-col items-center justify-center text-center p-8"
              >
                {/* Visual Representation based on active step */}
                <div className="relative mb-8">
                  {/* Glowing backdrop */}
                  <div className="absolute inset-0 bg-blue-500/20 blur-[50px] rounded-full" />
                  
                  {/* Dynamic Element */}
                  <motion.div
                    animate={
                      steps[activeStep].animation === 'shake' ? { x: [-10, 10, -10, 10, 0] } :
                      steps[activeStep].animation === 'pulse' ? { scale: [1, 1.1, 1] } :
                      steps[activeStep].animation === 'lock' ? { scale: [1.2, 1], rotate: [0, 360] } :
                      steps[activeStep].animation === 'spin' ? { rotate: 360 } :
                      { y: [0, -20, 0] }
                    }
                    transition={{ 
                      repeat: Infinity, 
                      duration: steps[activeStep].animation === 'spin' ? 4 : 2,
                      ease: "easeInOut"
                    }}
                    className="relative bg-slate-800 p-8 rounded-full border border-slate-700 shadow-2xl"
                  >
                    {React.cloneElement(steps[activeStep].icon as React.ReactElement<any>, { className: 'w-24 h-24' })}
                  </motion.div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">{steps[activeStep].title}</h2>
                <div className="w-12 h-1 bg-blue-500/50 rounded-full mx-auto" />
              </motion.div>
            </AnimatePresence>
            
            {/* Progress indicators at bottom */}
            <div className="absolute bottom-6 flex gap-2">
              {steps.map((s) => (
                <div 
                  key={s.id} 
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    s.id === activeStep ? 'w-8 bg-blue-400' : 'w-2 bg-slate-700'
                  }`} 
                />
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* FAQ / Deep Dive Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
        <div className="bg-slate-800/30 border border-slate-700/50 p-8 rounded-3xl">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="text-blue-400" />
            What is Parametric Insurance?
          </h3>
          <p className="text-slate-400 leading-relaxed">
            Unlike traditional insurance which relies on manual assessors visiting a farm to estimate damage, 
            parametric insurance pays out automatically when pre-agreed weather conditions (parameters) are met. 
            If the wind speed exceeds 120 km/h, the contract pays out. It's binary, transparent, and instant.
          </p>
        </div>

        <div className="bg-slate-800/30 border border-slate-700/50 p-8 rounded-3xl">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Globe className="text-emerald-400" />
            How does the blockchain help?
          </h3>
          <p className="text-slate-400 leading-relaxed">
            By running on the Stellar network (Soroban), all funds are held in transparent, unchangeable smart contracts. 
            No human can deny a valid claim. The funds are physically locked and can only be released by the code 
            when the Oracle (weather data provider) confirms the storm data.
          </p>
        </div>
      </div>
      
    </div>
  );
};

export default DocsTab;
