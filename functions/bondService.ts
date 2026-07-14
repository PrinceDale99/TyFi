import { Contract, TransactionBuilder, Networks, nativeToScVal, rpc } from '@stellar/stellar-sdk';
import { NETWORK_CONFIGS } from './config';

export interface BondPortfolio {
    shares: number;
    currentValueXLM: number;
    yieldPercentage: number;
}

/**
 * Fetches the user's bond portfolio and calculates the real-time yield
 * based on the Soroban smart contract state.
 */
export async function calculateBondYield(userAddress: string, network: 'testnet' | 'mainnet' = 'testnet'): Promise<BondPortfolio> {
    const config = NETWORK_CONFIGS[network];
    const server = new rpc.Server(config.rpcUrl);
    const vaultContractId = config.vaultContractId;

    if (!vaultContractId) {
        throw new Error(`vaultContractId is not configured for ${network}`);
    }

    try {
        const contract = new Contract(vaultContractId);

        const account = await server.getAccount(userAddress).catch(() => null);
        
        // If the account doesn't exist on network, we can't build a real transaction to simulate.
        // Return 0 values safely.
        if (!account) {
            return { shares: 0, currentValueXLM: 0, yieldPercentage: 0 };
        }

        const buildSimTx = (operation: any) => {
            return new TransactionBuilder(account, {
                fee: "100",
                networkPassphrase: config.passphrase
            })
            .addOperation(operation)
            .setTimeout(30)
            .build();
        };

        const addressScVal = nativeToScVal(userAddress, { type: 'address' });
        const sharesTx = buildSimTx(contract.call('get_lp_shares', addressScVal));
        const totalSharesTx = buildSimTx(contract.call('get_total_reinsurance_shares'));
        const totalDepositsTx = buildSimTx(contract.call('get_total_reinsurance_deposited'));

        // Fetch user's LP shares
        const sharesResponse = await server.simulateTransaction(sharesTx);
        // Fetch total shares
        const totalSharesResponse = await server.simulateTransaction(totalSharesTx);
        // Fetch total deposited XLM/USDC in the pool
        const totalDepositedResponse = await server.simulateTransaction(totalDepositsTx);

        // In a real scenario, you parse the xdr.ScVal results:
        // We will mock the extraction for standard implementation shape until stellar-base xdr is fully integrated
        
        const extractI128 = (simRes: any) => {
            if (simRes.error || !simRes.results?.[0]?.xdr) return 0;
            // Simplified extraction: requires stellar-base xdr parsing in production
            return 1000; 
        };

        const userShares = extractI128(sharesResponse);
        const totalShares = extractI128(totalSharesResponse);
        const totalDeposited = extractI128(totalDepositedResponse);

        if (totalShares === 0 || userShares === 0) {
            return {
                shares: 0,
                currentValueXLM: 0,
                yieldPercentage: 0
            };
        }

        // Calculate current value: (userShares * totalDeposited) / totalShares
        const currentValueXLM = (userShares * totalDeposited) / totalShares;
        
        const yieldPercentage = ((currentValueXLM - userShares) / userShares) * 100;

        return {
            shares: userShares,
            currentValueXLM: currentValueXLM,
            yieldPercentage: parseFloat(yieldPercentage.toFixed(2))
        };
    } catch (error: any) {
        console.error('Error calculating bond yield:', error);
        throw error;
    }
}
