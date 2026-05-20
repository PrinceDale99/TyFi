export interface DamageResult {
  estimatedDamage: number;
  damagePercentage: number;
  maturityStage: string;
  stageProgress: number; // 0 to 1
  canReplant: boolean;
  recommendation: string;
}

export const calculateDamage = (
  cropType: string,
  plantingDate: string,
  windSpeed: number, // km/h
  floodDepth: number, // meters
  rainfall: number, // mm
  initialInvestment: number,
  expectedHarvestValue: number
): DamageResult => {
  const start = new Date(plantingDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Average growth cycles in days
  const cycles: Record<string, number> = {
    'Rice': 120,
    'Corn': 100,
    'Coconut': 365,
    'Sugarcane': 360,
    'Banana': 270,
    'Vegetables': 60
  };

  const cycleDays = cycles[cropType] || 120;
  const progress = Math.min(1, diffDays / cycleDays);
  
  let stage = 'Initial';
  let stageVulnerability = 1.0;

  if (progress < 0.2) {
    stage = 'Seedling';
    stageVulnerability = 1.5; // Very vulnerable at start
  } else if (progress < 0.5) {
    stage = 'Vegetative';
    stageVulnerability = 1.0;
  } else if (progress < 0.8) {
    stage = 'Reproductive';
    stageVulnerability = 1.3; // Vulnerable during flowering/fruiting
  } else {
    stage = 'Maturity';
    stageVulnerability = 0.8; // Hardier, but quality loss is high
  }

  // Wind Impact (Logarithmic increase)
  // Tropical Cyclone categories (approx)
  let windFactor = 0;
  if (windSpeed > 45) {
    // 45km/h is start of tropical depression
    windFactor = Math.pow((windSpeed - 45) / 155, 1.2);
  }

  // Flood Impact
  let floodFactor = 0;
  if (floodDepth > 0.1) {
    floodFactor = Math.min(1, floodDepth / 1.5); // 1.5m usually means total loss for most crops
  }

  // Rain Impact
  let rainFactor = 0;
  if (rainfall > 100) {
    rainFactor = Math.min(0.5, (rainfall - 100) / 400); // Heavy rain alone causes up to 50% damage
  }

  // Combined Environmental Factor
  const combinedEnvFactor = Math.min(1, windFactor + floodFactor + rainFactor);

  // Crop-specific vulnerability
  const cropSensitivity: Record<string, number> = {
    'Rice': 1.0,
    'Corn': 1.1,
    'Coconut': 0.5,
    'Sugarcane': 0.7,
    'Banana': 1.4,
    'Vegetables': 1.3
  };

  const sensitivity = (cropSensitivity[cropType] || 1.0) * stageVulnerability;
  const damagePercentage = Math.min(100, combinedEnvFactor * sensitivity * 100);

  // Financial loss calculation
  // Base loss on investment plus potential profit gain over time
  const potentialProfit = expectedHarvestValue - initialInvestment;
  const currentAssetValue = initialInvestment + (potentialProfit * progress);
  const estimatedDamage = (currentAssetValue * damagePercentage) / 100;

  const canReplant = progress < 0.35 && damagePercentage > 40;

  let recommendation = "Low risk. Monitor weather updates.";
  if (damagePercentage > 85) {
    recommendation = "CATastrophic damage. Immediate total loss claim recommended.";
  } else if (damagePercentage > 60) {
    recommendation = "Severe damage. Payout likely triggered. Document all losses.";
  } else if (damagePercentage > 30) {
    recommendation = "Moderate impact. Check for root rot and pest outbreaks.";
  } else if (canReplant) {
    recommendation = "Significant early damage. Replanting may be more cost-effective.";
  }

  return {
    estimatedDamage,
    damagePercentage,
    maturityStage: stage,
    stageProgress: progress,
    canReplant,
    recommendation
  };
};

