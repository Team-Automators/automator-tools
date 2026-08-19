// Generates icon-192.png and icon-512.png in client/public using pure Node.js
// Dark background + lightning bolt silhouette in accent blue
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

// Draw a lightning bolt icon on an RGBA canvas
function makePNG(size) {
  // RGBA pixel array
  const px = new Uint8Array(size * size * 4);

  const bg   = [15,  23,  42,  255]; // #0F172A
  const acc  = [37, 99,  235, 255];  // #2563EB
  const r    = Math.round(size * 0.18); // corner radius

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Rounded rect clip
      const dx = Math.max(0, Math.max(r - x, x - (size - 1 - r)));
      const dy = Math.max(0, Math.max(r - y, y - (size - 1 - r)));
      if (dx * dx + dy * dy > r * r) {
        // Outside rounded rect — transparent
        px[i+3] = 0;
        continue;
      }

      // Default: background
      px[i]   = bg[0]; px[i+1] = bg[1]; px[i+2] = bg[2]; px[i+3] = 255;

      // Lightning bolt using the scaled path from viewBox 0 0 24 24
      // Points (scaled to [0..1] space then multiplied by size):
      // Original: M13 2 L3 14 h9 l-1 8   10 -12 h-9 l1 -8 z
      // = polygon: (13,2),(3,14),(12,14),(11,22),(21,10),(12,10)
      const pts = [
        [13/24, 2/24],
        [3/24,  14/24],
        [12/24, 14/24],
        [11/24, 22/24],
        [21/24, 10/24],
        [12/24, 10/24],
      ].map(([px2, py2]) => [
        Math.round(px2 * size * 0.72 + size * 0.14),  // 72% width, 14% margin
        Math.round(py2 * size * 0.72 + size * 0.14),
      ]);

      if (pointInPolygon(x, y, pts)) {
        px[i] = acc[0]; px[i+1] = acc[1]; px[i+2] = acc[2]; px[i+3] = 255;
      }
    }
  }

  // Build PNG
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  // Raw rows with filter byte 0
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0;
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (1 + size * 4) + 1 + x * 4;
      raw[dst]   = px[src];
      raw[dst+1] = px[src+1];
      raw[dst+2] = px[src+2];
      raw[dst+3] = px[src+3];
    }
  }

  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

const out = path.join(__dirname, 'client', 'public');
fs.mkdirSync(out, { recursive: true });

console.log('Generating icon-192.png…');
fs.writeFileSync(path.join(out, 'icon-192.png'), makePNG(192));

console.log('Generating icon-512.png…');
fs.writeFileSync(path.join(out, 'icon-512.png'), makePNG(512));

console.log('Done. Icons written to client/public/');
