import http from 'http';
import fs from 'fs';

const BASE_URL = 'http://localhost:4200';
const ROUTES_TO_TEST = [
  { path: '/', label: 'Home Page' },
  { path: '/products', label: 'Products Catalog' },
  { path: '/categories', label: 'Categories Hub' },
  { path: '/zodiac', label: 'Zodiac & Birthday Finder' },
  { path: '/mystery-box', label: 'Mystery Box' },
  { path: '/cart', label: 'Cart Page' },
  { path: '/checkout', label: 'Checkout' },
  { path: '/login', label: 'Login' },
  { path: '/register', label: 'Register' },
  { path: '/find-order', label: 'Find Order' },
  { path: '/guides', label: 'Guides Hub' },
  { path: '/about', label: 'About Page' },
  { path: '/contact', label: 'Contact Page' },
  { path: '/help', label: 'Help Center' },
  { path: '/shipping-returns', label: 'Shipping & Returns' }
];

async function checkRoute(route) {
  return new Promise((resolve) => {
    http.get(BASE_URL + route.path, (res) => {
      // 200 or 301/302 redirects are valid server responses
      if (res.statusCode >= 200 && res.statusCode < 400) {
        console.log(`✅ [PASS] ${route.label} (${route.path}) - HTTP ${res.statusCode}`);
        resolve(true);
      } else {
        console.error(`❌ [FAIL] ${route.label} (${route.path}) - HTTP ${res.statusCode}`);
        resolve(false);
      }
      res.resume();
    }).on('error', (err) => {
      console.error(`❌ [ERROR] ${route.label}:`, err.message);
      resolve(false);
    });
  });
}

async function run() {
  console.log(`Starting smoke tests against ${BASE_URL}...`);
  let passed = 0;
  for (const r of ROUTES_TO_TEST) {
    const ok = await checkRoute(r);
    if (ok) passed++;
  }
  console.log(`\nServer Routes Result: ${passed}/${ROUTES_TO_TEST.length} routes passed.`);

  // Verify Prerendered Distribution Artifacts
  console.log('\nChecking Prerendered Static Build Artifacts...');
  const distDir = 'Frontend/dist/frontend/browser';
  let prerenderCount = 0;
  const samplePrerendered = ['index.html', 'about/index.html', 'categories/index.html', 'zodiac/index.html', 'guides/index.html', 'mystery-box/index.html', 'faq/index.html', 'contact/index.html', 'shipping-returns/index.html', 'terms/index.html', 'privacy/index.html'];
  samplePrerendered.forEach(f => {
    if (fs.existsSync(`${distDir}/${f}`)) {
      prerenderCount++;
      console.log(`✅ [STATIC] ${f} present (${fs.statSync(`${distDir}/${f}`).size} bytes)`);
    } else {
      console.error(`❌ [STATIC] ${f} MISSING`);
    }
  });

  process.exit(passed === ROUTES_TO_TEST.length && prerenderCount === samplePrerendered.length ? 0 : 1);
}

run();
