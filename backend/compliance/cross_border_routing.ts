import { logger } from '../logger';
import axios from 'axios';

export interface RemittanceRequest {
    userId: string;
    targetCountry: 'PH' | 'VN' | 'ID';
    amountUSDC: number;
    localBankDetails: any;
}

/**
 * Handles cross-border remittances via PDAX CaaS to local EMI partners.
 * Ensures the smart contract passes USDC to CaaS BEFORE touching retail bank accounts.
 */
export async function routeCrossBorderPayout(req: RemittanceRequest): Promise<string> {
    logger.info(`Routing ${req.amountUSDC} USDC to ${req.targetCountry} for user ${req.userId}`);
    
    // 1. Validate Target Country compliance
    if (!['PH', 'VN', 'ID'].includes(req.targetCountry)) {
        throw new Error(`Country ${req.targetCountry} is not supported for compliance reasons.`);
    }

    // 2. Call PDAX CaaS API to convert USDC to Local Fiat & Remit
    const txId = await executeCaaSConversion(req);
    
    logger.info(`Remittance successful via EMI partner. TxID: ${txId}`);
    return txId;
}

async function executeCaaSConversion(req: RemittanceRequest): Promise<string> {
    // Real API call to PDAX CaaS
    try {
        const response = await axios.post('https://trade.pdax.ph/api/v1/caas/remit', {
            amount: req.amountUSDC,
            currency: 'USDC',
            target_country: req.targetCountry,
            bank_details: req.localBankDetails
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.PDAX_CAAS_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data.transaction_id;
    } catch (error: any) {
        logger.error(`PDAX CaaS Remittance failed: ${error.message}`);
        throw new Error("Cross border routing failed via PDAX CaaS.");
    }
}
