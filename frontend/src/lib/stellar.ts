import {
  StellarWalletsKit,
  Networks as SWKNetworks,
} from '@creit.tech/stellar-wallets-kit';
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
}

export const NETWORK_CONFIGS: Record<'testnet' | 'mainnet', NetworkConfig> = {

  testnet: {
    name: 'Testnet',
    xlmTokenId: 'CAMB6K2KOVZGEGXX5V7C3QMI6FVLZM7LS5TJOOUX74MFOMP32RCEAYIQ',
    vaultContractId: 'CCN2PKUYBI33EVUW3NUZ57YWY7DW5V7BS4LMDJTWOMYQUJOFHQAQVFJT',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    passphrase: Networks.TESTNET,
  },
  mainnet: {
    name: 'Mainnet',
    xlmTokenId: 'CAS3J7AVONGEJ757545DG5TZAT24DQZGX357FBCT6UW674ATCQZ3E367',
    vaultContractId: 'CAAQCLJ7SF5IP3BHD4OKPLMCDQTEVTRYWEXYBQIGNL6U6ZYIK7HNCHEK',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://soroban-rpc.stellar.org',
    passphrase: Networks.PUBLIC,
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
              url: "https://tyfi.app",
              icons: ["https://tyfi.app/logo.png"]
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
    .setTimeout(30)
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
            nativeToScVal(damagePercentage, { type: 'u32' })
          ]
        )
      )
      .setTimeout(30)
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
  typhoonId: string = 'DEFAULT_TYPHOON'
) => {
  try {
    const config = NETWORK_CONFIGS[network as 'testnet' | 'mainnet'];
    const server = new rpc.Server(config.sorobanRpcUrl);
    const farmerAddress = Address.fromString(farmer);
    const contract = new Contract(config.vaultContractId);
    
    console.log(`[${config.name}] Claiming payout on chain for farm ${farmId}...`);
    
    const account = await server.getAccount(farmer);
    const tx = new TransactionBuilder(
      account,
      {
        fee: BASE_FEE,
        networkPassphrase: config.passphrase,
      }
    )
    .addOperation(
      contract.call(
        "claim_payout",
        ...[
          farmerAddress.toScVal(),
          xdr.ScVal.scvSymbol(sanitizeSymbol(farmId)),
          xdr.ScVal.scvSymbol(sanitizeSymbol(season)),
          xdr.ScVal.scvSymbol(sanitizeSymbol(typhoonId))
        ]
      )
    )
    .setTimeout(30)
    .build();

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
    .setTimeout(30)
    .build();

    const result = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(result)) {
      const val = result.result?.retval;
      if (val) {
        return Number(scValToNative(val)) / 10000000;
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
    .setTimeout(30)
    .build();

    const result = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(result)) {
      const val = result.result?.retval;
      if (val) {
        return Number(scValToNative(val)) / 10000000;
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
      .setTimeout(30).build();
    
    // 2. Get total shares
    const txTotalShares = new TransactionBuilder(dummyAccount, { fee: BASE_FEE, networkPassphrase: config.passphrase })
      .addOperation(contract.call("get_total_reinsurance_shares"))
      .setTimeout(30).build();

    // 3. Get total deposited (XLM)
    const txTotalDeposited = new TransactionBuilder(dummyAccount, { fee: BASE_FEE, networkPassphrase: config.passphrase })
      .addOperation(contract.call("get_total_reinsurance_deposited"))
      .setTimeout(30).build();

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
      return Number(amountStroops) / 10000000;
    }
    return 0;
  } catch (error) {
    console.error("Error fetching user LP balance:", error);
    return 0;
  }
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
        .setTimeout(30).build();
      const txDep = new TransactionBuilder(dummyAccount, { fee: BASE_FEE, networkPassphrase: config.passphrase })
        .addOperation(contract.call("get_total_reinsurance_deposited"))
        .setTimeout(30).build();

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
    .setTimeout(30)
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

