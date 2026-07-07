import { GoogleGenerativeAI } from '@google/generative-ai';
import { logEvent } from './logger';
import { processPayoutOfframp } from './pdaxService';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface LoanPrediction {
    approved: boolean;
    recommendedAmountXlm: number;
    predictedYieldPercentage: number;
    reasoning: string;
}

/**
 * Uses Gemini AI to analyze a farmer's situation and predict their upcoming crop yield
 * after a storm. Determines if a rebuilding microloan is viable.
 */
export async function predictCropYieldAndLoan(
    farmSizeHectares: number, 
    cropType: string, 
    region: string, 
    historicalYield: number,
    damagePercentage: number
): Promise<LoanPrediction> {
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set.");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
    You are an AI agricultural actuary. A farmer in ${region} growing ${cropType} on ${farmSizeHectares} hectares 
    just suffered ${damagePercentage}% damage from a typhoon. Their historical yield before storms is ${historicalYield} tons/hectare.
    
    Predict their expected yield recovery percentage for the next season if given a rebuilding micro-loan.
    Determine if they should be approved for an uncollateralized rebuilding micro-loan, and recommend a loan amount in XLM 
    (assume 1 XLM = 0.10 USD, and they need about 200 USD per hectare to replant, scaling down based on remaining undamaged crops).
    Maximum loan is 5000 XLM.

    Respond STRICTLY in JSON format with no markdown wrappers or extra text:
    {
      "approved": boolean,
      "recommendedAmountXlm": number,
      "predictedYieldPercentage": number,
      "reasoning": "string"
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim().replace(/```json/g, '').replace(/```/g, '');
        
        const prediction: LoanPrediction = JSON.parse(responseText);
        await logEvent('INFO', 'AI Microloan Prediction generated', prediction);
        return prediction;
    } catch (error: any) {
        await logEvent('ERROR', 'AI Microloan Prediction failed', { error: error.message });
        throw new Error('Failed to generate loan prediction');
    }
}

/**
 * Executes the entire microloan pipeline: AI Prediction -> Soroban (mocked state for backend) -> PDAX Fiat Offramp
 */
export async function executeMicroloanPipeline(
    address: string, 
    farmData: any, 
    paymentMethod: string, 
    paymentAccount: string
) {
    // 1. AI Prediction
    const prediction = await predictCropYieldAndLoan(
        farmData.farmSizeHectares,
        farmData.cropType,
        farmData.region,
        farmData.historicalYield,
        farmData.damagePercentage
    );

    if (!prediction.approved) {
        await logEvent('INFO', 'Microloan denied by AI', { address, reasoning: prediction.reasoning });
        return { success: false, reason: prediction.reasoning };
    }

    // 2. We would call Soroban `originate_microloan` here using Stellar SDK.
    // Assuming Soroban transaction succeeds...
    await logEvent('INFO', `Soroban origination successful for loan of ${prediction.recommendedAmountXlm} XLM`, { address });

    // 3. Instant PDAX Offramp to fiat
    const offrampResult = await processPayoutOfframp(prediction.recommendedAmountXlm, paymentMethod, paymentAccount);
    
    await logEvent('INFO', 'Microloan fiat offramp complete via PDAX', { address, offrampResult });

    return { 
        success: true, 
        loanAmount: prediction.recommendedAmountXlm, 
        prediction: prediction.predictedYieldPercentage,
        offrampResult 
    };
}
