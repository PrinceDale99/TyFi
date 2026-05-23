import type { WeatherData } from '../types';


const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || '';
const AGROMONITOR_API_KEY = import.meta.env.VITE_AGROMONITOR_API_KEY || '';

const WEATHER_CACHE_KEY = 'typhoon_vault_weather_cache';

export const fetchWeather = async (lat: number, lon: number): Promise<WeatherData> => {
  try {
    // 1. Open-Meteo for Hourly/Daily Forecasts + Agricultural Data
    const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=wind_speed_10m,precipitation&daily=et0_fao_evapotranspiration,soil_moisture_0_to_7cm_max&timezone=auto`;
    
    // 2. OpenWeather for Current Accurate Data
    const openWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;

    // 3. GDACS for Real-time Tropical Cyclone Tracking
    const gdacsUrl = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/v1?eventtype=TC';

    const [meteoRes, owRes, gdacsRes] = await Promise.all([
      fetch(meteoUrl),
      fetch(openWeatherUrl),
      fetch(gdacsUrl).catch(() => null)
    ]);

    const meteoData = meteoRes.ok ? await meteoRes.json() : null;
    const owData = owRes.ok ? await owRes.json() : null;
    const gdacsData = gdacsRes && gdacsRes.ok ? await gdacsRes.json() : null;

    if (!meteoData && !owData) {
      // Fallback to cache if network fails
      const cached = localStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        console.warn('Network failed. Using cached weather data.');
        return JSON.parse(cached);
      }
      throw new Error('All weather data fetches failed and no cache available');
    }

    const currentMeteo = meteoData?.current || {};
    const hourlyMeteo = meteoData?.hourly || { time: [], wind_speed_10m: [], precipitation: [] };
    const dailyMeteo = meteoData?.daily || {};

    // Process GDACS data for active typhoons near the Philippines
    let activeStorm = null;
    if (gdacsData && gdacsData.features) {
      const storms = gdacsData.features.filter((f: any) => 
        f.properties.eventtype === 'TC' && 
        (f.geometry.coordinates[0] > 110 && f.geometry.coordinates[0] < 140) && // Longitude range for PH area
        (f.geometry.coordinates[1] > 5 && f.geometry.coordinates[1] < 25)      // Latitude range for PH area
      );
      if (storms.length > 0) {
        activeStorm = {
          name: storms[0].properties.eventname,
          lat: storms[0].geometry.coordinates[1],
          lon: storms[0].geometry.coordinates[0],
          severity: storms[0].properties.severitydata?.severity || 'Unknown'
        };
      }
    }

    // REAL Agromonitor-like metrics from Open-Meteo Agricultural data
    const windGusts = owData?.wind?.gust || currentMeteo.wind_gusts_10m || 0;
    const soilMoisture = dailyMeteo.soil_moisture_0_to_7cm_max?.[0] || 0.3;
    
    let damageEstimation = 0;
    let agromonitorStatus = 'Normal';
    
    if (windGusts > 100) {
      damageEstimation = 60;
      agromonitorStatus = 'Critical - Severe Typhoon Impact';
    } else if (windGusts > 60) {
      damageEstimation = 30;
      agromonitorStatus = 'High Risk - Wind Damage';
    } else if (windGusts > 40) {
      damageEstimation = 10;
      agromonitorStatus = 'Moderate Risk';
    }

    if (soilMoisture > 0.45) {
      damageEstimation += 15;
      agromonitorStatus = 'Flood Risk - Saturated Soil';
    }

    let cropHealthIndex = 0.95;
    if (soilMoisture < 0.1) cropHealthIndex -= 0.3;
    if (soilMoisture > 0.5) cropHealthIndex -= 0.2;
    if (windGusts > 50) cropHealthIndex -= (windGusts - 50) / 100;

    const weatherResult: WeatherData = {
      temperature: owData?.main?.temp ?? currentMeteo.temperature_2m ?? 28.5,
      windSpeed: owData?.wind?.speed ?? currentMeteo.wind_speed_10m ?? 0,
      windGusts: windGusts,
      rainfall: owData?.rain?.['1h'] ?? currentMeteo.precipitation ?? 0,
      rain: currentMeteo.rain ?? 0,
      condition: owData?.weather?.[0]?.main ?? getWeatherCondition(currentMeteo.weather_code || 0),
      weatherCode: currentMeteo.weather_code || 0,
      humidity: owData?.main?.humidity ?? currentMeteo.relative_humidity_2m ?? 0,
      pressure: owData?.main?.pressure ?? currentMeteo.pressure_msl ?? 0,
      visibility: owData?.visibility ?? 10000,
      cloudCover: owData?.clouds?.all ?? currentMeteo.cloud_cover ?? 0,
      timestamp: new Date().toLocaleTimeString(),
      updatedAt: new Date(currentMeteo.time || Date.now()),
      hourlyTime: hourlyMeteo.time.map((t: string) => new Date(t)),
      hourlyWindSpeed: hourlyMeteo.wind_speed_10m,
      hourlyPrecipitation: hourlyMeteo.precipitation,
      damageEstimation: Math.min(100, damageEstimation),
      cropHealthIndex: Math.max(0, cropHealthIndex),
      agromonitorStatus,
      activeStorm
    };

    // Store in cache for offline use
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(weatherResult));

    return weatherResult;
  } catch (error) {
    console.error('Error fetching weather:', error);
    // Attempt to return cache on error
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (cached) {
      console.warn('Returning cached weather data after error');
      return JSON.parse(cached);
    }
    throw error;
  }
};

const getWeatherCondition = (code: number): string => {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 55) return 'Drizzle';
  if (code <= 65) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Overcast';
};
