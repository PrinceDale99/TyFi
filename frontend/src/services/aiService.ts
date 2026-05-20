import type { WeatherData, FarmData } from '../types';
import { logPrediction } from './firebaseService';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export interface AiPredictionResult {
  willHit: boolean;
  hitProbability: number; // 0 to 100
  estimatedTimeOfImpact: string; // e.g. "Within 12-18 hours"
  estimatedDamage: number; // 0 to 100
  confidenceScore: number; // 0 to 100
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  reasoning: string;
  advisory: string;
}

/**
 * Connects to Google Gemini API to analyze current weather conditions, GDACS storm tracking data,
 * and farm coordinates to predict if the storm will hit the farm and estimate potential crop damage.
 */
export const analyzeWeatherImpact = async (
  farm: FarmData,
  weather: WeatherData,
  growthStage?: string
): Promise<AiPredictionResult> => {
  const stage = growthStage || 'Vegetative';
  const stellarPubkey = localStorage.getItem('stellar_pubkey') || farm.id;
  
  // Format details for the Gemini prompt
  const systemPrompt = `You are the TyFi Smart Advisor, an advanced agricultural risk engine specialized in typhoon impact prediction and crop damage estimation.
Your task is to analyze the weather, active tropical storm (cyclone) trajectories, and farm details, then return a JSON prediction indicating whether the weather will hit the farm and the estimated damage.

You MUST respond strictly in valid JSON format. Do not write any normal markdown conversational text, do not write codeblock tags, just output a clean JSON string matching this exact structure:
{
  "willHit": boolean,
  "hitProbability": number (0-100),
  "estimatedTimeOfImpact": "string",
  "estimatedDamage": number (0-100),
  "confidenceScore": number (0-100),
  "riskLevel": "Low" | "Moderate" | "High" | "Critical",
  "reasoning": "string explaining the prediction, referencing the farm coordinates vs storm center, wind speed, precipitation, and crop vulnerability",
  "advisory": "actionable agricultural steps the farmer should take immediately"
}`;

  const userPrompt = `
Analyze the following parameters:

--- FARM DETAILS ---
Farm Name: ${farm.farmName}
Farmer ID/RSBSA: ${farm.rsbsaNumber}
Coordinates: Latitude ${farm.latitude}, Longitude ${farm.longitude}
Crop Type: ${farm.cropType}
Growth Stage: ${stage}
Farm Size: ${farm.farmSize} Hectares
Total Crop Value: ${farm.totalCropValue} XLM

--- LIVE WEATHER METRICS ---
Current Temperature: ${weather.temperature}°C
Current Wind Speed: ${weather.windSpeed} km/h
Current Wind Gusts: ${weather.windGusts} km/h (Payout Threshold: 100 km/h)
Current Rainfall: ${weather.rainfall} mm (Payout Threshold: 200 mm)
Liquid Rain: ${weather.rain} mm
Condition: ${weather.condition}
Cloud Cover: ${weather.cloudCover || 0}%
Soil Moisture / Health Index: ${weather.cropHealthIndex || 0.95}

--- ACTIVE GDACS STORM TRACKING ---
${weather.activeStorm ? `
Active Tropical Cyclone: ${weather.activeStorm.name}
Storm Center: Latitude ${weather.activeStorm.lat}, Longitude ${weather.activeStorm.lon}
Storm Severity: ${weather.activeStorm.severity}
` : 'No active cyclone recorded in the general region currently. Estimate local storm cell / heavy convective activity based on live weather metrics.'}

--- ASSESSMENT GOALS ---
1. "willHit" should be true if:
   - There is an active storm tracking towards the farm location (approx. within 1.5 degrees/150km radius).
   - OR if current local wind speeds exceed 50km/h or rainfall exceeds 80mm, indicating severe impact.
2. "estimatedDamage" (0-100%) should scientifically match the crop type and growth stage vulnerabilities. For example:
   - Rice/Palay is extremely vulnerable during Reproductive/Maturity stages to heavy rain (waterlogging) and strong winds (lodging).
   - Coconuts are highly resistant to water but can lose leaves/fruits to high wind gusts.
   - Bananas have shallow roots and easily blow down in winds > 60 km/h.
   - Seedlings are sensitive to flooding and soil erosion.
3. Compute the hitProbability (0-100) and riskLevel accurately.

Return the JSON block.`;

  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/analyze-weather`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\n${userPrompt}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI proxy returned status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse JSON safely, removing any potential markdown codeblock formatting if Gemini accidentally wraps it
    const cleanJsonText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const result: AiPredictionResult = JSON.parse(cleanJsonText);
    
    // Log prediction to Firestore
    await logPrediction({
      farmerAddress: stellarPubkey,
      farmName: farm.farmName,
      riskLevel: result.riskLevel,
      hitProbability: result.hitProbability,
      estimatedDamage: result.estimatedDamage,
      reasoning: result.reasoning,
      advisory: result.advisory
    });

    // Trigger FCM notification via local backend if the AI predicts a hit (willHit === true)
    if (result.willHit && farm.phoneNumber) {
      try {
        await fetch(`${BACKEND_URL}/api/notify-alert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: stellarPubkey,
            farmName: farm.farmName,
            severity: result.riskLevel,
            reason: result.reasoning,
            probability: result.hitProbability,
          }),
        });
        console.log('Storm warning notification successfully queued via FCM.');
      } catch (fcmError) {
        console.error('Failed to trigger FCM warning notification:', fcmError);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error invoking Gemini Advisor:', error);
    // Fallback predictive logic if API is throttled or fails
    const mockWillHit = weather.windSpeed > 45 || weather.rainfall > 60;
    const result: AiPredictionResult = {
      willHit: mockWillHit,
      hitProbability: mockWillHit ? 75 : 15,
      estimatedTimeOfImpact: mockWillHit ? 'Within 24 hours' : 'No imminent impact',
      estimatedDamage: mockWillHit ? Math.round(weather.windSpeed * 0.6) : 0,
      confidenceScore: 80,
      riskLevel: mockWillHit ? 'High' : 'Low',
      reasoning: `[System Fallback Mode] Weather wind speed is ${weather.windSpeed.toFixed(1)} km/h with rainfall of ${weather.rainfall.toFixed(1)} mm.`,
      advisory: mockWillHit 
        ? 'Precautionary Alert: Ensure all farm drainage is clear to prevent flooding and protect sensitive crop seedlings.' 
        : 'Continue monitoring regular Open-Meteo feeds.'
    };

    // Log fallback prediction too
    await logPrediction({
      farmerAddress: stellarPubkey,
      farmName: farm.farmName,
      riskLevel: result.riskLevel,
      hitProbability: result.hitProbability,
      estimatedDamage: result.estimatedDamage,
      reasoning: result.reasoning,
      advisory: result.advisory
    });

    return result;
  }
};

export interface CropValuationResult {
  initialInvestment: number; // in XLM
  expectedHarvestValue: number; // in XLM
  confidenceScore: number; // 0 to 100
  explanation: string;
}

/**
 * Uses Gemini AI to estimate secure, exploit-proof production costs and expected harvest values
 * based on Philippine agricultural data, specific regional yields, and farm size.
 * Includes a robust fallback calculation for seamless operation.
 */
export const estimateCropMetrics = async (
  cropType: string,
  farmSize: number,
  region: string
): Promise<CropValuationResult> => {
  const systemPrompt = `You are a professional Philippine agricultural economist and risk validator for the TyFi.
Your job is to estimate realistic, non-manipulatable baseline crop economics to prevent farmers from inflating numbers to claim excessive insurance payouts.

Estimate:
1. Production Cost (initialInvestment) in XLM (Stellar Lumens)
2. Expected Harvest (expectedHarvestValue) in XLM (Stellar Lumens)

Parameters:
- Crop Type: ${cropType} (Rice/Palay, Corn, Coconut, Sugarcane)
- Farm Size: ${farmSize} Hectares
- Region: ${region} (Philippines)

Guidelines:
- Rice (Palay) averages ~600-800 XLM production cost and ~2000-2500 XLM expected harvest per hectare in regions like Central Luzon.
- Corn averages ~500-700 XLM production cost and ~1700-2200 XLM expected harvest per hectare.
- Coconut is lower maintenance: ~250-400 XLM production cost and ~1100-1500 XLM expected harvest per hectare.
- Sugarcane is high input: ~800-1100 XLM production cost and ~2500-3200 XLM expected harvest per hectare.
- Scale these numbers linearly with farmSize.
- Adjust slightly based on regional fertility and typical weather patterns (e.g., Central Luzon has excellent palay yields, Bicol has high coconut suitability).

Return strictly a JSON object with no markdown tags or text, following this exact schema:
{
  "initialInvestment": number,
  "expectedHarvestValue": number,
  "confidenceScore": number (0-100),
  "explanation": "string explaining how the pricing and yield was estimated based on regional and crop-specific factors"
}`;

  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/analyze-weather`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: systemPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI proxy returned status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJsonText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const result: CropValuationResult = JSON.parse(cleanJsonText);
    
    // Ensure numbers are rounded nicely
    result.initialInvestment = Math.round(result.initialInvestment);
    result.expectedHarvestValue = Math.round(result.expectedHarvestValue);
    
    return result;
  } catch (error) {
    console.warn('[AI Service] Failed to estimate crop metrics with Gemini, using regional math fallback:', error);
    
    // Fallback calculation logic based on agricultural standards
    let costPerHectare = 650;
    let harvestPerHectare = 2000;
    let regionalMultiplier = 1.0;

    // Region adjustments
    if (region === 'Central Luzon') regionalMultiplier = 1.1;
    if (region === 'Cagayan Valley') regionalMultiplier = 1.05;
    if (region === 'Bicol Region') regionalMultiplier = 0.95;

    // Crop adjustments
    switch (cropType.toLowerCase()) {
      case 'rice':
        costPerHectare = 660;
        harvestPerHectare = 2100;
        break;
      case 'corn':
        costPerHectare = 550;
        harvestPerHectare = 1800;
        break;
      case 'coconut':
        costPerHectare = 300;
        harvestPerHectare = 1300;
        break;
      case 'sugarcane':
        costPerHectare = 850;
        harvestPerHectare = 2700;
        break;
    }

    const initialInvestment = Math.round(farmSize * costPerHectare * regionalMultiplier);
    const expectedHarvestValue = Math.round(farmSize * harvestPerHectare * regionalMultiplier);

    return {
      initialInvestment,
      expectedHarvestValue,
      confidenceScore: 85,
      explanation: `[System Fallback] Estimated using standard Philippine regional baseline data for ${cropType} in ${region} at ${farmSize} hectares.`
    };
  }
};

