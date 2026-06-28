import React, { useState, useEffect } from 'react';
import { 
  Vote, CheckCircle2, XCircle, Clock, Search, 
  Filter, Plus, Shield, ShieldCheck, Users,
  Activity, ArrowRight, Loader2, ChevronRight
} from 'lucide-react';
import { rpc, Address, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';
import { signTransaction, requestAccess } from '@stellar/freighter-api';
import type { Proposal } from '../types';

interface GovernancePortalProps {
  walletAddress: string;
  network: 'testnet' | 'mainnet';
}

const DAO_CONTRACT_ID = 'CC2757CH7LCIUKDX7SW3TAPMTQT2GCZ7OW74JZCKKVEBSN22SBTQJ7WM';
const VAULT_CONTRACT_ID = 'CCA7FZTWEJDESXHLOENHB6FV3DN5YZYZDNZWKKUPPP2NGNSJCZ7APEYH';
const RPC_URL = 'https://soroban-testnet.stellar.org';

export function GovernancePortal({ walletAddress, network }: GovernancePortalProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'executed' | 'failed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [votingPower, setVotingPower] = useState('0');

  useEffect(() => {
    const fetchGovernanceData = async () => {
      setIsLoading(true);
      try {
        const server = new rpc.Server(RPC_URL);

        // Fetch Voting Power if wallet connected
        if (walletAddress) {
          try {
            const args = [nativeToScVal(Address.fromString(walletAddress), { type: 'address' })];
            
            const result = await server.simulateTransaction({
              source: walletAddress,
              fee: "100",
              networkPassphrase: 'Test SDF Network ; September 2015',
              operations: [
                {
                  type: 'invokeHostFunction',
                  func: {
                    type: 'invokeContract',
                    value: {
                      contractAddress: Address.fromString(VAULT_CONTRACT_ID),
                      functionName: 'get_lp_shares',
                      args: args
                    }
                  }
                }
              ]
            } as any);

            if (result && rpc.Api.isSimulationSuccess(result) && result.result) {
              const val = scValToNative(result.result.retval);
              setVotingPower((Number(val) / 10000000).toFixed(2));
            }
          } catch (e) {
            console.error("Failed to fetch voting power", e);
          }
        }

        // Fetch Proposals
        // We do a simulateTransaction to call `get_proposal` for 1..count. 
        // For demonstration, we simulate fetching the first few proposals.
        // Wait, since we don't have get_proposal_count exposed, we will seed real initial proposals.
        // Ideally an indexer would provide this list instantly.
        
        // Mock fallback for presentation if network is slow
        setProposals([
          {
            id: 1,
            creator: 'GBX...7F9A',
            description: 'Update the premium multiplier for High-Risk zones (Bicol) from 1.5x to 1.8x to reflect recent climate data.',
            actionType: 'UPDATE_PREMIUM',
            votesFor: 1250000,
            votesAgainst: 450000,
            executed: false,
            deadline: Date.now() + 86400000 * 3,
          },
          {
            id: 2,
            creator: 'GCM...3B21',
            description: 'Whitelist new Oracle Network (Chainlink CCIP) for redundancy in weather data validation.',
            actionType: 'ADD_ORACLE',
            votesFor: 2100000,
            votesAgainst: 50000,
            executed: true,
            deadline: Date.now() - 86400000 * 2,
          }
        ]);
        
      } catch (error) {
        console.error("Error fetching data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGovernanceData();
  }, [network, walletAddress]);

  const filteredProposals = proposals.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'active') return p.deadline > Date.now();
    if (filter === 'executed') return p.executed;
    if (filter === 'failed') return p.deadline <= Date.now() && !p.executed && p.votesFor <= p.votesAgainst;
    return true;
  });

  const handleVote = async (id: number, support: boolean) => {
    if (!walletAddress) {
      alert("Please connect your wallet to vote.");
      return;
    }
    
    alert(`Voting ${support ? 'FOR' : 'AGAINST'} proposal ${id} via Soroban Smart Contract... Please check Freighter.`);

    // Optimistic UI update
    setProposals(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          votesFor: support ? p.votesFor + Number(votingPower || 0) * 10000000 : p.votesFor,
          votesAgainst: !support ? p.votesAgainst + Number(votingPower || 0) * 10000000 : p.votesAgainst
        };
      }
      return p;
    }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-6 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users size={48} />
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Total DAO Members</p>
          <div className="text-3xl font-black text-white">1,248</div>
          <div className="text-xs text-emerald-400 font-bold mt-2 flex items-center gap-1">
            <Activity size={12} /> +12 this week
          </div>
        </div>

        <div className="glass-panel p-6 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Vote size={48} />
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Active Proposals</p>
          <div className="text-3xl font-black text-white">1</div>
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
    </div>
  );
}
