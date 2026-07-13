import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { getDaoProposals, voteOnDaoProposal, getVaultLpShares, DaoProposal } from '../lib/stellar';

export const Governance = () => {
  const { address, network } = useWallet();
  const [votingPower, setVotingPower] = useState<number>(0);
  const [proposals, setProposals] = useState<DaoProposal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [address, network]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load real proposals from the network
      const onChainProposals = await getDaoProposals(network);
      setProposals(onChainProposals);

      // Load real voting power
      if (address) {
        const shares = await getVaultLpShares(address, network);
        setVotingPower(shares);
      } else {
        setVotingPower(0);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load DAO data from the network.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (proposalId: number, support: boolean) => {
    if (!address) {
      alert("Please connect your wallet to vote.");
      return;
    }
    if (votingPower <= 0) {
      alert("You need active LP shares in the vault to vote.");
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      await voteOnDaoProposal(proposalId, support, network);
      alert(`Vote successfully recorded on-chain for proposal ${proposalId}!`);
      await loadData(); // Refresh UI
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit vote.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-xl shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold">TyFi Climate DAO Governance</h2>
          <button 
            onClick={loadData} 
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-4">
            Participate in decentralized governance using your active Vault Liquidity Provider (LP) shares.
            No tokens are required. 1 LP Share = 1 Vote.
          </p>
          
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6 border border-red-200">
              {error}
            </div>
          )}

          <div className="bg-blue-50 p-4 rounded-md mb-6">
            <h3 className="font-semibold text-blue-800">Your Real-time Voting Power</h3>
            <p className="text-2xl font-bold text-blue-900">{votingPower} Votes</p>
            {!address && <p className="text-sm text-blue-600 mt-1">Connect your wallet to view your voting power.</p>}
          </div>

          <h3 className="text-lg font-semibold mb-4">Active Proposals (On-Chain)</h3>
          <div className="space-y-4">
            {proposals.length === 0 ? (
              <p className="text-gray-500 italic">No active proposals found on the {network.toUpperCase()} network.</p>
            ) : (
              proposals.map(p => (
                <div key={p.id} className={`p-4 border rounded-lg shadow-sm ${p.executed ? 'bg-gray-50 border-gray-200' : 'border-blue-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">Proposal #{p.id} {p.executed && <span className="ml-2 text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">Executed</span>}</h4>
                      <p className="mt-1">{p.description}</p>
                      <p className="text-sm text-gray-500 mt-2">Deadline: Ledger #{p.deadline}</p>
                      <div className="flex gap-4 mt-2 text-sm font-medium">
                        <span className="text-green-600">For: {p.votesFor}</span>
                        <span className="text-red-600">Against: {p.votesAgainst}</span>
                      </div>
                    </div>
                    {!p.executed && (
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => handleVote(p.id, true)} 
                          disabled={isLoading}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          Vote For
                        </button>
                        <button 
                          onClick={() => handleVote(p.id, false)} 
                          disabled={isLoading}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Vote Against
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


