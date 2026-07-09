const CACHE = 'dugoutpick-1783595665325';
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
  // Network-first: 동적 데이터(원격 JSON·Supabase API)·HTML.
  // ⚠️ Supabase(.supabase.co)를 캐시하면 재화 잔액 GET이 옛 값에 고정돼 화면이 안 갱신됨
  //    (구매 POST는 SW가 캐시 안 해 DB는 차감되지만 조회는 stale) → 반드시 네트워크 우선.
  const isHtml = url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  const isDynamic = url.hostname === 'raw.githubusercontent.com' || url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.workers.dev');
  if (isDynamic || isHtml) {
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
      }).catch(() => caches.match(e.request));   // fetch 실패(CORS/네트워크) 시 캐시 폴백 — 미처리 throw 방지
    })
  );
});
