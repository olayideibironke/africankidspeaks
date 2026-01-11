import fs from "fs";
import path from "path";

const root = process.cwd();
const file = path.join(root, "data", "flashcards.filled.repaired.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { row.push(cur); cur = ""; continue; }
    if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; continue; }
    if (ch === "\r") continue;
    cur += ch;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function clean(s) { return String(s ?? "").trim(); }
function isPlaceholder(s) { return /^word_\d+$/i.test(clean(s)); }

if (!fs.existsSync(file)) {
  console.log("❌ Missing:", file);
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(file, "utf8"));
const header = rows[0].map((x) => clean(x).toLowerCase());
const idx = {
  id: header.indexOf("id"),
  en: header.indexOf("en"),
  yo: header.indexOf("yo"),
  ig: header.indexOf("ig"),
  pg: header.indexOf("pg"),
};

const bad = [];
for (const r of rows.slice(1)) {
  const id = Number(clean(r[idx.id]));
  if (!Number.isFinite(id)) continue;
  const en = clean(r[idx.en]);
  const yo = clean(r[idx.yo]);
  const ig = clean(r[idx.ig]);
  const pg = clean(r[idx.pg]);

  if (!en || !yo || !ig || !pg || isPlaceholder(en) || isPlaceholder(yo) || isPlaceholder(ig) || isPlaceholder(pg)) {
    bad.push(id);
  }
}

console.log("Bad IDs count:", bad.length);
console.log("First 50 bad IDs:", bad.slice(0, 50));
