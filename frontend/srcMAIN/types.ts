export interface FarmData {
  id: string;
  farmerName: string;
  rsbsaNumber: string;
  farmName: string;
  region: string;
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
  condition: 'Clear' | 'Cloudy' | 'Rainy' | 'Stormy' | 'Thunder';
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
}

export interface Claim {
  id: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Rejected';
  trigger: string;
}
