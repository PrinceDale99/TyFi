import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { config } from './config';

// Add stealth plugin to bypass bot protections (e.g., Cloudflare on Accuweather)
puppeteer.use(StealthPlugin());

export interface ScrapedData {
  source: string;
  windSpeedKmh?: number;
  rainfallMm?: number;
  alertLevel?: string;
  confidence: number;
  timestamp: string;
  rawJson?: any;
}

export class OracleScraper {
  private browser: Browser | null = null;

  async init() {
    console.log('[Scraper] Initializing headless browser...');
    this.browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.RENDER ? '/usr/bin/google-chrome-stable' : undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[Scraper] Browser closed.');
    }
  }

  async scrapePagasa(): Promise<ScrapedData | null> {
    if (!this.browser) return null;
    const page = await this.browser.newPage();
    try {
      console.log(`[Scraper] Fetching PAGASA...`);
      await page.goto(config.targets.pagasaWeather, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const data = await page.evaluate(() => {
        const tcAlerts = document.querySelectorAll('.panel-body, .weather-forecast');
        let windSpeed = 0;
        let isTyphoon = false;

        tcAlerts.forEach(el => {
          const text = el.textContent?.toLowerCase() || '';
          if (text.includes('tropical cyclone') || text.includes('typhoon') || text.includes('storm')) {
            isTyphoon = true;
            const match = text.match(/(\d+)\s*(km\/h|kph)/);
            if (match) {
              const speed = parseInt(match[1], 10);
              if (speed > windSpeed) windSpeed = speed;
            }
          }
        });

        return { windSpeed, isTyphoon };
      });

      console.log(`[Scraper] PAGASA Tropical Cyclone Detected: ${data.isTyphoon}, Wind: ${data.windSpeed} km/h`);
      
      return {
        source: 'PAGASA',
        windSpeedKmh: data.windSpeed > 0 ? data.windSpeed : undefined,
        alertLevel: data.isTyphoon ? 'Signal Detected' : 'Normal',
        confidence: 0.9,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('[Scraper] PAGASA Error:', error.message);
      return null;
    } finally {
      await page.close();
    }
  }

  async scrapePanahon(): Promise<ScrapedData | null> {
    if (!this.browser) return null;
    const page = await this.browser.newPage();
    try {
      console.log(`[Scraper] Fetching Panahon...`);
      await page.goto(config.targets.panahon, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const data = await page.evaluate(() => {
        let isTyphoon = false;
        let windSpeed = 0;
        // Panahon typically uses marquee or alert banners for severe weather
        const alertElements = document.querySelectorAll('.alert, .marquee, .weather-update');
        alertElements.forEach(el => {
          const text = el.textContent?.toLowerCase() || '';
          if (text.includes('typhoon') || text.includes('bagyo') || text.includes('signal')) {
            isTyphoon = true;
          }
        });
        
        // Simple wind speed extraction if available
        const bodyText = document.body.innerText.toLowerCase();
        const windMatch = bodyText.match(/(?:wind|hangin).*?(\d+)\s*(?:km\/h|kph)/);
        if (windMatch) {
          windSpeed = parseInt(windMatch[1], 10);
        }

        return { isTyphoon, windSpeed };
      });

      return {
        source: 'Panahon',
        windSpeedKmh: data.windSpeed > 0 ? data.windSpeed : undefined,
        alertLevel: data.isTyphoon ? 'Severe Weather Alert' : 'Normal',
        confidence: 0.8,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('[Scraper] Panahon Error:', error.message);
      return null;
    } finally {
      await page.close();
    }
  }

  async scrapeAccuweather(): Promise<ScrapedData | null> {
    if (!this.browser) return null;
    const page = await this.browser.newPage();
    try {
      console.log(`[Scraper] Fetching Accuweather (Stealth)...`);
      await page.goto(config.targets.accuweatherSat, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const data = await page.evaluate(() => {
        let isTyphoon = false;
        let windSpeed = 0;
        
        // Accuweather severe alerts banner
        const alerts = document.querySelectorAll('.severe-weather-card, .alert-banner');
        alerts.forEach(el => {
          const text = el.textContent?.toLowerCase() || '';
          if (text.includes('typhoon') || text.includes('cyclone') || text.includes('storm')) {
            isTyphoon = true;
          }
        });

        // Search for wind metrics in detail panels
        const details = document.querySelectorAll('.detail-item');
        details.forEach(el => {
          const text = el.textContent?.toLowerCase() || '';
          if (text.includes('wind')) {
            const match = text.match(/(\d+)\s*(km\/h|kph)/);
            if (match) windSpeed = parseInt(match[1], 10);
          }
        });

        return { isTyphoon, windSpeed };
      });

      return {
        source: 'AccuWeather',
        windSpeedKmh: data.windSpeed > 0 ? data.windSpeed : undefined,
        alertLevel: data.isTyphoon ? 'Severe Storm Tracked' : 'Normal',
        confidence: 0.7,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('[Scraper] AccuWeather Error:', error.message);
      return null;
    } finally {
      await page.close();
    }
  }

  async scrapeZoomEarth(): Promise<ScrapedData | null> {
    if (!this.browser) return null;
    const page = await this.browser.newPage();
    try {
      console.log(`[Scraper] Fetching Zoom Earth (Network Interception)...`);
      
      let maxWindSpeed = 0;
      let isTyphoon = false;
      
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        // Block images and media to save RAM on Render
        if (resourceType === 'image' || resourceType === 'media' || resourceType === 'font') {
          request.abort();
        } else {
          request.continue();
        }
      });

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('api.zoom.earth') && response.status() === 200) {
           try {
             const json = await response.json();
             // Zoom Earth API often returns storm tracks array
             if (json && json.storms) {
               json.storms.forEach((storm: any) => {
                 isTyphoon = true;
                 if (storm.wind_speed && storm.wind_speed > maxWindSpeed) {
                   maxWindSpeed = storm.wind_speed;
                 }
               });
             }
           } catch (e) {
             // Not JSON
           }
        }
      });

      await page.goto(config.targets.zoomEarth, { waitUntil: 'networkidle2', timeout: 45000 });
      
      return {
        source: 'ZoomEarth',
        windSpeedKmh: maxWindSpeed > 0 ? maxWindSpeed : undefined,
        alertLevel: isTyphoon ? 'Active Storm Tracked' : 'Clear',
        confidence: 0.85,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('[Scraper] Zoom Earth Error:', error.message);
      return null;
    } finally {
      await page.close();
    }
  }

  async runAll() {
    await this.init();
    
    // Sequential execution to save RAM on Render Free Tier
    const results: ScrapedData[] = [];
    
    const pagasa = await this.scrapePagasa();
    if (pagasa) results.push(pagasa);
    
    const panahon = await this.scrapePanahon();
    if (panahon) results.push(panahon);

    const accuweather = await this.scrapeAccuweather();
    if (accuweather) results.push(accuweather);

    const zoomEarth = await this.scrapeZoomEarth();
    if (zoomEarth) results.push(zoomEarth);

    await this.close();
    return results;
  }
}
