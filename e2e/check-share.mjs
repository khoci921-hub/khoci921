import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', (error) => console.log('BROWSER ERROR:', error.message));

  console.log('Navigating...');
  await page.goto('http://localhost:3000/share.html?job=TG648ASJ', { waitUntil: 'networkidle' });
  console.log('Done.');
  await browser.close();
})();
