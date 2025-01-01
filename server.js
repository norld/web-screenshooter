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
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: 'Missing "url" or "action" in request body' });

  try {
    const result = await PuppeteerService.processTask(url);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error processing Puppeteer request:', error);
    res.status(500).json({ sucess: false, error: 'Internal server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Puppeteer service running at http://localhost:${port}`);
});
