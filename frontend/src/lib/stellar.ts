import freighterApi from "@stellar/freighter-api";
const { isConnected, setAllowed, getAddress, signTransaction } = freighterApi;

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
    // Native XLM SAC on Testnet
    xlmTokenId: 'CDLZFC3SYJYDZT7KMGCCEEH45FAZ6COCYPIBA67KEHWOAAZ5KVHQ64VL',
    // ✅ Deployed 2026-05-21 — tx: 53b327340a990201617f61c639749dd9f92be2c542fee7cd50faca04f587e92c
    // 🔗 https://stellar.expert/explorer/testnet/tx/53b327340a990201617f61c639749dd9f92be2c542fee7cd50faca04f587e92c
    // 🔗 https://lab.stellar.org/r/testnet/contract/CBMNXUY6U2PO56JB5TZNUNQQZFXVUJ6XOZ3T3LJZJ3U6RH64RXTP3WRN
    vaultContractId: 'CBMNXUY6U2PO56JB5TZNUNQQZFXVUJ6XOZ3T3LJZJ3U6RH64RXTP3WRN',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    passphrase: Networks.TESTNET,
  },
  mainnet: {
    name: 'Mainnet',
    // Native XLM SAC on Mainnet
    xlmTokenId: 'CAS3J7AVONGEJ757545DG5TZAT24DQZGX357FBCT6UW674ATCQZ3E367',
    // ✅ Deployed 2026-05-21
    vaultContractId: 'CAAQCLJ7SF5IP3BHD4OKPLMCDQTEVTRYWEXYBQIGNL6U6ZYIK7HNCHEK',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://soroban-rpc.stellar.org',
    passphrase: Networks.PUBLIC,
  }
};

// Helper to ensure strings are valid Soroban symbols (max 32 chars, a-zA-Z0-9_)
const sanitizeSymbol = (str: string) => {
  return str.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 32);
};
export const connectWallet = async () => {
  try {
    if (await isConnected()) {
      const allowed = await setAllowed();
      if (!allowed) {
        throw new Error("User declined connection request");
      }
      
      const { address, error } = await getAddress();
      if (error) {
        throw new Error(error);
      }
      if (!address) {
        throw new Error("No public address found. Please make sure you are logged into Freighter.");
      }
      return address;
    }
    throw new Error("Freighter extension not detected. Please install it to continue.");
  } catch (error: any) {
    console.error("Wallet connection error:", error);
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

    console.log(`[${config.name}] Requesting Freighter signature for: subscribe`);
    const signResult = await signTransaction(preparedTx.toXDR(), {
      networkPassphrase: config.passphrase,
    });
    
    const signedXdr = typeof signResult === 'string' ? signResult : signResult.signedTxXdr;
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
    console.log(`[${config.name}] Requesting Freighter signature for Oracle Submission...`);
    const signResult = await signTransaction(preparedTx.toXDR(), { networkPassphrase: config.passphrase });
    
    const signedXdr = typeof signResult === 'string' ? signResult : signResult.signedTxXdr;
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

    const signResult = await signTransaction(preparedTx.toXDR(), {
      networkPassphrase: config.passphrase,
    });
    
    const signedXdr = typeof signResult === 'string' ? signResult : signResult.signedTxXdr;
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

    const stroops = Math.floor(amount * 10000000);

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
          nativeToScVal(BigInt(stroops), { type: 'i128' })
        ]
      )
    )
    .setTimeout(30)
    .build();

    const preparedTx = await server.prepareTransaction(tx) as Transaction;

    console.log(`[${config.name}] Requesting Freighter signature for: ${methodName}`);
    const signResult = await signTransaction(preparedTx.toXDR(), {
      networkPassphrase: config.passphrase,
    });
    
    const signedXdr = typeof signResult === 'string' ? signResult : signResult.signedTxXdr;
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

