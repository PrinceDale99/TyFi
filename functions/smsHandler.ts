import axios from 'axios';
import admin from 'firebase-admin';
import { logEvent } from './logger';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+14176702344';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `You are the TyFi Emergency SMS Assistant. You must be direct, extremely concise, and get straight to the point. No small talk. No asking if they are safe.
Your ONLY goal is to instantly collect the information required for their insurance claim:
1. Their location (City/Region).
2. The specific damage to their property or crops.
3. Their TyFi wallet address.

Immediately ask for any missing information in a single, direct sentence (e.g. "To process your claim, please reply with your City, the specific damage, and your TyFi wallet address.").

Completion Protocol:
Once you have the location, damage, and wallet address, do NOT send any more messages. Reply with EXACTLY this text and nothing else: [CLAIM_COMPLETE]`;

// Helper to send SMS via Twilio
async function sendSms(to: string, text: string) {
  try {
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      new URLSearchParams({
        To: to,
        From: TWILIO_PHONE_NUMBER,
        Body: text
      }),
      {
        auth: {
          username: TWILIO_ACCOUNT_SID,
          password: TWILIO_AUTH_TOKEN
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    await logEvent('INFO', 'Sent SMS via Twilio', { to });
    return response.data;
  } catch (error: any) {
    await logEvent('ERROR', 'Failed to send SMS via Twilio', { errorMessage: error.message });
    throw error;
  }
}

// Call Gemini
async function callGemini(messages: any[]) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing');
  
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  const contents = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: 'Understood. I will act as the TyFi Emergency SMS Assistant and follow the protocols.' }] },
    ...messages
  ];

  const response = await axios.post(API_URL, { contents });
  return response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// Extract Claim Data using Gemini JSON mode
async function extractClaimData(messages: any[]) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing');
  
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  const transcript = messages.map((m: any) => `${m.role}: ${m.parts[0].text}`).join('\\n');
  const prompt = `Here is a transcript of an SMS conversation with a typhoon victim. Extract the policy_number, safety_status, and damage_description into a JSON object. If policy number is missing, put their name. Transcript:\\n\\n${transcript}`;

  const response = await axios.post(API_URL, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  });
  
  const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
  return JSON.parse(rawText);
}

export async function handleIncomingSms(req: any, res: any, db: admin.firestore.Firestore | null) {
  // Twilio sends Form-Encoded data: 'From' and 'Body'
  const fromNumber = req.body.From || req.query.From;
  const messageText = req.body.Body || req.query.Body;

  if (!fromNumber || !messageText) {
    return res.status(400).json({ error: 'Missing from or text' });
  }

  await logEvent('INFO', 'Received Incoming SMS', { from: fromNumber, text: messageText });

  if (!db) {
    await logEvent('ERROR', 'Firestore not initialized');
    return res.status(500).json({ error: 'Database not initialized' });
  }

  res.status(200).send('OK'); // Acknowledge webhook quickly

  try {
    const sessionRef = db.collection('smsSessions').doc(fromNumber);
    const sessionDoc = await sessionRef.get();
    
    let messages = [];
    if (sessionDoc.exists) {
      messages = sessionDoc.data()?.messages || [];
    }

    // Add user's new message
    messages.push({ role: 'user', parts: [{ text: messageText }] });

    // Get Gemini's response
    const geminiReply = await callGemini(messages);
    await logEvent('INFO', '🤖 AI RESPONSE:', { text: geminiReply });

    if (geminiReply.includes('[CLAIM_COMPLETE]')) {
      // Claim is done, extract data
      const claimData = await extractClaimData(messages);
      
      // Save claim
      await db.collection('claims').add({
        phoneNumber: fromNumber,
        ...claimData,
        source: 'SMS',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'PENDING_REVIEW'
      });

      // Send confirmation
      const finalMsg = `Thank you. Your claim for policy ${claimData.policy_number || ''} has been filed successfully and marked urgent. We will text you updates here.`;
      await sendSms(fromNumber, finalMsg);
      
      // Clear session
      await sessionRef.delete();
      await logEvent('INFO', 'SMS Claim Filed successfully', { from: fromNumber });

    } else {
      // Send the question back to the user
      await sendSms(fromNumber, geminiReply);

      // Save assistant reply to history
      messages.push({ role: 'model', parts: [{ text: geminiReply }] });
      await sessionRef.set({
        messages,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

  } catch (error: any) {
    await logEvent('ERROR', 'Error handling SMS webhook', { errorMessage: error.message });
  }
}
