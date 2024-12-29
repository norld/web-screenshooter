const puppeteer = require('puppeteer');
const path = require('path');

class PuppeteerService {
  static browser = null;
  static browserTimeout = null;
  static BROWSER_SHUTDOWN_DELAY = 5 * 60 * 1000; // 5 minutes

  // Initialize browser instance
  static async getBrowserInstance() {
    if (!this.browser) {
      // Path to the downloaded Chromium binary
      // const executablePath = path.join(__dirname, 'node_modules', 'puppeteer', '.local-chromium', 'linux-XXXXXX', 'chrome-linux', 'chrome'); // Adjust according to your OS
      // console.log("@executablePath", executablePath)
      this.browser = await puppeteer.launch({
        // executablePath, // Use the downloaded Chromium binary
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
  static async processTask(url, action) {
    try {
      const browser = await this.getBrowserInstance();
      const page = await browser.newPage();

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      let result;
      switch (action) {
        case 'getTitle':
          result = await page.title();
          break;

        case 'screenshot':
          result = await page.screenshot({ encoding: 'base64' });
          break;

        default:
          throw new Error(`Unsupported action: ${action}`);
      }

      await page.close();
      return result;
    } catch (error) {
      console.error('Error processing Puppeteer task:', error);
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
}

module.exports = PuppeteerService;
