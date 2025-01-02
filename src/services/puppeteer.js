const puppeteer = require('puppeteer');
const path = require('path');
const axios = require('axios');
const os = require('os');
require('dotenv').config();
const fs = require('fs');
const FormData = require('form-data');
const amqp = require('amqplib');

class PuppeteerService {
  static browser = null;
  static browserTimeout = null;
  static BROWSER_SHUTDOWN_DELAY = 5 * 60 * 1000; // 5 minutes

  // Initialize browser instance
  static async getBrowserInstance() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
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
  static async processTask(url, portokuId) {
    const browser = await this.getBrowserInstance();
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const tempDir = '../../public';
      const screenshotPath = path.join(tempDir, 'screenshot.png');
      // Ensure the public directory exists
      const publicDir = path.resolve(__dirname, '../../public');
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
      formData.append('path', '/web-fetcher');

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
        screenshot: img.data[0],
      }
      const params = {
        data: {
          portoku: portokuId,
          asset: img.data?.length ? img?.data[0]?.documentId : null,
          metadata,
        }
      }
      await axios.post(
        `${process.env.BASE_API}/post/asset`,
        params,
        {
          headers: {
            Authorization: `Bearer ${process.env.BEARER_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      // Delete the screenshot from the public directory
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Error deleting screenshot:', err.message);
        } else {
          console.log('Screenshot deleted successfully');
        }
      });
      await page.close();
      return metadata;
    } catch (error) {
      await page.close();
      console.error('Error processing Puppeteer task:', error.message);
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

  // Start RabbitMQ consumer
  static async startConsumer() {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    const queue = 'puppeteer_tasks';

    await channel.assertQueue(queue, { durable: true });
    console.log(`Waiting for messages in ${queue}. To exit press CTRL+C`);

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        const url = msg.content.toString();
        console.log(`Received task for URL: ${url}`);
        try {
          await this.processTask(url);
          channel.ack(msg);
        } catch (error) {
          console.error('Error processing task:', error.message);
          channel.nack(msg);
        }
      }
    });
  }
}

module.exports = PuppeteerService;

// Start the consumer when the script is run
if (require.main === module) {
  PuppeteerService.startConsumer().catch(console.error);
}