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

import {
  NETWORK_CONFIGS, voteOnDaoProposal, createDaoProposal, settleDaoProposal, finalizeDaoProposal, isUserRejection, describeDaoError,
  DAO_ADMIN_ONLY_ACTIONS, DAO_MIN_PROPOSAL_SHARES,
  type DaoActionType, type DaoProposalStatus, type DaoRole,
} from '../lib/stellar';
import { PHILIPPINE_REGIONS } from '../constants';
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

/** QUORUM_BPS in the DAO contract: 30% of the LP-share snapshot must vote. */
const DAO_QUORUM_BPS = 3_000;
const STROOPS_PER_SHARE = 10_000_000;

/**
 * Mirrors get_proposal_status in contracts/tyfi_dao/src/lib.rs, computed locally so the
 * live poll doesn't need an extra RPC call per proposal.
 */
const proposalStatus = (p: any, currentLedger: number): DaoProposalStatus => {
  if (p.vetoed) return 'Vetoed';
  if (p.executed) return 'Executed';
  if (currentLedger <= Number(p.deadline)) return 'Active';
  const votesFor = BigInt(p.votes_for ?? 0);
  const totalVotes = votesFor + BigInt(p.votes_against ?? 0);
  const quorumRequired = (BigInt(p.quorum_snapshot ?? 0) * BigInt(DAO_QUORUM_BPS)) / 10_000n;
  const thresholdMet = totalVotes > 0n && (votesFor * 10_000n) / totalVotes >= BigInt(p.required_threshold_bps ?? 0);
  if (totalVotes < quorumRequired || !thresholdMet) return 'Failed';
  return currentLedger < Number(p.timelock_until) ? 'TimelockPending' : 'Passed';
};

const STATUS_STYLES: Record<DaoProposalStatus, { label: string; className: string }> = {
  Active:          { label: 'Active',            className: 'bg-sky-500/20 text-sky-400 border border-sky-500/30' },
  TimelockPending: { label: 'Passed · Timelock', className: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' },
  Passed:          { label: 'Passed',            className: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' },
  Executed:        { label: 'Executed',          className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  Failed:          { label: 'Failed',            className: 'bg-rose-500/20 text-rose-400 border border-rose-500/30' },
  Vetoed:          { label: 'Vetoed',            className: 'bg-rose-500/20 text-rose-400 border border-rose-500/30' },
};

const ACTION_OPTIONS: { value: DaoActionType; label: string; valueLabel?: string; min?: number; max?: number; hint?: string }[] = [
  { value: 'UpdatePremiumRate', label: 'Update Premium Rate', valueLabel: 'Premium multiplier (%)', min: 1, max: 1000, hint: '100 = 1.0× base premium for the region' },
  { value: 'UpdateQuorumThreshold', label: 'Update Oracle Quorum', valueLabel: 'Oracle quorum threshold', min: 1, max: 100, hint: 'Number of oracle reports required for consensus' },
  { value: 'UpdateSolvencyCap', label: 'Update Solvency Cap', valueLabel: 'Solvency cap (bps)', min: 100, max: 9500, hint: '100–9500 basis points of the pool' },
  { value: 'RegisterOracle', label: 'Register / Remove Oracle' },
];

/** One-line summary of what a proposal will change, e.g. "Premium rate · Luzon → 125%". */
const describeAction = (p: Proposal): string => {
  switch (p.actionType) {
    case 'UpdatePremiumRate': return `Premium rate · ${p.paramRegion} → ${p.paramValue}%`;
    case 'UpdateQuorumThreshold': return `Oracle quorum → ${p.paramValue}`;
    case 'UpdateSolvencyCap': return `Solvency cap → ${((p.paramValue ?? 0) / 100).toFixed(2)}%`;
    case 'RegisterOracle': return `${p.paramOracleActive ? 'Register' : 'Remove'} oracle ${p.paramOracle?.slice(0, 6)}…${p.paramOracle?.slice(-4)}`;
    default: return p.actionType;
  }
};

const formatShares = (stroops: number) =>
  (stroops / STROOPS_PER_SHARE).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function GovernancePortal({ walletAddress, network }: GovernancePortalProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'passed' | 'executed' | 'failed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [votingPower, setVotingPower] = useState('0');
  const [daoRole, setDaoRole] = useState<DaoRole | null>(null);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
  const [proposalForm, setProposalForm] = useState({
    description: '',
    actionType: 'UpdatePremiumRate' as DaoActionType,
    value: '',
    region: '',
    oracle: '',
    oracleActive: true,
    endDate: '',
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  /** Total LP shares in the vault (stroops): the DAO's voting supply. */
  const [votingSupply, setVotingSupply] = useState<number | null>(null);

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

  const loadVotingSupply = useCallback(async () => {
    try {
      const config = NETWORK_CONFIGS[network];
      const server = new rpc.Server(config.sorobanRpcUrl);
      const dummyAccount = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
      const result = await server.simulateTransaction(
        new TransactionBuilder(dummyAccount, { fee: "100", networkPassphrase: config.passphrase })
          .addOperation(new Contract(config.vaultContractId).call('get_total_reinsurance_shares'))
          .setTimeout(30)
          .build()
      );
      if (rpc.Api.isSimulationSuccess(result) && result.result) {
        setVotingSupply(Number(scValToNative(result.result.retval)));
      }
    } catch (e) {
      console.error("Failed to read the vault's total LP shares", e);
    }
  }, [network]);

  /** Returns the voter's LP-share voting power in XLM, or null if it could not be read. */
  const loadVotingPower = useCallback(async (): Promise<number | null> => {
    if (!walletAddress || walletAddress.startsWith("DEMO_")) return null;
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
        const power = Number(scValToNative(result.result.retval)) / 10000000;
        setVotingPower(power.toFixed(2));
        return power;
      }
    } catch (e) {
      console.error("Failed to fetch voting power", e);
    }
    return null;
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
        // get_proposal returns Option<Proposal>; unit enums decode as ['VariantName'].
        const p = scValToNative(propResult.result.retval);
        if (!p) continue;

        const votesFor = Number(p.votes_for ?? 0);
        const votesAgainst = Number(p.votes_against ?? 0);
        const quorumRequired = (Number(p.quorum_snapshot ?? 0) * DAO_QUORUM_BPS) / 10_000;

        fetchedProposals.push({
          id: Number(p.id),
          creator: String(p.creator),
          description: String(p.description),
          actionType: Array.isArray(p.action_type) ? String(p.action_type[0]) : String(p.action_type),
          votesFor,
          votesAgainst,
          executed: Boolean(p.executed),
          // Convert ledger sequence deadline to an approximate timestamp (~5s per ledger)
          deadline: Date.now() + (Number(p.deadline) - currentLedger) * 5000,
          status: proposalStatus(p, currentLedger),
          paramValue: Number(p.param_value ?? 0),
          paramRegion: String(p.param_region ?? ''),
          paramOracle: String(p.param_oracle ?? ''),
          paramOracleActive: Number(p.param_oracle_active ?? 0) === 1,
          requiredThresholdBps: Number(p.required_threshold_bps ?? 0),
          quorumRequired,
        });
      }

      // Look up the connected wallet's votes on open proposals so we can show them
      // and hide the vote buttons instead of letting the contract reject a repeat vote.
      if (walletAddress && !walletAddress.startsWith("DEMO_")) {
        const voter = nativeToScVal(Address.fromString(walletAddress), { type: 'address' });
        await Promise.all(fetchedProposals.filter(p => p.status === 'Active').map(async p => {
          try {
            const rec = await simulateRead('get_vote_record', nativeToScVal(p.id, { type: 'u64' }), voter);
            if (rpc.Api.isSimulationSuccess(rec) && rec.result) {
              const record = scValToNative(rec.result.retval);
              if (record) p.myVote = record.support ? 'for' : 'against';
            }
          } catch (err) {
            console.error(`Failed to fetch vote record for proposal ${p.id}`, err);
          }
        }));
      }

      // Drop results from a request started before the network/wallet changed.
      if (generation !== fetchGenerationRef.current) return;
      setProposals(fetchedProposals.reverse()); // newest first
      setLastSyncedAt(Date.now());
    } catch (e) {
      console.error("Failed to fetch proposals", e);
    } finally {
      isPollingRef.current = false;
    }
  }, [network, walletAddress]);

  const loadRole = useCallback(async () => {
    if (!walletAddress || walletAddress.startsWith("DEMO_")) {
      setDaoRole(null);
      return;
    }
    try {
      const config = NETWORK_CONFIGS[network];
      const server = new rpc.Server(config.sorobanRpcUrl);
      const dummyAccount = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
      const result = await server.simulateTransaction(
        new TransactionBuilder(dummyAccount, { fee: "100", networkPassphrase: config.passphrase })
          .addOperation(new Contract(config.daoContractId).call('get_role', nativeToScVal(Address.fromString(walletAddress), { type: 'address' })))
          .setTimeout(30)
          .build()
      );
      if (rpc.Api.isSimulationSuccess(result) && result.result) {
        const role = scValToNative(result.result.retval);
        setDaoRole(Array.isArray(role) ? role[0] as DaoRole : null);
      }
    } catch (e) {
      console.error("Failed to fetch DAO role", e);
    }
  }, [network, walletAddress]);

  const refreshGovernance = useCallback(async () => {
    await Promise.all([loadProposals(), loadVotingPower(), loadVotingSupply(), loadRole()]);
  }, [loadProposals, loadVotingPower, loadVotingSupply, loadRole]);

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
    if (filter === 'active') return p.status === 'Active';
    if (filter === 'passed') return p.status === 'Passed' || p.status === 'TimelockPending';
    if (filter === 'executed') return p.status === 'Executed';
    if (filter === 'failed') return p.status === 'Failed' || p.status === 'Vetoed';
    return true;
  });

  const handleVote = async (id: number, support: boolean) => {
    if (!walletAddress) {
      showToast("Please connect your wallet first.", "error");
      return;
    }
    
    // Pre-flight checks so common rejections never open the wallet popup.
    const proposal = proposals.find(p => p.id === id);
    if (proposal && proposal.status !== 'Active') {
      showToast(`Voting on proposal ${id} has ended.`, "error");
      return;
    }
    if (proposal?.myVote) {
      showToast(`You have already voted ${proposal.myVote.toUpperCase()} on proposal ${id}.`, "error");
      return;
    }
    const power = await loadVotingPower();
    if (power === 0) {
      showToast("You have no voting power. Provide liquidity in the Vault tab to earn LP shares, then vote.", "error");
      return;
    }

    try {
      showToast(`Voting ${support ? 'FOR' : 'AGAINST'} proposal ${id} via Soroban smart contract... Approve it in your wallet or with your passkey.`, "info");

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
      showToast(
        isUserRejection(e) ? "Vote cancelled in wallet." : describeDaoError(e) ?? "Voting failed. Check console for details.",
        "error"
      );
    }
  };

  const [finalizingId, setFinalizingId] = useState<number | null>(null);
  const canExecute = daoRole === 'Executor' || daoRole === 'Admin';

  /**
   * Applies a passed proposal to the vault. finalize_proposal only accepts
   * proposals that execute_proposal has settled, so settle first when needed.
   */
  const handleFinalize = async (id: number) => {
    if (!walletAddress) return;
    const passphrase = NETWORK_CONFIGS[network].passphrase;
    const sign = (xdr: string) => signWithFreighter(xdr, passphrase);
    setFinalizingId(id);
    try {
      showToast(`Applying proposal ${id} to the vault...`, "info");
      try {
        await finalizeDaoProposal(id, network, walletAddress, sign);
      } catch (e) {
        // DaoError::ProposalFailed (#10): not settled yet.
        if (!/Error\(Contract, #10\)/.test(String((e as any)?.message ?? e))) throw e;
        await settleDaoProposal(id, network, walletAddress, sign);
        await finalizeDaoProposal(id, network, walletAddress, sign);
      }
      capturePostHogEvent('governance_proposal_finalized', { proposal_id: id, network });
      showToast(`Proposal ${id} executed: the DAO updated the vault on-chain.`, "success");
      refreshGovernance();
    } catch (e) {
      console.error("Finalize failed", e);
      showToast(isUserRejection(e) ? "Finalize cancelled in wallet." : describeDaoError(e) ?? "Finalize failed. Check console for details.", "error");
    } finally {
      setFinalizingId(null);
    }
  };

  const selectedAction = ACTION_OPTIONS.find(a => a.value === proposalForm.actionType)!;
  const isAdmin = daoRole === 'Admin';
  const canProposeSelected = DAO_ADMIN_ONLY_ACTIONS.includes(proposalForm.actionType)
    ? isAdmin
    : isAdmin || daoRole === 'Proposer' || Number(votingPower) * STROOPS_PER_SHARE >= DAO_MIN_PROPOSAL_SHARES;

  const handleCreateProposal = async () => {
    if (!walletAddress) {
      showToast("Please connect your wallet first.", "error");
      return;
    }
    const { description, actionType, value, region, oracle, oracleActive, endDate } = proposalForm;
    if (!description.trim() || !endDate) {
      showToast("Please add a description and an end date.", "error");
      return;
    }
    if (!canProposeSelected) {
      showToast(DAO_ADMIN_ONLY_ACTIONS.includes(actionType)
        ? "Only DAO admins can propose this action."
        : "You need the Proposer role or LP shares in the vault to create proposals.", "error");
      return;
    }

    const numericValue = Number(value);
    if (selectedAction.min !== undefined && (!Number.isInteger(numericValue) || numericValue < selectedAction.min || numericValue > selectedAction.max!)) {
      showToast(`${selectedAction.valueLabel} must be a whole number from ${selectedAction.min} to ${selectedAction.max}.`, "error");
      return;
    }
    if (actionType === 'UpdatePremiumRate' && !region.trim()) {
      showToast("Please choose the region this premium rate applies to.", "error");
      return;
    }
    if (actionType === 'RegisterOracle' && !/^G[A-Z2-7]{55}$/.test(oracle.trim())) {
      showToast("Please enter a valid Stellar address (G…) for the oracle.", "error");
      return;
    }

    // Voting window in ledgers (1 ledger ≈ 5 seconds), ending at the end of the chosen day.
    const end = new Date(`${endDate}T23:59:59`);
    const durationLedgers = Math.floor((end.getTime() - Date.now()) / 5000);
    if (durationLedgers <= 0) {
      showToast("End date must be in the future.", "error");
      return;
    }

    setIsSubmittingProposal(true);
    try {
      showToast("Submitting proposal via smart contract... Approve it in your wallet or with your passkey.", "info");
      const passphrase = NETWORK_CONFIGS[network].passphrase;
      await createDaoProposal(
        walletAddress,
        description.trim(),
        { actionType, value: numericValue || 0, region: region.trim(), oracle: oracle.trim(), oracleActive },
        durationLedgers,
        network,
        xdr => signWithFreighter(xdr, passphrase)
      );

      capturePostHogEvent('governance_proposal_submitted', {
        action_type: actionType,
        network,
      });
      showToast("Proposal confirmed on-chain!", "success");
      setShowCreateModal(false);
      setProposalForm(f => ({ ...f, description: '', value: '', region: '', oracle: '', endDate: '' }));
      refreshGovernance();
    } catch (e) {
      console.error("Create proposal failed", e);
      showToast(
        isUserRejection(e) ? "Proposal cancelled in wallet." : describeDaoError(e) ?? "Failed to create proposal. Check console for details.",
        "error"
      );
    } finally {
      setIsSubmittingProposal(false);
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
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Voting Supply</p>
          <div className="text-3xl font-black text-white">{votingSupply === null ? '—' : formatShares(votingSupply)}</div>
          <div className="text-xs text-emerald-400 font-bold mt-2 flex items-center gap-1">
            <Activity size={12} /> vTYFI · total LP shares in the vault
          </div>
        </div>

        <div className="glass-panel p-6 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Vote size={48} />
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Active Proposals</p>
          <div className="text-3xl font-black text-white">{proposals.filter(p => p.status === 'Active').length}</div>
          <div className="text-xs text-sky-400 font-bold mt-2">Voting in progress</div>
        </div>

        <div className="glass-panel p-6 border border-white/5 relative overflow-hidden group md:col-span-2 bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
          <div className="flex justify-between items-center h-full">
            <div>
              <p className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-1">Your Voting Power</p>
              <div className="text-4xl font-black text-white mb-1">{walletAddress ? votingPower : '0'} <span className="text-lg text-indigo-300">vTYFI</span></div>
              <p className="text-xs text-indigo-200/60">
                Read dynamically from LP Shares contract{daoRole ? ` · Role: ${daoRole}` : ''}
              </p>
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
              {(['all', 'active', 'passed', 'executed', 'failed'] as const).map(f => (
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
                const status = proposal.status ?? 'Active';
                const isActive = status === 'Active';
                const totalVotes = proposal.votesFor + proposal.votesAgainst;
                const forPercent = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
                const quorumPercent = proposal.quorumRequired
                  ? Math.min(100, (totalVotes / proposal.quorumRequired) * 100)
                  : 100;

                return (
                  <div key={proposal.id} className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-sky-500/30 transition-all group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="text-xs font-black text-slate-500 uppercase">TIP-{proposal.id}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[status].className}`}>
                            {STATUS_STYLES[status].label}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {describeAction(proposal)}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2 leading-tight pr-12">{proposal.description}</h3>
                        <p className="text-xs font-mono text-slate-500 break-all">By {proposal.creator}</p>
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
                        <span className="text-emerald-400">For: {formatShares(proposal.votesFor)} vTYFI</span>
                        <span className="text-rose-400">Against: {formatShares(proposal.votesAgainst)} vTYFI</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-rose-500/20 overflow-hidden flex">
                        <div className="h-full bg-emerald-500" style={{ width: `${forPercent}%` }}></div>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <span>
                          Quorum {quorumPercent.toFixed(0)}% ({formatShares(totalVotes)} / {formatShares(proposal.quorumRequired ?? 0)})
                        </span>
                        <span>Needs {((proposal.requiredThresholdBps ?? 5001) / 100).toFixed(0)}% for</span>
                      </div>
                    </div>

                    {isActive && proposal.myVote && (
                      <div className={`mt-6 pt-6 border-t border-white/5 text-xs font-black uppercase tracking-wider flex items-center gap-2 ${
                        proposal.myVote === 'for' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        <CheckCircle2 size={16} /> You voted {proposal.myVote}
                      </div>
                    )}

                    {isActive && !proposal.myVote && (
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

                    {status === 'TimelockPending' && (
                      <div className="mt-6 pt-6 border-t border-white/5 text-xs font-bold text-indigo-300 flex items-center gap-2">
                        <Clock size={14} /> Passed — can be applied to the vault once the timelock ends.
                      </div>
                    )}

                    {status === 'Passed' && (
                      <div className="mt-6 pt-6 border-t border-white/5">
                        {canExecute ? (
                          <button
                            onClick={() => handleFinalize(proposal.id)}
                            disabled={finalizingId !== null}
                            className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black uppercase tracking-wider text-xs transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                          >
                            {finalizingId === proposal.id
                              ? <><Loader2 size={16} className="animate-spin" /> Applying to vault…</>
                              : <><ShieldCheck size={16} /> Finalize &amp; apply to vault</>}
                          </button>
                        ) : (
                          <p className="text-xs font-bold text-slate-400">Timelock over — waiting for a DAO executor to apply it to the vault.</p>
                        )}
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
                  value={proposalForm.description}
                  onChange={e => setProposalForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-sky-500 outline-none"
                  rows={3}
                  placeholder="Describe your proposal..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Action Type</label>
                <div className="relative">
                  <select 
                    value={proposalForm.actionType}
                    onChange={e => setProposalForm(f => ({ ...f, actionType: e.target.value as DaoActionType, value: '' }))}
                    className="w-full appearance-none bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none cursor-pointer"
                  >
                    {ACTION_OPTIONS.map(a => (
                      <option key={a.value} value={a.value}>
                        {a.label}{DAO_ADMIN_ONLY_ACTIONS.includes(a.value) ? ' (admin only)' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              {proposalForm.actionType === 'UpdatePremiumRate' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Region</label>
                  <input
                    list="dao-region-options"
                    value={proposalForm.region}
                    onChange={e => setProposalForm(f => ({ ...f, region: e.target.value }))}
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                    placeholder="e.g. Central Luzon"
                  />
                  <datalist id="dao-region-options">
                    {PHILIPPINE_REGIONS.map(r => <option key={r.name} value={r.name} />)}
                  </datalist>
                </div>
              )}

              {selectedAction.valueLabel && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{selectedAction.valueLabel}</label>
                  <input
                    type="number"
                    min={selectedAction.min}
                    max={selectedAction.max}
                    step={1}
                    value={proposalForm.value}
                    onChange={e => setProposalForm(f => ({ ...f, value: e.target.value }))}
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                    placeholder={`${selectedAction.min}–${selectedAction.max}`}
                  />
                  {selectedAction.hint && <p className="text-[11px] text-slate-500 mt-1">{selectedAction.hint}</p>}
                </div>
              )}

              {proposalForm.actionType === 'RegisterOracle' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Oracle Address</label>
                    <input
                      value={proposalForm.oracle}
                      onChange={e => setProposalForm(f => ({ ...f, oracle: e.target.value }))}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white font-mono text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                      placeholder="G..."
                    />
                  </div>
                  <div className="flex gap-2">
                    {[true, false].map(active => (
                      <button
                        key={String(active)}
                        type="button"
                        onClick={() => setProposalForm(f => ({ ...f, oracleActive: active }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider border transition-all ${
                          proposalForm.oracleActive === active
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            : 'text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {active ? 'Register' : 'Remove'}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Voting Ends On (Month, Day, Year)</label>
                <div className="relative">
                  <input 
                    type="date"
                    value={proposalForm.endDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={e => setProposalForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {walletAddress && !canProposeSelected && (
                <p className="text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  {DAO_ADMIN_ONLY_ACTIONS.includes(proposalForm.actionType)
                    ? 'Only DAO admins can propose this action.'
                    : 'You need the Proposer role or LP shares in the vault to create proposals.'}
                </p>
              )}

              <button 
                onClick={handleCreateProposal}
                disabled={isSubmittingProposal}
                className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-2"
              >
                {isSubmittingProposal && <Loader2 size={16} className="animate-spin" />}
                Submit Proposal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
