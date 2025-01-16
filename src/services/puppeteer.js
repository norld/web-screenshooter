const puppeteer = require('puppeteer');
const path = require('path');
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const Redis = require("ioredis")

// Create a Redis connection to Upstash
const redis = new Redis(process.env.REDIS_URL);

class PuppeteerService {
  static browser = null;
  static browserTimeout = null;
  static BROWSER_SHUTDOWN_DELAY = 5 * 60 * 1000; // 5 minutes

  // Initialize browser instance
  static async getBrowserInstance() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
        headless: true, // Headless mode for better performance
      });
    }

    // Reset the browser shutdown timer
    this.resetShutdownTimer();
    return this.browser;
  }

  // Reset the browser shutdown timer
  static resetShutdownTimer() {
    if (this.browserTimeout) {
      clearTimeout(this.browserTimeout);
    }

    this.browserTimeout = setTimeout(async () => {
      await this.closeBrowser();
    }, this.BROWSER_SHUTDOWN_DELAY);
  }

  // Process Puppeteer task
  static async processTask(url, portokuAssetId) {
    const browser = await this.getBrowserInstance();
    const page = await browser.newPage();
    try {
      await Promise.all([
        page.setViewport({ width: 1280, height: 800 }),  // Simulate a smaller screen
        page.goto(url, { waitUntil: 'domcontentloaded' }),
      ])
      const publicDir = path.resolve(__dirname, '../../public');
      const screenshotPath = path.join(publicDir, `screenshot_${uuidv4()}.png`);
      // Ensure the public directory exists
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }

      const [title] = await Promise.all([
        page.title(),
        page.screenshot({ path: screenshotPath })
      ]);
      
      const filePath = path.resolve(__dirname, screenshotPath);

      const formData = new FormData();
      formData.append('files', fs.createReadStream(filePath));
      formData.append('path', 'web-fetcher');

      const img = await axios.post(
        `${process.env.BASE_API}/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${process.env.BEARER_TOKEN}`,
            Accept: 'application/json',
            'Content-Type': 'multipart/form-data',
            ...formData.getHeaders(), // Set FormData headers
          },
        }
      );
      const metadata = {
        title,
        screenshot: img?.data[0]?.id,
        url
      }
      const params = {
        asset: img.data?.length ? img?.data[0]?.id : null,
        metadata,
        portokuAssetId,
        fsStatus: 'DONE'
      }
      // Delete the screenshot from the public directory
      
      await Promise.all([
        axios.post(
          `${process.env.BASE_API}/post/asset`,
          params,
          {
            headers: {
              Authorization: `Bearer ${process.env.BEARER_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        ),
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error('Error deleting screenshot:', err.message);
          } else {
            console.log('Screenshot deleted successfully');
          }
        }),
        page.close(),
      ])
      return metadata;
    } catch (error) {
      const params = { portokuAssetId, fsStatus: 'ERROR' }
      axios.post(
        `${process.env.BASE_API}/post/asset`,
        params,
        {
          headers: {
            Authorization: `Bearer ${process.env.BEARER_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      )
      await page.close();
      throw error;
    }
  }

  // Close the browser instance
  static async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    if (this.browserTimeout) {
      clearTimeout(this.browserTimeout);
      this.browserTimeout = null;
    }
  }

  static async pushToQueue(url, id) {
    return redis.rpush('scrapeQueue', JSON.stringify({ url, id }));
  }

  static async startConsumer() {
    console.log('Waiting for messages in Redis queue...');
    while (true) {
      // Pop a URL from the Redis queue (blocking)
      const data = await redis.lpop('scrapeQueue'); // lpop is a non-blocking pop operation
      if (data) {
        const res = JSON.parse(data);
        if (res?.url && res?.id) {
          try {
            await this.processTask(res?.url, res?.id);
          } catch (error) {
            console.error(`Error scraping URL ${res?.url}:`, error);
          }
        }
      } else {
        // If no data is found, wait for a short period before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

}

module.exports = PuppeteerService;

PuppeteerService.startConsumer().catch(console.error);
