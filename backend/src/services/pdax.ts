import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PDAX_API_URL = process.env.PDAX_API_URL || 'https://api.pdax.ph/v1';
const PDAX_API_KEY = process.env.PDAX_API_KEY || 'mock_key';

export const pdax = {
  /**
   * Market sell XLM for PHP via PDAX institutional API.
   * @param amountXlm The amount of XLM to sell.
   * @returns The Order ID and expected PHP output.
   */
  async sellXLM(amountXlm: number): Promise<{ orderId: string, amountPhp: number }> {
    console.log(`[PDAX] Initiating market sell of ${amountXlm} XLM for PHP...`);
    
    // In production, this would be an actual Axios POST to /v1/orders
    // const response = await axios.post(`${PDAX_API_URL}/orders`, { ... });
    
    // Simulating API latency and execution
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Assume a simulated rate of 5.6 PHP per XLM for now
    const rate = 5.6; 
    const amountPhp = amountXlm * rate;
    const orderId = `PDAX-ORD-${Date.now()}`;
    
    console.log(`[PDAX] Order executed. Order ID: ${orderId}, Expected PHP: ₱${amountPhp.toFixed(2)}`);
    return { orderId, amountPhp };
  },

  /**
   * Push PHP to the farmer's registered GCash/Maya/Bank account via InstaPay.
   */
  async sweepToFiat(amountPhp: number, farmerAccountId: string): Promise<string> {
    console.log(`[InstaPay] Sweeping ₱${amountPhp.toFixed(2)} to farmer ${farmerAccountId}...`);
    
    // Simulating settlement delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const receipt = `INSTAPAY-${Math.random().toString(36).substring(7).toUpperCase()}`;
    console.log(`[InstaPay] Settlement successful. Receipt: ${receipt}`);
    
    return receipt;
  }
};
