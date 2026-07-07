import React, { useState } from 'react';
import axios from 'axios';
import { CaretDown, CaretUp, Plus, Image as ImageIcon, Bank, HandCoins, Broadcast } from '@phosphor-icons/react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://backend-985651545620.us-central1.run.app';

export const AdvancedFeatures: React.FC<{ walletAddress: string | null }> = ({ walletAddress }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testPdaxOfframp = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/pdax-offramp`, {
        address: walletAddress || 'G_TEST',
        amountXlm: 50,
        paymentMethod: 'GCASH',
        paymentAccount: '09123456789'
      });
      setResult(res.data);
    } catch (e: any) {
      setResult({ error: e.response?.data || e.message });
    }
    setLoading(false);
  };

  const testIPFSOracles = async () => {
    setLoading(true);
    try {
      // Mocking a base64 image payload (e.g. damaged crops)
      const base64Mock = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      const res = await axios.post(`${API_BASE}/api/claim-mms`, {
        phoneNumber: '+639123456789',
        body: 'Typhoon destroyed my farm',
        mediaUrls: [`data:image/png;base64,${base64Mock}`]
      });
      setResult(res.data);
    } catch (e: any) {
      setResult({ error: e.response?.data || e.message });
    }
    setLoading(false);
  };

  const testYieldBonds = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/bond-portfolio?address=${walletAddress || 'G_TEST'}`);
      setResult(res.data);
    } catch (e: any) {
      setResult({ error: e.response?.data || e.message });
    }
    setLoading(false);
  };

  const testMicroLoan = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/apply-microloan`, {
        address: walletAddress || 'G_TEST',
        farmData: {
          farmSizeHectares: 2,
          cropType: 'Rice',
          region: 'Albay',
          historicalYield: 4.5,
          damagePercentage: 85
        },
        paymentMethod: 'MAYA',
        paymentAccount: '09198765432'
      });
      setResult(res.data);
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
            <Broadcast size={24} weight="duotone" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Advanced Protocol Features</h2>
            <p className="text-sm text-slate-400">Test the newly integrated capabilities (Phase 3-5)</p>
          </div>
        </div>
        {isOpen ? <CaretUp size={20} className="text-slate-400" /> : <CaretDown size={20} className="text-slate-400" />}
      </div>

      {isOpen && (
        <div className="p-6 border-t border-slate-700/50 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/20">
          <button 
            onClick={testPdaxOfframp}
            disabled={loading}
            className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all disabled:opacity-50 text-left"
          >
            <Bank size={24} className="text-emerald-400" />
            <div>
              <div className="font-semibold text-slate-200">PDAX InstaPay Offramp</div>
              <div className="text-xs text-slate-400">Convert 50 XLM to GCash Fiat</div>
            </div>
          </button>

          <button 
            onClick={testIPFSOracles}
            disabled={loading}
            className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all disabled:opacity-50 text-left"
          >
            <ImageIcon size={24} className="text-blue-400" />
            <div>
              <div className="font-semibold text-slate-200">Gemini Vision MMS Claim</div>
              <div className="text-xs text-slate-400">Upload to IPFS & Assess Damage</div>
            </div>
          </button>

          <button 
            onClick={testYieldBonds}
            disabled={loading}
            className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all disabled:opacity-50 text-left"
          >
            <Plus size={24} className="text-amber-400" />
            <div>
              <div className="font-semibold text-slate-200">Disaster Relief Bonds</div>
              <div className="text-xs text-slate-400">Fetch Soroban Tokenized Yield</div>
            </div>
          </button>

          <button 
            onClick={testMicroLoan}
            disabled={loading}
            className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all disabled:opacity-50 text-left"
          >
            <HandCoins size={24} className="text-purple-400" />
            <div>
              <div className="font-semibold text-slate-200">Instant AI Micro-Loan</div>
              <div className="text-xs text-slate-400">Predict Yield & Disburse via Maya</div>
            </div>
          </button>

          {result && (
            <div className="col-span-1 md:col-span-2 mt-4">
              <div className="text-xs font-mono text-slate-400 mb-2">API Response:</div>
              <pre className="bg-slate-950 p-4 rounded-xl text-emerald-400 text-xs overflow-x-auto border border-slate-800">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
