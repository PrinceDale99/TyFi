export interface PayoutRecord {
    transaction_hash: string;
    farmer_id: string;
    amount_xlm: number;
    amount_php: number | null;
    status: 'PENDING' | 'EXECUTING' | 'MANUAL_REVIEW' | 'COMPLETED' | 'FAILED';
    pdax_order_id?: string;
    instapay_receipt?: string;
    created_at: Date;
}
export declare const db: {
    /**
     * Initializes a new payout record with an idempotency lock based on transaction hash.
     */
    initializePayout(txHash: string, farmerId: string, amountXlm: number): Promise<boolean>;
    /**
     * Updates the status of a payout.
     */
    updateStatus(txHash: string, status: PayoutRecord['status'], additionalFields?: Partial<PayoutRecord>): Promise<void>;
};
//# sourceMappingURL=db.d.ts.map