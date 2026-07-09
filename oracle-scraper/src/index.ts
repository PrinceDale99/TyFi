import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cron from 'node-cron';
import axios from 'axios';
import { config } from './config';
import { OracleScraper } from './scraper';
import { aggregateData } from './aggregator';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const scraper = new OracleScraper();

// Trigger scraping manually
app.post('/api/scrape', async (req, res) => {
  try {
    const results = await scraper.runAll();
    const aggregated = aggregateData(results);
    
    // Push to the main oracle backend
    /*
    await axios.post(config.oracleApiUrl, aggregated, {
      headers: { 'Authorization': `Bearer ${config.oracleApiKey}` }
    });
    */

    res.json({ success: true, aggregated, results });
  } catch (error: any) {
    console.error('Manual scrape failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check for Render
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Schedule the cron job
cron.schedule(config.cronSchedule, async () => {
  console.log(`[Cron] Triggering scheduled scrape at ${new Date().toISOString()}`);
  try {
    const results = await scraper.runAll();
    const aggregated = aggregateData(results);
    
    console.log('[Cron] Scrape successful, pushing to Oracle...');
    
    // In production, we push to the main TyFi backend which signs the Stellar Tx
    /*
    await axios.post(config.oracleApiUrl, aggregated, {
      headers: { 'Authorization': `Bearer ${config.oracleApiKey}` }
    });
    */
  } catch (error) {
    console.error(`[Cron] Scheduled scrape failed:`, error);
  }
});

app.listen(config.port, () => {
  console.log(`🚀 TyFi Oracle Scraper running on port ${config.port}`);
  console.log(`⏰ Cron schedule: ${config.cronSchedule}`);
});
