import { logger } from '../logger';
import crypto from 'crypto';
import vision from '@google-cloud/vision';

/**
 * Handles ephemeral storage of PII data.
 * Adheres to Data Privacy Act (NPC) by purging documents right after verification
 * and storing only non-reversible hashes.
 */
export async function processKycDocument(userId: string, documentBuffer: Buffer): Promise<string> {
    logger.info(`Processing KYC document for ${userId}`);
    
    // 1. Temporarily hold document in memory/ephemeral storage
    const tempStorageId = await storeEphemerally(documentBuffer);
    
    // 2. Perform OCR / Identity Verification via partner API
    const isVerified = await verifyIdentityWithPartner(tempStorageId);
    
    // 3. Generate non-reversible hash for on-chain identity binding
    const docHash = crypto.createHash('sha256').update(documentBuffer).digest('hex');
    
    // 4. PURGE RAW DATA
    await purgeEphemeralData(tempStorageId);
    logger.info(`Purged ephemeral KYC data for ${userId}`);
    
    if (!isVerified) {
        throw new Error("Identity verification failed.");
    }
    
    return docHash;
}

async function storeEphemerally(buffer: Buffer): Promise<string> {
    // In a real environment, this goes to an ephemeral Redis/Memcached instance
    // For this demonstration, we use a simple in-memory ephemeral store
    const id = `temp_${crypto.randomUUID()}`;
    ephemeralStore.set(id, buffer);
    return id;
}

const ephemeralStore = new Map<string, Buffer>();

async function verifyIdentityWithPartner(tempId: string): Promise<boolean> {
    const buffer = ephemeralStore.get(tempId);
    if (!buffer) return false;

    try {
        const client = new vision.ImageAnnotatorClient();
        
        // Call the Google Cloud Vision SDK directly using the injected service account
        const [result] = await client.documentTextDetection(buffer);
        const text = result.fullTextAnnotation?.text || "";
        
        logger.info(`Vision OCR Result extracted length: ${text.length}`);
        
        // Basic RSBSA validation criteria: checks if document contains words like 'RSBSA' or 'Republic of the Philippines'
        return text.includes("RSBSA") || text.includes("Republic");
    } catch (error: any) {
        logger.error(`Vision API KYC check failed: ${error.message}`);
        return false;
    }
}

async function purgeEphemeralData(tempId: string): Promise<void> {
    // Purge the data from memory to strictly comply with Data Privacy Act
    ephemeralStore.delete(tempId);
}
