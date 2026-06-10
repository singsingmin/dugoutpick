/**
 * Post-export PWA patcher for DugoutPick web build.
 * Run after `expo export --platform web` from app/.
 * Adds: manifest.json, sw.js, iOS meta tags, PWA icons.
 */
import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, '..', 'app');
const distDir = join(appDir, 'dist');
const assetsDir = join(appDir, 'assets');

// ── 1. Copy PWA icons ──────────────────────────────────────────────
copyFileSync(join(assetsDir, 'icon.png'), join(distDir, 'icon.png'));
copyFileSync(join(assetsDir, 'favicon.png'), join(distDir, 'favicon.png'));

// ── 2. manifest.json ───────────────────────────────────────────────
const manifest = {
  name: '오늘야구각',
  short_name: '오늘야구각',
  description: 'KBO 오늘 경기 꿀잼지수 예측',
  start_url: '/dugoutpick/',
  scope: '/dugoutpick/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#F3E9CE',
  theme_color: '#34663F',
  icons: [
    {
      src: '/dugoutpick/favicon.png',
      sizes: '64x64',
      type: 'image/png',
    },
    {
      src: '/dugoutpick/icon.png',
      sizes: '1024x1024',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ],
};
writeFileSync(join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// ── 3. sw.js (service worker) ──────────────────────────────────────
const sw = `const CACHE = 'dugoutpick-v2';
const PRECACHE = [
  '/dugoutpick/',
  '/dugoutpick/index.html',
  '/dugoutpick/manifest.json',
  '/dugoutpick/icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Network-first: GitHub raw JSON data
  if (url.hostname === 'raw.githubusercontent.com') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  // Cache-first: app shell & static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
`;
writeFileSync(join(distDir, 'sw.js'), sw);

// ── 4. Patch index.html ────────────────────────────────────────────
let html = readFileSync(join(distDir, 'index.html'), 'utf8');

// Skip if already patched
if (!html.includes('apple-mobile-web-app-capable')) {
  // Fix favicon path (Expo generates root-relative but we're under /dugoutpick/)
  html = html.replace('href="/favicon.ico"', 'href="/dugoutpick/favicon.ico"');

  // Fix JS bundle path: Expo Metro ignores baseUrl in output:single mode.
  // script src="/_expo/..." → src="/dugoutpick/_expo/..."
  html = html.replace(/src="\/_expo\//g, 'src="/dugoutpick/_expo/');

  // Extend viewport to support iPhone notch / Dynamic Island
  html = html.replace(
    'width=device-width, initial-scale=1, shrink-to-fit=no',
    'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover'
  );

  const pwaHead = `  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="오늘야구각" />
  <meta name="theme-color" content="#34663F" />
  <link rel="apple-touch-icon" href="/dugoutpick/icon.png" />
  <link rel="manifest" href="/dugoutpick/manifest.json" />
  <script>if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/dugoutpick/sw.js'));</script>`;

  // Expo puts </head> right after the last element on the same line; add newline first
  html = html.replace('</head>', `\n${pwaHead}\n</head>`);

  writeFileSync(join(distDir, 'index.html'), html);
} else {
  console.log('  index.html already patched — skipped');
}

console.log('✓ PWA patch done');
console.log('  icon.png, favicon.png copied');
console.log('  manifest.json created');
console.log('  sw.js created');
console.log('  index.html patched (viewport, favicon, Apple meta, manifest link, SW)');
