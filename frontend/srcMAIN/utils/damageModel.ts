/**
 * Utility to calculate estimated damages based on wind speed and farm characteristics
 */

export interface DamageReport {
  damagePercentage: number;
  estimatedLoss: number;
  severity: 'None' | 'Low' | 'Moderate' | 'Severe' | 'Catastrophic';
  payoutAmount: number;
}

export const calculateDamages = (
  windSpeed: number, 
  cropValue: number, 
  coverageAmount: number
): DamageReport => {
  let damagePercentage = 0;
  let severity: DamageReport['severity'] = 'None';

  // Parametric damage model (Simplified)
  if (windSpeed < 80) {
    damagePercentage = 0;
    severity = 'None';
  } else if (windSpeed < 120) {
    // 80-120 km/h: 0-20% damage
    damagePercentage = ((windSpeed - 80) / 40) * 20;
    severity = 'Low';
  } else if (windSpeed < 150) {
    // 120-150 km/h: 20-50% damage
    damagePercentage = 20 + ((windSpeed - 120) / 30) * 30;
    severity = 'Moderate';
  } else if (windSpeed < 180) {
    // 150-180 km/h: 50-85% damage
    damagePercentage = 50 + ((windSpeed - 150) / 30) * 35;
    severity = 'Severe';
  } else {
    // > 180 km/h: 85-100% damage
    damagePercentage = Math.min(100, 85 + ((windSpeed - 180) / 50) * 15);
    severity = 'Catastrophic';
  }

  const estimatedLoss = (damagePercentage / 100) * cropValue;
  
  // Payout is capped by coverage amount but covers losses
  // In parametric insurance, sometimes it's binary, but here we'll make it 
  // proportional to the loss up to the coverage limit.
  const payoutAmount = Math.min(estimatedLoss, coverageAmount);

  return {
    damagePercentage,
    estimatedLoss,
    severity,
    payoutAmount
  };
};
