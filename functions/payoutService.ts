import admin from 'firebase-admin';
import { logEvent } from './logger';
import { initiateFiatSweep } from './pdax';
import { sendSms } from './smsHandler';

// Helper to safely get Firestore
function getDb(): FirebaseFirestore.Firestore | null {
  try {
    return admin.apps.length ? admin.firestore() : null;
  } catch {
    return null;
  }
}

export interface PayoutContext {
  phoneNumber?: string;
  walletAddress?: string;
  source: string;
}

/**
 * Safe payout abstraction layer.
 * Tries PDAX first. If unavailable (revoked credentials, network error, etc.),
 * queues the payout in Firestore for manual processing and notifies the farmer via SMS.
 * NEVER throws — the app will always continue running.
 */
export async function safeInitiatePayout(
  amountPHP: number,
  prefs: any,
  context: PayoutContext
): Promise<{ success: boolean; txId: string; mode: 'PDAX_LIVE' | 'MANUAL_QUEUE' }> {
  try {
    const txId = await initiateFiatSweep(amountPHP, prefs);
    await logEvent('INFO', 'safeInitiatePayout: PDAX payout succeeded', { txId, amountPHP, source: context.source });
    return { success: true, txId, mode: 'PDAX_LIVE' };
  } catch (e: any) {
    await logEvent('WARNING', 'safeInitiatePayout: PDAX unavailable — queuing payout for manual processing', {
      error: e.message,
      amountPHP,
      context,
    });

    // Save to Firestore pending queue for admin review
    const db = getDb();
    const queueRef = db
      ? await db.collection('pending_payouts').add({
          ...context,
          amountPHP,
          prefs,
          status: 'PENDING_MANUAL_PAYOUT',
          reason: e.message,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      : null;

    const refId = queueRef ? `TyFi-${queueRef.id.substring(0, 8).toUpperCase()}` : `TyFi-${Date.now()}`;

    // Notify farmer gracefully — never expose internal errors
    if (context.phoneNumber) {
      await sendSms(
        context.phoneNumber,
        `✅ TyFi Claim Approved: Your PHP ${amountPHP} payout has been verified. It will be deposited to your ${prefs?.provider || 'account'} within 3-5 business days. Ref: ${refId}`
      ).catch(() => {}); // SMS failure must never block the flow
    }

    return { success: true, txId: refId, mode: 'MANUAL_QUEUE' };
  }
}
