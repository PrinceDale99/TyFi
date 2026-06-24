import React, { useEffect, useState } from 'react';
import { 
  History, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Clock,
  ShieldCheck,
  Zap,
  ChevronRight
} from 'lucide-react';
import { getPredictionHistory, getPayoutHistory, type PredictionLog, type PayoutLog } from '../services/firebaseService';
import { useXlmToPhp } from '../hooks/useXlmToPhp';

interface HistoryDashboardProps {
  walletAddress: string;
  network?: 'testnet' | 'mainnet';
}

const HistoryDashboard: React.FC<HistoryDashboardProps> = ({ walletAddress, network = 'testnet' }) => {
  const { formatPhp } = useXlmToPhp();
  const [predictions, setPredictions] = useState<PredictionLog[]>([]);
  const [payouts, setPayouts] = useState<PayoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'payouts' | 'risks'>('payouts');

  useEffect(() => {
    const fetchData = async () => {
      if (!walletAddress) return;
      setLoading(true);
      try {
        const [predData, payoutData] = await Promise.all([
          getPredictionHistory(walletAddress, network),
          getPayoutHistory(walletAddress, network)
        ]);
        setPredictions(predData);
        setPayouts(payoutData);
      } catch (err) {
        console.error("Failed to fetch history from Firestore:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [walletAddress, network]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-black uppercase tracking-widest">Retrieving Secure Logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('payouts')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'payouts' 
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' 
                : 'bg-white/5 text-slate-500 hover:text-white'
            }`}
          >
            Payout History
          </button>
          <button
            onClick={() => setActiveSubTab('risks')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'risks' 
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' 
                : 'bg-white/5 text-slate-500 hover:text-white'
            }`}
          >
            AI Risk Assessments
          </button>
        </div>
        
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
          <ShieldCheck size={14} className="text-emerald-500" />
          On-Chain Verified
        </div>
      </div>

      <div className="space-y-4">
        {activeSubTab === 'payouts' ? (
          payouts.length === 0 ? (
            <div className="glass-panel py-16 text-center">
              <History size={48} className="mx-auto text-slate-800 mb-4" />
              <h4 className="text-white font-bold mb-1">No Payouts Detected</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Immutable ledger logs will appear here once a parametric trigger is confirmed by the oracle consensus.
              </p>
            </div>
          ) : (
            payouts.map((payout, i) => (
              <div key={payout.id || i} className="group glass-panel p-5 hover:border-sky-500/30 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shadow-inner">
                      <Zap size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-black text-white uppercase tracking-tight">Parametric Payout</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded font-bold uppercase">Settled</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <Clock size={12} />
                        {payout.timestamp?.toDate().toLocaleString() || 'Recent'}
                        <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                        {payout.region}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-white">{payout.amount.toLocaleString()} <span className="text-xs text-sky-500">XLM</span></div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{formatPhp(payout.amount)}</div>
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          predictions.length === 0 ? (
            <div className="glass-panel py-16 text-center">
              <TrendingUp size={48} className="mx-auto text-slate-800 mb-4" />
              <h4 className="text-white font-bold mb-1">No Risk History</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                AI weather impact assessments will be logged here for seasonal transparency and audit.
              </p>
            </div>
          ) : (
            predictions.map((pred, i) => (
              <div key={pred.id || i} className="group glass-panel p-5 hover:border-indigo-500/30 transition-all border-l-4 border-l-indigo-500/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${
                      pred.riskLevel === 'Critical' || pred.riskLevel === 'High' 
                        ? 'bg-rose-500/10 text-rose-400' 
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-wider">{pred.farmName} Assessment</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        {pred.timestamp?.toDate().toLocaleString() || 'Recent'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 uppercase font-black mb-0.5">Risk Level</div>
                      <div className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
                        pred.riskLevel === 'Critical' ? 'bg-rose-500/20 text-rose-400' :
                        pred.riskLevel === 'High' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {pred.riskLevel}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 uppercase font-black mb-0.5">Hit Prob.</div>
                      <div className="text-sm font-black text-white">{pred.hitProbability}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 uppercase font-black mb-0.5">Est. Damage</div>
                      <div className="text-sm font-black text-white">{pred.estimatedDamage}%</div>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-black/20 rounded-xl border border-white/5 mb-3">
                  <p className="text-xs text-slate-400 italic line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
                    "{pred.reasoning}"
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-indigo-400 font-black uppercase tracking-widest flex items-center gap-1">
                    <ShieldCheck size={12} /> Gemini Advisor Insight
                  </div>
                  <button className="text-[10px] text-slate-500 hover:text-white font-bold uppercase tracking-widest flex items-center gap-1 transition-colors">
                    View Details <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};

export default HistoryDashboard;
