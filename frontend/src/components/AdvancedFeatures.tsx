import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronUp, Plus, Image as ImageIcon, Building, HandCoins, Radio, Activity, CheckCircle, Bell, AlertTriangle, CloudRain, LineChart, ThermometerSun, FileText, Download, Languages, Terminal, Users, Code, Zap, RefreshCw, XCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'https://tyfi-yzbn.onrender.com';

interface AdvancedFeaturesProps {
  walletAddress: string | null;
  userRole?: 'farmer' | 'sponsor' | null;
  setUserRole?: (role: 'farmer' | 'sponsor' | null) => void;
}

export const AdvancedFeatures: React.FC<AdvancedFeaturesProps> = ({ walletAddress, userRole, setUserRole }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'clean' | 'json'>('clean');
  
  // Terminal state
  const [logs, setLogs] = useState<{timestamp: string, message: string, type: 'info' | 'success' | 'error' | 'command'}[]>(() => {
    try {
      const saved = localStorage.getItem('typhoon_vault_debug_logs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'command' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  useEffect(() => {
    localStorage.setItem('typhoon_vault_debug_logs', JSON.stringify(logs));
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleRequest = async (name: string, requestFn: () => Promise<any>) => {
    setLoading(true);
    addLog(`Executing: ${name}...`, 'command');
    try {
      const res = await requestFn();
      setResult(res.data || res);
      addLog(`Success: ${name} completed.`, 'success');
    } catch (e: any) {
      const errorData = e.response?.data || e.message;
      const errorDetail = typeof errorData === 'object' ? JSON.stringify(errorData) : String(errorData);
      setResult({ error: errorData });
      addLog(`Error: ${name} failed - ${e.message} | Details: ${errorDetail}`, 'error');
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden mb-6 shadow-2xl">
      <div 
        className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-lg text-indigo-400">
            <Terminal size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 uppercase tracking-widest">Debug Command Center</h2>
            <p className="text-xs text-slate-400 font-medium">Developer tools, API testing & State manipulation</p>
          </div>
        </div>
        {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
      </div>

      {isOpen && (
        <div className="p-0 border-t border-slate-700/50 flex flex-col xl:flex-row bg-[#020617]">
          {/* Left Panel - Actions */}
          <div className="w-full xl:w-1/3 border-r border-slate-800/50 h-[800px] overflow-y-auto custom-scrollbar p-6 space-y-8">
            
            {/* Role Switcher */}
            {setUserRole && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <Users size={16} />
                  <h3 className="text-sm font-bold uppercase tracking-widest">Force Account Role</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => {
                        setUserRole('farmer');
                        addLog('Switched role to Farmer', 'info');
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border ${userRole === 'farmer' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                  >
                    Farmer / Beneficiary
                  </button>
                  <button 
                    onClick={() => {
                        setUserRole('sponsor');
                        addLog('Switched role to Sponsor/LP', 'info');
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border ${userRole === 'sponsor' ? 'bg-sky-500/20 border-sky-500/50 text-sky-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                  >
                    Sponsor / LP
                  </button>
                </div>
              </div>
            )}

            <div className="w-full h-px bg-slate-800"></div>

            {/* Farm & Policy */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Farm & Policy Engine</h3>
              <div className="space-y-2">
                <ActionBtn icon={<CheckCircle size={14}/>} title="Register FCM Token" desc="For Push Notifications" onClick={() => handleRequest('Register FCM', () => axios.post(`${API_BASE}/api/register`, { address: walletAddress || 'G_TEST', fcmToken: 'test_token', phoneNumber: '+639939702450' }))} loading={loading} />
                <ActionBtn icon={<FileText size={14}/>} title="Generate NFT Cert" desc="IPFS PDF Policy" onClick={() => handleRequest('Gen NFT Cert', () => axios.post(`${API_BASE}/api/generate-certificate`, { address: walletAddress || 'G_TEST', crop: 'Rice', coverage: '5000 XLM', region: 'Albay', season: 'Wet 2026', premium: '50 XLM', txHash: 'abc123mocktxhash' }))} loading={loading} />
                <ActionBtn icon={<Download size={14}/>} title="Fetch Certificates" desc="List User Policies" onClick={() => handleRequest('Fetch Certs', () => axios.get(`${API_BASE}/api/certificates/${walletAddress || 'G_TEST'}`))} loading={loading} />
                <ActionBtn icon={<Languages size={14}/>} title="AI Translation" desc="Test Localization" onClick={() => handleRequest('Translate', () => axios.post(`${API_BASE}/api/ai/translate`, { text: 'Your crop insurance payout has been approved.', targetLanguage: 'Tagalog' }))} loading={loading} />
              </div>
            </div>

            {/* Weather & Oracles */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Oracles & Intelligence</h3>
              <div className="space-y-2">
                <ActionBtn icon={<ThermometerSun size={14}/>} title="PAGASA Weather API" desc="Real-time localized" onClick={() => handleRequest('PAGASA API', () => axios.get(`${API_BASE}/api/pagasa-weather`))} loading={loading} />
                <ActionBtn icon={<CloudRain size={14}/>} title="AI Weather Risk" desc="Gemini Analysis" onClick={() => handleRequest('AI Weather', () => axios.post(`${API_BASE}/api/ai/analyze-weather`, { location: 'Albay', metrics: { windSpeed: 120, rainfall: 400, pressure: 980 } }))} loading={loading} />
                <ActionBtn icon={<LineChart size={14}/>} title="DA Market Prices" desc="Rice/Crop PHP" onClick={() => handleRequest('Market Prices', () => axios.get(`${API_BASE}/api/market-prices`))} loading={loading} />
                <ActionBtn icon={<Activity size={14}/>} title="Get XLM/PHP Rate" desc="Oracle Price Feed" onClick={() => handleRequest('XLM Rate', () => axios.get(`${API_BASE}/api/v1/xlm-rate`))} loading={loading} />
              </div>
            </div>

            {/* Liquidity & Capital */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Liquidity & Capital</h3>
              <div className="space-y-2">
                <ActionBtn icon={<Building size={14}/>} title="PDAX InstaPay Offramp" desc="50 XLM to GCash" onClick={() => handleRequest('PDAX Offramp', () => axios.post(`${API_BASE}/api/execute-offramp`, { address: walletAddress || 'G_TEST', amount: 50 }))} loading={loading} />
                <ActionBtn icon={<Plus size={14}/>} title="Fetch Relief Bonds" desc="Soroban Yield" onClick={() => handleRequest('Relief Bonds', () => axios.get(`${API_BASE}/api/bond-portfolio?address=${walletAddress || 'G_TEST'}`))} loading={loading} />
                <ActionBtn icon={<HandCoins size={14}/>} title="AI Micro-Loan" desc="Yield Pred & Maya" onClick={() => handleRequest('Micro-Loan', () => axios.post(`${API_BASE}/api/apply-microloan`, { address: walletAddress || 'G_TEST', farmData: { farmSizeHectares: 2, cropType: 'Rice', region: 'Albay', historicalYield: 4.5, damagePercentage: 85 }, paymentMethod: 'MAYA', paymentAccount: '09939702450' }))} loading={loading} />
              </div>
            </div>

            {/* Events & Notifications */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Events & Webhooks</h3>
              <div className="space-y-2">
                <ActionBtn icon={<ImageIcon size={14}/>} title="SMS/MMS Webhook" desc="Offline Claims" onClick={() => handleRequest('SMS Webhook', () => axios.post(`${API_BASE}/api/sms/webhook`, { From: '+639939702450', Body: 'Typhoon destroyed my farm', MediaUrl0: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=` }))} loading={loading} />
                <ActionBtn icon={<Bell size={14}/>} title="Notify Payout (SMS)" desc="Twilio Integration" onClick={() => handleRequest('Notify SMS', () => axios.post(`${API_BASE}/api/notify-payout`, { address: walletAddress || 'G_TEST', amount: 1500, currency: 'PHP' }))} loading={loading} />
                <ActionBtn icon={<AlertTriangle size={14}/>} title="Emergency Alert" desc="FCM Push" onClick={() => handleRequest('Emergency FCM', () => axios.post(`${API_BASE}/api/notify-alert`, { address: walletAddress || 'G_TEST', message: 'Typhoon approaching Albay! Harvest early.' }))} loading={loading} />
              </div>
            </div>

          </div>

          {/* Right Panel - Terminal & Output */}
          <div className="w-full xl:w-2/3 h-[800px] flex flex-col bg-[#050B14]">
            
            {/* Terminal Window */}
            <div className="flex-1 flex flex-col border-b border-slate-800/50 relative">
              <div className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 px-4 py-2 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-slate-400" />
                  <span className="text-xs font-mono font-bold text-slate-300">tyfi-console ~ /debug</span>
                </div>
                <div className="flex gap-3 items-center">
                  <button 
                    onClick={() => {
                      const logString = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
                      navigator.clipboard.writeText(logString);
                      addLog('Terminal logs copied to clipboard', 'success');
                    }}
                    className="text-[10px] text-slate-500 hover:text-sky-400 font-bold tracking-widest uppercase transition-colors"
                  >
                    Copy Logs
                  </button>
                  <button 
                    onClick={() => {
                      setLogs([]);
                      localStorage.removeItem('typhoon_vault_debug_logs');
                    }}
                    className="text-[10px] text-slate-500 hover:text-rose-400 font-bold tracking-widest uppercase transition-colors"
                  >
                    Clear Logs
                  </button>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-xs custom-scrollbar">
                {logs.length === 0 && (
                  <div className="text-slate-600 mb-2">TyFi Developer Console Initialized. Waiting for commands...</div>
                )}
                {logs.map((log, idx) => (
                  <div key={idx} className="mb-1.5 flex gap-3">
                    <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                    <span className={`break-all ${
                      log.type === 'command' ? 'text-sky-400 font-bold' : 
                      log.type === 'success' ? 'text-emerald-400' :
                      log.type === 'error' ? 'text-rose-400' : 'text-slate-300'
                    }`}>
                      {log.type === 'command' ? `> ${log.message}` : log.message}
                    </span>
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            </div>

            {/* Result Inspector */}
            <div className="h-1/2 flex flex-col bg-[#020617]">
              <div className="flex items-center border-b border-slate-800/50 bg-slate-900/50 px-2">
                <button 
                  onClick={() => setActiveTab('clean')}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'clean' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  Clean Output
                </button>
                <button 
                  onClick={() => setActiveTab('json')}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'json' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  Raw JSON
                </button>
                <div className="flex-1"></div>
                {result && (
                  <button onClick={() => { setResult(null); addLog('Result cleared', 'info'); }} className="p-2 text-slate-500 hover:text-rose-400 transition-colors" title="Clear Result">
                    <XCircle size={16} />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {!result ? (
                  <div className="h-full flex items-center justify-center text-slate-600 text-xs font-mono flex-col gap-2">
                    <Code size={24} className="opacity-20" />
                    No output. Execute a command to see results here.
                  </div>
                ) : (
                  <>
                    {activeTab === 'json' ? (
                      <pre className="text-xs font-mono text-indigo-300 overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    ) : (
                      <div className="space-y-4">
                        {result.error ? (
                          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
                            <h4 className="text-rose-400 font-bold text-sm mb-2 flex items-center gap-2"><AlertTriangle size={16} /> Error Occurred</h4>
                            <p className="text-rose-300/80 text-xs font-mono">{typeof result.error === 'object' ? JSON.stringify(result.error) : result.error}</p>
                          </div>
                        ) : (
                          <div className="bg-sky-500/5 border border-sky-500/10 p-4 rounded-xl">
                            <h4 className="text-sky-400 font-bold text-sm mb-3 flex items-center gap-2"><CheckCircle size={16} /> Execution Successful</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {Object.entries(result).slice(0, 8).map(([key, value]) => (
                                <div key={key} className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{key}</div>
                                  <div className="text-xs text-slate-200 font-mono truncate" title={String(value)}>
                                    {typeof value === 'object' ? 'Object {...}' : String(value)}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {Object.keys(result).length > 8 && (
                              <div className="mt-4 text-xs text-slate-500 text-center">
                                + {Object.keys(result).length - 8} more fields (View Raw JSON)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

// Reusable action button
const ActionBtn = ({ icon, title, desc, onClick, loading }: { icon: React.ReactNode, title: string, desc: string, onClick: () => void, loading: boolean }) => (
  <button 
    onClick={onClick} 
    disabled={loading} 
    className="w-full flex items-center gap-3 p-3 bg-slate-800/30 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl text-left transition-all group"
  >
    <div className="p-2 bg-slate-900 rounded-lg text-slate-400 group-hover:text-indigo-400 group-hover:scale-110 transition-all">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-bold text-xs text-slate-200 truncate group-hover:text-white transition-colors">{title}</div>
      <div className="text-[10px] text-slate-500 truncate">{desc}</div>
    </div>
    {loading && <RefreshCw size={14} className="text-slate-500 animate-spin" />}
  </button>
);
