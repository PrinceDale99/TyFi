import axios from 'axios';

const PDAX_API_BASE = 'https://doc.general.api.pdax.ph';

export async function initiateFiatSweep(amountPHP: number): Promise<string> {
  try {
    const username = process.env.PDAX_USERNAME || 'pdaxapi_temp_01';
    const password = process.env.PDAX_PASSWORD; // Securely loaded from .env

    if (!password) throw new Error("PDAX credentials missing");

    const authResponse = await axios.post(`${PDAX_API_BASE}/auth`, { username, password });
    const token = authResponse.data.access_token;
    
    // Trade Routing Execution
    const sweepResponse = await axios.post(
      `${PDAX_API_BASE}/v1/sweep`,
      { amount: amountPHP, currency: 'PHP', target_currency: 'USDC' },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return sweepResponse.data.transaction_id;
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.error("PDAX Token Expired or Unauthorized.");
    }
    throw new Error('Failed to execute fiat sweep via PDAX');
  }
}
