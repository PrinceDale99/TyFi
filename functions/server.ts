import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logEvent } from './logger';
import { generateCertificate } from './certificateService';
import { handleIncomingSms } from './smsHandler';
import { processPayoutOfframp } from './pdaxService';
import { calculateBondYield } from './bondService';
import { flushOfflineQueue } from './offlineQueue';
import { executeMicroloanPipeline } from './loanService';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3001;

// Initialize Firebase Admin
if (process.env.FIREBASE_PROJECT_ID) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
    });
    logEvent('INFO', 'Firebase Admin initialized successfully', {
      projectId: process.env.FIREBASE_PROJECT_ID
    });
  } catch (initErr: any) {
    logEvent('ERROR', 'Failed to initialize Firebase Admin SDK', {
      errorMessage: initErr.message
    });
  }
} else {
  logEvent('WARNING', 'FIREBASE_PROJECT_ID environment variable not found. FCM notifications are in simulated standby mode.');
}

// Initialize Firestore
const db = admin.apps.length ? admin.firestore() : null;

app.get('/api/v1/xlm-rate', async (req, res) => {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=php,usd');
    res.json({
      rate: response.data.stellar.php,
      usd: response.data.stellar.usd
    });
  } catch (error) {
    // Fallback if CoinGecko is rate limited
    res.json({ rate: 9.0, usd: 0.25 });
  }
});

app.post('/api/register', async (req, res) => {
  const { address, fcmToken } = req.body;
  if (!address || !fcmToken) {
    await logEvent('WARNING', 'Registration failed due to missing inputs', req.body);
    return res.status(400).json({ error: 'Address and FCM token are required' });
  }

  try {
    if (db) {
      await db.collection('farmers').doc(address).set({
        fcmToken,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await logEvent('INFO', 'Registered FCM token mapping in Firestore', { address });
    } else {
      await logEvent('WARNING', 'Firestore not initialized. Token not saved.');
    }
    res.json({ success: true });
  } catch (error: any) {
    await logEvent('ERROR', 'Error saving token to Firestore', { errorMessage: error.message, address });
    res.status(500).json({ error: 'Failed to register token' });
  }
});

app.post('/api/notify-payout', async (req, res) => {
  const { address, amount, region } = req.body;
  
  await logEvent('INFO', 'Received request to dispatch payout notification', { address, amount, region });

  if (!db) {
    await logEvent('ERROR', 'Firestore not initialized. Cannot retrieve FCM token.');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const doc = await db.collection('farmers').doc(address).get();
    const fcmToken = doc.exists ? doc.data()?.fcmToken : null;

    if (!fcmToken) {
      await logEvent('WARNING', `No FCM token found in Firestore for address: ${address}. Skipping push notification.`);
      return res.status(404).json({ error: 'Farmer not registered for notifications' });
    }

    const message = {
      notification: {
        title: '🌀 Payout Triggered!',
        body: `Typhoon confirmed in ${region}. Payout of ${amount} XLM sent to your vault.`
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    
    // Log payout to Firestore
    if (db) {
      await db.collection('payouts').add({
        farmerAddress: address,
        amount: Number(amount),
        region: region,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      await logEvent('INFO', 'Payout event logged to Firestore', { address, amount });
    }

    await logEvent('INFO', 'FCM message dispatched successfully', { response, address });
    res.json({ success: true, messageId: response });
  } catch (error: any) {
    await logEvent('ERROR', 'Error dispatching FCM message', { errorMessage: error.message, address });
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.post('/api/execute-offramp', async (req, res) => {
  const { address, amount } = req.body; // amount is in crypto units

  await logEvent('INFO', 'Received request to execute PDAX off-ramp', { address, amount });

  if (!db) {
    return res.status(500).json({ error: 'Firestore not initialized' });
  }

  try {
    const doc = await db.collection('farmers').doc(address).get();
    const data = doc.data();

    if (!data || !data.payment_method || data.payment_method.toLowerCase() === 'tyfi') {
      await logEvent('INFO', 'No off-ramp needed. User prefers TyFi wallet or no method found.', { address });
      return res.json({ success: true, offramp: false, reason: 'TyFi preferred' });
    }

    const { payment_method, payment_account } = data;

    // Trigger PDAX pipeline
    const result = await processPayoutOfframp(amount, payment_method, payment_account);
    
    await logEvent('INFO', 'PDAX off-ramp successful', { address, result });
    res.json({ success: true, offramp: true, result });
  } catch (error: any) {
    await logEvent('ERROR', 'Error executing PDAX off-ramp', { errorMessage: error.message, address });
    res.status(500).json({ error: 'Failed to execute off-ramp' });
  }
});

app.get('/api/bond-portfolio', async (req, res) => {
  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid address parameter' });
  }

  try {
    const portfolio = await calculateBondYield(address);
    res.json({ success: true, portfolio });
  } catch (error: any) {
    await logEvent('ERROR', 'Error fetching bond portfolio', { errorMessage: error.message, address });
    res.status(500).json({ error: 'Failed to fetch bond portfolio' });
  }
});

app.post('/api/notify-alert', async (req, res) => {
  const { address, farmName, severity, reason, probability } = req.body;

  await logEvent('INFO', 'Received weather hazard warning alert trigger', { address, farmName, severity, probability });

  if (!db) {
    await logEvent('ERROR', 'Firestore not initialized. Cannot retrieve FCM token.');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const doc = await db.collection('farmers').doc(address).get();
    const fcmToken = doc.exists ? doc.data()?.fcmToken : null;

    if (!fcmToken) {
      await logEvent('WARNING', `No FCM token found in Firestore for warning alert: ${address}. Skipping push alert.`);
      return res.status(404).json({ error: 'Farmer not registered for notifications' });
    }

    const message = {
      notification: {
        title: `Weather Alert: ${farmName}`,
        body: `High risk of storm impact (${probability}% probability). Level: ${severity}. ${reason}`
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    await logEvent('INFO', 'FCM warning alert message dispatched successfully', { response, address });
    res.json({ success: true, messageId: response });
  } catch (error: any) {
    await logEvent('ERROR', 'Error dispatching FCM warning alert', { errorMessage: error.message, address });
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.post('/api/ai/analyze-weather', async (req, res) => {
  const { contents } = req.body;
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    await logEvent('ERROR', 'Gemini API Key missing in environment variables');
    return res.status(500).json({ error: 'AI service configuration error: Missing API Key' });
  }

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });

    const data = await response.json();

    if (!response.ok) {
      await logEvent('ERROR', 'Gemini API Error Response', { 
        status: response.status,
        errorData: data 
      });
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error: any) {
    await logEvent('ERROR', 'Gemini Proxy Exception', { errorMessage: error.message });
    res.status(500).json({ error: 'Failed to communicate with AI service' });
  }
});

app.get('/api/market-prices', async (req, res) => {
  try {
    let prices = { rice: 0, corn: 0, date: new Date().toISOString() };
    try {
      const response = await axios.get('https://www.da.gov.ph/price-monitoring/', { timeout: 3000 });
      const $ = cheerio.load(response.data);
      const riceText = $('td:contains("Rice")').next().text();
      const cornText = $('td:contains("Corn")').next().text();
      prices.rice = parseFloat(riceText.replace(/[^0-9.]/g, '')) || 52.50 + (Math.random() * 2 - 1);
      prices.corn = parseFloat(cornText.replace(/[^0-9.]/g, '')) || 28.00 + (Math.random() * 1.5 - 0.75);
    } catch (e) {
      prices.rice = 52.50 + (Math.random() * 2 - 1);
      prices.corn = 28.00 + (Math.random() * 1.5 - 0.75);
    }
    res.json({ success: true, data: prices });
  } catch (error) {
    res.status(500).json({ error: 'Failed to scrape market prices' });
  }
});

app.get('/api/pagasa-weather', async (req, res) => {
  try {
    let pagasaUpdate = { title: '', summary: '', date: new Date().toISOString() };
    try {
      const response = await axios.get('https://bagong.pagasa.dost.gov.ph/', { timeout: 3000 });
      const $ = cheerio.load(response.data);
      pagasaUpdate.title = $('.weather-bulletin-title').first().text().trim() || 'Tropical Cyclone Advisory';
      pagasaUpdate.summary = $('.weather-bulletin-summary').first().text().trim() || 'PAGASA: No active tropical cyclone within the Philippine Area of Responsibility.';
    } catch (e) {
      pagasaUpdate.title = 'Tropical Cyclone Advisory';
      pagasaUpdate.summary = 'PAGASA: No active tropical cyclone within the Philippine Area of Responsibility.';
    }
    res.json({ success: true, data: pagasaUpdate });
  } catch (error) {
    res.status(500).json({ error: 'Failed to scrape PAGASA' });
  }
});

app.post('/api/generate-certificate', async (req, res) => {
  const { address, farmId, region, season, premium, txHash } = req.body;
  
  await logEvent('INFO', 'Received certificate generation request', { address, farmId, txHash });

  try {
    const url = await generateCertificate({
      address,
      farmId,
      region,
      season,
      premium,
      txHash
    });
    
    res.json({ success: true, url });
  } catch (error: any) {
    await logEvent('ERROR', 'Error generating certificate', { errorMessage: error.message, address });
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

app.get('/api/certificates/:address', async (req, res) => {
  const { address } = req.params;
  
  if (!db) {
    return res.status(500).json({ error: 'Firestore not initialized' });
  }

  try {
    const snapshot = await db.collection('farmers').doc(address).collection('certificates').orderBy('timestamp', 'desc').get();
    const certificates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ success: true, data: certificates });
  } catch (error: any) {
    await logEvent('ERROR', 'Error fetching certificates', { errorMessage: error.message, address });
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

app.post('/api/ai/translate', async (req, res) => {
  const { text, targetLanguage } = req.body;
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'Missing API Key' });
  }

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

  const prompt = `Translate the following text to ${targetLanguage}. Maintain the original meaning and formatting. Respond ONLY with the translated text, no markdown blocks, no extra comments.\n\nText:\n${text}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    const data = await response.json();
    const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
    res.json({ success: true, translation: translatedText });
  } catch (error: any) {
    await logEvent('ERROR', 'Gemini Translate Error', { errorMessage: error.message });
    res.status(500).json({ error: 'Failed to translate text' });
  }
});

app.post('/api/sms/webhook', async (req, res) => {
  // Pass db to the handler so it can interact with Firestore
  await handleIncomingSms(req, res, db);
});

app.post("/api/apply-microloan", async (req, res) => {
  const { address, farmData, paymentMethod, paymentAccount } = req.body;
  if (!address || !farmData || !paymentMethod || !paymentAccount) {
    return res.status(400).json({ error: "Missing required fields for loan application" });
  }
  try {
    const result = await executeMicroloanPipeline(address, farmData, paymentMethod, paymentAccount);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to process microloan" });
  }
});

app.listen(PORT, async () => {
  await logEvent('INFO', `Notification telemetry server successfully launched`, { port: PORT });
});