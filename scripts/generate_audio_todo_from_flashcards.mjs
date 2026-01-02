// scripts/generate_audio_todo_from_flashcards.mjs
// Generates data/audio_todo.csv showing which flashcard IDs are missing native audio per language.
// Assumes native audio is stored as assets/audio/{yo,ig,pg}/{id}.mp3
// NO UPPERCASE filenames.

import fs from "fs";
import path from "path";

const root = process.cwd();

const csvPath = path.join(root, "data", "flashcards.csv");
const outPath = path.join(root, "data", "audio_todo.csv");

const audioDirs = {
  yo: path.join(root, "assets", "audio", "yo"),
  ig: path.join(root, "assets", "audio", "ig"),
  pg: path.join(root, "assets", "audio", "pg"),
};

function die(msg) {
  console.error(`\n[generate_audio_todo] ${msg}\n`);
  process.exit(1);
}

// Minimal CSV parser that supports quotes and commas inside quotes.
function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      field = "";
      // ignore empty trailing row
      if (row.some((x) => String(x).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    if (ch === "\r") continue;

    field += ch;
  }

  // last field
  row.push(field);
  if (row.some((x) => String(x).trim() !== "")) rows.push(row);

  return rows;
}

function readExistingAudioIds(dirPath) {
  try {
    const files = fs.readdirSync(dirPath);
    const ids = new Set();
    for (const f of files) {
      // match "13.mp3" only
      const m = /^(\d+)\.mp3$/i.exec(f);
      if (m) ids.add(Number(m[1]));
    }
    return ids;
  } catch {
    // directory may not exist yet
    return new Set();
  }
}

function toCsvRow(fields) {
  // quote if needed
  return fields
    .map((v) => {
      const s = String(v ?? "");
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(",");
}

if (!fs.existsSync(csvPath)) die(`Missing file: ${path.relative(root, csvPath)}`);

const csvRaw = fs.readFileSync(csvPath, "utf8");
const rows = parseCsv(csvRaw);

if (rows.length < 2) die("flashcards.csv has no data rows.");

const header = rows[0].map((h) => String(h).trim().toLowerCase());
const idCol = header.indexOf("id");
const enCol = header.indexOf("en");

if (idCol === -1) die('flashcards.csv must include a column named "id".');
if (enCol === -1) die('flashcards.csv must include a column named "en".');

const yoIds = readExistingAudioIds(audioDirs.yo);
const igIds = readExistingAudioIds(audioDirs.ig);
const pgIds = readExistingAudioIds(audioDirs.pg);

const out = [];
out.push(
  toCsvRow([
    "id",
    "en",
    "yo_has_native",
    "ig_has_native",
    "pg_has_native",
    "yo_missing",
    "ig_missing",
    "pg_missing",
  ])
);

let total = 0;
let yoHave = 0;
let igHave = 0;
let pgHave = 0;

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];

  const id = Number(String(row[idCol] ?? "").trim());
  const en = String(row[enCol] ?? "").trim();

  if (!Number.isFinite(id)) continue;

  total += 1;

  const yoHas = yoIds.has(id);
  const igHas = igIds.has(id);
  const pgHas = pgIds.has(id);

  if (yoHas) yoHave += 1;
  if (igHas) igHave += 1;
  if (pgHas) pgHave += 1;

  out.push(
    toCsvRow([
      id,
      en,
      yoHas ? 1 : 0,
      igHas ? 1 : 0,
      pgHas ? 1 : 0,
      yoHas ? "" : "MISSING",
      igHas ? "" : "MISSING",
      pgHas ? "" : "MISSING",
    ])
  );
}

fs.writeFileSync(outPath, out.join("\n") + "\n", "utf8");

console.log("\n[generate_audio_todo] Wrote:", path.relative(root, outPath));
console.log("[generate_audio_todo] Flashcards:", total);
console.log("[generate_audio_todo] Yoruba native:", `${yoHave}/${total}`);
console.log("[generate_audio_todo] Igbo native:", `${igHave}/${total}`);
console.log("[generate_audio_todo] Pidgin native:", `${pgHave}/${total}\n`);
