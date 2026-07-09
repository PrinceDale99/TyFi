import React, { useState, useEffect, useRef } from 'react';
import { Shield, AlertTriangle, RefreshCw, BellRing, Gauge, HelpCircle, Send, User, MessageSquare, ChevronRight, X, Bot, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { analyzeWeatherImpact, chatWithAdvisor } from '../services/aiService';
import type { AiPredictionResult, ChatMessage } from '../services/aiService';
import type { WeatherData, FarmData } from '../types';

interface AiCopilotProps {
  accountId?: string;
  weather: WeatherData | null;
  farms: FarmData[];
  claims?: any[];
  addNotification: (text: string, type?: 'info' | 'success' | 'warning') => void;
  onUpdateWeatherDamage?: (damage: number, status: string, aiDamage?: number, confidence?: number) => void;
  network?: 'testnet' | 'mainnet';
}

const AiCopilot: React.FC<AiCopilotProps> = ({
  accountId,
  weather,
  farms,
  claims = [],
  addNotification,
  onUpdateWeatherDamage,
  network = 'testnet'
}) => {
  const [activeMode, setActiveTab] = useState<'chat' | 'risk'>('chat');
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [growthStage, setGrowthStage] = useState<'Seedling' | 'Vegetative' | 'Reproductive' | 'Maturity'>('Vegetative');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<AiPredictionResult | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Chat States
  const getInitialMessages = () => {
    if (accountId) {
      const saved = localStorage.getItem(`typhoon_chat_${accountId}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return [
      { role: 'model', text: "Mabuhay! I am your TyFi Smart Advisor. I'm here to help you protect your crops and manage your insurance. How can I assist you today?", timestamp: Date.now() }
    ];
  };

  const [messages, setMessages] = useState<ChatMessage[]>(getInitialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(getInitialMessages());
  }, [accountId]);

  useEffect(() => {
    if (accountId) {
      localStorage.setItem(`typhoon_chat_${accountId}`, JSON.stringify(messages));
    }
  }, [messages, accountId]);
  useEffect(() => {
    if (farms.length > 0 && !selectedFarmId) {
      setSelectedFarmId(farms[0].id);
    }
  }, [farms, selectedFarmId]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Proactive Alerting Effect
  useEffect(() => {
    if (weather && (weather.windSpeed > 60 || weather.rainfall > 80)) {
      const hasAlerted = messages.some(m => m.text.includes('🚨 STORM ALERT'));
      if (!hasAlerted) {
        const stormAlert = `🚨 STORM ALERT: I've detected high wind speeds (${weather.windSpeed}km/h) in your region. Based on your ${farms[0]?.cropType || 'crops'}, I recommend ensuring all drainage is clear and harvesting any mature produce immediately. Would you like a detailed risk assessment?`;
        setMessages(prev => [...prev, { role: 'model', text: stormAlert, timestamp: Date.now() }]);
      }
    }
  }, [weather, farms, messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMessage, timestamp: Date.now() }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await chatWithAdvisor(userMessage, messages, farms, weather, claims);
      setMessages(prev => [...prev, { role: 'model', text: response, timestamp: Date.now() }]);
    } catch (err) {
      console.error('Chat failed:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAnalyze = async () => {
    if (!weather) {
      addNotification('Weather data is not loaded yet.', 'warning');
      return;
    }
    const farm = farms.find(f => f.id === selectedFarmId);
    if (!farm) {
      addNotification('Please select a valid farm for analysis.', 'warning');
      return;
    }

    setIsAnalyzing(true);
    
    try {
      addNotification(`Analyzing risk metrics for ${farm.farmName}...`, 'info');
      const result = await analyzeWeatherImpact(farm, weather, growthStage, network);
      setPrediction(result);
      
      // Auto-inject analysis into chat
      const analysisSummary = `### Risk Assessment for ${farm.farmName}\n- **Risk Level:** ${result.riskLevel}\n- **Hit Probability:** ${result.hitProbability}%\n- **Estimated Damage:** ${result.estimatedDamage}%\n\n**Advisory:** ${result.advisory}`;
      setMessages(prev => [...prev, { role: 'model', text: analysisSummary, timestamp: Date.now() }]);
      setActiveTab('chat');

      if (onUpdateWeatherDamage) {
        onUpdateWeatherDamage(
          weather.damageEstimation || 0,
          result.willHit ? `Critical Risk (${result.riskLevel})` : 'Low Risk',
          result.estimatedDamage,
          result.confidenceScore
        );
      }
    } catch (error) {
      console.error(error);
      addNotification('Assessment encountered an issue.', 'warning');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="glass-panel border-t border-l border-white/10 shadow-2xl relative overflow-hidden bg-gradient-to-br from-slate-900/60 via-indigo-950/10 to-slate-900/60 flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-r from-indigo-500 to-sky-500 rounded-lg text-white">
            <Bot size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white leading-none">Smart Advisor</h3>
            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest animate-pulse">Online</span>
          </div>
        </div>
        <div className="flex bg-slate-950 p-1 rounded-lg border border-white/5">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${activeMode === 'chat' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
          >
            Chat
          </button>
          <button 
            onClick={() => setActiveTab('risk')}
            className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${activeMode === 'risk' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
          >
            Risk Info
          </button>
          {activeMode === 'chat' && (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="ml-2 px-2 py-1 rounded text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all flex items-center justify-center"
              title="Clear Chat History"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-w-sm w-full">
            <h3 className="text-white font-bold text-lg mb-2">Clear Chat History?</h3>
            <p className="text-slate-400 text-xs mb-6 leading-relaxed">
              This will permanently delete your conversation with the Smart Advisor. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-white/10 text-slate-300 font-bold hover:bg-white/5 transition-colors text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  const init = [
                    { role: 'model', text: "Mabuhay! I am your TyFi Smart Advisor. I'm here to help you protect your crops and manage your insurance. How can I assist you today?", timestamp: Date.now() }
                  ];
                  setMessages(init as ChatMessage[]);
                  if (accountId) localStorage.setItem(`typhoon_chat_${accountId}`, JSON.stringify(init));
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors text-xs"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}

      {activeMode === 'chat' ? (
        <>
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`flex gap-3 max-w-[95%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center border ${msg.role === 'user' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-sky-500/10 border-sky-500/30 text-sky-400'}`}>
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none'
                  }`}>
                    {msg.role === 'user' ? (
                      msg.text.split('\n').map((line, idx) => (
                        <p key={idx} className={idx > 0 ? 'mt-2' : ''}>{line}</p>
                      ))
                    ) : (
                      <div className="[&>p]:mb-2 last:[&>p]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:mb-2 [&>h3]:font-bold [&>h3]:text-sm [&>h3]:mb-1 [&>strong]:text-white">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    )}
                    {msg.timestamp && (
                      <div className={`text-[10px] mt-1.5 font-medium ${msg.role === 'user' ? 'text-indigo-200/70 text-right' : 'text-slate-500 text-left'}`}>
                        {new Date(msg.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start animate-pulse">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <Bot size={14} />
                  </div>
                  <div className="bg-white/5 border border-white/10 p-3 rounded-2xl rounded-tl-none">
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-slate-950/30">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about protection, claims, or recovery..."
                className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="absolute right-2 p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-400 disabled:opacity-50 disabled:hover:bg-indigo-500 transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[
                "How to protect Rice?",
                "Explain my last payout",
                "Recovery steps after storm",
                "What is Parametric?"
              ].map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInputValue(suggestion)}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[9px] font-bold text-slate-500 hover:text-white hover:border-white/20 transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </form>
        </>
      ) : (
        /* Original Risk Profile UI (scrollable) */
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
          <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Select Farm</label>
                <select
                  value={selectedFarmId}
                  onChange={(e) => setSelectedFarmId(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                >
                  {farms.map(f => (
                    <option key={f.id} value={f.id}>{f.farmName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Growth Stage</label>
                <select
                  value={growthStage}
                  onChange={(e) => setGrowthStage(e.target.value as any)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="Seedling">Seedling</option>
                  <option value="Vegetative">Vegetative</option>
                  <option value="Reproductive">Reproductive</option>
                  <option value="Maturity">Maturity</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || farms.length === 0}
              className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Analyzing Models...
                </>
              ) : (
                <>
                  <Shield size={14} />
                  Assess Risk Profile
                </>
              )}
            </button>
          </div>

          {prediction ? (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-black mb-1">
                    <Gauge size={10} className="text-indigo-400" />
                    Probability
                  </div>
                  <div className="text-xl font-black text-white">{prediction.hitProbability}%</div>
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full bg-indigo-500" style={{ width: `${prediction.hitProbability}%` }} />
                  </div>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-black mb-1">
                    <AlertTriangle size={10} className="text-rose-400" />
                    Damage
                  </div>
                  <div className="text-xl font-black text-white">{prediction.estimatedDamage}%</div>
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full bg-rose-500" style={{ width: `${prediction.estimatedDamage}%` }} />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Impact Analysis</span>
                <p className="text-[11px] text-slate-300 italic">"{prediction.reasoning}"</p>
              </div>

              <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block mb-1">Official Advisory</span>
                <p className="text-[11px] text-slate-300">{prediction.advisory}</p>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-600 border border-white/5 border-dashed rounded-xl">
              <HelpCircle size={24} className="mx-auto mb-2 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">No Active Assessment</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiCopilot;

