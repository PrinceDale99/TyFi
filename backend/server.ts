import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { logEvent } from './logger';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Initialize Firebase Admin
if (process.env.FIREBASE_PROJECT_ID) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      })
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
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    await logEvent('ERROR', 'Gemini Proxy Error', { errorMessage: error.message });
    res.status(500).json({ error: 'Failed to communicate with AI service' });
  }
});

app.listen(PORT, async () => {
  await logEvent('INFO', `Notification telemetry server successfully launched`, { port: PORT });
});
