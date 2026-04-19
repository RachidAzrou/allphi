// Extract operator-stream rectangles + image positions from page 1 of the
// Europees aanrijdingsformulier template, so we can place the impact arrows
// inside section 10 boxes. Run with `node scripts/extract-template-boxes.mjs`.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = path.join(__dirname, "..", "public", "AANRIJDINGSFORMULIER.pdf");

const data = await readFile(pdfPath);
const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
const doc = await loadingTask.promise;
const page = await doc.getPage(1);
const viewport = page.getViewport({ scale: 1 });
console.log("page size:", viewport.width.toFixed(2), "x", viewport.height.toFixed(2));

const opList = await page.getOperatorList();
const fnNames = pdfjs.OPS;

// Track current transform matrix stack for image positions.
const stack = [];
let m = [1, 0, 0, 1, 0, 0];
const mul = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

const items = [];
for (let i = 0; i < opList.fnArray.length; i++) {
  const fn = opList.fnArray[i];
  const args = opList.argsArray[i];
  if (fn === fnNames.save) stack.push(m.slice());
  else if (fn === fnNames.restore) m = stack.pop() || [1, 0, 0, 1, 0, 0];
  else if (fn === fnNames.transform) {
    m = mul(m, args);
  } else if (
    fn === fnNames.paintImageXObject ||
    fn === fnNames.paintInlineImageXObject ||
    fn === fnNames.paintJpegXObject ||
    fn === fnNames.paintImageMaskXObject
  ) {
    // image is drawn in unit square scaled by current transform
    const x = m[4];
    const y = m[5];
    const w = Math.hypot(m[0], m[1]);
    const h = Math.hypot(m[2], m[3]);
    items.push({ kind: "image", name: args[0] ?? "(inline)", x, y, w, h });
  } else if (fn === fnNames.constructPath) {
    // args = [opIds, operands]
    const ops = args[0];
    const operands = args[1];
    let oi = 0;
    for (const op of ops) {
      if (op === fnNames.rectangle) {
        const x = operands[oi++];
        const y = operands[oi++];
        const w = operands[oi++];
        const h = operands[oi++];
        // transform by current matrix to page coordinates
        const x2 = m[0] * x + m[2] * y + m[4];
        const y2 = m[1] * x + m[3] * y + m[5];
        items.push({ kind: "rect", x: x2, y: y2, w, h });
      } else if (op === fnNames.moveTo || op === fnNames.lineTo) {
        oi += 2;
      } else if (op === fnNames.curveTo) {
        oi += 6;
      } else if (op === fnNames.curveTo2 || op === fnNames.curveTo3) {
        oi += 4;
      }
    }
  }
}

console.log("\n--- IMAGES ---");
items
  .filter((i) => i.kind === "image")
  .forEach((i) =>
    console.log(
      `${i.name} @ x=${i.x.toFixed(2)} y=${i.y.toFixed(2)} w=${i.w.toFixed(
        2,
      )} h=${i.h.toFixed(2)}`,
    ),
  );

console.log("\n--- LARGE RECTS (w*h > 5000) ---");
items
  .filter((i) => i.kind === "rect" && i.w * i.h > 5000)
  .forEach((i) =>
    console.log(
      `rect @ x=${i.x.toFixed(2)} y=${i.y.toFixed(2)} w=${i.w.toFixed(
        2,
      )} h=${i.h.toFixed(2)}`,
    ),
  );
