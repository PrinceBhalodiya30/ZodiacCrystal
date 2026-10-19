import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4200/zodiac/1', { waitUntil: 'networkidle' });
await page.screenshot({ path: '.claude/skills/run-frontend/screenshots/zodiac-detail.png', fullPage: false });
await browser.close();
