/**
 * Post-export PWA patcher for DugoutPick web build.
 * Run after `expo export --platform web` from app/.
 * Adds: manifest.json, sw.js, iOS meta tags, PWA icons.
 */
import { readFileSync, writeFileSync, copyFileSync, readdirSync } from 'fs';
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
// 빌드 타임스탬프를 캐시 키에 주입 → 배포마다 sw.js 내용이 바뀜 → 브라우저가 새 SW 감지
const buildTs = Date.now();
const sw = `const CACHE = 'dugoutpick-${buildTs}';
const PRECACHE = [
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
  // Network-first: JSON 데이터 + HTML (배포 시 최신 HTML 보장, 번들 경로 불일치 방지)
  const isHtml = url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (url.hostname === 'raw.githubusercontent.com' || isHtml) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Cache-first: 해시 포함 JS/CSS 번들 등 불변 정적 자산
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
  <script>if('serviceWorker'in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/dugoutpick/sw.js');navigator.serviceWorker.addEventListener('controllerchange',()=>window.location.reload());});}</script>
  <style>
    /* dvh: 모바일 브라우저 크롬(주소창 등) 제외한 실제 가시 영역 높이 */
    html{height:-webkit-fill-available}
    html{height:100dvh}
    body,#root{height:100%}
    /* 100dvh 아래 영역(home indicator 등)이 흰 배경으로 노출되지 않도록 */
    html,body{background-color:#F3E9CE}
    /* 브라우저 모드: 외부 컨테이너 49px 고정, 패딩 제거 */
    div:has(>div[role="tablist"]){height:49px!important;padding-bottom:0px!important}
    /* RN이 JS(useSafeAreaInsets)로 탭바 내부 모든 하위 요소에 padding-bottom 주입.
       직접 자식만 겨냥하면 더 깊은 중첩 div에 걸린 padding이 남아 라벨이 짤림.
       * 전체에 적용해 모든 레벨에서 제거. */
    div:has(>div[role="tablist"]) *{padding-bottom:0px!important}
    /* standalone(홈화면 PWA): 홈 인디케이터 영역까지 배경 확장.
       box-sizing:border-box → 전체 높이=49px+safe-area, 콘텐츠 영역은 여전히 49px. */
    @media(display-mode:standalone){
      div:has(>div[role="tablist"]){height:calc(49px + env(safe-area-inset-bottom,0px))!important;padding-bottom:env(safe-area-inset-bottom,0px)!important;box-sizing:border-box!important}
    }
    /* 스플래시: 뷰포트 고정 */
    [data-testid="splash-container"]{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100%!important;height:100%!important;overflow:hidden!important;z-index:9999!important}
    /* CSS 1차: img 태그 기반 렌더(react-native-web ImageBackground) */
    [data-testid="splash-container"] img{object-position:top center!important;object-fit:cover!important}
    /* CSS 1차: background-image 기반 렌더(expo-image 등) */
    [data-testid="splash-container"] div{background-position:top center!important}
  </style>
  <script>
  /* 스플래시 진단 오버레이 + 포지셔닝 수정 */
  (function(){
    var reported=false;
    function showOverlay(lines){
      var d=document.createElement('div');
      d.id='__splash_dbg';
      d.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:999999;background:rgba(0,0,0,.85);color:#0f0;font:11px monospace;padding:6px;white-space:pre-wrap;pointer-events:none;';
      d.textContent=lines.join('\n');
      document.body.appendChild(d);
      setTimeout(function(){d.remove();},20000);
    }
    function fixSplash(){
      var c=document.querySelector('[data-testid="splash-container"]');
      if(!c)return;
      /* 포지셔닝 수정 */
      c.querySelectorAll('img').forEach(function(el){
        el.style.setProperty('object-position','top center','important');
        el.style.setProperty('object-fit','cover','important');
      });
      c.querySelectorAll('*').forEach(function(el){
        try{
          if(getComputedStyle(el).backgroundImage!=='none'){
            el.style.setProperty('background-position','top center','important');
            el.style.setProperty('background-size','cover','important');
          }
        }catch(e){}
      });
      /* 진단 오버레이 (첫 1회만) */
      if(reported)return;
      reported=true;
      var cr=c.getBoundingClientRect();
      var cs=getComputedStyle(c);
      var lines=['[splash-dbg] vp:'+window.innerWidth+'x'+window.innerHeight,
        'container:'+cr.width.toFixed(0)+'x'+cr.height.toFixed(0)+' top:'+cr.top.toFixed(0)+' pos:'+cs.position];
      c.querySelectorAll('img').forEach(function(el,i){
        var r=el.getBoundingClientRect(),s=getComputedStyle(el);
        lines.push('img['+i+']:'+r.width.toFixed(0)+'x'+r.height.toFixed(0)+' fit:'+s.objectFit+' objPos:'+s.objectPosition);
      });
      var bi=0;
      c.querySelectorAll('*').forEach(function(el){
        try{
          var bg=getComputedStyle(el).backgroundImage;
          if(bg&&bg!=='none'){
            var r=el.getBoundingClientRect(),s=getComputedStyle(el);
            lines.push('bg['+bi+']:'+el.tagName+' '+r.width.toFixed(0)+'x'+r.height.toFixed(0)+' sz:'+s.backgroundSize+' pos:'+s.backgroundPosition);
            bi++;
          }
        }catch(e){}
      });
      showOverlay(lines);
    }
    var obs=new MutationObserver(fixSplash);
    obs.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(function(){obs.disconnect();},15000);
  }());
  </script>`;

  // Expo puts </head> right after the last element on the same line; add newline first
  html = html.replace('</head>', `\n${pwaHead}\n</head>`);

  writeFileSync(join(distDir, 'index.html'), html);
} else {
  console.log('  index.html already patched — skipped');
}

// ── 5. Patch JS bundle: fix asset paths ────────────────────────────
// Expo Metro output:single hardcodes "/assets/..." in the bundle regardless of baseUrl.
// Replace "/assets/ → "/dugoutpick/assets/ so GitHub Pages paths resolve correctly.
const jsBundleDir = join(distDir, '_expo', 'static', 'js', 'web');
const jsBundles = readdirSync(jsBundleDir).filter(f => f.endsWith('.js'));
let patchedBundles = 0;
for (const bundleFile of jsBundles) {
  const bundlePath = join(jsBundleDir, bundleFile);
  const bundleContent = readFileSync(bundlePath, 'utf8');
  if (bundleContent.includes('"/assets/')) {
    const patched = bundleContent.replaceAll('"/assets/', '"/dugoutpick/assets/');
    writeFileSync(bundlePath, patched, 'utf8');
    patchedBundles++;
  }
}

console.log('✓ PWA patch done');
console.log('  icon.png, favicon.png copied');
console.log('  manifest.json created');
console.log('  sw.js created');
console.log('  index.html patched (viewport, favicon, Apple meta, manifest link, SW)');
console.log(`  ${patchedBundles} JS bundle(s) patched (asset paths prefixed with /dugoutpick)`);
