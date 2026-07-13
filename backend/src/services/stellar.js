"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupStellarListener = setupStellarListener;
const StellarSdk = __importStar(require("@stellar/stellar-sdk"));
const db_1 = require("./db");
const pdax_1 = require("./pdax");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
const BRIDGE_ESCROW_ACCOUNT = process.env.BRIDGE_ESCROW_ACCOUNT || 'GD_MOCK_ESCROW_ADDRESS';
async function setupStellarListener() {
    console.log(`[Stellar] Connecting to Horizon to watch Escrow Account: ${BRIDGE_ESCROW_ACCOUNT}`);
    // Fetch the latest cursor (in production we would persist the cursor in the DB)
    server.payments()
        .forAccount(BRIDGE_ESCROW_ACCOUNT)
        .cursor('now')
        .stream({
        onmessage: async (payment) => {
            if (payment.type === 'payment' && payment.asset_type === 'native') {
                console.log(`[Stellar] Received payment of ${payment.amount} XLM! Tx Hash: ${payment.transaction_hash}`);
                await handleIncomingPayout(payment.transaction_hash, payment.from, parseFloat(payment.amount));
            }
        },
        onerror: (error) => {
            console.error('[Stellar] Streaming error:', error);
        }
    });
}
/**
 * Executes the full fiat sweep pipeline using idempotency locks.
 */
async function handleIncomingPayout(txHash, farmerId, amountXlm) {
    try {
        // 1. Lock transaction
        const isNew = await db_1.db.initializePayout(txHash, farmerId, amountXlm);
        if (!isNew) {
            console.log(`[Idempotency] Transaction ${txHash} already processed. Skipping.`);
            return;
        }
        await db_1.db.updateStatus(txHash, 'EXECUTING');
        // 2. Perform AML Velocity Check (Simulated for now)
        if (amountXlm > 10000) {
            console.warn(`[AML] Velocity limit exceeded for farmer ${farmerId}. Flagging for manual review.`);
            await db_1.db.updateStatus(txHash, 'MANUAL_REVIEW');
            return;
        }
        // 3. Sell on PDAX
        const { orderId, amountPhp } = await pdax_1.pdax.sellXLM(amountXlm);
        // 4. Sweep to Fiat
        const receipt = await pdax_1.pdax.sweepToFiat(amountPhp, farmerId);
        // 5. Complete
        await db_1.db.updateStatus(txHash, 'COMPLETED', {
            amount_php: amountPhp,
            pdax_order_id: orderId,
            instapay_receipt: receipt
        });
        console.log(`[Pipeline] Successfully processed and swept payout for ${farmerId}.`);
    }
    catch (error) {
        console.error(`[Pipeline] Error processing payout for ${txHash}:`, error);
        await db_1.db.updateStatus(txHash, 'FAILED');
    }
}
//# sourceMappingURL=stellar.js.map