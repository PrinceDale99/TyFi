import {
  StellarWalletsKit,
  Networks as SWKNetworks,
} from '@creit.tech/stellar-wallets-kit';
export { StellarWalletsKit };
import { FreighterModule, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule, ALBEDO_ID } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { WalletConnectModule, WALLET_CONNECT_ID } from '@creit.tech/stellar-wallets-kit/modules/wallet-connect';

import {
  Address,
  Contract,
  Networks,
  rpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  scValToNative,
  nativeToScVal,
  Transaction,
  Account,
} from "@stellar/stellar-sdk";

export interface NetworkConfig {
  name: string;
  xlmTokenId: string;
  vaultContractId: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
  passphrase: string;
  daoContractId: string;
}

export const NETWORK_CONFIGS: Record<'testnet' | 'mainnet', NetworkConfig> = {

  testnet: {
    name: 'Testnet',
    xlmTokenId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    vaultContractId: 'CCA7FZTWEJDESXHLOENHB6FV3DN5YZYZDNZWKKUPPP2NGNSJCZ7APEYH',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    passphrase: Networks.TESTNET,
    daoContractId: 'CCNOLKFAVVGPI665RM2OHOFOTRKAGF572IILENIIVXJK37RKNFPX4KKN', // Deployed testnet DAO
  },
  mainnet: {
    name: 'Mainnet',
    xlmTokenId: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
    vaultContractId: 'CAQCA3H4UIGESIJZE3LF7TYKQY6TBQV2OQ7OVBRRRRIARX5JOTXZUNVT',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://soroban-rpc.stellar.org',
    passphrase: Networks.PUBLIC,
    daoContractId: 'CDMYX2V5Y6J34U4GTRU32O65XQ64R7PXZ4E4X7C2WYYU5ZQGQJ3F6E2V', // Will be replaced on mainnet
  }
};

const sanitizeSymbol = (str: string) => {
  return str.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 32);
};

let isKitInitialized = false;
let currentWalletId: string = FREIGHTER_ID;
let currentUserAddress: string = '';

export const initKit = (network: 'testnet' | 'mainnet' = 'testnet') => {
  if (!isKitInitialized) {
    const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
    
    StellarWalletsKit.init({
      selectedWalletId: FREIGHTER_ID,
      network: network === 'mainnet' ? SWKNetworks.PUBLIC : SWKNetworks.TESTNET,
      modules: [
        new FreighterModule(),
        new AlbedoModule(),
        ...(wcProjectId ? [
          new WalletConnectModule({
            projectId: wcProjectId,
            metadata: {
              name: "TyFi Vault",
              description: "Parametric Agricultural Insurance Protocol",
              url: "https://tyfi.vercel.app",
              icons: ["https://tyfi.vercel.app/logo.png"]
            }
          })
        ] : [])
      ]
    });
    isKitInitialized = true;
  } else {
    StellarWalletsKit.setNetwork(network === 'mainnet' ? SWKNetworks.PUBLIC : SWKNetworks.TESTNET);
  }
};

export const connectWallet = async (network: 'testnet' | 'mainnet' = 'testnet', walletId: string = FREIGHTER_ID) => {
  try {
    const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
    if (walletId === WALLET_CONNECT_ID && !wcProjectId) {
      throw new Error(`MISSING_WC_ID`);
    }

    initKit(network);
    StellarWalletsKit.setWallet(walletId);
    
    // Check if the selected wallet extension/app is available (only needed for extensions like Freighter)
    if (walletId !== WALLET_CONNECT_ID && walletId !== ALBEDO_ID) {
      const isAvailable = await StellarWalletsKit.selectedModule.isAvailable();
      if (!isAvailable) {
        throw new Error(`WALLET_NOT_INSTALLED:${walletId}`);
      }
    }

    currentWalletId = walletId;
    // fetchAddress prompts the user to connect (unlike getAddress which gets memory)
    const { address } = await StellarWalletsKit.fetchAddress();
    currentUserAddress = address;
    return address;
  } catch (error: any) {
    console.error("Wallet connection error:", error);
    throw error;
  }
};

export const signTx = async (xdrString: string, network: 'testnet' | 'mainnet') => {
  initKit(network);
  const signResult = await StellarWalletsKit.signTransaction(xdrString, {
    address: currentUserAddress,
    networkPassphrase: NETWORK_CONFIGS[network].passphrase
  });
  return signResult.signedTxXdr;
};

export const registerPolicyOnChain = async (
  farmer: string,
  farmId: string,
  region: string,
  cropValue: number,
  season: string = 'Wet Season 2026',
  network: 'testnet' | 'mainnet' = 'testnet'
) => {
  try {
    const config = NETWORK_CONFIGS[network as 'testnet' | 'mainnet'];
    const server = new rpc.Server(config.sorobanRpcUrl);
    
    // Construct the actual Soroban subscription call:
    // subscribe(farmer, farm_id, region, season, premium)
    const farmerAddress = Address.fromString(farmer);
    const contract = new Contract(config.vaultContractId);
    
    // Build Transaction Envelope
    const account = await server.getAccount(farmer);
    
    // Construct the operation
    const tx = new TransactionBuilder(
      account,
      {
        fee: BASE_FEE,
        networkPassphrase: config.passphrase,
      }
    )
    .addOperation(
      contract.call(
        "subscribe",
        ...[
          farmerAddress.toScVal(),
          xdr.ScVal.scvSymbol(sanitizeSymbol(farmId)),
          xdr.ScVal.scvSymbol(sanitizeSymbol(region)),
          xdr.ScVal.scvSymbol(sanitizeSymbol(season)),
          nativeToScVal(BigInt(cropValue), { type: 'i128' })
        ]
      )
    )
    .setTimeout(300)
    .build();

    const preparedTx = await server.prepareTransaction(tx) as Transaction;

    console.log(`[${config.name}] Requesting signature for: subscribe`);
    const signedXdr = await signTx(preparedTx.toXDR(), network);
    const transaction = TransactionBuilder.fromXDR(signedXdr, config.passphrase) as Transaction;
    const result = await server.sendTransaction(transaction);
    
    if (result.status !== "PENDING") {
      throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
    }

    // Wait for result
    let status: string = result.status;
    let txResult;
    while (status === "PENDING" || status === "NOT_FOUND") {
      await new Promise(r => setTimeout(r, 2000));
      txResult = await server.getTransaction(result.hash);
      status = txResult.status;
    }

    if (status === "SUCCESS") {
      console.log(`[${config.name}] Policy registration completed successfully. Hash: ${result.hash}`);
      return true;
    } else {
      throw new Error(`Transaction failed: ${status}`);
    }
  } catch (error: any) {
    console.error(`[${network.toUpperCase()}] Blockchain registration error:`, error);
    throw error;
  }
};

export const submitWeatherReportOnChain = async (
  oracle: string,
  typhoonId: string,
  region: string,
  damagePercentage: number,
  windSpeed: number = 0,
  network: 'testnet' | 'mainnet' = 'testnet'
) => {
  try {
    const config = NETWORK_CONFIGS[network as 'testnet' | 'mainnet'];
    const server = new rpc.Server(config.sorobanRpcUrl);
    const contract = new Contract(config.vaultContractId);
    const account = await server.getAccount(oracle);

    let tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: config.passphrase })
      .addOperation(
        contract.call(
          "submit_weather_report",
          ...[
            Address.fromString(oracle).toScVal(),
            nativeToScVal(sanitizeSymbol(typhoonId), { type: 'symbol' }),
            nativeToScVal(sanitizeSymbol(region), { type: 'symbol' }),
            nativeToScVal(damagePercentage, { type: 'u32' }),
            nativeToScVal(windSpeed, { type: 'u32' })
          ]
        )
      )
      .setTimeout(300)
      .build();

    const preparedTx = await server.prepareTransaction(tx) as Transaction;
    console.log(`[${config.name}] Requesting signature for Oracle Submission...`);
    const signedXdr = await signTx(preparedTx.toXDR(), network);
    const transaction = TransactionBuilder.fromXDR(signedXdr, config.passphrase) as Transaction;
    const result = await server.sendTransaction(transaction);
    
    if (result.status !== "PENDING") {
      throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
    }

    let status: string = result.status;
    while (status === "PENDING" || status === "NOT_FOUND") {
      await new Promise(r => setTimeout(r, 2000));
      const txResult = await server.getTransaction(result.hash);
      status = txResult.status;
    }

    if (status === "SUCCESS") {
      console.log(`[${config.name}] Oracle submission completed. Hash: ${result.hash}`);
      return true;
    } else {
      throw new Error(`Transaction failed: ${status}`);
    }
  } catch (error: any) {
    console.error(`[${network.toUpperCase()}] Blockchain oracle error:`, error);
    throw error;
  }
};
export const claimPayoutOnChain = async (
  farmer: string, 
  farmId: string, 
  season: string, 
  network: 'testnet' | 'mainnet' = 'testnet',
  typhoonId: string = 'DEFAULT_TYPHOON',
  amount: number = 0
) => {
  try {
    const config = NETWORK_CONFIGS[network as 'testnet' | 'mainnet'];
    const server = new rpc.Server(config.sorobanRpcUrl);
    const farmerAddress = Address.fromString(farmer);
    const contract = new Contract(config.vaultContractId);
    
    console.log(`[${config.name}] Claiming payout on chain for farm ${farmId}...`);
    
    const account = await server.getAccount(farmer);
    let tx;
    if (network === 'testnet') {
      const valToPass = BigInt(Math.floor(amount * 10000000));
      
      const op1 = contract.call(
        "testnet_claim_payout",
        ...[
          farmerAddress.toScVal(),
          nativeToScVal(valToPass, { type: 'i128' })
        ]
      );
      
      tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: config.passphrase })
        .addOperation(op1)
        .setTimeout(300)
        .build();
    } else {
      const operation = contract.call(
        "claim_payout",
        ...[
          farmerAddress.toScVal(),
          xdr.ScVal.scvSymbol(sanitizeSymbol(farmId)),
          xdr.ScVal.scvSymbol(sanitizeSymbol(season)),
          xdr.ScVal.scvSymbol(sanitizeSymbol(typhoonId))
        ]
      );
      
      tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: config.passphrase })
        .addOperation(operation)
        .setTimeout(300)
        .build();
    }

    const preparedTx = await server.prepareTransaction(tx) as Transaction;

    const signedXdr = await signTx(preparedTx.toXDR(), network);
    const transaction = TransactionBuilder.fromXDR(signedXdr, config.passphrase) as Transaction;
    const result = await server.sendTransaction(transaction);
    
    if (result.status !== "PENDING") {
      throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
    }

    let status: string = result.status;
    while (status === "PENDING" || status === "NOT_FOUND") {
      await new Promise(r => setTimeout(r, 2000));
      const txResult = await server.getTransaction(result.hash);
      status = txResult.status;
    }

    if (status === "SUCCESS") {
      console.log(`[${config.name}] Payout successfully disbursed. Hash: ${result.hash}`);
      return result.hash;
    } else {
      throw new Error(`Transaction failed: ${status}`);
    }
  } catch (error) {
    console.error(`[${network.toUpperCase()}] Blockchain claim error:`, error);
    throw error;
  }
};

export const getContractTvl = async (network: 'testnet' | 'mainnet' = 'testnet'): Promise<number> => {
  try {
    const config = NETWORK_CONFIGS[network];
    const server = new rpc.Server(config.sorobanRpcUrl);
    const contract = new Contract(config.vaultContractId);

    // Prepare a simulated call to get_total_reinsurance_deposited
    const dummyAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
    const tx = new TransactionBuilder(
      dummyAccount,
      {
        fee: BASE_FEE,
        networkPassphrase: config.passphrase,
      }
    )
    .addOperation(contract.call("get_total_reinsurance_deposited"))
    .setTimeout(300)
    .build();

    const result = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(result)) {
      const val = result.result?.retval;
      if (val) {
        const nativeVal = scValToNative(val);
        const strVal = typeof nativeVal === 'bigint' ? nativeVal.toString() : 
                      (nativeVal && typeof nativeVal === 'object') ? (nativeVal.low !== undefined ? nativeVal.low.toString() : nativeVal.toString()) : 
                      String(nativeVal);
        const numVal = Number(strVal) / 10000000;
        return isNaN(numVal) ? 0 : numVal;
      }
    }
    return 0;
  } catch (error) {
    console.error("Error fetching TVL from contract:", error);
    return 0;
  }
};

export const getContractSubsidy = async (network: 'testnet' | 'mainnet' = 'testnet'): Promise<number> => {
  try {
    const config = NETWORK_CONFIGS[network];
    const server = new rpc.Server(config.sorobanRpcUrl);
    const contract = new Contract(config.vaultContractId);

    const dummyAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
    const tx = new TransactionBuilder(
      dummyAccount,
      {
        fee: BASE_FEE,
        networkPassphrase: config.passphrase,
      }
    )
    .addOperation(contract.call("get_subsidy_balance"))
    .setTimeout(300)
    .build();

    const result = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(result)) {
      const val = result.result?.retval;
      if (val) {
        const nativeVal = scValToNative(val);
        const strVal = typeof nativeVal === 'bigint' ? nativeVal.toString() : 
                      (nativeVal && typeof nativeVal === 'object') ? (nativeVal.low !== undefined ? nativeVal.low.toString() : nativeVal.toString()) : 
                      String(nativeVal);
        return Number(strVal) / 10000000;
      }
    }
    return 0;
  } catch (error) {
    console.error("Error fetching subsidy balance from contract:", error);
    return 0;
  }
};

export const getUserLpBalance = async (user: string, network: 'testnet' | 'mainnet' = 'testnet'): Promise<number> => {
  try {
    const config = NETWORK_CONFIGS[network];
    const server = new rpc.Server(config.sorobanRpcUrl);
    const contract = new Contract(config.vaultContractId);
    const userAddr = Address.fromString(user);

    // Prepare simulated calls
    const dummyAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
    
    // 1. Get user shares
    const txShares = new TransactionBuilder(dummyAccount, { fee: BASE_FEE, networkPassphrase: config.passphrase })
      .addOperation(contract.call("get_lp_shares", userAddr.toScVal()))
      .setTimeout(300).build();
    
    // 2. Get total shares
    const txTotalShares = new TransactionBuilder(dummyAccount, { fee: BASE_FEE, networkPassphrase: config.passphrase })
      .addOperation(contract.call("get_total_reinsurance_shares"))
      .setTimeout(300).build();

    // 3. Get total deposited (XLM)
    const txTotalDeposited = new TransactionBuilder(dummyAccount, { fee: BASE_FEE, networkPassphrase: config.passphrase })
      .addOperation(contract.call("get_total_reinsurance_deposited"))
      .setTimeout(300).build();

    const [resShares, resTotalShares, resTotalDeposited] = await Promise.all([
      server.simulateTransaction(txShares),
      server.simulateTransaction(txTotalShares),
      server.simulateTransaction(txTotalDeposited)
    ]);

    if (rpc.Api.isSimulationSuccess(resShares) && 
        rpc.Api.isSimulationSuccess(resTotalShares) && 
        rpc.Api.isSimulationSuccess(resTotalDeposited)) {
      
      const shares = BigInt(scValToNative(resShares.result!.retval!));
      const totalShares = BigInt(scValToNative(resTotalShares.result!.retval!));
      const totalDeposited = BigInt(scValToNative(resTotalDeposited.result!.retval!));

      if (totalShares === 0n) return 0;

      // amount = (shares * total_deposited) / total_shares
      const amountStroops = (shares * totalDeposited) / totalShares;
      const val = amountStroops;
      let rawVal: string;
      if (val !== undefined) {
        rawVal = val.toString();
      } else {
        rawVal = "0";
      }
      return Number(rawVal) / 10000000;
    }
    return 0;
  } catch (error) {
    console.error("Error fetching user LP balance:", error);
    return 0;
  }
};

// ---------------------------------------------------------------------------
// DAO Governance Integration
// ---------------------------------------------------------------------------

export interface DaoProposal {
  id: number;
  creator: string;
  description: string;
  votesFor: number;
  votesAgainst: number;
  executed: boolean;
  deadline: number;
}

/**
 * Fetch all active proposals from the DAO contract.
 * Note: Real Soroban apps might use an indexer. This is pure Web3.
 */
export async function getDaoProposals(network: 'testnet' | 'mainnet'): Promise<DaoProposal[]> {
  try {
    const config = NETWORK_CONFIGS[network];
    const server = new rpc.Server(config.sorobanRpcUrl);
    const contract = new Contract(config.daoContractId);

    const countTx = await server.simulateTransaction(
      new TransactionBuilder(
        new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '1'),
        { fee: '100', networkPassphrase: config.passphrase }
      )
      .addOperation(contract.call('get_proposal_count'))
      .setTimeout(30)
      .build()
    );

    const countSuccess = countTx as any;
    if (!rpc.Api.isSimulationSuccess(countTx) || countSuccess.result.retval.switch().name !== 'scvU64') {
      return []; // Return empty if count fails or is missing
    }

    // Safely parse u64 from XDR
    const countVal = countSuccess.result.retval.u64();
    const countStr = typeof countVal === 'bigint' ? countVal.toString() : 
                     (countVal && typeof countVal === 'object' && countVal.low !== undefined) ? countVal.low.toString() : 
                     countVal.toString();
    const count = parseInt(countStr, 10);
    const proposals: DaoProposal[] = [];

    // Fetch each proposal individually (Option A: Pure Web3 approach)
    for (let i = 1; i <= count; i++) {
      try {
        const propTx = await server.simulateTransaction(
          new TransactionBuilder(
            new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '1'),
            { fee: '100', networkPassphrase: config.passphrase }
          )
          .addOperation(contract.call('get_proposal', nativeToScVal(i, { type: 'u64' })))
          .setTimeout(30)
          .build()
        );

        if (rpc.Api.isSimulationSuccess(propTx)) {
          const propSuccess = propTx as any;
          const pMap = propSuccess.result.retval.value() as any[];
          if (pMap && pMap.length) {
            // Unpack struct fields based on TyfiDaoContract DataKey::Proposal order
            let id = i;
            let creator = '';
            let description = '';
            let votesFor = 0;
            let votesAgainst = 0;
            let executed = false;
            let deadline = 0;

            for (const field of pMap) {
              const key = field.key().sym().toString();
              const val = field.val();
              
              if (key === 'id') id = parseInt(val.u64().toString(), 10);
              if (key === 'creator') creator = scValToNative(val);
              if (key === 'description') description = scValToNative(val);
              if (key === 'votes_for') votesFor = parseInt(val.i128().lo().toString(), 10);
              if (key === 'votes_against') votesAgainst = parseInt(val.i128().lo().toString(), 10);
              if (key === 'executed') executed = val.b();
              if (key === 'deadline') deadline = parseInt(val.u64().toString(), 10);
            }

            proposals.push({
              id, creator, description, votesFor, votesAgainst, executed, deadline
            });
          }
        }
      } catch (err) {
        console.error(`Failed to fetch proposal ${i}:`, err);
      }
    }

    return proposals;
  } catch (error) {
    console.error('Error fetching DAO proposals:', error);
    return [];
  }
}

/**
 * Submit a vote for a DAO proposal using Freighter.
 */
export async function voteOnDaoProposal(
  proposalId: number,
  support: boolean,
  network: 'testnet' | 'mainnet',
  walletAddress: string
): Promise<string> {
  const pubKey = walletAddress;
  if (!pubKey) throw new Error('Wallet not connected');

  const config = NETWORK_CONFIGS[network];
  const server = new rpc.Server(config.sorobanRpcUrl);

  const accountResp = await server.getAccount(pubKey);
  const account = new Account(pubKey, (accountResp as any).sequence);

  const contract = new Contract(config.daoContractId);
  const operation = contract.call(
    'vote',
    new Address(pubKey).toScVal(),
    nativeToScVal(proposalId, { type: 'u64' }),
    nativeToScVal(support, { type: 'bool' })
  );

  let tx = new TransactionBuilder(account, {
    fee: '1000', // Baseline fee
    networkPassphrase: config.passphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(simulated)) {
    throw new Error('Simulation failed');
  }

  tx = (rpc as any).assembleTransaction(tx, config.passphrase, simulated).build() as Transaction;

  const signedTxXdr = (await StellarWalletsKit.signTransaction(tx.toXDR(), { 
    address: pubKey, 
    networkPassphrase: config.passphrase 
  })).signedTxXdr;
  const signedTx = TransactionBuilder.fromXDR(signedTxXdr, config.passphrase);

  const sendResponse = await server.sendTransaction(signedTx as Transaction);
  if (sendResponse.status === 'ERROR') {
    throw new Error('Transaction submission failed');
  }

  return sendResponse.hash;
};

export interface LedgerTx {
  hash: string;
  ledger: number;
  createdAt: string;
  sourceAccount: string;
  feePaid: number;
  operationCount: number;
}

export const fetchRecentTransactions = async (network: 'testnet' | 'mainnet' = 'testnet'): Promise<LedgerTx[]> => {
  try {
    const config = NETWORK_CONFIGS[network];
    const url = `${config.horizonUrl}/transactions?limit=8&order=desc`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch transactions from Horizon: ${response.statusText}`);
    }
    const data = await response.json();
    const records = data._embedded?.records || [];
    return records.map((r: any) => ({
      hash: r.hash,
      ledger: r.ledger,
      createdAt: r.created_at,
      sourceAccount: r.source_account,
      feePaid: r.fee_charged || r.fee_paid || 100,
      operationCount: r.operation_count || 1,
    }));
  } catch (error) {
    console.error("Error fetching transactions from Horizon:", error);
    return [];
  }
};

export const contributeLiquidityOnChain = async (
  user: string,
  amount: number,
  type: 'lp' | 'subsidy',
  stakingMode: 'deposit' | 'withdraw' = 'deposit',
  network: 'testnet' | 'mainnet' = 'testnet'
) => {
  try {
    const config = NETWORK_CONFIGS[network as 'testnet' | 'mainnet'];
    const server = new rpc.Server(config.sorobanRpcUrl);
    const userAddress = Address.fromString(user);
    const contract = new Contract(config.vaultContractId);
    
    let methodName = 'deposit_subsidy';
    if (type === 'lp') {
      methodName = stakingMode === 'withdraw' ? 'withdraw_reinsurance' : 'deposit_reinsurance';
    }

    let valToPass = BigInt(Math.floor(amount * 10000000)); // Default to stroops

    if (methodName === 'withdraw_reinsurance') {
      const dummyAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
      const txShares = new TransactionBuilder(dummyAccount, { fee: BASE_FEE, networkPassphrase: config.passphrase })
        .addOperation(contract.call("get_total_reinsurance_shares"))
        .setTimeout(300).build();
      const txDep = new TransactionBuilder(dummyAccount, { fee: BASE_FEE, networkPassphrase: config.passphrase })
        .addOperation(contract.call("get_total_reinsurance_deposited"))
        .setTimeout(300).build();

      const [resShares, resDep] = await Promise.all([
        server.simulateTransaction(txShares),
        server.simulateTransaction(txDep)
      ]);

      if (rpc.Api.isSimulationSuccess(resShares) && rpc.Api.isSimulationSuccess(resDep)) {
        const totalShares = BigInt(scValToNative(resShares.result!.retval!));
        const totalDeposited = BigInt(scValToNative(resDep.result!.retval!));
        if (totalDeposited > 0n) {
          // shares = (amount_stroops * totalShares) / totalDeposited
          valToPass = (valToPass * totalShares) / totalDeposited;
        }
      }
    }

    const account = await server.getAccount(user);
    const tx = new TransactionBuilder(
      account,
      {
        fee: BASE_FEE,
        networkPassphrase: config.passphrase,
      }
    )
    .addOperation(
      contract.call(
        methodName,
        ...[
          userAddress.toScVal(),
          nativeToScVal(valToPass, { type: 'i128' })
        ]
      )
    )
    .setTimeout(300)
    .build();

    const preparedTx = await server.prepareTransaction(tx) as Transaction;

    console.log(`[${config.name}] Requesting signature for: ${methodName}`);
    const signedXdr = await signTx(preparedTx.toXDR(), network);
    const transaction = TransactionBuilder.fromXDR(signedXdr, config.passphrase) as Transaction;
    const result = await server.sendTransaction(transaction);
    
    if (result.status !== "PENDING") {
      throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
    }

    let status: string = result.status;
    let txResult;
    while (status === "PENDING" || status === "NOT_FOUND") {
      await new Promise(r => setTimeout(r, 2000));
      txResult = await server.getTransaction(result.hash);
      status = txResult.status;
    }

    if (status === "SUCCESS") {
      console.log(`[${config.name}] Liquidity operation successful. Hash: ${result.hash}`);
      return result.hash;
    } else {
      throw new Error(`Transaction failed: ${status}`);
    }
  } catch (error) {
    console.error(`[${network.toUpperCase()}] Blockchain liquidity error:`, error);
    throw error;
  }
};

