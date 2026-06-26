import axios from 'axios';

const PDAX_API_BASE = process.env.PDAX_API_BASE || 'https://api.pdax.ph';

export async function initiateFiatSweep(amountPHP: number): Promise<string> {
  const username = process.env.PDAX_USERNAME;
  const password = process.env.PDAX_PASSWORD;

  if (!username || !password) {
    throw new Error('PDAX API credentials (PDAX_USERNAME, PDAX_PASSWORD) are not configured in the environment.');
  }

  try {
    // 1. Authenticate with PDAX
    const authResponse = await axios.post(`${PDAX_API_BASE}/auth/login`, { username, password });
    const token = authResponse.data.access_token;
    
    if (!token) {
      throw new Error('PDAX API did not return an access token');
    }

    // 2. Execute Fiat Sweep/Transfer
    const sweepResponse = await axios.post(
      `${PDAX_API_BASE}/v1/sweep`, // Adjust endpoint to actual PDAX payout/sweep endpoint
      { amount: amountPHP, currency: 'PHP', target_currency: 'USDC' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    return sweepResponse.data.transaction_id || sweepResponse.data.id;
  } catch (error: any) {
    console.error("PDAX API Error:", error.response?.data || error.message);
    throw new Error(`PDAX Fiat Sweep Failed: ${error.response?.data?.message || error.message}`);
  }
}
