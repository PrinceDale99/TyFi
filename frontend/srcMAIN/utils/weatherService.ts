import { fetchWeatherApi } from 'openmeteo';
import type { WeatherData } from '../types';

const PARAMS = {
  latitude: 13.4088,
  longitude: 122.5615,
  daily: ['wind_gusts_10m_max', 'precipitation_sum'],
  hourly: ['wind_speed_10m', 'wind_gusts_10m', 'precipitation'],
  models: ['best_match'],
  current: ['wind_gusts_10m', 'wind_speed_10m', 'precipitation', 'rain', 'weather_code'],
  minutely_15: ['wind_gusts_10m', 'wind_speed_10m', 'rain', 'weather_code'],
  timezone: 'Asia/Singapore',
  forecast_days: 16,
};

const URL = 'https://api.open-meteo.com/v1/forecast';

/** Translate WMO weather code → human condition */
function wmoToCondition(code: number): WeatherData['condition'] {
  if (code >= 95) return 'Thunder';
  if (code >= 80 || (code >= 61 && code <= 67)) return 'Stormy';
  if (code >= 51 && code <= 57) return 'Rainy';
  if (code >= 2 && code <= 3) return 'Cloudy';
  return 'Clear';
}

export async function fetchLiveWeather(): Promise<WeatherData> {
  const responses = await fetchWeatherApi(URL, PARAMS);
  const response = responses[0]; // single location

  const utcOffsetSeconds = response.utcOffsetSeconds();

  const current = response.current()!;
  const hourly = response.hourly()!;
  const daily = response.daily()!;

  const windGusts = current.variables(0)!.value();   // wind_gusts_10m
  const windSpeed = current.variables(1)!.value();   // wind_speed_10m
  const precipitation = current.variables(2)!.value(); // precipitation
  const rain = current.variables(3)!.value();        // rain
  const weatherCode = current.variables(4)!.value(); // weather_code

  // Hourly arrays
  const hourlyLen =
    (Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval();
  const hourlyTime = Array.from({ length: hourlyLen }, (_, i) =>
    new Date(
      (Number(hourly.time()) + i * hourly.interval() + utcOffsetSeconds) * 1000
    )
  );

  // Daily arrays
  const dailyLen =
    (Number(daily.timeEnd()) - Number(daily.time())) / daily.interval();
  const dailyTime = Array.from({ length: dailyLen }, (_, i) =>
    new Date(
      (Number(daily.time()) + i * daily.interval() + utcOffsetSeconds) * 1000
    )
  );

  return {
    windSpeed,                                     // km/h
    windGusts,                                     // km/h
    rainfall: precipitation,                       // mm
    rain,
    weatherCode,
    condition: wmoToCondition(weatherCode),
    pressure: 1013,                                // not in open-meteo free tier
    humidity: 75,
    updatedAt: new Date(
      (Number(current.time()) + utcOffsetSeconds) * 1000
    ),
    hourlyTime,
    hourlyWindSpeed: Array.from(hourly.variables(0)!.valuesArray() || []),
    hourlyWindGusts: Array.from(hourly.variables(1)!.valuesArray() || []),
    hourlyPrecipitation: Array.from(hourly.variables(2)!.valuesArray() || []),
    dailyTime,
    dailyWindGustsMax: Array.from(daily.variables(0)!.valuesArray() || []),
    dailyPrecipitationSum: Array.from(daily.variables(1)!.valuesArray() || []),
  };
}
