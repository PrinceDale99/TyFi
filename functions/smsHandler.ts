import axios from 'axios';
import admin from 'firebase-admin';
import { logEvent } from './logger';
import { processImageClaim } from './imageAssessor';
import { enqueueSms, dequeueSms } from './offlineQueue';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+14176702344';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SMSAPIPH_API_KEY_1 = process.env.SMSAPIPH_API_KEY_1 || 'sk-2b10gae3brwm1sfusc6kjalevokaileq';
const SMSAPIPH_API_KEY_2 = process.env.SMSAPIPH_API_KEY_2 || 'sk-2b10fnnauqecwrkpdfxf9nbtaopsag8j';

const SYSTEM_PROMPT = `You are the TyFi Emergency SMS Assistant. You must be direct, extremely concise, and get straight to the point. No small talk.
Your ONLY goal is to instantly collect the information required for their insurance claim:
1. Their location (City/Region).
2. The specific damage to their property or crops.
3. Their preferred payout method (TyFi Wallet, GCash, or Maya).
4. Their account number/address for the chosen payout method.

ORACLE VERIFICATION:
You are equipped with live PAGASA weather oracle data. If the oracle data (provided below) states there is NO active tropical cyclone or hurricane, you MUST reject the claim immediately. Tell the user "Claim Denied: The PAGASA weather oracle does not detect an active typhoon in the Philippine Area of Responsibility." and immediately output [CLAIM_REJECTED].

Immediately ask for any missing information in a single, direct sentence (e.g. "To process your claim, please reply with your City, specific damage, preferred payout method (GCash/Maya/TyFi), and account number.").

Completion Protocol:
Once you have the location, damage, payout method, and account number, do NOT send any more messages. Reply with EXACTLY this text and nothing else: [CLAIM_COMPLETE]`;

// Helper to send SMS concurrently via Twilio and dual SMS API PH endpoints
async function sendSms(to: string, text: string) {
  const promises = [];

  // 1. Send via Twilio
  const twilioPromise = axios.post(
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
  ).then(response => {
    logEvent('INFO', 'Sent SMS via Twilio', { to });
    return response.data;
  }).catch(error => {
    logEvent('ERROR', 'Failed to send SMS via Twilio', { errorMessage: error.message });
  });
  promises.push(twilioPromise);

  // 2. Send via SMS API PH (Primary Key)
  const smsApiPhPromise1 = axios.post(
    'https://smsapiph.onrender.com/api/v1/send/sms',
    {
      recipient: to,
      message: text
    },
    {
      headers: {
        'x-api-key': SMSAPIPH_API_KEY_1,
        'Content-Type': 'application/json'
      }
    }
  ).then(response => {
    logEvent('INFO', 'Sent SMS via SMS API PH (Key 1)', { to });
    return response.data;
  }).catch(error => {
    logEvent('ERROR', 'Failed to send SMS via SMS API PH (Key 1)', { errorMessage: error.message });
  });
  promises.push(smsApiPhPromise1);

  // 3. Send via SMS API PH (Secondary Key)
  const smsApiPhPromise2 = axios.post(
    'https://smsapiph.onrender.com/api/v1/send/sms',
    {
      recipient: to,
      message: text
    },
    {
      headers: {
        'x-api-key': SMSAPIPH_API_KEY_2,
        'Content-Type': 'application/json'
      }
    }
  ).then(response => {
    logEvent('INFO', 'Sent SMS via SMS API PH (Key 2)', { to });
    return response.data;
  }).catch(error => {
    logEvent('ERROR', 'Failed to send SMS via SMS API PH (Key 2)', { errorMessage: error.message });
  });
  promises.push(smsApiPhPromise2);

  // Wait for all three to complete
  await Promise.all(promises);
  return { success: true };
}

// Call Gemini
async function callGemini(messages: any[]) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing');
  
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  // Fetch Oracle Data
  let oracleData = "PAGASA Oracle Data: Unavailable.";
  try {
    const pagasaRes = await axios.get('http://localhost:3001/api/pagasa-weather');
    oracleData = `PAGASA Oracle Data: ${pagasaRes.data.data.title} - ${pagasaRes.data.data.summary}`;
  } catch (e) {
    console.error("Oracle fetch failed", e);
  }

  const contents = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT + "\\n\\nCURRENT ORACLE DATA:\\n" + oracleData }] },
    { role: 'model', parts: [{ text: 'Understood. I will act as the TyFi Emergency SMS Assistant and enforce the Oracle verification.' }] },
    ...messages
  ];

  const response = await axios.post(API_URL, { contents });
  return response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// Extract Claim Data using Gemini JSON mode
async function extractClaimData(messages: any[]) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing');
  
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const transcript = messages.map((m: any) => `${m.role}: ${m.parts[0].text}`).join('\\n');
  const prompt = `Here is a transcript of an SMS conversation with a typhoon victim. Extract the user's location, damage_description, payment_method (GCash, Maya, or TyFi), and payment_account into a strict JSON object. Transcript:\\n\\n${transcript}`;

  const response = await axios.post(API_URL, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  });
  
  const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
  return JSON.parse(rawText);
}

export async function handleIncomingSms(req: any, res: any, db: admin.firestore.Firestore | null, isRetry: boolean = false) {
  // Twilio sends Form-Encoded data: 'From', 'Body', and possibly 'MediaUrl0'
  const fromNumber = req.body.From || req.query.From;
  const messageTextRaw = req.body.Body || req.query.Body;
  const mediaUrl = req.body.MediaUrl0 || req.query.MediaUrl0;

  if (!fromNumber) {
    if (!isRetry) res.status(400).json({ error: 'Missing from' });
    return;
  }

  // 1. Enqueue in Offline Mesh if it's a new message
  let queueId = '';
  if (!isRetry) {
    queueId = await enqueueSms(fromNumber, messageTextRaw, mediaUrl);
    res.status(200).send('OK'); // Acknowledge webhook quickly to Twilio
  }

  await logEvent('INFO', 'Processing Incoming SMS', { from: fromNumber, text: messageTextRaw, mediaUrl, isRetry });

  if (!db) {
    await logEvent('ERROR', 'Firestore not initialized');
    return; // Don't dequeue, so it retries later
  }

  try {
    const sessionRef = db.collection('smsSessions').doc(fromNumber);
    const sessionDoc = await sessionRef.get();
    
    let messages = [];
    let imageAnalysisData: any = null;

    if (sessionDoc.exists) {
      messages = sessionDoc.data()?.messages || [];
      imageAnalysisData = sessionDoc.data()?.imageAnalysisData || null;
    }

    // Process image if sent
    let messageText = messageTextRaw;
    if (mediaUrl) {
        const assessment = await processImageClaim(mediaUrl);
        imageAnalysisData = assessment;
        messageText += `\n[SYSTEM NOTE: User attached an image. AI Vision Analysis states -> Damage Score: ${assessment.damage_score}%, Description: ${assessment.description}]`;
    }

    // Add user's new message
    messages.push({ role: 'user', parts: [{ text: messageText }] });

    // Get Gemini's response
    const geminiReply = await callGemini(messages);
    await logEvent('INFO', '🤖 AI RESPONSE:', { text: geminiReply });

    if (geminiReply.includes('[CLAIM_REJECTED]')) {
      await sendSms(fromNumber, geminiReply.replace('[CLAIM_REJECTED]', '').trim());
      await sessionRef.delete();
      await logEvent('WARNING', 'SMS Claim Rejected by Oracle', { from: fromNumber });
      return;
    }

    if (geminiReply.includes('[CLAIM_COMPLETE]')) {
      // Claim is done, extract data
      const claimData = await extractClaimData(messages);
      
      // Save claim
      await db.collection('claims').add({
        phoneNumber: fromNumber,
        ...claimData,
        ipfs_hash: imageAnalysisData?.ipfs_hash || null,
        damage_score: imageAnalysisData?.damage_score || null,
        repair_estimate_php: imageAnalysisData?.repair_estimate_php || null,
        source: 'SMS_WITH_VISION',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'PENDING_PAYOUT'
      });

      // Send confirmation
      const finalMsg = `Thank you. Your claim has been verified by the weather oracle and filed successfully. Your payout will be sent to your ${claimData.payment_method || 'account'} shortly.`;
      await sendSms(fromNumber, finalMsg);
      
      // Clear session
      await sessionRef.delete();
      await logEvent('INFO', 'SMS Claim Filed successfully', { from: fromNumber, ipfsHash: imageAnalysisData?.ipfs_hash });

    } else {
      // Send the question back to the user
      await sendSms(fromNumber, geminiReply);

      // Save assistant reply to history
      messages.push({ role: 'model', parts: [{ text: geminiReply }] });
      const sessionDataToSave: any = {
        messages,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (imageAnalysisData) {
        sessionDataToSave.imageAnalysisData = imageAnalysisData;
      }

      await sessionRef.set(sessionDataToSave, { merge: true });
    }

    // 2. Dequeue successfully processed message
    if (!isRetry && queueId) {
        dequeueSms(queueId);
    }

  } catch (error: any) {
    await logEvent('ERROR', 'Error handling SMS webhook (Message kept in offline queue)', { errorMessage: error.message });
    throw error; // Let the caller (flush mechanism) know it failed
  }
}
