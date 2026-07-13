import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupStellarListener } from './services/stellar';
import smsRouter from './services/sms';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'tyfi-backend-layer2' });
});

// Mount the Twilio SMS Webhook routing
app.use('/api/sms', smsRouter);

// Start the Express server
app.listen(port, () => {
  console.log(`[TyFi Backend] Layer 2 services listening on port ${port}`);
  
  // Initialize the Stellar listener for Vault payouts
  setupStellarListener().catch(err => {
    console.error('Failed to setup Stellar listener:', err);
  });
});
