const express = require('express');
const PuppeteerService = require('./src/services/puppeteer');
const basicAuth = require("express-basic-auth");

const app = express();
const port = 1338;

app.use(express.json());

// Endpoint: Process Puppeteer task
app.get('/', (req, res) => {
  res.send('Web fetcher service is running');
});

app.post('/process', basicAuth({ challenge: true, users: { ["portolabs-admin"]: process.env.KEY ?? "admin" } }), async (req, res) => {
  const { url, portokuAssetId } = req.body;

  if (!url || !portokuAssetId) return res.status(400).json({ error: 'Missing "url" or "portokuAssetId" in request body' });

  try {
    await PuppeteerService.pushToQueue(url, portokuAssetId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing Puppeteer request:', error);
    res.status(500).json({ sucess: false, error: 'Internal server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Puppeteer service running at http://localhost:${port}`);
});
