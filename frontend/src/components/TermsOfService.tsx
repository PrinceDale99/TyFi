import React from 'react';

export const TermsOfService = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto bg-white rounded-xl shadow-md">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Terms of Service & Regulatory Compliance</h1>
      
      <div className="space-y-6 text-gray-600">
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">1. Nature of the Protocol</h2>
          <p>
            TyFi operates as a <strong>Parametric Weather Derivative</strong> platform. It is strictly <strong>not an insurance policy</strong> under the jurisdiction of the Insurance Commission (IC). Payments made by farmers are classified as <strong>Contingency Fees</strong>, not premiums. Payouts are entirely algorithmic and triggered by external meteorological oracles, independent of actual physical loss adjustments.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">2. Yield and Liquidity Provision</h2>
          <p>
            All yield generated for Liquidity Providers (LPs) is exclusively sourced from short-term Sovereign Bonds via licensed partners (e.g., PDAX Securities). TyFi does not engage in unregulated DeFi Staking or speculative token lending. By providing liquidity, you acknowledge that your capital is backing weather derivatives.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">3. Cross-Border Remittances & Capital Controls</h2>
          <p>
            All cross-border payouts (e.g., to Vietnam, Indonesia) are processed via licensed Electronic Money Issuers (EMIs). Users do not interact directly with unregulated crypto assets. The protocol automatically off-ramps USDC/XLM via our CaaS (Crypto-as-a-Service) partners before reaching your local fiat bank account.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">4. Data Privacy (NPC Compliance)</h2>
          <p>
            To comply with the Data Privacy Act, sensitive PII (e.g., RSBSA IDs, Land Titles) is processed using ephemeral storage. Once identity verification is completed, raw documents are permanently purged, and only a non-reversible cryptographic hash is retained on-chain for identity binding.
          </p>
        </section>
      </div>
    </div>
  );
};
