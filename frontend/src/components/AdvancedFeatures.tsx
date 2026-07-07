import React, { useState } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronUp, Plus, Image as ImageIcon, Building, HandCoins, Radio, Activity, CheckCircle, Bell, AlertTriangle, CloudRain, LineChart, ThermometerSun, FileText, Download, Languages } from 'lucide-react';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'https://tyfi-backend.onrender.com';

export const AdvancedFeatures: React.FC<{ walletAddress: string | null }> = ({ walletAddress }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRequest = async (requestFn: () => Promise<any>) => {
    setLoading(true);
    try {
      const res = await requestFn();
      setResult(res.data || res);
    } catch (e: any) {
      setResult({ error: e.response?.data || e.message });
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden mb-6">
      <div 
        className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-lg text-indigo-400">
            <Radio size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Advanced Protocol Features & Debugger</h2>
            <p className="text-sm text-slate-400">Test every endpoint in the TyFi System</p>
          </div>
        </div>
        {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
      </div>

      {isOpen && (
        <div className="p-6 border-t border-slate-700/50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-800/20 max-h-[600px] overflow-y-auto">
          {/* PDAX Offramp */}
          <button onClick={() => handleRequest(() => axios.post(`${API_BASE}/api/execute-offramp`, { address: walletAddress || 'G_TEST', amount: 50 }))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <Building size={24} className="text-emerald-400" />
            <div>
              <div className="font-semibold text-slate-200">PDAX InstaPay Offramp</div>
              <div className="text-xs text-slate-400">Convert 50 XLM to GCash Fiat</div>
            </div>
          </button>

          {/* SMS Webhook (IPFS/Gemini) */}
          <button onClick={() => handleRequest(() => axios.post(`${API_BASE}/api/sms/webhook`, { From: '+639939702450', Body: 'Typhoon destroyed my farm', MediaUrl0: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=` }))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <ImageIcon size={24} className="text-blue-400" />
            <div>
              <div className="font-semibold text-slate-200">SMS / MMS Webhook</div>
              <div className="text-xs text-slate-400">Simulate offline claim processing</div>
            </div>
          </button>

          {/* Disaster Relief Bonds */}
          <button onClick={() => handleRequest(() => axios.get(`${API_BASE}/api/bond-portfolio?address=${walletAddress || 'G_TEST'}`))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <Plus size={24} className="text-amber-400" />
            <div>
              <div className="font-semibold text-slate-200">Fetch Relief Bonds</div>
              <div className="text-xs text-slate-400">Get Tokenized Yield from Soroban</div>
            </div>
          </button>

          {/* AI Micro-loan */}
          <button onClick={() => handleRequest(() => axios.post(`${API_BASE}/api/apply-microloan`, { address: walletAddress || 'G_TEST', farmData: { farmSizeHectares: 2, cropType: 'Rice', region: 'Albay', historicalYield: 4.5, damagePercentage: 85 }, paymentMethod: 'MAYA', paymentAccount: '09939702450' }))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <HandCoins size={24} className="text-purple-400" />
            <div>
              <div className="font-semibold text-slate-200">Instant AI Micro-Loan</div>
              <div className="text-xs text-slate-400">Predict Yield & Disburse via Maya</div>
            </div>
          </button>

          {/* XLM Rate */}
          <button onClick={() => handleRequest(() => axios.get(`${API_BASE}/api/v1/xlm-rate`))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <Activity size={24} className="text-green-400" />
            <div>
              <div className="font-semibold text-slate-200">Get XLM/PHP Rate</div>
              <div className="text-xs text-slate-400">Fetch real-time oracle rate</div>
            </div>
          </button>

          {/* Register Farmer */}
          <button onClick={() => handleRequest(() => axios.post(`${API_BASE}/api/register`, { address: walletAddress || 'G_TEST', fcmToken: 'test_token', phoneNumber: '+639939702450' }))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <CheckCircle size={24} className="text-teal-400" />
            <div>
              <div className="font-semibold text-slate-200">Register FCM Token</div>
              <div className="text-xs text-slate-400">Register farmer for notifications</div>
            </div>
          </button>

          {/* Notify Payout */}
          <button onClick={() => handleRequest(() => axios.post(`${API_BASE}/api/notify-payout`, { address: walletAddress || 'G_TEST', amount: 1500, currency: 'PHP' }))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <Bell size={24} className="text-pink-400" />
            <div>
              <div className="font-semibold text-slate-200">Notify Payout (SMS)</div>
              <div className="text-xs text-slate-400">Send Twilio payout SMS</div>
            </div>
          </button>

          {/* Notify Alert */}
          <button onClick={() => handleRequest(() => axios.post(`${API_BASE}/api/notify-alert`, { address: walletAddress || 'G_TEST', message: 'Typhoon approaching Albay! Harvest early.' }))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <AlertTriangle size={24} className="text-red-400" />
            <div>
              <div className="font-semibold text-slate-200">Emergency Alert (FCM)</div>
              <div className="text-xs text-slate-400">Send Push Notification</div>
            </div>
          </button>

          {/* AI Weather Analysis */}
          <button onClick={() => handleRequest(() => axios.post(`${API_BASE}/api/ai/analyze-weather`, { location: 'Albay', metrics: { windSpeed: 120, rainfall: 400, pressure: 980 } }))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <CloudRain size={24} className="text-cyan-400" />
            <div>
              <div className="font-semibold text-slate-200">AI Weather Risk</div>
              <div className="text-xs text-slate-400">Gemini analyzes typhoon data</div>
            </div>
          </button>

          {/* Market Prices */}
          <button onClick={() => handleRequest(() => axios.get(`${API_BASE}/api/market-prices`))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <LineChart size={24} className="text-yellow-400" />
            <div>
              <div className="font-semibold text-slate-200">DA Market Prices</div>
              <div className="text-xs text-slate-400">Fetch Rice/Crop prices in PHP</div>
            </div>
          </button>

          {/* PAGASA Weather */}
          <button onClick={() => handleRequest(() => axios.get(`${API_BASE}/api/pagasa-weather`))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <ThermometerSun size={24} className="text-orange-400" />
            <div>
              <div className="font-semibold text-slate-200">PAGASA Weather API</div>
              <div className="text-xs text-slate-400">Fetch real-time localized weather</div>
            </div>
          </button>

          {/* Generate Certificate */}
          <button onClick={() => handleRequest(() => axios.post(`${API_BASE}/api/generate-certificate`, { address: walletAddress || 'G_TEST', crop: 'Rice', coverage: '5000 XLM', region: 'Albay', season: 'Wet 2026', premium: '50 XLM', txHash: 'abc123mocktxhash' }))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <FileText size={24} className="text-blue-500" />
            <div>
              <div className="font-semibold text-slate-200">Generate Insurance NFT</div>
              <div className="text-xs text-slate-400">Create IPFS PDF Certificate</div>
            </div>
          </button>

          {/* Fetch Certificates */}
          <button onClick={() => handleRequest(() => axios.get(`${API_BASE}/api/certificates/${walletAddress || 'G_TEST'}`))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <Download size={24} className="text-indigo-400" />
            <div>
              <div className="font-semibold text-slate-200">Fetch Certificates</div>
              <div className="text-xs text-slate-400">Get user's minted policies</div>
            </div>
          </button>

          {/* AI Translate */}
          <button onClick={() => handleRequest(() => axios.post(`${API_BASE}/api/ai/translate`, { text: 'Your crop insurance payout has been approved.', targetLanguage: 'Tagalog' }))} disabled={loading} className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left">
            <Languages size={24} className="text-rose-400" />
            <div>
              <div className="font-semibold text-slate-200">AI Local Translation</div>
              <div className="text-xs text-slate-400">Tagalog / Dialect conversion</div>
            </div>
          </button>

          {result && (
            <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-4">
              <div className="text-xs font-mono text-slate-400 mb-2 flex justify-between">
                <span>API Response:</span>
                <button onClick={() => setResult(null)} className="text-red-400 hover:text-red-300">Clear</button>
              </div>
              <pre className="bg-slate-950 p-4 rounded-xl text-emerald-400 text-xs overflow-x-auto border border-slate-800 max-h-[300px]">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
