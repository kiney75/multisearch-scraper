const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'missing q' });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const url = `https://multisearch.to/?q=${encodeURIComponent(q)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    try {
      await page.waitForFunction(
        () => !document.body.innerText.includes('security verification') &&
              !document.body.innerText.includes('Vérification de sécurité'),
        { timeout: 20000 }
      );
    } catch (e) {}

    await new Promise(r => setTimeout(r, 2500));

    const results = await page.$$eval('a[href]', (els) => {
      const out = [];
      const seen = new Set();
      for (const a of els) {
        let href = a.getAttribute('href') || '';
        if (!href || href === '#' || href.startsWith('javascript:')) continue;
        if (!href.startsWith('http')) continue;
        if (href.includes('multisearch.to')) continue;
        if (/\.(png|jpg|jpeg|gif|svg|css|js|ico|woff2?)$/i.test(href)) continue;
        if (seen.has(href)) continue;
        seen.add(href);
        const title = (a.textContent || '').trim() || href;
        if (title.length < 2) continue;
        out.push({ title, link: href, description: '' });
      }
      return out;
    });

    res.json({ query: q, results, count: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.get('/', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server on port ' + PORT));
