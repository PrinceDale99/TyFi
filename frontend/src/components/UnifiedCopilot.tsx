import React, { useState, useEffect, useRef } from 'react';
import { Bot, FlaskConical, X, Wind, CloudRain, RefreshCw, Zap } from 'lucide-react';
import AiCopilot from './AiCopilot';
import type { WeatherData, FarmData } from '../types';

interface UnifiedCopilotProps {
  network: 'testnet' | 'mainnet';
  walletAddress: string;
  weather: WeatherData | null;
  farms: FarmData[];
  claims: any[];
  addNotification: (text: string, type?: 'info' | 'success' | 'warning') => void;
  onUpdateWeatherDamage: (damage: number, status: string, aiDamage?: number, confidence?: number) => void;
  isSandboxToggleEnabled: boolean;
  setIsSandboxToggleEnabled: (v: boolean) => void;
  isSimulatingWeather: boolean;
  handleSimulateWeather: (scenario: 'normal' | 'wind_trigger' | 'rain_trigger' | 'double_trigger') => void;
  handleResetWeather: () => void;
  setWeather: React.Dispatch<React.SetStateAction<WeatherData | null>>;
}

type ActiveTab = 'ai' | 'sandbox';

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

const UnifiedCopilot: React.FC<UnifiedCopilotProps> = ({
  network,
  walletAddress,
  weather,
  farms,
  claims,
  addNotification,
  onUpdateWeatherDamage,
  isSandboxToggleEnabled,
  setIsSandboxToggleEnabled,
  isSimulatingWeather,
  handleSimulateWeather,
  handleResetWeather,
  setWeather,
}) => {
  const isTestnet = network === 'testnet';
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('ai');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = () => setIsOpen(prev => !prev);

  // Scenario config
  const scenarios = [
    { key: 'normal' as const,       icon: '☀️', label: 'Normal Conditions',  sub: '45 km/h Wind · 25mm Rain · 0% Payout',  wind: 45  },
    { key: 'wind_trigger' as const, icon: '💨', label: 'Moderate Typhoon',   sub: '115 km/h Wind · 80mm Rain · 30% Payout', wind: 115 },
    { key: 'rain_trigger' as const, icon: '🌧️', label: 'Severe Typhoon',     sub: '135 km/h Wind · 220mm Rain · 70% Payout',wind: 135 },
    { key: 'double_trigger' as const,icon: '🌀',label: 'Super Typhoon',      sub: '165 km/h Wind · 350mm Rain · 100% Payout',wind: 165},
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        className="fixed inset-0 z-[55]"
        style={{
          pointerEvents: isOpen ? 'all' : 'none',
          background: isOpen ? 'rgba(2,6,23,0.55)' : 'transparent',
          backdropFilter: isOpen ? 'blur(2px)' : 'none',
          transition: 'background 300ms ease, backdrop-filter 300ms ease',
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed bottom-24 right-6 z-[60] w-[390px] max-w-[calc(100vw-24px)] flex flex-col"
        style={{
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(calc(100% + 48px)) scale(0.95)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: `transform 420ms ${SPRING}, opacity 220ms ease`,
          maxHeight: 'calc(100vh - 120px)',
        }}
      >
        {/* Glass panel */}
        <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl shadow-slate-950/60 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 120px)' }}>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 shrink-0">
            {/* Tabs — only on testnet */}
            {isTestnet ? (
              <div className="flex gap-1 bg-white/5 p-1 rounded-xl flex-1">
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'ai'
                      ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Bot size={13} />
                  AI Copilot
                </button>
                <button
                  onClick={() => setActiveTab('sandbox')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'sandbox'
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FlaskConical size={13} />
                  Sandbox
                  {isSimulatingWeather && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-ping" />
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <Bot size={16} className="text-sky-400" />
                <span className="text-sm font-black text-white uppercase tracking-wider">AI Farm Copilot</span>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden">

            {/* AI Tab */}
            <div
              className="h-full"
              style={{
                display: activeTab === 'ai' ? 'block' : 'none',
              }}
            >
              <AiCopilot
                accountId={walletAddress}
                weather={weather}
                farms={farms}
                claims={claims}
                addNotification={addNotification}
                onUpdateWeatherDamage={onUpdateWeatherDamage}
                network={network}
              />
            </div>

            {/* Sandbox Tab — testnet only */}
            {isTestnet && (
              <div
                className="h-full overflow-y-auto custom-scrollbar"
                style={{ display: activeTab === 'sandbox' ? 'block' : 'none' }}
              >
                <div className="p-5 space-y-4">
                  {/* Enable toggle */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isSandboxToggleEnabled ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`} />
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        {isSandboxToggleEnabled ? 'Sandbox Active' : 'Enable Sandbox'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setIsSandboxToggleEnabled(!isSandboxToggleEnabled);
                        if (isSandboxToggleEnabled) handleResetWeather();
                      }}
                      className={`w-10 h-5 rounded-full p-0.5 transition-all duration-300 ${isSandboxToggleEnabled ? 'bg-indigo-500' : 'bg-white/10'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${isSandboxToggleEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Scenario buttons */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest px-1">Select Scenario</p>
                    {scenarios.map(s => {
                      const isActive = isSimulatingWeather && weather?.windSpeed === s.wind;
                      return (
                        <button
                          key={s.key}
                          onClick={() => handleSimulateWeather(s.key)}
                          className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3.5 group transition-all duration-200 ${
                            isActive
                              ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                              : 'bg-white/[0.03] border-white/5 text-slate-300 hover:bg-white/[0.07] hover:border-white/10'
                          }`}
                        >
                          <span className="text-xl shrink-0">{s.icon}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-black">{s.label}</div>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5">{s.sub}</div>
                          </div>
                          {isActive && (
                            <div className="ml-auto shrink-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Reset */}
                  {isSimulatingWeather && (
                    <button
                      onClick={handleResetWeather}
                      className="w-full py-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-500/20 transition-all"
                    >
                      <RefreshCw size={11} className="animate-spin" style={{ animationDuration: '3s' }} />
                      Revert to Live API Feeds
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAB Button */}
      <button
        onClick={toggle}
        className={`fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 group ${
          isSimulatingWeather && !isOpen
            ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950'
            : ''
        }`}
        style={{
          background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
          boxShadow: isOpen
            ? '0 0 0 0 transparent'
            : '0 8px 32px rgba(99,102,241,0.35), 0 2px 8px rgba(0,0,0,0.4)',
        }}
        title={isOpen ? 'Close' : 'AI Copilot'}
      >
        {/* Icon — rotates to X when open */}
        <div
          style={{
            transition: `transform 350ms ${SPRING}`,
            transform: isOpen ? 'rotate(135deg) scale(0.85)' : 'rotate(0deg) scale(1)',
          }}
        >
          {isOpen ? (
            <X size={22} className="text-white" />
          ) : (
            <Bot size={22} className="text-white" />
          )}
        </div>

        {/* Sim-active indicator ring (testnet only) */}
        {isSimulatingWeather && !isOpen && isTestnet && (
          <span className="absolute inset-0 rounded-full border-2 border-indigo-400 opacity-60 animate-ping" />
        )}
      </button>
    </>
  );
};

export default UnifiedCopilot;
