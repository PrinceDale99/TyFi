import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Vote, CheckCircle2, XCircle, Clock, Search, 
  Filter, Plus, Shield, ShieldCheck, Users,
  Activity, ArrowRight, Loader2, ChevronRight, ChevronDown
} from 'lucide-react';
import { rpc, Address, nativeToScVal, scValToNative, TransactionBuilder, Account, Contract, Transaction } from '@stellar/stellar-sdk';
import { signTransaction, requestAccess } from '@stellar/freighter-api';
import type { Proposal } from '../types';

interface GovernancePortalProps {
  walletAddress: string;
  network: 'testnet' | 'mainnet';
}

import { NETWORK_CONFIGS, voteOnDaoProposal, createDaoProposal, isUserRejection } from '../lib/stellar';
import { capturePostHogEvent } from '../lib/posthog';

// Newer freighter-api versions return { error } on rejection instead of throwing,
// so surface it as an error that the analytics pipeline can classify.
const signWithFreighter = async (xdr: string, networkPassphrase: string): Promise<string> => {
  const result: any = await signTransaction(xdr, { networkPassphrase });
  if (typeof result === 'string') return result;
  if (result?.error) {
    throw Object.assign(new Error(result.error.message ?? String(result.error)), { code: result.error.code });
  }
  return result.signedTxXdr;
};

export function GovernancePortal({ walletAddress, network }: GovernancePortalProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'executed' | 'failed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [votingPower, setVotingPower] = useState('0');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [daoMetrics, setDaoMetrics] = useState({
    total_members: 1248,
    weekly_growth: 12,
    active_proposals: 1
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // ─── Live Governance Data ──────────────────────────────────────────────────
  // Soroban RPC has no push subscriptions, so proposals are polled roughly once
  // per ledger close. Polling pauses while the tab is hidden and refreshes
  // immediately when it becomes visible again.
  const PROPOSAL_POLL_MS = 6000;
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const fetchGenerationRef = useRef(0);
  const isPollingRef = useRef(false);

  const loadDaoMetrics = useCallback(async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://tyfi-yzbn.onrender.com';
      const metricsRes = await fetch(`${backendUrl}/api/dao/metrics`);
      if (metricsRes.ok) {
        setDaoMetrics(await metricsRes.json());
      }
    } catch (e) {
      console.error("Failed to fetch DAO metrics", e);
    }
  }, []);

  const loadVotingPower = useCallback(async () => {
    if (!walletAddress || walletAddress.startsWith("DEMO_")) return;
    try {
      const config = NETWORK_CONFIGS[network];
      const server = new rpc.Server(config.sorobanRpcUrl);
      const vaultContract = new Contract(config.vaultContractId);
      // Always use the zero account for read-only simulations to avoid op_no_source_account errors
      // if the user's connected wallet is unfunded on testnet.
      const dummyAccount = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
      const tx = new TransactionBuilder(dummyAccount, { fee: "1000000", networkPassphrase: config.passphrase })
        .addOperation(vaultContract.call('get_lp_shares', nativeToScVal(Address.fromString(walletAddress), { type: 'address' })))
        .setTimeout(30)
        .build();

      const result = await server.simulateTransaction(tx);
      if (result && rpc.Api.isSimulationSuccess(result) && result.result) {
        const val = scValToNative(result.result.retval);
        setVotingPower((Number(val) / 10000000).toFixed(2));
      }
    } catch (e) {
      console.error("Failed to fetch voting power", e);
    }
  }, [network, walletAddress]);

  const loadProposals = useCallback(async () => {
    // Skip if a previous poll is still in flight (slow RPC) to avoid piling up requests.
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    const generation = fetchGenerationRef.current;

    try {
      const config = NETWORK_CONFIGS[network];
      const server = new rpc.Server(config.sorobanRpcUrl);
      const daoContract = new Contract(config.daoContractId);
      const dummyAccount = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
      const simulateRead = (method: string, ...args: any[]) =>
        server.simulateTransaction(
          new TransactionBuilder(dummyAccount, { fee: "100", networkPassphrase: config.passphrase })
            .addOperation(daoContract.call(method, ...args))
            .setTimeout(30)
            .build()
        );

      const [countResult, latestLedgerResp] = await Promise.all([
        simulateRead('get_proposal_count'),
        server.getLatestLedger(),
      ]);
      if (!(countResult && rpc.Api.isSimulationSuccess(countResult) && countResult.result)) return;

      const count = Number(scValToNative(countResult.result.retval));
      const currentLedger = latestLedgerResp.sequence;

      // Fetch all proposals in parallel so each refresh stays well inside the poll interval.
      const results = await Promise.all(
        Array.from({ length: count }, (_, idx) =>
          simulateRead('get_proposal', nativeToScVal(idx + 1, { type: 'u64' })).catch(err => {
            console.error(`Failed to fetch proposal ${idx + 1}`, err);
            return null;
          })
        )
      );

      const fetchedProposals: Proposal[] = [];
      for (const propResult of results) {
        if (!(propResult && rpc.Api.isSimulationSuccess(propResult) && propResult.result)) continue;
        const p = scValToNative(propResult.result.retval);

        // Convert soroban Symbol or String to JS string
        const actionTypeStr = typeof p.action_type === 'string' ? p.action_type : String(p.action_type);
        const descStr = typeof p.description === 'string' ? p.description : String(p.description);

        fetchedProposals.push({
          id: Number(p.id || p[0]),
          creator: p.creator || p[1],
          description: descStr || p[2],
          actionType: actionTypeStr || p[3],
          votesFor: Number(p.votes_for || p[4] || 0),
          votesAgainst: Number(p.votes_against || p[5] || 0),
          executed: p.executed || p[6] || false,
          // Convert ledger sequence deadline to an approximate timestamp (~5s per ledger)
          deadline: Date.now() + (Number(p.deadline) - currentLedger) * 5000,
        });
      }

      // Drop results from a request started before the network/wallet changed.
      if (generation !== fetchGenerationRef.current) return;
      setProposals(fetchedProposals);
      setLastSyncedAt(Date.now());
    } catch (e) {
      console.error("Failed to fetch proposals", e);
    } finally {
      isPollingRef.current = false;
    }
  }, [network]);

  const refreshGovernance = useCallback(async () => {
    await Promise.all([loadProposals(), loadVotingPower(), loadDaoMetrics()]);
  }, [loadProposals, loadVotingPower, loadDaoMetrics]);

  useEffect(() => {
    fetchGenerationRef.current += 1;
    isPollingRef.current = false;
    setIsLoading(true);
    refreshGovernance().finally(() => setIsLoading(false));

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadProposals();
    }, PROPOSAL_POLL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadProposals();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshGovernance, loadProposals]);

  const filteredProposals = proposals.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'active') return p.deadline > Date.now();
    if (filter === 'executed') return p.executed;
    if (filter === 'failed') return p.deadline <= Date.now() && !p.executed && p.votesFor <= p.votesAgainst;
    return true;
  });

  const handleVote = async (id: number, support: boolean) => {
    if (!walletAddress) {
      showToast("Please connect your wallet first.", "error");
      return;
    }
    
    try {
      showToast(`Voting ${support ? 'FOR' : 'AGAINST'} proposal ${id} via Soroban Smart Contract... Please check Freighter.`, "info");

      const passphrase = NETWORK_CONFIGS[network].passphrase;
      await voteOnDaoProposal(id, support, network, walletAddress, xdr => signWithFreighter(xdr, passphrase));

      capturePostHogEvent('governance_vote_submitted', {
        proposal_id: id,
        vote: support ? 'for' : 'against',
        network,
      });
      showToast("Vote confirmed on-chain!", "success");
      // Pull the real on-chain tallies right away instead of waiting for the next poll.
      refreshGovernance();
    } catch (e) {
      console.error("Voting failed", e);
      showToast(isUserRejection(e) ? "Vote cancelled in wallet." : "Voting failed. Check console for details.", "error");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12 relative">
      
      {/* Toast Notification UI */}
      {toast && (
        <div className={`fixed bottom-8 right-8 p-4 rounded-xl shadow-2xl border z-[60] animate-in slide-in-from-bottom-5 font-bold flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100' :
          toast.type === 'error' ? 'bg-rose-900/90 border-rose-500/50 text-rose-100' :
          'bg-slate-900/90 border-sky-500/50 text-sky-100'
        }`}>
          {toast.type === 'success' && <CheckCircle2 size={20} className="text-emerald-400" />}
          {toast.type === 'error' && <XCircle size={20} className="text-rose-400" />}
          {toast.type === 'info' && <Activity size={20} className="text-sky-400" />}
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-6 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users size={48} />
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Total DAO Members</p>
          <div className="text-3xl font-black text-white">{daoMetrics.total_members.toLocaleString()}</div>
          <div className="text-xs text-emerald-400 font-bold mt-2 flex items-center gap-1">
            <Activity size={12} /> +{daoMetrics.weekly_growth} this week
          </div>
        </div>

        <div className="glass-panel p-6 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Vote size={48} />
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Active Proposals</p>
          <div className="text-3xl font-black text-white">{proposals.filter(p => p.deadline > Date.now()).length}</div>
          <div className="text-xs text-sky-400 font-bold mt-2">Voting in progress</div>
        </div>

        <div className="glass-panel p-6 border border-white/5 relative overflow-hidden group md:col-span-2 bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
          <div className="flex justify-between items-center h-full">
            <div>
              <p className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-1">Your Voting Power</p>
              <div className="text-4xl font-black text-white mb-1">{walletAddress ? votingPower : '0'} <span className="text-lg text-indigo-300">vTYFI</span></div>
              <p className="text-xs text-indigo-200/60">Read dynamically from LP Shares contract</p>
            </div>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black uppercase tracking-wider text-sm transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              <Plus size={18} />
              New Proposal
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel border border-white/5 flex flex-col md:flex-row min-h-[600px]">
        <div className="w-full md:w-64 border-r border-white/5 p-6 space-y-6">
          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Filter size={14} /> Filters
            </h3>
            <div className="space-y-2">
              {(['all', 'active', 'executed', 'failed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                    filter === f 
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  {f} Proposals
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-white flex items-center gap-3">
              <ShieldCheck className="text-sky-400" />
              Governance Proposals
            </h2>
            {lastSyncedAt && (
              <div
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400"
                title={`Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
              <Loader2 size={32} className="animate-spin text-sky-500" />
              <p className="text-sm font-bold uppercase tracking-widest">Reading from Soroban RPC...</p>
            </div>
          ) : filteredProposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Vote size={48} className="opacity-20 mb-4" />
              <p className="text-sm font-bold">No proposals found for this filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProposals.map(proposal => {
                const isActive = proposal.deadline > Date.now();
                const isPassed = proposal.votesFor > proposal.votesAgainst;
                const totalVotes = proposal.votesFor + proposal.votesAgainst;
                const forPercent = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
                
                return (
                  <div key={proposal.id} className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-sky-500/30 transition-all group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-black text-slate-500 uppercase">TIP-{proposal.id}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isActive ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                            proposal.executed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            isPassed ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                            'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {isActive ? 'Active' : proposal.executed ? 'Executed' : isPassed ? 'Passed - Pending' : 'Failed'}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2 leading-tight pr-12">{proposal.description}</h3>
                        <p className="text-xs font-mono text-slate-500">By {proposal.creator}</p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-end gap-1">
                          <Clock size={12} /> {isActive ? 'Ends In' : 'Ended'}
                        </p>
                        <p className="text-sm font-black text-white">
                          {new Date(proposal.deadline).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-3">
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-emerald-400">For: {(proposal.votesFor / 1000).toFixed(1)}k</span>
                        <span className="text-rose-400">Against: {(proposal.votesAgainst / 1000).toFixed(1)}k</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-rose-500/20 overflow-hidden flex">
                        <div className="h-full bg-emerald-500" style={{ width: `${forPercent}%` }}></div>
                      </div>
                    </div>

                    {isActive && (
                      <div className="mt-6 flex gap-3 pt-6 border-t border-white/5">
                        <button 
                          onClick={() => handleVote(proposal.id, true)}
                          className="flex-1 py-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black uppercase tracking-wider text-xs hover:bg-emerald-500/20 transition-all flex justify-center items-center gap-2"
                        >
                          <CheckCircle2 size={16} /> Vote For
                        </button>
                        <button 
                          onClick={() => handleVote(proposal.id, false)}
                          className="flex-1 py-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 font-black uppercase tracking-wider text-xs hover:bg-rose-500/20 transition-all flex justify-center items-center gap-2"
                        >
                          <XCircle size={16} /> Vote Against
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <XCircle size={24} />
            </button>
            <h3 className="text-xl font-black text-white mb-4">Create Proposal</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
                <textarea 
                  id="proposalDesc"
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-sky-500 outline-none"
                  rows={3}
                  placeholder="Describe your proposal..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Action Type</label>
                <div className="relative">
                  <select 
                    id="proposalAction"
                    className="w-full appearance-none bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none cursor-pointer"
                  >
                    <option value="" disabled selected>Select an action type</option>
                    <option value="UPDATE_PREMIUM_RATE">Update Premium Rate</option>
                    <option value="UPDATE_PAYOUT_THRESHOLD">Update Payout Threshold</option>
                    <option value="UPGRADE_CONTRACT_WASM">Upgrade Contract WASM</option>
                    <option value="UPDATE_DAO_QUORUM">Update DAO Quorum Requirement</option>
                    <option value="UPDATE_DAO_VOTING_PERIOD">Update Voting Period</option>
                    <option value="ADD_AUTHORIZED_ORACLE">Add Authorized Oracle</option>
                    <option value="REMOVE_AUTHORIZED_ORACLE">Remove Authorized Oracle</option>
                    <option value="TRANSFER_TREASURY_FUNDS">Transfer Treasury Funds</option>
                    <option value="PAUSE_PROTOCOL">Emergency Pause Protocol</option>
                    <option value="UNPAUSE_PROTOCOL">Unpause Protocol</option>
                    <option value="UPDATE_FEE_BUMP_SPONSOR">Update Gas Sponsor Account</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Voting Ends On (Month, Day, Year)</label>
                <div className="relative">
                  <input 
                    type="date"
                    id="proposalEndDate"
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>
              <button 
                onClick={async () => {
                  if (!walletAddress) {
                    showToast("Please connect your wallet first.", "error");
                    return;
                  }
                  try {
                    const desc = (document.getElementById('proposalDesc') as HTMLTextAreaElement).value;
                    const action = (document.getElementById('proposalAction') as HTMLSelectElement).value;
                    const endDateStr = (document.getElementById('proposalEndDate') as HTMLInputElement).value;
                    
                    if (!desc || !action || !endDateStr) {
                      showToast("Please fill all fields, including the end date", "error");
                      return;
                    }

                    const endDate = new Date(endDateStr);
                    const now = new Date();
                    if (endDate <= now) {
                      showToast("End date must be in the future", "error");
                      return;
                    }

                    // Calculate duration in ledgers (1 ledger ~ 5 seconds)
                    const diffSeconds = Math.floor((endDate.getTime() - now.getTime()) / 1000);
                    const durationLedgers = Math.floor(diffSeconds / 5);

                    showToast(`Submitting Proposal via Smart Contract... Please check Freighter.`, "info");
                    const passphrase = NETWORK_CONFIGS[network].passphrase;
                    await createDaoProposal(walletAddress, desc, action, durationLedgers, network, xdr => signWithFreighter(xdr, passphrase));

                    capturePostHogEvent('governance_proposal_submitted', {
                      action_type: action,
                      network,
                    });
                    showToast("Proposal confirmed on-chain!", "success");
                    setShowCreateModal(false);
                    refreshGovernance();
                  } catch (e) {
                    console.error("Create proposal failed", e);
                    showToast(isUserRejection(e) ? "Proposal cancelled in wallet." : "Failed to create proposal. Check console for details.", "error");
                  }
                }}
                className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-wider text-sm transition-all"
              >
                Submit Proposal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
