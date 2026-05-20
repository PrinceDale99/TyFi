import React, { useEffect, useState } from 'react';
import { Activity, ExternalLink, RefreshCw, Cpu, Layers } from 'lucide-react';
import { fetchRecentTransactions, type LedgerTx } from '../lib/stellar';

interface LedgerStreamProps {
  network: 'testnet' | 'mainnet';
}

const LedgerStream: React.FC<LedgerStreamProps> = ({ network }) => {
  const [transactions, setTransactions] = useState<LedgerTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const txs = await fetchRecentTransactions(network);
      setTransactions(txs);
      setSecondsAgo(0);
    } catch (err) {
      console.error("Failed to load blockchain stream:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [network]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      setSecondsAgo(prev => {
        if (prev >= 14) {
          loadTransactions();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, network]);

  const getExplorerUrl = (hash: string) => {
    const netPath = network === 'mainnet' ? 'public' : 'testnet';
    return `https://stellar.expert/explorer/${netPath}/tx/${hash}`;
  };

  const getShortAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  return (
    <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping absolute"></div>
            <div className="w-3 h-3 bg-emerald-500 rounded-full relative"></div>
          </div>
          <div>
            <h3 className="font-black text-white text-sm uppercase tracking-wider">Live Stellar Ledger Stream</h3>
            <p className="text-slate-400 text-xs">Real-time telemetries from Stellar Horizon public node</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all border ${
              autoRefresh 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-slate-900 border-white/5 text-slate-500'
            }`}
          >
            {autoRefresh ? `Auto-Syncing (${15 - secondsAgo}s)` : 'Paused'}
          </button>
          
          <button
            onClick={loadTransactions}
            disabled={loading}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-lg text-slate-400 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-slate-900/40 border border-white/5 rounded-xl text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">Network Node</div>
          <div className="text-xs font-bold text-sky-400 flex items-center justify-center gap-1">
            <Cpu size={12} />
            Horizon-{network.toUpperCase()}
          </div>
        </div>
        <div className="p-3 bg-slate-900/40 border border-white/5 rounded-xl text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">Fee Pool Rate</div>
          <div className="text-xs font-bold text-white flex items-center justify-center gap-1">
            100 Stroops
          </div>
        </div>
        <div className="p-3 bg-slate-900/40 border border-white/5 rounded-xl text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">Ledger Version</div>
          <div className="text-xs font-bold text-white flex items-center justify-center gap-1">
            v21 Stable
          </div>
        </div>
        <div className="p-3 bg-slate-900/40 border border-white/5 rounded-xl text-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">Consensus Type</div>
          <div className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1">
            <Layers size={12} />
            SCP Consensus
          </div>
        </div>
      </div>

      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
        {loading && transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <RefreshCw size={24} className="text-sky-400 animate-spin" />
            <div className="text-xs text-slate-400">Synchronizing ledger stream from Stellar network...</div>
          </div>
        ) : (
          transactions.map((tx) => (
            <div 
              key={tx.hash} 
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-900/30 hover:bg-slate-900/60 border border-white/5 hover:border-white/10 rounded-xl transition-all group"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 font-bold rounded">
                    Ledger #{tx.ledger}
                  </span>
                  <a
                    href={getExplorerUrl(tx.hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {tx.hash.slice(0, 16)}...{tx.hash.slice(-8)}
                    <ExternalLink size={10} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                  </a>
                </div>
                <div className="text-[10px] text-slate-500">
                  Source: <span className="font-mono text-slate-400">{getShortAddress(tx.sourceAccount)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 mt-2 sm:mt-0 text-right">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Ops count</div>
                  <div className="text-xs font-bold text-white">{tx.operationCount}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Gas Fee</div>
                  <div className="text-xs font-bold text-white">{tx.feePaid} Stroops</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Timestamp</div>
                  <div className="text-[10px] text-slate-400">
                    {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LedgerStream;
