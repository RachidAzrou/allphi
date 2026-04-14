/**
 * Maakt zwarte hoeken transparant voor PWA-iconen (geen zwarte rand).
 * Bron: vierkant met blauwe cirkel + witte phi op zwarte achtergrond.
 */
import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** Vierkant PNG: blauwe cirkel + wit symbool op zwarte hoeken → dit script maakt hoeken transparant. */
const input = join(root, "public/icons/source-icon-512.png");

function isForeground(r, g, b) {
  // Witte phi
  if (r > 200 && g > 200 && b > 200) return true;
  // Merkblauw en randen van de cirkel (B dominant)
  if (b > 72 && b > r - 8 && b > g - 8 && r + g + b > 95) return true;
  return false;
}

async function processIcon() {
  const buf = readFileSync(input);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const w = info.width;
  const h = info.height;
  const out = new Uint8ClampedArray(data);
  const transparent = new Uint8Array(w * h);

  const stack = [];
  const push = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = y * w + x;
    if (transparent[i]) return;
    const o = i * 4;
    const r = out[o];
    const g = out[o + 1];
    const b = out[o + 2];
    if (isForeground(r, g, b)) return;
    transparent[i] = 1;
    stack.push(i);
  };

  for (const [x, y] of [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ]) {
    push(x, y);
  }

  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  for (let i = 0; i < w * h; i++) {
    if (!transparent[i]) continue;
    const o = i * 4;
    out[o + 3] = 0;
  }

  // Verwijder resterende zwarte/donkere rand rond de cirkel (niet met hoeken verbonden).
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (out[o + 3] === 0) continue;
    const r = out[o];
    const g = out[o + 1];
    const b = out[o + 2];
    const sum = r + g + b;
    if (sum < 92 && b < 92) {
      out[o + 3] = 0;
      continue;
    }
    // Dunne donkere halo tussen oud zwart en blauw
    if (sum < 130 && b < 100 && r < 70 && g < 100) {
      out[o + 3] = 0;
    }
  }

  const pngRaw = await sharp(Buffer.from(out), {
    raw: { width: w, height: h, channels: 4 },
  })
    .png()
    .toBuffer();

  const s = Math.min(w, h);
  const left = Math.floor((w - s) / 2);
  const top = Math.floor((h - s) / 2);

  const png512 = await sharp(pngRaw)
    .extract({ left, top, width: s, height: s })
    .resize(512, 512, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  // Flatten op merkblauw zodat transparantie geen "zwarte rand" toont
  // op platformen die icons op een donkere achtergrond renderen.
  const brandBlue = "#2799D7";
  const png512Square = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: brandBlue,
    },
  })
    .composite([{ input: png512 }])
    .png()
    .toBuffer();

  // Normaliseer achtergrond naar exact merkblauw zodat subtiele halo/ringjes verdwijnen.
  const { data: sqRaw } = await sharp(png512Square)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const normalized = new Uint8ClampedArray(sqRaw);
  const bg = await sharp({
    create: { width: 1, height: 1, channels: 4, background: brandBlue },
  })
    .raw()
    .toBuffer();
  const br = bg[0],
    bgc = bg[1],
    bb = bg[2];
  for (let i = 0; i < 512 * 512; i++) {
    const o = i * 4;
    const r = normalized[o];
    const g = normalized[o + 1];
    const b = normalized[o + 2];
    // Houd de witte phi, maak al de rest exact background.
    if (r > 220 && g > 220 && b > 220) continue;
    normalized[o] = br;
    normalized[o + 1] = bgc;
    normalized[o + 2] = bb;
    normalized[o + 3] = 255;
  }
  const png512Final = await sharp(Buffer.from(normalized), {
    raw: { width: 512, height: 512, channels: 4 },
  })
    .png()
    .toBuffer();

  const out512 = join(root, "public/icons/app-icon-512.png");
  const out192 = join(root, "public/icons/app-icon-192.png");

  writeFileSync(out512, png512Final);
  await sharp(png512Final)
    .resize(192, 192, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(out192);

  const apple180 = join(root, "public/icons/apple-touch-icon.png");
  await sharp(png512Final)
    .resize(180, 180, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(apple180);

  console.log("Wrote", out512, out192, apple180);
}

processIcon().catch((e) => {
  console.error(e);
  process.exit(1);
});
