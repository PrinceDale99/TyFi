import axios from 'axios';
import admin from 'firebase-admin';
import { logEvent } from './logger';
import { processImageClaim } from './imageAssessor';
import { enqueueSms, dequeueSms } from './offlineQueue';
import { initiateFiatSweep } from './pdax';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+14176702344';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SMSAPIPH_API_KEY_1 = process.env.SMSAPIPH_API_KEY_1 || 'sk-2b10gae3brwm1sfusc6kjalevokaileq';
const SMSAPIPH_API_KEY_2 = process.env.SMSAPIPH_API_KEY_2 || 'sk-2b10fnnauqecwrkpdfxf9nbtaopsag8j';
const HTTPSMS_API_KEY = process.env.HTTPSMS_API_KEY || 'uk_NhBONIPuV20POXEZ_wzsTma8EoFAjBv_Or1y2p5uDdB7rZebfM-3r7nYkM2dVU22';

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
export async function sendSms(to: string, text: string) {
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

  // 4. Send via HttpSms (Concurrent)
  const httpSmsPromise = axios.post(
    'https://api.httpsms.com/v1/messages/send',
    {
      to: to,
      content: text
    },
    {
      headers: {
        'x-api-key': HTTPSMS_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  ).then(response => {
    logEvent('INFO', 'Sent SMS via HttpSms', { to });
    return response.data;
  }).catch(error => {
    logEvent('ERROR', 'Failed to send SMS via HttpSms', { errorMessage: error.message });
  });
  promises.push(httpSmsPromise);

  // Wait for all four to complete
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
  }

  const normalizedMsg = (messageTextRaw || '').trim().toUpperCase();

  // COMMAND ROUTER
  if (normalizedMsg === 'HELP' || normalizedMsg === 'INFO') {
    if (!isRetry) res.status(200).send('OK');
    await sendSms(fromNumber, "TyFi Commands:\n- CLAIM: Start a new claim conversation.\n- AUTO CLAIM: Instantly check your registered farm against the weather oracle for payout.\n- EDIT PAYMENT [Method] [Account]: Update payout details (e.g., EDIT PAYMENT GCASH 09123456789).");
    return;
  }

  if (normalizedMsg === 'AUTO CLAIM') {
    if (!isRetry) res.status(200).send('OK');
    if (!db) return;
    
    // Check if farmer is registered securely by phone number
    const farmersQuery = await db.collection('farmers').where('phoneNumber', '==', fromNumber).limit(1).get();
    
    if (farmersQuery.empty) {
      await sendSms(fromNumber, "AUTO CLAIM DENIED: Your phone number is not registered to a farm in the TyFi system. Please register first.");
      return;
    }
    
    const farmerDoc = farmersQuery.docs[0];
    const farmerData = farmerDoc.data();
    
    // Check oracle
    let oracleData = "PAGASA Oracle Data: Unavailable.";
    try {
      const pagasaRes = await axios.get('http://localhost:3001/api/pagasa-weather');
      oracleData = pagasaRes.data.data.title + " " + pagasaRes.data.data.summary;
    } catch (e) {
      // ignore
    }
    
    if (oracleData.toLowerCase().includes("no active") || oracleData.toLowerCase().includes("unavailable")) {
      await sendSms(fromNumber, "AUTO CLAIM DENIED: The weather oracle does not detect an active severe typhoon at your registered coordinates.");
    } else {
      const prefs = {
        provider: farmerData.paymentMethod || 'gcash',
        accountNumber: farmerData.paymentAccount || '09000000000',
        accountName: farmerData.name || 'Typhoon Survivor',
        method: 'fiat'
      };

      const payoutAmount = farmerData.insuredValue || 15000;

      try {
        await sendSms(fromNumber, `Processing... We are routing your AUTO CLAIM payout of PHP ${payoutAmount} to ${prefs.provider}. Please wait.`);

        const txId = await initiateFiatSweep(payoutAmount, prefs);
        
        await db.collection('claims').add({
          phoneNumber: fromNumber,
          walletAddress: farmerDoc.id,
          source: 'AUTO_CLAIM_SMS',
          pdaxTxId: txId,
          status: 'PAID',
          amount: payoutAmount,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await sendSms(fromNumber, `✅ AUTO CLAIM APPROVED: Typhoon conditions confirmed. PHP ${payoutAmount} has been sent to your ${prefs.provider}. Ref: ${txId}`);
      } catch (e: any) {
        await sendSms(fromNumber, `⚠️ AUTO CLAIM ERROR: Approved, but payout failed. Error: ${e.message}`);
      }
    }
    return;
  }

  if (normalizedMsg === 'CLAIM') {
    if (!isRetry) res.status(200).send('OK');
    // Check oracle first
    let oracleData = "";
    try {
      const pagasaRes = await axios.get('http://localhost:3001/api/pagasa-weather');
      oracleData = pagasaRes.data.data.title + " " + pagasaRes.data.data.summary;
    } catch (e) {
      // ignore
    }
    
    if (oracleData.toLowerCase().includes("no active") || oracleData.toLowerCase().includes("unavailable")) {
      await sendSms(fromNumber, "CLAIM DENIED: The PAGASA weather oracle confirms there are no active typhoons. We cannot process a claim at this time.");
      return;
    }
    
    // Just start the AI process
    await sendSms(fromNumber, "TyFi Claim Started. Please reply with your City/Region and describe the crop damage.");
    if (db) {
      const sessionRef = db.collection('smsSessions').doc(fromNumber);
      await sessionRef.set({
        messages: [{ role: 'model', parts: [{ text: "TyFi Claim Started. Please reply with your City/Region and describe the crop damage." }] }],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    return;
  }

  const editPaymentMatch = normalizedMsg.match(/^EDIT PAYMENT\s+(GCASH|MAYA|TYFI)\s+([A-Z0-9]+)$/);
  if (editPaymentMatch) {
    if (!isRetry) res.status(200).send('OK');
    if (!db) return;
    
    const method = editPaymentMatch[1].toLowerCase();
    const account = editPaymentMatch[2];
    
    // Update user profile in Firestore securely by phone number
    const farmersQuery = await db.collection('farmers').where('phoneNumber', '==', fromNumber).limit(1).get();
    if (!farmersQuery.empty) {
      const farmerDoc = farmersQuery.docs[0];
      await db.collection('farmers').doc(farmerDoc.id).update({ paymentMethod: method, paymentAccount: account });
    }
    
    // Also update any active session so the AI knows
    const sessionRef = db.collection('smsSessions').doc(fromNumber);
    const sessionDoc = await sessionRef.get();
    if (sessionDoc.exists) {
      await sessionRef.set({ paymentMethod: method, paymentAccount: account }, { merge: true });
    }
    
    await sendSms(fromNumber, `Success: Your payout preference has been updated to ${method.toUpperCase()} (${account}). Future payouts will be routed here.`);
    return;
  }

  if (!isRetry) res.status(200).send('OK'); // Acknowledge webhook quickly to Twilio

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
      
      const farmersQuery = await db.collection('farmers').where('phoneNumber', '==', fromNumber).limit(1).get();
      const farmerDoc = !farmersQuery.empty ? farmersQuery.docs[0] : null;
      const farmerData = farmerDoc ? farmerDoc.data() : {};
      
      const payoutAmount = imageAnalysisData?.repair_estimate_php || farmerData?.insuredValue || 15000;
      
      const prefs = {
        provider: claimData.payment_method || 'gcash',
        accountNumber: claimData.payment_account || '09000000000',
        accountName: farmerData?.name || 'Typhoon Survivor',
        method: 'fiat'
      };

      try {
        await sendSms(fromNumber, `Processing... AI Assessment complete. Routing PHP ${payoutAmount} payout to ${prefs.provider}.`);

        const txId = await initiateFiatSweep(payoutAmount, prefs);
        
        // Save claim
        await db.collection('claims').add({
          phoneNumber: fromNumber,
          walletAddress: farmerDoc ? farmerDoc.id : null,
          ...claimData,
          ipfs_hash: imageAnalysisData?.ipfs_hash || null,
          damage_score: imageAnalysisData?.damage_score || null,
          repair_estimate_php: imageAnalysisData?.repair_estimate_php || null,
          source: 'SMS_WITH_VISION',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          status: 'PAID',
          amount: payoutAmount,
          pdaxTxId: txId,
        });

        // Send confirmation
        const finalMsg = `✅ CLAIM SUCCESS: PHP ${payoutAmount} has been sent to your ${prefs.provider} account. Ref: ${txId}`;
        await sendSms(fromNumber, finalMsg);
      } catch (e: any) {
        await sendSms(fromNumber, `⚠️ Claim filed, but payout routing failed. Error: ${e.message}`);
      }
      
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
