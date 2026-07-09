import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3002,
  cronSchedule: process.env.CRON_SCHEDULE || '*/15 * * * *', // Default: every 15 minutes
  renderExternalUrl: process.env.RENDER_EXTERNAL_URL, // e.g. https://tyfi-scraper.onrender.com
  oracleApiUrl: process.env.ORACLE_API_URL || 'http://localhost:3001/oracle/api/v1/scraper-update', // Where to push the data
  oracleApiKey: process.env.ORACLE_API_KEY || 'development_secret_key',
  // Target URLs
  targets: {
    pagasaWeather: 'https://www.pagasa.dost.gov.ph/weather',
    pagasaAgri: 'https://www.pagasa.dost.gov.ph/agri-weather#farm-weather-forecast',
    panahon: 'https://www.panahon.gov.ph/',
    accuweatherSat: 'https://www.accuweather.com/en/ph/national/satellite',
    zoomEarth: 'https://zoom.earth/places/philippines/manila/'
  }
};
