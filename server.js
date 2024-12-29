const express = require('express');
const PuppeteerService = require('./src/services/puppeteer');

const app = express();
const port = 3000;

app.use(express.json());

// Endpoint: Process Puppeteer task
app.post('/process', async (req, res) => {
  const { url, action } = req.body;

  if (!url || !action) {
    return res.status(400).json({ error: 'Missing "url" or "action" in request body' });
  }

  try {
    const result = await PuppeteerService.processTask(url, action);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error processing Puppeteer request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint: Close the browser manually
app.post('/close-browser', async (req, res) => {
  try {
    await PuppeteerService.closeBrowser();
    res.json({ success: true, message: 'Browser instance closed.' });
  } catch (error) {
    console.error('Error closing browser:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Puppeteer service running at http://localhost:${port}`);
});
