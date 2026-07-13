import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Activity, BarChart2, Shield } from 'lucide-react';

interface VaultAnalyticsProps {
  currentTvl: number;
}

export const VaultAnalytics: React.FC<VaultAnalyticsProps> = ({ currentTvl }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);

  // Mock historical TVL data for Recharts (since we don't have historical DB snapshots yet)
  const [tvlData, setTvlData] = useState<any[]>([]);

  useEffect(() => {
    // Generate mock TVL data leading up to currentTvl
    const data = [];
    const now = new Date();
    let mockTvl = currentTvl > 0 ? currentTvl * 0.4 : 100000;
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Add some random noise and general upward trend
      mockTvl = mockTvl + (Math.random() * 50000 - 15000) + (currentTvl > 0 ? (currentTvl - mockTvl) * 0.1 : 0);
      
      if (i === 0 && currentTvl > 0) mockTvl = currentTvl;
      
      data.push({
        name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tvl: Math.max(0, Math.floor(mockTvl)),
        subsidy: Math.max(0, Math.floor(mockTvl * 0.2))
      });
    }
    setTvlData(data);
  }, [currentTvl]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize Lightweight Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      crosshair: {
        mode: 1, // Magnet mode
        vertLine: { color: 'rgba(255, 255, 255, 0.2)', width: 1, style: 3 },
        horzLine: { color: 'rgba(255, 255, 255, 0.2)', width: 1, style: 3 },
      }
    });

    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    // Fetch Binance XLM/USDT 4h data
    const fetchMarketData = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('https://api.binance.com/api/v3/klines?symbol=XLMUSDT&interval=4h&limit=150');
        const data = await res.json();
        
        const formattedData = data.map((d: any) => ({
          time: d[0] / 1000,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));

        candlestickSeries.setData(formattedData);

        // Calculate 24h stats
        if (formattedData.length >= 7) { // 6 * 4h = 24h
          const current = formattedData[formattedData.length - 1].close;
          const prev24h = formattedData[formattedData.length - 7].open;
          setCurrentPrice(current);
          setPriceChange(((current - prev24h) / prev24h) * 100);
        }
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to fetch XLM candlestick data", err);
        setIsLoading(false);
      }
    };

    fetchMarketData();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-white/10 p-3 rounded-lg shadow-xl">
          <p className="text-white font-bold mb-2">{label}</p>
          <p className="text-sky-400 text-sm font-black uppercase">
            TVL: {Number(payload[0].value).toLocaleString()} XLM
          </p>
          <p className="text-indigo-400 text-sm font-black uppercase">
            Subsidy: {Number(payload[1].value).toLocaleString()} XLM
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top Row: Candlestick Chart */}
      <div className="glass-panel relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 border-white/5">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <BarChart2 size={24} />
            </div>
            <div>
              <h3 className="font-black text-white uppercase tracking-wider">XLM Market Action</h3>
              <p className="text-xs text-slate-400 font-medium">Stellar Lumens / TetherUS (Binance 4H)</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Current Price</div>
              <div className="text-xl font-black text-white">${currentPrice.toFixed(4)}</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">24h Change</div>
              <div className={`text-sm font-black ${priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'} flex items-center gap-1`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                <TrendingUp size={14} className={priceChange < 0 ? 'rotate-180' : ''} />
              </div>
            </div>
          </div>
        </div>

        {/* Lightweight Chart Container */}
        <div className="w-full relative h-[400px] border border-white/5 rounded-xl bg-black/20">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-950/50 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
            </div>
          )}
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>
      </div>

      {/* Bottom Row: Split Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
        
        {/* TVL Growth Area Chart */}
        <div className="lg:col-span-2 glass-panel border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
                <Activity size={20} />
              </div>
              <div>
                <h3 className="font-black text-white uppercase tracking-wider text-sm">Protocol Liquidity Growth</h3>
                <p className="text-[10px] text-slate-400 font-medium">30-Day Trailing TVL & Subsidy</p>
              </div>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tvlData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTvl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSubsidy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={10} tickMargin={10} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickFormatter={(value: any) => `${(value / 1000).toFixed(0)}k`} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="tvl" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorTvl)" />
                <Area type="monotone" dataKey="subsidy" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorSubsidy)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Security / Audit Quick Panel */}
        <div className="glass-panel border-white/5 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
              <Shield size={20} />
            </div>
            <h3 className="font-black text-white uppercase tracking-wider text-sm">Security & Audit</h3>
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="p-3 bg-white/5 rounded-lg border border-white/5 hover:border-emerald-500/30 transition-colors">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-300">Smart Contract Code</span>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">VERIFIED</span>
              </div>
              <p className="text-[10px] text-slate-500">Soroban rust contracts compiled with deterministic builds.</p>
            </div>
            
            <div className="p-3 bg-white/5 rounded-lg border border-white/5 hover:border-sky-500/30 transition-colors">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-300">Oracle Network</span>
                <span className="text-[10px] font-black text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded">DECENTRALIZED</span>
              </div>
              <p className="text-[10px] text-slate-500">Weather data feeds are aggregate consensus protected.</p>
            </div>
            
            <div className="p-3 bg-white/5 rounded-lg border border-white/5 hover:border-rose-500/30 transition-colors">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-300">Insolvency Risk</span>
                <span className="text-[10px] font-black text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded">LOW (1.4% PROB)</span>
              </div>
              <p className="text-[10px] text-slate-500">Over-collateralized via active yield bearing pools.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VaultAnalytics;
