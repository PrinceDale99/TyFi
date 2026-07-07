import { Server } from '@stellar/stellar-sdk/rpc';
import { Contract } from '@stellar/stellar-sdk';

const RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const VAULT_CONTRACT_ID = process.env.VAULT_CONTRACT_ID || ''; // Replace with actual deployed contract ID

const server = new Server(RPC_URL);

export interface BondPortfolio {
    shares: number;
    currentValueXLM: number;
    yieldPercentage: number;
}

/**
 * Fetches the user's bond portfolio and calculates the real-time yield
 * based on the Soroban smart contract state.
 */
export async function calculateBondYield(userAddress: string): Promise<BondPortfolio> {
    if (!VAULT_CONTRACT_ID) {
        throw new Error('VAULT_CONTRACT_ID is not configured');
    }

    try {
        const contract = new Contract(VAULT_CONTRACT_ID);

        // Fetch user's LP shares
        const sharesResponse = await server.simulateTransaction(
            // @ts-ignore - Building raw invocation for read-only call
            {
                source: userAddress,
                fee: "100",
                sequence: "0",
                operations: [
                    contract.call('get_lp_shares', userAddress)
                ]
            }
        );
        
        // Fetch total shares
        const totalSharesResponse = await server.simulateTransaction(
            // @ts-ignore
            {
                source: userAddress,
                fee: "100",
                sequence: "0",
                operations: [
                    contract.call('get_total_reinsurance_shares')
                ]
            }
        );

        // Fetch total deposited XLM/USDC in the pool
        const totalDepositedResponse = await server.simulateTransaction(
            // @ts-ignore
            {
                source: userAddress,
                fee: "100",
                sequence: "0",
                operations: [
                    contract.call('get_total_reinsurance_deposited')
                ]
            }
        );

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
