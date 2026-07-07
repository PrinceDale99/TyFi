import fs from 'fs';
import path from 'path';
import { logEvent } from './logger';
import { handleIncomingSms } from './smsHandler';
import admin from 'firebase-admin';

const QUEUE_FILE = path.join(__dirname, 'offline_queue.json');

export interface QueuedSms {
    id: string;
    from: string;
    body: string;
    mediaUrl?: string;
    timestamp: number;
    retryCount: number;
}

/**
 * Ensures the queue file exists
 */
function ensureQueueExists() {
    if (!fs.existsSync(QUEUE_FILE)) {
        fs.writeFileSync(QUEUE_FILE, JSON.stringify([]), 'utf-8');
    }
}

/**
 * Adds an incoming SMS to the offline-first mesh queue.
 */
export async function enqueueSms(from: string, body: string, mediaUrl?: string): Promise<string> {
    ensureQueueExists();
    const queue: QueuedSms[] = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
    
    const id = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    queue.push({
        id,
        from,
        body,
        mediaUrl,
        timestamp: Date.now(),
        retryCount: 0
    });

    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
    await logEvent('INFO', 'SMS Enqueued in Offline Mesh', { id, from });
    
    return id;
}

/**
 * Removes an SMS from the queue once it has been successfully processed.
 */
export function dequeueSms(id: string) {
    ensureQueueExists();
    let queue: QueuedSms[] = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
    queue = queue.filter(msg => msg.id !== id);
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
}

/**
 * Flushes the queue, attempting to process all pending offline messages.
 * This should be called by a Cron job or whenever network is restored.
 */
export async function flushOfflineQueue(db: admin.firestore.Firestore | null) {
    if (!db) return;
    
    ensureQueueExists();
    const queue: QueuedSms[] = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));

    if (queue.length === 0) return;

    await logEvent('INFO', `Flushing ${queue.length} messages from Offline Mesh Queue`);

    for (const msg of queue) {
        try {
            // Reconstruct a mock request object for the smsHandler
            const req = {
                body: { From: msg.from, Body: msg.body, MediaUrl0: msg.mediaUrl },
                query: {}
            };
            
            const res = {
                status: () => ({ json: () => {}, send: () => {} }),
            };

            await handleIncomingSms(req, res, db, true); // true flag for 'isRetry' to avoid re-queueing
            
            // If successful, remove from queue
            dequeueSms(msg.id);
            await logEvent('INFO', `Successfully flushed queued message`, { id: msg.id });

        } catch (error: any) {
            await logEvent('ERROR', 'Failed to flush queued message', { id: msg.id, error: error.message });
            // Increment retry count
            msg.retryCount += 1;
        }
    }
    
    // Save updated retry counts
    const updatedQueue: QueuedSms[] = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
    for (const msg of queue) {
        const index = updatedQueue.findIndex(u => u.id === msg.id);
        if (index !== -1) updatedQueue[index].retryCount = msg.retryCount;
    }
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(updatedQueue, null, 2), 'utf-8');
}
