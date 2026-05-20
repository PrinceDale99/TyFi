import type { WeatherData } from '../types';


export const fetchWeather = async (lat: number, lon: number): Promise<WeatherData> => {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=wind_speed_10m,precipitation&timezone=auto`
    );
    
    if (!response.ok) {
      throw new Error('Weather data fetch failed');
    }

    const data = await response.json();
    const current = data.current;
    const hourly = data.hourly;

    return {
      temperature: current.temperature_2m,
      windSpeed: current.wind_speed_10m,
      windGusts: current.wind_gusts_10m,
      rainfall: current.precipitation,
      rain: current.rain,
      condition: getWeatherCondition(current.weather_code),
      weatherCode: current.weather_code,
      humidity: current.relative_humidity_2m,
      pressure: current.pressure_msl,
      timestamp: new Date().toLocaleTimeString(),
      updatedAt: new Date(current.time),
      hourlyTime: hourly.time.map((t: string) => new Date(t)),
      hourlyWindSpeed: hourly.wind_speed_10m,
      hourlyPrecipitation: hourly.precipitation,
    };
  } catch (error) {
    console.error('Error fetching weather:', error);
    // Return mock data if API fails to keep the UI functional
    const now = new Date();
    const hourlyTime = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(now);
      d.setHours(d.getHours() - (23 - i));
      return d;
    });

    return {
      temperature: 28.5,
      windSpeed: 45.2,
      windGusts: 62.1,
      rainfall: 12.5,
      rain: 8.2,
      condition: 'Cloudy',
      weatherCode: 3,
      humidity: 82,
      pressure: 1012,
      timestamp: now.toLocaleTimeString(),
      updatedAt: now,
      hourlyTime,
      hourlyWindSpeed: Array.from({ length: 24 }, () => 30 + Math.random() * 20),
      hourlyPrecipitation: Array.from({ length: 24 }, () => Math.random() * 5),
    };
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
