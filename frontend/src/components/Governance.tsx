import React, { useState } from 'react';

export const Governance = () => {
  const [votingPower, setVotingPower] = useState<number>(0);
  const [proposals, setProposals] = useState<any[]>([
    {
      id: 1,
      description: "Increase Visayas Risk Zone Premium Multiplier to 120%",
      votesFor: 15000,
      votesAgainst: 2000,
      deadline: "2027-01-15",
      executed: false
    }
  ]);

  const handleVote = (proposalId: number, support: boolean) => {
    // In production, this would call Soroban tyfi_dao contract's vote function
    console.log(`Voted ${support ? 'FOR' : 'AGAINST'} proposal ${proposalId}`);
    alert(`Vote recorded for proposal ${proposalId}`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-xl shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold">TyFi Climate DAO Governance</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-4">
            Participate in decentralized governance using your active Vault Liquidity Provide (LP) shares.
            No tokens are required. 1 LP Share = 1 Vote.
          </p>
          <div className="bg-blue-50 p-4 rounded-md mb-6">
            <h3 className="font-semibold text-blue-800">Your Voting Power</h3>
            <p className="text-2xl font-bold text-blue-900">{votingPower} Votes</p>
            <button className="mt-4 px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-100" onClick={() => setVotingPower(500)}>
              Simulate Load LP Shares
            </button>
          </div>

          <h3 className="text-lg font-semibold mb-4">Active Proposals</h3>
          <div className="space-y-4">
            {proposals.map(p => (
              <div key={p.id} className="p-4 border border-gray-200 rounded-lg shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">Proposal #{p.id}</h4>
                    <p>{p.description}</p>
                    <p className="text-sm text-gray-500 mt-2">Deadline: {p.deadline}</p>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className="text-green-600">For: {p.votesFor}</span>
                      <span className="text-red-600">Against: {p.votesAgainst}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => handleVote(p.id, true)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                      Vote For
                    </button>
                    <button onClick={() => handleVote(p.id, false)} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                      Vote Against
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

