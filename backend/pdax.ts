import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const PDAX_API_BASE = process.env.PDAX_API_BASE || 'https://uat.services.sandbox.pdax.ph/api/pdax-api';

export async function initiateFiatSweep(amountPHP: number, paymentPrefs?: any): Promise<string> {
  const username = process.env.PDAX_USERNAME;
  const password = process.env.PDAX_PASSWORD;

  if (!username || !password) {
    throw new Error('PDAX API credentials (PDAX_USERNAME, PDAX_PASSWORD) are not configured in the environment.');
  }

  // If no payment preferences or it's web3, skip fiat sweep
  if (paymentPrefs && paymentPrefs.method !== 'fiat') {
     return "WEB3_DIRECT_PAYOUT";
  }

  // Extract preferences or fallback to default
  // NOTE: For UAT, we map UI providers to officially supported test bank codes:
  // GCash -> BASECPH (Security Bank Test)
  // Maya -> BACTBPH (CTBC Test)
  const bankCode = paymentPrefs?.provider === 'GCash' || paymentPrefs?.provider === 'gcash' ? 'BASECPH' : 
                   paymentPrefs?.provider === 'Maya' || paymentPrefs?.provider === 'paymaya' ? 'BACTBPH' : 
                   paymentPrefs?.provider === 'UnionBank' ? 'BASECPH' : 
                   'BASECPH'; // default
  
  const accountName = paymentPrefs?.accountName || "Juan Dela Cruz";
  // Override accountNumber with officially supported test account numbers to prevent UAT 9946 errors
  const accountNumber = bankCode === 'BASECPH' ? "0000042001461" :
                        bankCode === 'BACTBPH' ? "001700062270" :
                        (paymentPrefs?.accountNumber || "09190690982").replace(/\s/g, "");

  // Split accountName into parts for the API
  const nameParts = accountName.split(' ');
  const firstName = nameParts[0] || "Juan";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : "Dela Cruz";

  try {
    // 1. Authenticate with PDAX
    const authResponse = await axios.post(`${PDAX_API_BASE}/pdax-institution/v1/login`, { username, password });
    const accessToken = authResponse.data.access_token;
    const idToken = authResponse.data.id_token;
    
    if (!accessToken || !idToken) {
      throw new Error('PDAX API did not return valid authentication tokens');
    }

    // 2. Execute Fiat Sweep/Transfer (Withdrawal)
    const txIdentifier = uuidv4();
    const sweepResponse = await axios.post(
      `${PDAX_API_BASE}/pdax-institution/v1/fiat/withdraw`,
      {
        identifier: txIdentifier,
        sender_first_name: "Typhoon",
        sender_middle_name: "n.a.",
        sender_last_name: "Resilience Vault",
        sender_country_origin: "Philippines",
        source_of_funds: "Business Income",
        fee_type: "Sender",
        beneficiary_first_name: firstName,
        beneficiary_middle_name: "n.a.",
        beneficiary_last_name: lastName,
        beneficiary_bank_code: bankCode,
        beneficiary_account_name: accountName,
        beneficiary_account_number: accountNumber,
        purpose: "Donation of Financial Aid",
        relationship_of_sender_to_beneficiary: "Business",
        currency: "PHP",
        amount: amountPHP.toString(),
        method: "PAY-TO-ACCOUNT-REAL-TIME"
      },
      { 
        headers: { 
          'access_token': accessToken,
          'id_token': idToken
        } 
      }
    );
    
    return sweepResponse.data.data?.reference_number || sweepResponse.data.data?.identifier || "UNKNOWN_TX";
  } catch (error: any) {
    console.error("PDAX API Error:", error.response?.data || error.message);
    throw new Error(`PDAX Fiat Sweep Failed: ${error.response?.data?.error || error.response?.data?.message || error.message}`);
  }
}

export const initiateFiatDeposit = async (amountPHP: number, paymentMethod: string = "grabpay_cashin") => {
  try {
    const username = process.env.PDAX_USERNAME;
    const password = process.env.PDAX_PASSWORD;
    if (!username || !password) throw new Error('Missing PDAX credentials');
    
    const authResponse = await axios.post(`${PDAX_API_BASE}/pdax-institution/v1/login`, { username, password });
    const accessToken = authResponse.data.access_token;
    const idToken = authResponse.data.id_token;
    if (!accessToken || !idToken) throw new Error('PDAX API did not return valid authentication tokens');
    
    console.log(`[PDAX] Initiating fiat deposit for PHP ${amountPHP} via ${paymentMethod}...`);

    const response = await axios.post(
      `${PDAX_API_BASE}/pdax-institution/v1/fiat/deposit`,
      {
        amount: amountPHP.toString(),
        method: paymentMethod,
        identifier: uuidv4(),
        sender_first_name: "Juan",
        sender_middle_name: "Dela",
        sender_last_name: "Cruz",
        sender_country_origin: "Philippines",
        sender_address_line_one: "123 Mabuhay Street",
        sender_city: "Manila City",
        sender_province: "Metro Manila",
        sender_country: "Philippines",
        sender_zip_code: "1000",
        sender_phone_number: "639171234567",
        sender_nationality: "Philippines",
        sender_national_identity_number: "1234567890",
        sender_dob: "01-01-1990",
        sender_place_of_birth: "Manila City",
        source_of_funds: "Others: Sample",
        sender_email: "juan.delacruz@demo.com",
        beneficiary_first_name: "Typhoon",
        beneficiary_middle_name: "Resilience",
        beneficiary_last_name: "Vault",
        beneficiary_sex: "Male",
        beneficiary_nationality: "Philippines",
        beneficiary_dob: "01-01-2024",
        beneficiary_address_line_one: "1 Blockchain Way",
        beneficiary_city: "Taguig",
        beneficiary_province: "Metro Manila",
        beneficiary_country: "Philippines",
        beneficiary_zip_code: "1634",
        beneficiary_government_issued_id: "ID123",
        beneficiary_phone_number: "639081234567",
        purpose: "Investments/Savings",
        relationship_of_sender_to_beneficiary: "Business",
        currency: "PHP",
        nature_of_business: "Insurance"
      },
      { 
        headers: { 
          'access_token': accessToken,
          'id_token': idToken
        } 
      }
    );
    
    console.log(`[PDAX] Fiat deposit initiated successfully. Checkout URL: ${response.data.payment_checkout_url}`);
    return {
      success: true,
      data: response.data
    };
  } catch (error: any) {
    console.error(`[PDAX] Fiat deposit failed:`, error.response?.data || error.message);
    throw error;
  }
};
