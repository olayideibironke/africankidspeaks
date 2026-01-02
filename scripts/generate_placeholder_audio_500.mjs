import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "assets", "audio", "yo");

// Base64 for a tiny silent MP3 (very short)
const SILENT_MP3_BASE64 =
  "SUQzAwAAAAAAF1RTU0UAAAAPAAADTGF2ZjU2LjM2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQAAADhGAAAABAAADSAAAAEsAAABEVuZGF0YQAAAAA=";

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeMp3(filePath) {
  const buf = Buffer.from(SILENT_MP3_BASE64, "base64");
  fs.writeFileSync(filePath, buf);
}

ensureDir(OUT_DIR);

let made = 0;
let skipped = 0;

for (let id = 1; id <= 500; id++) {
  const fp = path.join(OUT_DIR, `${id}.mp3`);
  if (fs.existsSync(fp)) {
    skipped++;
    continue;
  }
  writeMp3(fp);
  made++;
}

console.log(`✅ Yoruba placeholders ready in: ${OUT_DIR}`);
console.log(`✅ Created: ${made}`);
console.log(`↩️ Skipped (already existed): ${skipped}`);
