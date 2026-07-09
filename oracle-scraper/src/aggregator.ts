import { ScrapedData } from './scraper';

export interface AggregateOracleData {
  averageWindSpeed: number;
  maxWindSpeed: number;
  averageRainfall: number;
  maxRainfall: number;
  isTyphoonActive: boolean;
  timestamp: string;
}

export function aggregateData(results: ScrapedData[]): AggregateOracleData {
  console.log('[Aggregator] Aggregating results from', results.length, 'sources');
  
  let totalWindWeight = 0;
  let weightedWindSum = 0;
  let isTyphoonActive = false;

  results.forEach(result => {
    if (result.alertLevel && result.alertLevel !== 'Normal' && result.alertLevel !== 'Clear') {
      isTyphoonActive = true;
    }

    if (result.windSpeedKmh) {
      weightedWindSum += result.windSpeedKmh * result.confidence;
      totalWindWeight += result.confidence;
    }
  });

  const averageWindSpeed = totalWindWeight > 0 ? (weightedWindSum / totalWindWeight) : 0;

  return {
    averageWindSpeed: parseFloat(averageWindSpeed.toFixed(2)),
    maxWindSpeed: Math.max(...results.map(r => r.windSpeedKmh || 0)),
    averageRainfall: 0, // Placeholder for future rain parsing
    maxRainfall: 0,
    isTyphoonActive,
    timestamp: new Date().toISOString()
  };
}
