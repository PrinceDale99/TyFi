import { logger } from '../logger';
import axios from 'axios';

export interface VerificationRequest {
    farmerId: string;
    evidenceUrls: string[]; // IPFS or Cloud Storage URLs of satellite imagery, photos
    practiceType: 'crop_rotation' | 'mangrove_restoration' | 'agroforestry';
}

export interface VerificationResult {
    verified: boolean;
    confidenceScore: number;
    subsidyDiscountAmount: number; // in USDC
}

/**
 * Validates carbon/regenerative farming practices.
 * Phase 3 uses a hybrid AI + Manual verification pipeline.
 */
export async function verifyCarbonPractices(req: VerificationRequest): Promise<VerificationResult> {
    logger.info(`Starting carbon verification for farmer ${req.farmerId}`);
    
    // Simulate AI/Satellite Analysis (Tier 1)
    const aiConfidence = await simulateGeminiSatelliteAnalysis(req.evidenceUrls);
    
    if (aiConfidence > 0.90) {
        logger.info(`AI auto-verified practices for ${req.farmerId} with score ${aiConfidence}`);
        return {
            verified: true,
            confidenceScore: aiConfidence,
            subsidyDiscountAmount: calculateSubsidy(req.practiceType)
        };
    } else {
        logger.warn(`AI confidence too low (${aiConfidence}). Flagging for manual audit.`);
        // In production, this would trigger a manual review queue
        return {
            verified: false,
            confidenceScore: aiConfidence,
            subsidyDiscountAmount: 0
        };
    }
}

async function simulateGeminiSatelliteAnalysis(urls: string[]): Promise<number> {
    if (!urls || urls.length === 0) return 0;
    
    // Real API call to Google Gemini Vision
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            logger.warn("GEMINI_API_KEY not set. Falling back to default baseline confidence.");
            return 0.85; // Fallback only if no key is provided
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        // Construct the prompt for satellite/image analysis
        const payload = {
            contents: [{
                parts: [
                    { text: "Analyze this satellite/drone imagery of a farm. Provide a confidence score from 0.0 to 1.0 on whether the farm is practicing regenerative agriculture (e.g. crop rotation, healthy mangrove presence). Output ONLY the number." },
                    // Assuming the first URL is an image we can pass
                    { fileData: { fileUri: urls[0], mimeType: "image/jpeg" } }
                ]
            }]
        };

        const response = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
        
        const textOutput = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
        const confidence = parseFloat(textOutput);
        
        return isNaN(confidence) ? 0.5 : confidence;
    } catch (error: any) {
        logger.error(`Gemini API failed: ${error.message}`);
        return 0; // Fail safe
    }
}

function calculateSubsidy(practice: string): number {
    switch (practice) {
        case 'mangrove_restoration': return 50; // $50 USDC equivalent premium discount
        case 'crop_rotation': return 20;
        case 'agroforestry': return 40;
        default: return 10;
    }
}
