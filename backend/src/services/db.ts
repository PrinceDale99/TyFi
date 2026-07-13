import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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

export const db = {
  /**
   * Initializes a new payout record with an idempotency lock based on transaction hash.
   */
  async initializePayout(txHash: string, farmerId: string, amountXlm: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      // Check for idempotency
      const res = await client.query('SELECT 1 FROM payouts WHERE transaction_hash = $1', [txHash]);
      if (res.rowCount && res.rowCount > 0) {
        return false; // Already processed
      }

      await client.query(
        'INSERT INTO payouts (transaction_hash, farmer_id, amount_xlm, status, created_at) VALUES ($1, $2, $3, $4, NOW())',
        [txHash, farmerId, amountXlm, 'PENDING']
      );
      return true;
    } finally {
      client.release();
    }
  },

  /**
   * Updates the status of a payout.
   */
  async updateStatus(txHash: string, status: PayoutRecord['status'], additionalFields: Partial<PayoutRecord> = {}) {
    const fields = ['status = $2'];
    const values: any[] = [txHash, status];
    let count = 3;

    if (additionalFields.amount_php) {
      fields.push(`amount_php = $${count++}`);
      values.push(additionalFields.amount_php);
    }
    if (additionalFields.pdax_order_id) {
      fields.push(`pdax_order_id = $${count++}`);
      values.push(additionalFields.pdax_order_id);
    }
    if (additionalFields.instapay_receipt) {
      fields.push(`instapay_receipt = $${count++}`);
      values.push(additionalFields.instapay_receipt);
    }

    const query = `UPDATE payouts SET ${fields.join(', ')} WHERE transaction_hash = $1`;
    await pool.query(query, values);
  }
};
