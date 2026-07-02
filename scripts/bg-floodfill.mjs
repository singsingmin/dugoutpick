// 근백색(near-white) 배경 제거 (재사용) — 경계에서 flood-fill로 "바깥과 연결된" 밝은 중성 배경만 투명화.
// 크로마키와 달리 단색/미세격자 흰 배경에 쓰며, 내부 크림 명판(숫자 자리)은 프레임에 둘러싸여 보존된다.
//
// 사용법:
//   node scripts/bg-floodfill.mjs <입력.png> <출력.webp|png> [--bright N] [--sat N] [--quality N|--lossless]
//   --bright: 배경 최소 밝기(max채널), 기본 200   --sat: 최대 채도(max-min), 기본 32
//
// 판정: brightness>=bright && (max-min)<=sat 이고 경계에서 BFS로 연결된 픽셀만 배경.
// 경계 페더: 배경에 인접한 반투명 전이 픽셀은 밝기 비례로 알파 감쇠(흰 프린지 억제).
import fs from 'node:fs';
import sharp from 'sharp';

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith('--'));
const getVal = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const has = (n) => args.includes(`--${n}`);
const [input, output] = files;
if (!input || !output) { console.error('사용법: node scripts/bg-floodfill.mjs <입력> <출력.webp> [--bright N] [--sat N] [--quality N|--lossless]'); process.exit(1); }

const BRIGHT = Number(getVal('bright') ?? 200);
const SAT = Number(getVal('sat') ?? 32);
// 페더 밴드: 전이(안티에일리어싱) 픽셀 판정용 완화 임계.
const FEATHER_BRIGHT = BRIGHT - 40;

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const isBg = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx >= BRIGHT && (mx - mn) <= SAT;
};

// 경계에서 BFS flood-fill (연결된 배경만).
const visited = new Uint8Array(W * H);
const stack = [];
const pushIf = (x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const p = y * W + x;
  if (visited[p]) return;
  if (!isBg(p * C)) return;
  visited[p] = 1; stack.push(p);
};
for (let x = 0; x < W; x++) { pushIf(x, 0); pushIf(x, H - 1); }
for (let y = 0; y < H; y++) { pushIf(0, y); pushIf(W - 1, y); }
while (stack.length) {
  const p = stack.pop();
  const x = p % W, y = (p - x) / W;
  pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1);
}

// 배경 → 알파 0. 경계 인접 전이 픽셀 → 밝기 비례 페더.
for (let p = 0; p < W * H; p++) {
  const i = p * C;
  if (visited[p]) { data[i + 3] = 0; continue; }
  // 배경에 인접 && 밝은 중성이면 전이 픽셀 → 부분 투명(프린지 억제)
  const x = p % W, y = (p - x) / W;
  const nbBg = (x > 0 && visited[p - 1]) || (x < W - 1 && visited[p + 1]) ||
               (y > 0 && visited[p - W]) || (y < H - 1 && visited[p + W]);
  if (nbBg) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx >= FEATHER_BRIGHT && (mx - mn) <= SAT + 10) {
      const t = Math.min(1, (mx - FEATHER_BRIGHT) / (255 - FEATHER_BRIGHT)); // 밝을수록 배경에 가까움
      data[i + 3] = Math.round(data[i + 3] * (1 - t * 0.85));
    }
  }
}

// 콘텐츠 bbox 크롭
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (data[(y * W + x) * C + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
}
const pad = 6;
minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad);
const cw = maxX - minX + 1, ch = maxY - minY + 1;

const lossless = has('lossless') || getVal('quality') === undefined;
const webpOpts = lossless ? { lossless: true, effort: 6 } : { quality: Number(getVal('quality')), effort: 6 };
let pipe = sharp(data, { raw: { width: W, height: H, channels: C } }).extract({ left: minX, top: minY, width: cw, height: ch });
pipe = /\.webp$/i.test(output) ? pipe.webp(webpOpts) : pipe.png();
await pipe.toFile(output);
const bgPct = (visited.reduce((a, v) => a + v, 0) / (W * H) * 100).toFixed(1);
console.log(`✓ ${output}  ${cw}x${ch}  aspect ${(cw / ch).toFixed(4)}  bg제거 ${bgPct}%  ${(fs.statSync(output).size / 1024).toFixed(1)}KB`);
