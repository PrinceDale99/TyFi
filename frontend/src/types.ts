export interface FarmData {
  id: string;
  farmerName: string;
  rsbsaNumber: string;
  farmName: string;
  region: string;
  season?: string;
  cropType: string;
  plantingDate: string;
  farmSize: number;
  initialInvestment: number;
  expectedHarvestValue: number;
  totalCropValue: number;
  latitude: number;
  longitude: number;
  phoneNumber?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  hasClaimed?: boolean;
  claimedAmount?: number;
  claimedRatio?: number;
  /** Land ownership proof: Deed of Sale or Land Title document filename */
  landDocument?: {
    fileName: string;
    docType: 'deed_of_sale' | 'land_title';
    uploadedAt: string;
  };
}

export interface Farm extends FarmData {
  id: string;
  isInsured: boolean;
}

export interface CalculatorData {
  cropType: string;
  area: number;
  stage: 'Seedling' | 'Vegetative' | 'Reproductive' | 'Maturity';
  destructionLevel: number; // 0 to 100 percentage
  marketPrice: number;
}

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  windGusts: number;
  rainfall: number;
  rain: number;
  condition: string;
  weatherCode: number;
  humidity: number;
  pressure: number;
  timestamp: string;
  updatedAt?: Date;
  hourlyTime?: Date[];
  hourlyWindSpeed?: number[];
  hourlyWindGusts?: number[];
  hourlyPrecipitation?: number[];
  dailyTime?: Date[];
  dailyWindGustsMax?: number[];
  dailyPrecipitationSum?: number[];
  // New OpenWeather / Agromonitor fields
  visibility?: number;
  cloudCover?: number;
  damageEstimation?: number;
  aiDamageEstimation?: number;
  cropHealthIndex?: number;
  agromonitorStatus?: string;
  activeStorm?: {
    name: string;
    lat: number;
    lon: number;
    severity: string;
  } | null;
}

export interface Claim {
  id: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Rejected';
  trigger: string;
}
