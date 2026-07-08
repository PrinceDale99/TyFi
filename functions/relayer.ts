import { 
  Keypair, 
  TransactionBuilder, 
  Networks, 
  SorobanRpc, 
  Transaction,
  FeeBumpTransaction,
  Contract, 
  xdr, 
  scValToNative, 
  nativeToScVal, 
  Operation 
} from '@stellar/stellar-sdk';
import { logEvent } from './logger';
import dotenv from 'dotenv';
dotenv.config();

const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const server = new SorobanRpc.Server(rpcUrl);

// Treasury account to pay for fees
// In production, this must be securely fetched from a KMS.
const TREASURY_SECRET = process.env.TREASURY_SECRET_KEY;
const treasuryKeypair = TREASURY_SECRET ? Keypair.fromSecret(TREASURY_SECRET) : Keypair.random();

// SmartWalletFactory Contract ID (must be configured via ENV)
const FACTORY_CONTRACT_ID = process.env.SMART_WALLET_FACTORY_ID || 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const WALLET_WASM_HASH = process.env.WALLET_WASM_HASH || '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * 1. Stellar Native Ledger Reserve Sponsorship Pipeline
 * Initiates a transaction utilizing BeginSponsoringFutureReserves and EndSponsoringFutureReserves
 * to sponsor the creation and initialization of a new farmer's smart wallet.
 */
export async function sponsorSmartWalletDeployment(userWebAuthnPubKey: string) {
    await logEvent('INFO', `[Relayer] Sponsoring smart wallet deployment for Biometric PubKey`, { userWebAuthnPubKey });
    
    try {
        const networkPassphrase = Networks.TESTNET;
        const treasuryAccount = await server.getAccount(treasuryKeypair.publicKey());

        // We use a deterministic salt based on the pubkey so the same user always gets the same address
        const saltBuffer = Buffer.from(userWebAuthnPubKey).subarray(0, 32); 
        // Pad to 32 bytes if necessary
        const paddedSalt = Buffer.alloc(32);
        saltBuffer.copy(paddedSalt);

        // Convert parameters to ScVals
        const wasmHashVal = xdr.ScVal.scvBytes(Buffer.from(WALLET_WASM_HASH, 'hex'));
        const saltVal = xdr.ScVal.scvBytes(paddedSalt);
        // The admin is passed as a generic string or bytes for the secp256r1 pubkey
        const adminVal = nativeToScVal(userWebAuthnPubKey, { type: 'string' }); 

        const factoryContract = new Contract(FACTORY_CONTRACT_ID);

        // Build the deployment transaction
        let txBuilder = new TransactionBuilder(treasuryAccount, {
            fee: "1000",
            networkPassphrase,
        });

        // 1. Begin Sponsoring Future Reserves (Treasury pays for ledger state)
        txBuilder.addOperation(Operation.beginSponsoringFutureReserves({
            sponsoredId: factoryContract.address() // The factory technically creates the instance
        }));

        // 2. Invoke the deploy function on the Factory
        txBuilder.addOperation(factoryContract.call("deploy", adminVal, wasmHashVal, saltVal));

        // 3. End Sponsoring Future Reserves
        txBuilder.addOperation(Operation.endSponsoringFutureReserves({
            source: treasuryKeypair.publicKey()
        }));

        const transaction = txBuilder.setTimeout(30).build();

        // Simulate the transaction to get resource footprint & fees
        const simulatedTx = await server.simulateTransaction(transaction);
        if (SorobanRpc.Api.isSimulationError(simulatedTx)) {
            throw new Error(`Simulation failed: ${simulatedTx.error}`);
        }

        // Assemble the transaction with the simulation data (auth and resources)
        const assembledTx = SorobanRpc.assembleTransaction(transaction, simulatedTx) as Transaction;
        
        // Sign with Treasury
        assembledTx.sign(treasuryKeypair);

        // Submit to the network
        const sendResponse = await server.sendTransaction(assembledTx);
        if (sendResponse.status === "ERROR") {
            throw new Error(`Submission error: ${sendResponse.errorResultXdr}`);
        }

        // Poll for confirmation
        let statusResponse = await server.getTransaction(sendResponse.hash);
        let retries = 0;
        while (statusResponse.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND && retries < 15) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            statusResponse = await server.getTransaction(sendResponse.hash);
            retries++;
        }

        if (statusResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
            // Extract the deployed contract ID from the result
            const resultVal = statusResponse.returnValue;
            const deployedAddress = scValToNative(resultVal as xdr.ScVal);
            
            await logEvent('INFO', `[Relayer] Smart Wallet Successfully Deployed!`, { address: deployedAddress });
            
            return { 
                success: true, 
                message: "Smart wallet factory deployment successful", 
                sponsoredAddress: deployedAddress 
            };
        } else {
            throw new Error(`Transaction failed with status: ${statusResponse.status}`);
        }

    } catch (error: any) {
        await logEvent('ERROR', `[Relayer] Smart Wallet Deployment failed`, { error: error.message });
        
        // Fallback for development if contract isn't deployed yet
        if (FACTORY_CONTRACT_ID.startsWith('CXXX')) {
            const mockWalletAddress = "C_SMART_WALLET_" + userWebAuthnPubKey.substring(0, 10);
            await logEvent('WARNING', `[Relayer] Factory contract not configured. Returning Mock Address: ${mockWalletAddress}`);
            return { 
                success: true, 
                message: "Mock wallet deployment initiated (Factory ID not set)", 
                sponsoredAddress: mockWalletAddress 
            };
        }
        
        throw new Error('Failed to sponsor deployment');
    }
}

/**
 * 2. Fee-Bump Transaction Wrapping Engine
 * Intercepts raw signed XDR from the client and wraps it in a FeeBumpTransaction.
 * The Treasury account is the feeSource, absorbing 100% of the gas costs.
 */
export async function wrapWithFeeBump(innerTxXdr: string) {
    await logEvent('INFO', `[Relayer] Wrapping transaction with FeeBump for gasless execution...`);
    const networkPassphrase = Networks.TESTNET;
    
    try {
        const innerTx = TransactionBuilder.fromXDR(innerTxXdr, networkPassphrase) as Transaction;
        
        const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
            treasuryKeypair,
            "100000", // max base fee
            innerTx,
            networkPassphrase
        );
        
        feeBumpTx.sign(treasuryKeypair);
        const feeBumpXdr = feeBumpTx.toXDR();
        
        // In a live environment, submit to Soroban RPC:
        // const response = await server.sendTransaction(feeBumpTx);
        
        await logEvent('INFO', `[Relayer] FeeBump transaction successfully signed by Treasury.`);
        
        return { success: true, feeBumpXdr };
    } catch (error: any) {
        await logEvent('ERROR', `[Relayer] FeeBump generation failed`, { error: error.message });
        throw new Error('Failed to wrap transaction');
    }
}
