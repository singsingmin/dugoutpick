// PNG → WebP 변환 도구 (재사용). 새 에셋 추가 시 이걸로 변환.
//
// 사용법:
//   node scripts/asset-to-webp.mjs <입력.png> [옵션]
//   node scripts/asset-to-webp.mjs app/assets/a.png app/assets/b.png --quality 82
//
// 옵션:
//   --lossless        무손실(텍스트·엣지·투명 에셋 권장, 기본값)
//   --quality N       손실 압축 품질 0~100 (사진형 배경 권장, 예: 82)
//   --near-lossless N  근접무손실(0~100, 높을수록 원본에 가까움)
//   --rm              변환 후 원본 PNG 삭제
//
// sharp 필요: 이 폴더에서 `npm install` 한 번(scripts/package.json).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const getFlag = (name) => args.includes(`--${name}`);
const getVal = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
// 값을 받는 플래그(--quality N 등)의 값 인덱스는 입력파일 목록에서 제외.
const valueFlags = ['quality', 'near-lossless'];
const consumed = new Set();
for (const name of valueFlags) { const i = args.indexOf(`--${name}`); if (i >= 0) consumed.add(i + 1); }
const inputs = args.filter((a, i) => !a.startsWith('--') && !consumed.has(i));

if (inputs.length === 0) {
  console.error('입력 PNG 경로가 필요합니다. 예: node scripts/asset-to-webp.mjs app/assets/x.png --quality 82');
  process.exit(1);
}

const quality = getVal('quality');
const nearLossless = getVal('near-lossless');
const lossless = getFlag('lossless') || (quality === undefined && nearLossless === undefined);
const rm = getFlag('rm');

const webpOpts = lossless
  ? { lossless: true, effort: 6 }
  : nearLossless !== undefined
    ? { nearLossless: true, quality: Number(nearLossless), effort: 6 }
    : { quality: Number(quality), effort: 6 };

const kb = (n) => (n / 1024).toFixed(1) + 'KB';

for (const input of inputs) {
  if (!fs.existsSync(input)) { console.error(`✗ 없음: ${input}`); continue; }
  const out = input.replace(/\.png$/i, '.webp');
  const before = fs.statSync(input).size;
  await sharp(input).webp(webpOpts).toFile(out);
  const after = fs.statSync(out).size;
  const mode = lossless ? 'lossless' : nearLossless !== undefined ? `near-lossless ${nearLossless}` : `q${quality}`;
  console.log(`✓ ${path.basename(input)} → ${path.basename(out)}  [${mode}]  ${kb(before)} → ${kb(after)}  (${(100 - (after / before) * 100).toFixed(0)}%↓)`);
  if (rm) fs.unlinkSync(input);
}
