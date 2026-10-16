import {
  StellarWalletsKit,
  Networks as SWKNetworks,
  SwkAppDarkTheme,
} from '@creit.tech/stellar-wallets-kit';
export { StellarWalletsKit };
import { FreighterModule, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule, ALBEDO_ID } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { WalletConnectModule, WALLET_CONNECT_ID } from '@creit.tech/stellar-wallets-kit/modules/wallet-connect';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr';
import { HanaModule } from '@creit.tech/stellar-wallets-kit/modules/hana';
import { RabetModule } from '@creit.tech/stellar-wallets-kit/modules/rabet';

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
import { getRelayerConfig, hostFunctionOf, invokeWithPasskey, loadPasskeySession } from "./passkey";
import { analytics, type TxAction, type TxEventContext, type TxStage, type VaultDepositInitiatedProps } from "./analytics";

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
    vaultContractId: 'CARODUWJWUBI5UPKQCAVGT7GXKJN65ZDVEOPSYCWPBGC6F5MYQJXCQZR',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    passphrase: Networks.TESTNET,
    daoContractId: 'CB3A3IZMHF7EUM75CP5FFA6XZNABLRZAT5JL6XC4SZX3FWGRVMQM6KPY', // Week 2 testnet DAO (see contracts/deployments/testnet.json)
  },
  mainnet: {
    name: 'Mainnet',
    xlmTokenId: 'CAS3J7AVONGEJ757545DG5TZAT24DQZGX357FBCT6UW674ATCQZ3E367',
    vaultContractId: 'CAQCA3H4UIGESIJZE3LF7TYKQY6TBQV2OQ7OVBRRRRIARX5JOTXZUNVT',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://mainnet.sorobanrpc.com',
    passphrase: Networks.PUBLIC,
    daoContractId: 'CCSOWCGXDJSZJ3TLQOHHIC5YKD6XLF2WOSIZE5FLNDTXB73J76TXLDAO', // Deployed Mainnet DAO
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
        new xBullModule(),
        new LobstrModule(),
        new HanaModule(),
        new RabetModule(),
        ...(wcProjectId ? [
          new WalletConnectModule({
            projectId: wcProjectId,
            metadata: {
              name: "TyFi Vault",
              description: "Parametric Agricultural Insurance Protocol",
              // Must match the page origin or WalletConnect warns and wallets may reject the session.
              url: window.location.origin,
              icons: [`${window.location.origin}/logo.svg`]
            }
          })
        ] : [])
      ]
    });
    StellarWalletsKit.setTheme(SwkAppDarkTheme);
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

/**
 * Let the user pick any supported wallet from the Stellar Wallets Kit's own
 * modal. Returns the address and the chosen module id (persist it so
 * connectWallet can reconnect silently later). Rejects with
 * WALLET_MODAL_CLOSED if the user dismisses the modal.
 */
export const connectWithKitModal = async (network: 'testnet' | 'mainnet' = 'testnet') => {
  initKit(network);
  let address: string;
  try {
    ({ address } = await StellarWalletsKit.authModal());
  } catch (error) {
    // The kit rejects with a plain { code, message } object, not an Error.
    const { code, message } = (error ?? {}) as { code?: number; message?: string };
    if (code === -1 && /closed the modal/i.test(String(message))) {
      throw new Error('WALLET_MODAL_CLOSED', { cause: error });
    }
    throw new Error(String(message ?? error ?? 'Failed to connect wallet.'), { cause: error });
  }
  const walletId = StellarWalletsKit.selectedModule.productId;
  currentWalletId = walletId;
  currentUserAddress = address;
  return { address, walletId };
};

export const signTx = async (xdrString: string, network: 'testnet' | 'mainnet') => {
  initKit(network);
  const signResult = await StellarWalletsKit.signTransaction(xdrString, {
    address: currentUserAddress,
    networkPassphrase: NETWORK_CONFIGS[network].passphrase
  });
  return signResult.signedTxXdr;
};

// ─── Tracked Soroban Transaction Pipeline ────────────────────────────────────
// Every vault and DAO write goes through executeTrackedTx so the analytics funnel
// (initiated → signed → confirmed / failed) is captured consistently.

const TX_POLL_INTERVAL_MS = 2000;
const TX_POLL_MAX_ATTEMPTS = 45; // ~90s before giving up on confirmation

const DEPOSIT_TYPE_BY_ACTION: Partial<Record<TxAction, VaultDepositInitiatedProps['deposit_type']>> = {
  subscribe_policy: 'parametric_policy',
  deposit_reinsurance: 'reinsurance_pool',
  deposit_subsidy: 'premium_subsidy',
};

export interface TrackedTxMeta {
  action: TxAction;
  network: 'testnet' | 'mainnet';
  walletAddress: string;
  /** Defaults to the vault contract. */
  contractId?: string;
  amountXlm?: number;
  region?: string;
  season?: string;
  /** Extra context attached to the signed / confirmed / failed events. */
  context?: TxEventContext;
  /** Defaults to the connected wallets-kit wallet. */
  sign?: (xdr: string) => Promise<string>;
}

const txError = (message: string, code: string) => Object.assign(new Error(message), { code });

// Freighter / wallets-kit surface rejections as messages like "User declined access"
// or "The user rejected this request" (Freighter API code -4).
export const isUserRejection = (error: any) =>
  error?.code === -4 ||
  error?.name === 'NotAllowedError' ||
  /reject|declin|denied|cancel|not allowed/i.test(String(error?.message ?? error ?? ''));

export const executeTrackedTx = async (
  meta: TrackedTxMeta,
  buildTx: (server: rpc.Server, config: NetworkConfig) => Promise<Transaction>
): Promise<string> => {
  const config = NETWORK_CONFIGS[meta.network];
  const server = new rpc.Server(config.sorobanRpcUrl);
  const contractId = meta.contractId ?? config.vaultContractId;
  const context = meta.context ?? {};
  let stage: TxStage = 'simulation';

  const depositType = DEPOSIT_TYPE_BY_ACTION[meta.action];
  if (depositType) {
    analytics.trackVaultDepositInitiated({
      deposit_type: depositType,
      amount_xlm: meta.amountXlm,
      region: meta.region,
      season: meta.season,
      network: meta.network,
    });
  }

  try {
    // Seedless passkey wallets: authorize with a device biometric and submit
    // through the fee-sponsoring relayer instead of an extension signature.
    const passkey = loadPasskeySession();
    if (passkey && passkey.walletAddress === meta.walletAddress) {
      if (meta.network !== 'testnet') {
        throw new Error('Passkey wallets are available on testnet only for now.');
      }
      const relayer = await getRelayerConfig();
      // Contract builders call server.getAccount(user); a smart wallet has no
      // classic account, so the sponsor stands in as the (fee-paying) source.
      const sponsorSourced = Object.create(server, {
        getAccount: { value: () => server.getAccount(relayer.sponsor) },
      }) as rpc.Server;
      const tx = await buildTx(sponsorSourced, config);

      const result = await invokeWithPasskey(passkey, hostFunctionOf(tx), next => {
        if (next === 'submission') {
          analytics.trackTransactionSigned({ ...context, action: meta.action, contract_id: contractId, wallet_address: meta.walletAddress, network: meta.network });
        }
        stage = next;
      });
      stage = 'on_chain_confirmation';
      analytics.trackTransactionConfirmed({
        ...context,
        tx_hash: result.hash,
        action: meta.action,
        amount_xlm: meta.amountXlm,
        sponsored_fee: true,
        sponsor_provider: 'tyfi_relayer',
        ledger_sequence: result.ledger,
        network: meta.network,
      });
      return result.hash;
    }

    const preparedTx = await server.prepareTransaction(await buildTx(server, config)) as Transaction;

    stage = 'wallet_signing';
    console.log(`[${config.name}] Requesting signature for: ${meta.action}`);
    const signedXdr = meta.sign
      ? await meta.sign(preparedTx.toXDR())
      : await signTx(preparedTx.toXDR(), meta.network);
    analytics.trackTransactionSigned({
      ...context,
      action: meta.action,
      contract_id: contractId,
      wallet_address: meta.walletAddress,
      network: meta.network,
    });

    stage = 'submission';
    const transaction = TransactionBuilder.fromXDR(signedXdr, config.passphrase) as Transaction;
    const result = await server.sendTransaction(transaction);
    if (result.status !== "PENDING") {
      throw txError(`Transaction failed: ${JSON.stringify(result)}`, `SEND_${result.status}`);
    }

    stage = 'on_chain_confirmation';
    for (let attempt = 0; attempt < TX_POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, TX_POLL_INTERVAL_MS));
      const txResult = await server.getTransaction(result.hash);
      if (txResult.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        console.log(`[${config.name}] ${meta.action} confirmed. Hash: ${result.hash}`);
        analytics.trackTransactionConfirmed({
          ...context,
          tx_hash: result.hash,
          action: meta.action,
          amount_xlm: meta.amountXlm,
          sponsored_fee: false,
          sponsor_provider: 'none',
          ledger_sequence: txResult.ledger,
          network: meta.network,
        });
        return result.hash;
      }
      if (txResult.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw txError(`Transaction failed: ${txResult.status}`, 'TX_FAILED');
      }
    }
    throw txError(`Transaction not confirmed after ${(TX_POLL_INTERVAL_MS * TX_POLL_MAX_ATTEMPTS) / 1000}s: ${result.hash}`, 'CONFIRMATION_TIMEOUT');
  } catch (error: any) {
    const userRejected = stage === 'wallet_signing' && isUserRejection(error);
    analytics.trackTransactionFailed({
      ...context,
      action: meta.action,
      stage,
      error_code: userRejected ? 'USER_REJECTED' : (error?.code ?? `${stage.toUpperCase()}_ERROR`),
      error_message: String(error?.message ?? error),
      user_rejected: userRejected,
      network: meta.network,
    });
    throw error;
  }
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
    await executeTrackedTx(
      { action: 'subscribe_policy', network, walletAddress: farmer, region, season },
      async (server, config) => {
        // subscribe(farmer, farm_id, region, season, premium)
        const account = await server.getAccount(farmer);
        const contract = new Contract(config.vaultContractId);
        return new TransactionBuilder(account, { fee: '1000000', networkPassphrase: config.passphrase })
          .addOperation(
            contract.call(
              "subscribe",
              Address.fromString(farmer).toScVal(),
              xdr.ScVal.scvSymbol(sanitizeSymbol(farmId)),
              xdr.ScVal.scvSymbol(sanitizeSymbol(region)),
              xdr.ScVal.scvSymbol(sanitizeSymbol(season)),
              nativeToScVal(BigInt(cropValue), { type: 'i128' })
            )
          )
          .setTimeout(300)
          .build();
      }
    );
    return true;
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
    await executeTrackedTx(
      { action: 'submit_weather_report', network, walletAddress: oracle, region },
      async (server, config) => {
        const account = await server.getAccount(oracle);
        const contract = new Contract(config.vaultContractId);
        return new TransactionBuilder(account, { fee: '1000000', networkPassphrase: config.passphrase })
          .addOperation(
            contract.call(
              "submit_weather_report",
              Address.fromString(oracle).toScVal(),
              nativeToScVal(sanitizeSymbol(typhoonId), { type: 'symbol' }),
              nativeToScVal(sanitizeSymbol(region), { type: 'symbol' }),
              nativeToScVal(damagePercentage, { type: 'u32' }),
              nativeToScVal(windSpeed, { type: 'u32' })
            )
          )
          .setTimeout(300)
          .build();
      }
    );
    return true;
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
    console.log(`[${NETWORK_CONFIGS[network].name}] Claiming payout on chain for farm ${farmId}...`);
    return await executeTrackedTx(
      { action: 'claim_payout', network, walletAddress: farmer, amountXlm: amount, season },
      async (server, config) => {
        const farmerAddress = Address.fromString(farmer);
        const contract = new Contract(config.vaultContractId);
        const account = await server.getAccount(farmer);
        const operation = network === 'testnet'
          ? contract.call(
              "testnet_claim_payout",
              farmerAddress.toScVal(),
              nativeToScVal(BigInt(Math.floor(amount * 10000000)), { type: 'i128' })
            )
          : contract.call(
              "claim_payout",
              farmerAddress.toScVal(),
              xdr.ScVal.scvSymbol(sanitizeSymbol(farmId)),
              xdr.ScVal.scvSymbol(sanitizeSymbol(season)),
              xdr.ScVal.scvSymbol(sanitizeSymbol(typhoonId))
            );
        return new TransactionBuilder(account, { fee: '1000000', networkPassphrase: config.passphrase })
          .addOperation(operation)
          .setTimeout(300)
          .build();
      }
    );
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
        fee: '1000000',
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
        fee: '1000000',
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
    const txShares = new TransactionBuilder(dummyAccount, { fee: '1000000', networkPassphrase: config.passphrase })
      .addOperation(contract.call("get_lp_shares", userAddr.toScVal()))
      .setTimeout(300).build();
    
    // 2. Get total shares
    const txTotalShares = new TransactionBuilder(dummyAccount, { fee: '1000000', networkPassphrase: config.passphrase })
      .addOperation(contract.call("get_total_reinsurance_shares"))
      .setTimeout(300).build();

    // 3. Get total deposited (XLM)
    const txTotalDeposited = new TransactionBuilder(dummyAccount, { fee: '1000000', networkPassphrase: config.passphrase })
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
        { fee: '1000000', networkPassphrase: config.passphrase }
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
            { fee: '1000000', networkPassphrase: config.passphrase }
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
  walletAddress: string,
  sign?: (xdr: string) => Promise<string>
): Promise<string> {
  if (!walletAddress) throw new Error('Wallet not connected');
  const config = NETWORK_CONFIGS[network];

  return executeTrackedTx(
    {
      action: 'dao_vote',
      network,
      walletAddress,
      contractId: config.daoContractId,
      context: { proposal_id: proposalId, vote: support ? 'for' : 'against' },
      sign,
    },
    async (server) => {
      const account = await server.getAccount(walletAddress);
      return new TransactionBuilder(account, { fee: '1000000', networkPassphrase: config.passphrase })
        .addOperation(
          new Contract(config.daoContractId).call(
            'vote',
            nativeToScVal(Address.fromString(walletAddress), { type: 'address' }),
            nativeToScVal(proposalId, { type: 'u64' }),
            xdr.ScVal.scvBool(support)
          )
        )
        .setTimeout(300)
        .build();
    }
  );
};

// ─── TyFi DAO (Week 2 contract) ──────────────────────────────────────────────

/** Mirrors the contract's ActionType enum (contracts/tyfi_dao/src/lib.rs). */
export type DaoActionType = 'UpdatePremiumRate' | 'UpdateQuorumThreshold' | 'UpdateSolvencyCap' | 'RegisterOracle';

/** Mirrors the contract's ProposalStatus enum. */
export type DaoProposalStatus = 'Active' | 'Passed' | 'Failed' | 'TimelockPending' | 'Executed' | 'Vetoed';

export type DaoRole = 'Proposer' | 'Voter' | 'Executor' | 'Admin';

/** Actions the contract restricts to the Admin role. */
export const DAO_ADMIN_ONLY_ACTIONS: DaoActionType[] = ['UpdateSolvencyCap', 'RegisterOracle'];

/** LP shares (stroops) needed to propose without the Proposer role (MIN_PROPOSAL_SHARES). */
export const DAO_MIN_PROPOSAL_SHARES = 1_000;

export interface DaoProposalParams {
  actionType: DaoActionType;
  /** Multiplier 1–1000 (premium rate), threshold 1–100 (quorum) or bps 100–9500 (solvency cap). */
  value?: number;
  /** Region symbol for UpdatePremiumRate. */
  region?: string;
  /** Oracle address and active flag for RegisterOracle. */
  oracle?: string;
  oracleActive?: boolean;
}

const DAO_ERROR_MESSAGES: Record<number, string> = {
  1: 'The DAO is already initialized.',
  2: 'The DAO contract is not initialized.',
  3: 'You are not authorized to do this.',
  4: 'This proposal does not exist.',
  5: 'Voting on this proposal has ended.',
  6: 'Voting on this proposal is still in progress.',
  7: 'You have already voted on this proposal.',
  8: 'You have no voting power. Provide liquidity in the Vault tab to earn LP shares, then vote.',
  9: 'This proposal has already been executed.',
  10: 'This proposal did not pass.',
  11: 'This proposal did not reach quorum.',
  12: 'This proposal is still in its timelock period.',
  13: 'This proposal was vetoed.',
  14: 'Your wallet does not have the role (or LP shares) required for this proposal type.',
  15: 'The proposal value is outside the allowed range.',
  16: 'The DAO could not apply this change to the vault.',
  17: 'The voting period must be longer than zero.',
};

/** Turns a DaoError (surfaced as "Error(Contract, #N)") into a readable message, or null. */
export const describeDaoError = (error: any): string | null => {
  const match = String(error?.message ?? error ?? '').match(/Error\(Contract, #(\d+)\)/);
  return match ? DAO_ERROR_MESSAGES[Number(match[1])] ?? null : null;
};

/** Soroban encodes unit enum variants as a single-element vec holding the variant symbol. */
const enumVariant = (name: string) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(name)]);

/**
 * Create a DAO proposal. durationLedgers is the voting window (1 ledger ≈ 5s).
 */
export async function createDaoProposal(
  walletAddress: string,
  description: string,
  params: DaoProposalParams,
  durationLedgers: number,
  network: 'testnet' | 'mainnet',
  sign?: (xdr: string) => Promise<string>
): Promise<string> {
  if (!walletAddress) throw new Error('Wallet not connected');
  const config = NETWORK_CONFIGS[network];
  // Unused payload fields still need valid values: empty symbol, creator address, 0.
  const region = params.actionType === 'UpdatePremiumRate' ? sanitizeSymbol(params.region ?? '') : '';
  const oracle = params.actionType === 'RegisterOracle' && params.oracle ? params.oracle : walletAddress;

  return executeTrackedTx(
    {
      action: 'dao_create_proposal',
      network,
      walletAddress,
      contractId: config.daoContractId,
      context: { proposal_action: params.actionType, voting_duration_ledgers: durationLedgers },
      sign,
    },
    async (server) => {
      const account = await server.getAccount(walletAddress);
      return new TransactionBuilder(account, { fee: '1000000', networkPassphrase: config.passphrase })
        .addOperation(
          new Contract(config.daoContractId).call(
            'create_proposal',
            nativeToScVal(Address.fromString(walletAddress), { type: 'address' }),
            nativeToScVal(description, { type: 'string' }),
            enumVariant(params.actionType),
            nativeToScVal(params.value ?? 0, { type: 'u32' }),
            xdr.ScVal.scvSymbol(region),
            nativeToScVal(Address.fromString(oracle), { type: 'address' }),
            nativeToScVal(params.oracleActive ? 1 : 0, { type: 'u32' }),
            nativeToScVal(durationLedgers, { type: 'u64' })
          )
        )
        .setTimeout(300)
        .build();
    }
  );
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
  let methodName: 'deposit_subsidy' | 'deposit_reinsurance' | 'withdraw_reinsurance' = 'deposit_subsidy';
  if (type === 'lp') {
    methodName = stakingMode === 'withdraw' ? 'withdraw_reinsurance' : 'deposit_reinsurance';
  }

  try {
    return await executeTrackedTx(
      { action: methodName, network, walletAddress: user, amountXlm: amount },
      async (server, config) => {
        const userAddress = Address.fromString(user);
        const contract = new Contract(config.vaultContractId);

        let valToPass = BigInt(Math.floor(amount * 10000000)); // Default to stroops

        if (methodName === 'withdraw_reinsurance') {
          const dummyAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
          const txShares = new TransactionBuilder(dummyAccount, { fee: '1000000', networkPassphrase: config.passphrase })
            .addOperation(contract.call("get_total_reinsurance_shares"))
            .setTimeout(300).build();
          const txDep = new TransactionBuilder(dummyAccount, { fee: '1000000', networkPassphrase: config.passphrase })
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
        return new TransactionBuilder(account, { fee: '1000000', networkPassphrase: config.passphrase })
          .addOperation(
            contract.call(
              methodName,
              userAddress.toScVal(),
              nativeToScVal(valToPass, { type: 'i128' })
            )
          )
          .setTimeout(300)
          .build();
      }
    );
  } catch (error: any) {
    console.error(`[${network.toUpperCase()}] Blockchain liquidity error:`, error?.message || JSON.stringify(error) || error);
    throw error;
  }
};

