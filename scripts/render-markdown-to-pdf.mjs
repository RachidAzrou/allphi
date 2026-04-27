import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

function usage() {
  console.error(
    "Usage: node scripts/render-markdown-to-pdf.mjs <input.md> <output.pdf>",
  );
  process.exit(2);
}

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) usage();

const md = fs.readFileSync(input, "utf8");
fs.mkdirSync(path.dirname(output), { recursive: true });

const doc = new PDFDocument({
  autoFirstPage: true,
  margins: { top: 54, bottom: 54, left: 54, right: 54 },
  size: "A4",
  info: { Title: path.basename(output) },
});

const out = fs.createWriteStream(output);
doc.pipe(out);

// Simple markdown renderer:
// - headings (#, ##, ###)
// - bullet lists (- )
// - fenced code blocks ``` ... ```
// - paragraphs (fallback)
let inCode = false;
let codeBuffer = [];

function flushCode() {
  if (!codeBuffer.length) return;
  doc.moveDown(0.4);
  doc
    .font("Courier")
    .fontSize(9)
    .fillColor("#111111")
    .text(codeBuffer.join("\n"), {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      lineGap: 2,
    });
  doc.font("Helvetica").fontSize(11).fillColor("#111111");
  codeBuffer = [];
  doc.moveDown(0.6);
}

function ensureSpace() {
  const y = doc.y;
  if (y > doc.page.height - doc.page.margins.bottom - 60) {
    doc.addPage();
  }
}

const lines = md.replace(/\r\n/g, "\n").split("\n");
for (const rawLine of lines) {
  const line = rawLine.replace(/\t/g, "  ");

  if (line.trim().startsWith("```")) {
    if (!inCode) {
      inCode = true;
      codeBuffer = [];
      continue;
    }
    inCode = false;
    flushCode();
    continue;
  }

  if (inCode) {
    codeBuffer.push(line);
    continue;
  }

  const trimmed = line.trim();
  if (!trimmed) {
    doc.moveDown(0.45);
    continue;
  }

  ensureSpace();

  // Headings
  if (trimmed.startsWith("### ")) {
    doc.font("Helvetica-Bold").fontSize(14).text(trimmed.slice(4));
    doc.font("Helvetica").fontSize(11);
    doc.moveDown(0.4);
    continue;
  }
  if (trimmed.startsWith("## ")) {
    doc.font("Helvetica-Bold").fontSize(16).text(trimmed.slice(3));
    doc.font("Helvetica").fontSize(11);
    doc.moveDown(0.5);
    continue;
  }
  if (trimmed.startsWith("# ")) {
    doc.font("Helvetica-Bold").fontSize(20).text(trimmed.slice(2));
    doc.font("Helvetica").fontSize(11);
    doc.moveDown(0.7);
    continue;
  }

  // Bullets
  if (trimmed.startsWith("- ")) {
    const bullet = trimmed.slice(2);
    doc.text(`• ${bullet}`, { indent: 12 });
    continue;
  }

  // Horizontal rule
  if (/^---+$/.test(trimmed)) {
    doc.moveDown(0.6);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor("#dddddd")
      .stroke();
    doc.strokeColor("#000000");
    doc.moveDown(0.9);
    continue;
  }

  // Paragraph
  doc.text(trimmed, { lineGap: 2 });
}

if (inCode) flushCode();

doc.end();

await new Promise((resolve, reject) => {
  out.on("finish", resolve);
  out.on("error", reject);
});

console.log(`Wrote ${output}`);

