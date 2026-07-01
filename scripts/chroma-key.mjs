// 크로마키 배경 제거 (재사용) — 형광 마젠타/그린 단색 배경 위 에셋을 투명 PNG/WebP로.
//
// 사용법:
//   node scripts/chroma-key.mjs <입력.png> <출력.webp|png> [--key magenta|green] [--lossless|--quality N]
//
// 마젠타 판정: min(R,B)-G 가 큰 픽셀(=마젠타 과잉). 빨강(B낮음)·크림(G높음)은 안 걸림.
// 엣지 스필(보라 잔상)은 전이 밴드에서 알파 페이드 + R/B를 G쪽으로 당겨 억제.
import fs from 'node:fs';
import sharp from 'sharp';

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith('--'));
const getVal = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const has = (n) => args.includes(`--${n}`);
const [input, output] = files;
if (!input || !output) { console.error('사용법: node scripts/chroma-key.mjs <입력> <출력.webp> [--key magenta|green] [--quality N|--lossless]'); process.exit(1); }

const key = getVal('key') ?? 'magenta';
const HARD = 60, SOFT = 20; // 과잉 임계: >=HARD 완전투명, SOFT~HARD 전이

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

// 배경 과잉값(excess): magenta = min(R,B)-G, green = G-max(R,B)
function excess(r, g, b) {
  return key === 'green' ? g - Math.max(r, b) : Math.min(r, b) - g;
}

let minX = W, minY = H, maxX = 0, maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const m = excess(r, g, b);
    if (m >= HARD) { data[i + 3] = 0; continue; }
    if (m > SOFT) {
      const t = (m - SOFT) / (HARD - SOFT);       // 0..1 (배경에 가까울수록 1)
      data[i + 3] = Math.round(data[i + 3] * (1 - t));
      // 스필 억제: 배경색 채널을 G쪽으로 당김
      if (key === 'green') data[i + 1] = Math.round(g - (g - Math.max(r, b)) * t * 0.9);
      else { data[i] = Math.round(r - (r - g) * t * 0.9); data[i + 2] = Math.round(b - (b - g) * t * 0.9); }
    }
    if (data[i + 3] > 8) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
}

const pad = 6;
minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad);
const cw = maxX - minX + 1, ch = maxY - minY + 1;

const lossless = has('lossless') || getVal('quality') === undefined;
const webpOpts = lossless ? { lossless: true, effort: 6 } : { quality: Number(getVal('quality')), effort: 6 };
let pipe = sharp(data, { raw: { width: W, height: H, channels: C } })
  .extract({ left: minX, top: minY, width: cw, height: ch });
pipe = /\.webp$/i.test(output) ? pipe.webp(webpOpts) : pipe.png();
await pipe.toFile(output);
console.log(`✓ ${output}  ${cw}x${ch}  aspect ${(cw / ch).toFixed(4)}  (crop ${minX},${minY}~${maxX},${maxY})  ${(fs.statSync(output).size / 1024).toFixed(1)}KB`);
