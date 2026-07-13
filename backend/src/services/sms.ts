import express from 'express';
import { db } from './db';
import { pdax } from './pdax';
import * as StellarSdk from '@stellar/stellar-sdk';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

/**
 * Validates the Twilio Signature to ensure the request is genuinely from Twilio.
 * In a real production environment, use the `twilio.validateRequest` utility.
 */
function validateTwilioRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Mock validation for now
  next();
}

/**
 * Webhook for incoming SMS from Farmers (Offline Mesh)
 * Endpoint: POST /api/sms/webhook
 */
router.post('/webhook', validateTwilioRequest, async (req, res) => {
  const { From, Body } = req.body; // Twilio sends the sender's phone number in 'From' and text in 'Body'

  console.log(`[SMS Gateway] Received message from ${From}: "${Body}"`);

  if (!From || !Body) {
    return res.status(400).send('Invalid payload');
  }

  // 1. Verify Phone Number (Anti-Spoofing)
  // In production, we query the DB to find the farmer's registered Stellar Address based on their phone number.
  // const farmer = await db.getFarmerByPhone(From);
  const mockFarmerAddress = 'G_MOCK_FARMER_ADDRESS'; 

  const command = Body.trim().toUpperCase().split(' ');
  const action = command[0]; // e.g., 'CLAIM' or 'STATUS'
  const policyId = command[1]; 

  let replyMessage = '';

  try {
    if (action === 'CLAIM') {
      // 2. Queue the claim for gasless execution by the Relayer
      console.log(`[Relayer] Queueing offline claim for Policy ${policyId} on behalf of ${mockFarmerAddress}`);
      
      // Simulate pushing to an SQS/RabbitMQ queue for the Soroban relayer
      await new Promise(resolve => setTimeout(resolve, 500));
      
      replyMessage = `TyFi: Claim request for Policy ${policyId} received offline. We are processing it on-chain. You will receive an SMS when the fiat payout hits your bank.`;
    } 
    else if (action === 'STATUS') {
      replyMessage = `TyFi: Your policy ${policyId} is ACTIVE. Current region wind speed is 90km/h. Stay safe.`;
    } 
    else {
      replyMessage = `TyFi: Unknown command. Text "CLAIM [POLICY_ID]" or "STATUS [POLICY_ID]".`;
    }
  } catch (error) {
    console.error('[SMS Gateway] Error processing command:', error);
    replyMessage = `TyFi: System error. Please try again later.`;
  }

  // 3. Respond to Twilio using TwiML
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(`
    <Response>
      <Message>${replyMessage}</Message>
    </Response>
  `);
});

export default router;
