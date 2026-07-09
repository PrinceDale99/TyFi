import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cron from 'node-cron';
import axios from 'axios';
import { config } from './config';
import { OracleScraper } from './scraper';
import { aggregateData, AggregateOracleData } from './aggregator';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const scraper = new OracleScraper();

// In-memory cache of the last successful scrape
let lastResult: AggregateOracleData | null = null;
let lastScrapeError: string | null = null;
let isScraping = false;

async function runScrapeAndPush() {
  if (isScraping) {
    console.log('[Scraper] Already running, skipping...');
    return;
  }
  isScraping = true;
  console.log(`[Scraper] Starting scrape cycle at ${new Date().toISOString()}`);

  try {
    const results = await scraper.runAll();

    if (results.length === 0) {
      throw new Error('All sources returned no data');
    }

    const aggregated = aggregateData(results);
    lastResult = aggregated;
    lastScrapeError = null;

    console.log('[Scraper] Aggregated result:', JSON.stringify(aggregated));
    console.log(`[Scraper] Pushing to Oracle backend: ${config.oracleApiUrl}`);

    // Push to the main TyFi backend
    const pushRes = await axios.post(config.oracleApiUrl, aggregated, {
      headers: { 'Authorization': `Bearer ${config.oracleApiKey}` },
      timeout: 15000
    });

    console.log(`[Scraper] Push success: ${JSON.stringify(pushRes.data)}`);
  } catch (error: any) {
    lastScrapeError = error.message;
    console.error(`[Scraper] Scrape/push failed: ${error.message}`);
  } finally {
    isScraping = false;
  }
}

// ==========================================
// ROUTES
// ==========================================

// Health check for Render
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    lastScrapeError,
    isScraping,
    hasData: !!lastResult
  });
});

// Expose the latest scrape result directly
app.get('/api/latest', (req, res) => {
  if (!lastResult) {
    return res.status(503).json({
      error: 'No scrape data yet. The scraper runs every 15 minutes.',
      lastScrapeError
    });
  }
  res.json({ success: true, data: lastResult, lastScrapeError });
});

// Trigger scraping manually (for testing/webhooks)
app.post('/api/scrape', async (req, res) => {
  if (isScraping) {
    return res.status(409).json({ error: 'Scrape already in progress' });
  }

  // Run async so we respond immediately
  runScrapeAndPush();
  res.json({ success: true, message: 'Scrape triggered. Check /api/latest in ~60s.' });
});

// ==========================================
// CRON SCHEDULE
// ==========================================
cron.schedule(config.cronSchedule, async () => {
  console.log(`[Cron] Triggering scheduled scrape at ${new Date().toISOString()}`);
  await runScrapeAndPush();
});

// Run an initial scrape on startup so data is available immediately
setTimeout(() => {
  console.log('[Startup] Running initial scrape...');
  runScrapeAndPush();
}, 5000); // 5s delay to let the server fully start

app.listen(config.port, () => {
  console.log(`🚀 TyFi Oracle Scraper running on port ${config.port}`);
  console.log(`⏰ Cron schedule: ${config.cronSchedule}`);
  console.log(`🎯 Pushing to: ${config.oracleApiUrl}`);
});
