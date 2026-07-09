import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import jwt from 'jsonwebtoken';
import { logEvent } from './logger';
import { generateCertificate } from './certificateService';
import { handleIncomingSms } from './smsHandler';
import { pdaxRouter } from './pdaxService';
import { oracleRouter } from './oracle';
import { calculateBondYield } from './bondService';
import { flushOfflineQueue } from './offlineQueue';
import { executeMicroloanPipeline } from './loanService';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/oracle', oracleRouter);

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

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
  const { address, amount } = req.body;
  const region = req.body.region || 'Philippines';
  const currency = req.body.currency || 'XLM';
  
  await logEvent('INFO', 'Received request to dispatch payout notification', { address, amount, region });

  try {
    let fcmToken: string | null = null;
    if (db) {
      const doc = await db.collection('farmers').doc(address).get();
      fcmToken = doc.exists ? doc.data()?.fcmToken : null;
    }

    if (!fcmToken) {
      await logEvent('WARNING', `No FCM token found for address: ${address}. Logging payout without push.`);
      // Log payout to Firestore anyway even without FCM
      if (db) {
        await db.collection('payouts').add({
          farmerAddress: address,
          amount: Number(amount),
          region,
          currency,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      return res.json({ success: true, notified: false, reason: 'No FCM token on file — payout logged to Firestore' });
    }

    const message = {
      notification: {
        title: '🌀 Payout Triggered!',
        body: `Typhoon confirmed in ${region}. Payout of ${amount} ${currency} sent to your vault.`
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    
    if (db) {
      await db.collection('payouts').add({
        farmerAddress: address,
        amount: Number(amount),
        region,
        currency,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await logEvent('INFO', 'FCM payout notification dispatched', { response, address });
    res.json({ success: true, notified: true, messageId: response });
  } catch (error: any) {
    await logEvent('ERROR', 'Error dispatching payout notification', { errorMessage: error.message, address });
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
  const { address } = req.body;
  // All alert fields are optional with sensible defaults
  const farmName = req.body.farmName || 'Your Farm';
  const severity = req.body.severity || 'HIGH';
  const reason = req.body.reason || 'Severe weather conditions detected near your farm coordinates.';
  const probability = req.body.probability || 85;
  const message = req.body.message || null;

  await logEvent('INFO', 'Received weather hazard warning alert trigger', { address, farmName, severity, probability });

  try {
    let fcmToken: string | null = null;
    if (db) {
      const doc = await db.collection('farmers').doc(address).get();
      fcmToken = doc.exists ? doc.data()?.fcmToken : null;
    }

    if (!fcmToken) {
      await logEvent('WARNING', `No FCM token found for ${address}. Logging alert without push.`);
      // Log alert to Firestore anyway
      if (db) {
        await db.collection('alerts').add({
          farmerAddress: address,
          farmName,
          severity,
          reason: message || reason,
          probability,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          pushed: false
        });
      }
      return res.json({ success: true, notified: false, reason: 'No FCM token on file — alert logged to Firestore' });
    }

    const notificationBody = message || `High risk of storm impact (${probability}% probability). Level: ${severity}. ${reason}`;
    const fcmMessage = {
      notification: {
        title: `⚠️ Weather Alert: ${farmName}`,
        body: notificationBody
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(fcmMessage);
    if (db) {
      await db.collection('alerts').add({
        farmerAddress: address,
        farmName,
        severity,
        reason: message || reason,
        probability,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        pushed: true,
        messageId: response
      });
    }
    await logEvent('INFO', 'FCM warning alert dispatched', { response, address });
    res.json({ success: true, notified: true, messageId: response });
  } catch (error: any) {
    await logEvent('ERROR', 'Error dispatching FCM warning alert', { errorMessage: error.message, address });
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.post('/api/ai/analyze-weather', async (req, res) => {
  // Support both raw `contents` (direct Gemini payload) and structured {location, metrics} payload
  const { contents, location, metrics } = req.body;
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    await logEvent('ERROR', 'Gemini API Key missing in environment variables');
    return res.status(500).json({ error: 'AI service configuration error: Missing API Key' });
  }

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  // Build a proper Gemini contents payload from structured data if contents is not provided
  let geminiContents = contents;
  if (!geminiContents || !Array.isArray(geminiContents) || geminiContents.length === 0) {
    const loc = location || 'Philippines';
    const m = metrics || {};
    const prompt = `You are TyFi's parametric insurance weather risk AI. Analyze the following weather data for ${loc} and assess the typhoon insurance trigger risk.

Weather Metrics:
- Wind Speed: ${m.windSpeed ?? 'N/A'} km/h
- Rainfall: ${m.rainfall ?? 'N/A'} mm
- Atmospheric Pressure: ${m.pressure ?? 'N/A'} hPa

Provide: 1) Risk Level (LOW/MEDIUM/HIGH/CRITICAL), 2) Whether the parametric trigger threshold is met (wind ≥ 150 km/h or rainfall ≥ 200mm in 24h), 3) Recommended action for the farmer, 4) Estimated payout probability as a percentage. Be concise and structured.`;
    geminiContents = [{ role: 'user', parts: [{ text: prompt }] }];
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: geminiContents }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      await logEvent('ERROR', 'Gemini API Error Response', { 
        status: response.status,
        errorData: data 
      });
      return res.status(response.status).json(data);
    }

    // Extract the text for convenience
    const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    res.json({ success: true, analysis, raw: data });
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
    let combinedUpdate = { title: '', summary: '', date: new Date().toISOString(), source: '' };
    
    // Fetch from both oracles concurrently
    const [pagasaResult, nasaResult] = await Promise.allSettled([
      axios.get('https://bagong.pagasa.dost.gov.ph/', { timeout: 3000 }),
      axios.get(`https://eonet.gsfc.nasa.gov/api/v3/events?category=severeStorms&status=open&api_key=${process.env.NASA_API_KEY || 'ttZtcju8urEIdB7HfyICZiRj7UfQ3FiuzwGKpvxa'}`, { timeout: 5000 })
    ]);

    let pagasaData = null;
    let nasaData = null;

    if (pagasaResult.status === 'fulfilled') {
      const $ = cheerio.load(pagasaResult.value.data);
      const pTitle = $('.weather-bulletin-title').first().text().trim();
      const pSummary = $('.weather-bulletin-summary').first().text().trim();
      if (pTitle && pSummary) {
        pagasaData = { title: pTitle, summary: pSummary };
      }
    } else {
      await logEvent('WARNING', 'PAGASA Scraping failed');
    }

    if (nasaResult.status === 'fulfilled') {
      const events = nasaResult.value.data.events;
      if (events && events.length > 0) {
        const storm = events[0]; // Most recent active storm
        nasaData = {
          title: `NASA Global Alert: ${storm.title}`,
          summary: `NASA Earth Observatory detected a severe storm event. Status: Open. Source: ${storm.sources[0]?.url || 'NASA'}`
        };
      } else {
        nasaData = {
          title: 'Global Severe Storm Advisory',
          summary: 'NASA EONET: No active severe storms currently tracked globally or near the Philippine Area of Responsibility.'
        };
      }
    } else {
      await logEvent('WARNING', 'NASA EONET API failed');
    }

    if (pagasaData && nasaData) {
      combinedUpdate.source = 'PAGASA & NASA EONET';
      combinedUpdate.title = `${pagasaData.title} | ${nasaData.title}`;
      combinedUpdate.summary = `[PAGASA] ${pagasaData.summary}\n\n[NASA] ${nasaData.summary}`;
    } else if (pagasaData) {
      combinedUpdate.source = 'PAGASA';
      combinedUpdate.title = pagasaData.title;
      combinedUpdate.summary = pagasaData.summary;
    } else if (nasaData) {
      combinedUpdate.source = 'NASA EONET';
      combinedUpdate.title = nasaData.title;
      combinedUpdate.summary = nasaData.summary;
    } else {
      throw new Error('Both PAGASA and NASA oracles failed to return data');
    }

    res.json({ success: true, data: combinedUpdate });
  } catch (error: any) {
    await logEvent('ERROR', 'Weather Oracle completely failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch weather data from all Oracles' });
  }
});

app.post('/api/generate-certificate', async (req, res) => {
  const { address, region, season, txHash } = req.body;
  // farmId may come in as `farmId` or `crop`; coerce premium to number
  const farmId = req.body.farmId || req.body.crop || 'Unknown Farm';
  const premium = parseFloat(String(req.body.premium)) || 0;
  
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
    res.status(500).json({ error: `Failed to generate certificate: ${error.message}` });
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

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

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

// ==========================================
// AUTHENTICATION & PERSISTENCE ROUTES
// ==========================================

const JWT_SECRET = process.env.JWT_SECRET || 'tyfi_super_secret_jwt_key_for_testnet_only';

// 1. Login or Create Profile using Wallet Address
app.post('/api/auth/login', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  await logEvent('INFO', 'User login attempt', { address });

  try {
    // Generate JWT
    const token = jwt.sign({ address }, JWT_SECRET, { expiresIn: '7d' });
    
    let userProfile = { address, createdAt: new Date().toISOString() };

    if (db) {
      const userRef = db.collection('users').doc(address);
      const doc = await userRef.get();
      
      if (!doc.exists) {
        // Create new user profile if it doesn't exist
        await userRef.set(userProfile);
        await logEvent('INFO', 'New user profile created', { address });
      } else {
        userProfile = doc.data() as any;
      }
    }

    res.json({ success: true, token, user: userProfile });
  } catch (error: any) {
    await logEvent('ERROR', 'Login failed', { errorMessage: error.message });
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// 2. Fetch authenticated user profile
app.get('/api/users/profile', authenticateToken, async (req: any, res: any) => {
  const { address } = req.user;
  
  if (!db) {
    return res.json({ success: true, user: { address, mock: true } });
  }

  try {
    const doc = await db.collection('users').doc(address).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, user: doc.data() });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
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

app.post('/api/pdax/webhook', async (req, res) => {
  const payload = req.body;
  
  if (!db) {
    return res.status(500).json({ error: 'Firestore not initialized' });
  }

  try {
    await logEvent('INFO', 'Received PDAX Webhook', { payload });

    // PDAX webhooks typically contain event_type, status, and reference ID.
    // e.g. { event_type: "WITHDRAWAL_STATUS_CHANGED", data: { reference_id: "...", status: "SUCCESS" } }
    
    // Save raw webhook event for audit trail
    await db.collection('pdax_webhooks').add({
      timestamp: new Date().toISOString(),
      payload
    });

    if (payload && payload.data && payload.data.reference_id) {
      const referenceId = payload.data.reference_id;
      const status = payload.data.status || payload.status;
      const eventType = payload.event_type || 'UNKNOWN';

      await logEvent('INFO', `Processing PDAX Webhook for Reference ID: ${referenceId}`, { status, eventType });

      // Update the offramp_transactions collection
      await db.collection('offramp_transactions').doc(referenceId).set({
        status: status,
        updatedAt: new Date().toISOString(),
        latestEvent: eventType
      }, { merge: true });
    }

    res.status(200).send('Webhook Received');
  } catch (error: any) {
    await logEvent('ERROR', 'Error processing PDAX Webhook', { error: error.message });
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, async () => {
  await logEvent('INFO', `Notification telemetry server successfully launched`, { port: PORT });
});