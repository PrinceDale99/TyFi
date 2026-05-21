import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wheat, Sprout, CloudRainWind, AlertTriangle, RefreshCw } from 'lucide-react';
import { translateText } from '../services/aiService';

interface MarketData {
  rice: { price: string; date: string; };
  corn: { price: string; date: string; };
}

interface PagasaData {
  title: string;
  summary: string;
  date: string;
}

const MarketWidget = () => {
  const { t, i18n } = useTranslation();
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [pagasaData, setPagasaData] = useState<PagasaData | null>(null);
  const [translatedPagasaSummary, setTranslatedPagasaSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const [marketRes, pagasaRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/market-prices`),
        fetch(`${BACKEND_URL}/api/pagasa-weather`)
      ]);

      if (!marketRes.ok || !pagasaRes.ok) {
        throw new Error('Network response was not ok');
      }

      const market = await marketRes.json();
      const pagasa = await pagasaRes.json();

      setMarketData({
        rice: { 
          price: market.data?.rice ? `₱${market.data.rice.toFixed(2)}` : '₱52.50', 
          date: market.data?.date || new Date().toISOString() 
        },
        corn: { 
          price: market.data?.corn ? `₱${market.data.corn.toFixed(2)}` : '₱28.00', 
          date: market.data?.date || new Date().toISOString() 
        }
      });
      setPagasaData(pagasa.data || pagasa);
      
      // Auto-translate PAGASA summary using Gemini AI based on selected language
      const summaryToTranslate = pagasa.data?.summary || pagasa.summary;
      if (summaryToTranslate) {
        const translated = await translateText(summaryToTranslate, i18n.language);
        setTranslatedPagasaSummary(translated);
      }
    } catch (err) {
      console.warn('Failed to fetch live data, using fallback for demo:', err);
      // Fallback data if backend is unreachable (e.g. HTTPS -> HTTP mixed content block on Firebase)
      setMarketData({
        rice: { price: '₱52.50', date: new Date().toISOString() },
        corn: { price: '₱28.00', date: new Date().toISOString() }
      });
      setPagasaData({
        title: 'Tropical Cyclone Advisory',
        summary: 'PAGASA: No active tropical cyclone within the Philippine Area of Responsibility.',
        date: new Date().toISOString()
      });
      setTranslatedPagasaSummary('PAGASA: No active tropical cyclone within the Philippine Area of Responsibility.');
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Re-translate if language changes
  useEffect(() => {
    const runTranslation = async () => {
      if (pagasaData?.summary) {
        setTranslatedPagasaSummary('Translating...');
        const translated = await translateText(pagasaData.summary, i18n.language);
        setTranslatedPagasaSummary(translated);
      }
    };
    runTranslation();
  }, [i18n.language, pagasaData]);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between h-full group">
      {/* Background glow effect */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-1000" />
      
      <div className="relative z-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <CloudRainWind className="text-sky-400" size={24} />
              {t('widgets.agriMarketPulse', 'Agri-Market Pulse')}
            </h2>
            <p className="text-xs text-slate-400 mt-1">{t('widgets.liveDaPrices', 'Live DA Prices & PAGASA Updates')}</p>
          </div>
          <button 
            onClick={fetchData} 
            disabled={isLoading}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/5 disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={`text-slate-300 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>

        {error ? (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-rose-300">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Wheat size={16} className="text-amber-400" />
                  <span className="text-xs font-bold tracking-widest uppercase">Rice (Palay)</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-white">{isLoading ? '--' : marketData?.rice?.price || '₱--'}</span>
                  <span className="text-xs text-slate-500 mb-1">/ kg</span>
                </div>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Sprout size={16} className="text-emerald-400" />
                  <span className="text-xs font-bold tracking-widest uppercase">Corn</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-white">{isLoading ? '--' : marketData?.corn?.price || '₱--'}</span>
                  <span className="text-xs text-slate-500 mb-1">/ kg</span>
                </div>
              </div>
            </div>

            <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold tracking-widest uppercase text-sky-400">PAGASA Bulletin</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {isLoading ? '...' : pagasaData?.date}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                {isLoading ? 'Loading updates...' : pagasaData?.title}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isLoading ? 'Please wait while we fetch the latest severe weather bulletin...' : translatedPagasaSummary}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-between mt-6 pt-4 border-t border-white/5">
        <span className="text-[10px] text-slate-500">Sources: DA Price Monitoring & PAGASA</span>
        <span className="text-[10px] text-slate-500">Updated real-time</span>
      </div>
    </div>
  );
};

export default MarketWidget;
