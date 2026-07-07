import axios from 'axios';
import FormData from 'form-data';
import { logEvent } from './logger';

const PINATA_API_KEY = process.env.PINATA_API_KEY || '';
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export interface AssessmentResult {
    damage_score: number;
    repair_estimate_php: number;
    ipfs_hash: string;
    description: string;
}

/**
 * Uploads image buffer to Pinata IPFS
 */
async function uploadToIPFS(imageBuffer: Buffer, mimeType: string): Promise<string> {
    if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
        throw new Error('Pinata API keys are missing in environment variables');
    }

    const formData = new FormData();
    formData.append('file', imageBuffer, {
        filename: `claim_image_${Date.now()}.jpg`,
        contentType: mimeType
    });

    try {
        const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
            headers: {
                ...formData.getHeaders(),
                pinata_api_key: PINATA_API_KEY,
                pinata_secret_api_key: PINATA_SECRET_API_KEY
            }
        });
        
        return response.data.IpfsHash;
    } catch (error: any) {
        await logEvent('ERROR', 'IPFS Upload Failed', { errorMessage: error.message });
        throw new Error('Failed to upload image to IPFS');
    }
}

/**
 * Calls Gemini Vision API to analyze farm damage
 */
async function analyzeDamageWithGemini(base64Image: string, mimeType: string): Promise<{ score: number, estimate: number, description: string }> {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_API_KEY}`;
    
    const prompt = `You are an expert agricultural insurance adjuster. 
Analyze the provided image of a farm or property affected by a typhoon.
Respond with a strict JSON object containing:
1. "damage_score": an integer from 0 to 100 representing the percentage of destruction.
2. "repair_estimate_php": an integer estimating the repair cost in Philippine Pesos (PHP).
3. "description": a short 1-sentence explanation of what you see.
Do not wrap the JSON in markdown blocks, just return the raw JSON object.`;

    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Image
                        }
                    }
                ]
            }
        ]
    };

    try {
        const response = await axios.post(API_URL, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });

        const textResponse = response.data.candidates[0].content.parts[0].text;
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        
        return {
            score: parsed.damage_score || 0,
            estimate: parsed.repair_estimate_php || 0,
            description: parsed.description || "Damage assessed."
        };
    } catch (error: any) {
        await logEvent('ERROR', 'Gemini Vision Analysis Failed', { errorMessage: error.message });
        throw new Error('Failed to analyze image with Gemini');
    }
}

/**
 * Main Pipeline: Downloads image, uploads to IPFS, and analyzes with Gemini Vision.
 */
export async function processImageClaim(mediaUrl: string): Promise<AssessmentResult> {
    await logEvent('INFO', 'Starting Multi-Modal Image Assessment', { mediaUrl });

    // 1. Download image from Twilio Media URL
    const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');
    const mimeType = response.headers['content-type'] || 'image/jpeg';

    // 2. Upload to IPFS in parallel with Gemini Analysis
    const base64Image = imageBuffer.toString('base64');
    
    const [ipfsHash, aiAnalysis] = await Promise.all([
        uploadToIPFS(imageBuffer, mimeType).catch(e => {
            logEvent('WARNING', 'IPFS upload skipped/failed', { error: e.message });
            return 'IPFS_UPLOAD_FAILED_OR_SKIPPED';
        }),
        analyzeDamageWithGemini(base64Image, mimeType)
    ]);

    const result: AssessmentResult = {
        damage_score: aiAnalysis.score,
        repair_estimate_php: aiAnalysis.estimate,
        description: aiAnalysis.description,
        ipfs_hash: ipfsHash
    };

    await logEvent('INFO', 'Image Assessment Completed', { result });
    return result;
}
