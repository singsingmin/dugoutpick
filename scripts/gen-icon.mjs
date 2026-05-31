// 앱 아이콘/스플래시 PNG 생성기 (이미지 툴 없이 순수 Node로 PNG 인코딩).
// 야구공(흰 공 + 빨간 실밥) 모티브. 출력: app/assets/{icon,adaptive-icon,splash-icon}.png
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'assets');

// 색
const GREEN = [0x34, 0x66, 0x3f];
const CREAM = [0xfb, 0xf5, 0xe4];
const DARK = [0x2b, 0x26, 0x20];
const WHITE = [0xf7, 0xf2, 0xe3];
const RED = [0xd3, 0x3a, 0x2c];

// ---- PNG 인코딩 ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
};
function png(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- 그리기 ----
function drawBall({ size = 1024, bg = null, ballScale = 0.62 }) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const R = (size * ballScale) / 2;
  const set = (x, y, c, a = 255) => { const i = (y * size + x) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = a; };
  const out = Math.max(5, R * 0.03);   // 외곽 두께
  const seamSpan = 0.82 * R;            // 실밥이 그려지는 세로 범위
  const seamW = Math.max(4, R * 0.028); // 실밥 선 두께
  const tickLen = R * 0.07;             // 실밥 tick 길이
  const tickThick = Math.max(3, R * 0.022);
  const tickSpacing = R * 0.135;
  for (let y = 0; y < size; y++) {
    const norm = (y - cy) / seamSpan;          // -1..1 (실밥 범위)
    const inSeam = Math.abs(norm) <= 1;
    const bow = inSeam ? 1 - norm * norm : 0;   // 가운데서 안쪽으로 휨
    const lx = cx - 0.5 * R + 0.22 * R * bow;   // 좌측 실밥 (가운데서 우로 볼록)
    const rx = cx + 0.5 * R - 0.22 * R * bow;   // 우측 실밥 (대칭)
    const tickOn = inSeam && (((y - (cy - seamSpan)) % tickSpacing) < tickThick);
    for (let x = 0; x < size; x++) {
      if (bg) set(x, y, bg, 255);
      const d = Math.hypot(x - cx, y - cy);
      if (d > R) continue;
      if (d > R - out) set(x, y, DARK, 255);
      else set(x, y, WHITE, 255);
      if (!inSeam) continue;
      // 실밥 선
      if (Math.abs(x - lx) < seamW || Math.abs(x - rx) < seamW) { set(x, y, RED, 255); continue; }
      // 실밥 tick (좌우 바깥쪽으로 짧은 가로선)
      if (tickOn) {
        if ((x > lx && x < lx + tickLen) || (x < lx && x > lx - tickLen) ||
            (x > rx && x < rx + tickLen) || (x < rx && x > rx - tickLen)) set(x, y, RED, 255);
      }
    }
  }
  return buf;
}

function write(name, w, h, buf) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, png(w, h, buf));
  console.log('wrote', name, fs.statSync(p).size, 'bytes');
}

// icon: 불투명 그린 배경 + 공
write('icon.png', 1024, 1024, drawBall({ size: 1024, bg: GREEN, ballScale: 0.66 }));
// adaptive(안드로이드 전경): 투명 + 공(세이프존 ~62%)
write('adaptive-icon.png', 1024, 1024, drawBall({ size: 1024, bg: null, ballScale: 0.6 }));
// splash: 투명 + 공(크림 배경 위에 표시)
write('splash-icon.png', 1024, 1024, drawBall({ size: 1024, bg: null, ballScale: 0.7 }));
console.log('done');
