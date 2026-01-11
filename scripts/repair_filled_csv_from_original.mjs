import fs from "fs";
import path from "path";

const root = process.cwd();
const filledPath = path.join(root, "data", "flashcards.filled.csv");
const originalPath = path.join(root, "data", "flashcards.csv");
const outPath = path.join(root, "data", "flashcards.filled.repaired.csv");

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

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }

    if (ch === "\r") continue;

    cur += ch;
  }

  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows;
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";
}

function clean(s) {
  return String(s ?? "").trim();
}

function isPlaceholder(s) {
  return /^word_\d+$/i.test(clean(s));
}

function indexHeader(headerRow) {
  const h = headerRow.map((x) => clean(x).toLowerCase());
  const get = (k) => h.indexOf(k);
  return {
    header: h,
    id: get("id"),
    en: get("en"),
    yo: get("yo"),
    ig: get("ig"),
    pg: get("pg"),
  };
}

function buildMap(rows, idx) {
  const map = new Map();
  for (const r of rows.slice(1)) {
    const id = Number(clean(r[idx.id]));
    if (!Number.isFinite(id)) continue;

    const en = clean(r[idx.en]);
    const yo = clean(r[idx.yo]);
    const ig = clean(r[idx.ig]);
    const pg = clean(r[idx.pg]);

    if (!en || !yo || !ig || !pg) continue;
    if (isPlaceholder(en) || isPlaceholder(yo) || isPlaceholder(ig) || isPlaceholder(pg)) continue;

    map.set(id, { en, yo, ig, pg });
  }
  return map;
}

if (!fs.existsSync(filledPath)) {
  console.log("❌ Missing:", filledPath);
  process.exit(1);
}
if (!fs.existsSync(originalPath)) {
  console.log("❌ Missing:", originalPath);
  process.exit(1);
}

const filled = parseCsv(fs.readFileSync(filledPath, "utf8"));
const orig = parseCsv(fs.readFileSync(originalPath, "utf8"));

const fIdx = indexHeader(filled[0]);
const oIdx = indexHeader(orig[0]);

for (const k of ["id", "en", "yo", "ig", "pg"]) {
  if (fIdx[k] === -1) {
    console.log("❌ filled.csv missing column:", k);
    console.log("Header =", fIdx.header);
    process.exit(1);
  }
  if (oIdx[k] === -1) {
    console.log("❌ flashcards.csv missing column:", k);
    console.log("Header =", oIdx.header);
    process.exit(1);
  }
}

const origMap = buildMap(orig, oIdx);

let repaired = 0;
let stillBad = 0;

for (let i = 1; i < filled.length; i++) {
  const r = filled[i];
  const id = Number(clean(r[fIdx.id]));
  if (!Number.isFinite(id)) continue;

  const en = clean(r[fIdx.en]);
  const yo = clean(r[fIdx.yo]);
  const ig = clean(r[fIdx.ig]);
  const pg = clean(r[fIdx.pg]);

  const bad =
    !en || !yo || !ig || !pg ||
    isPlaceholder(en) || isPlaceholder(yo) || isPlaceholder(ig) || isPlaceholder(pg);

  if (!bad) continue;

  const fromOrig = origMap.get(id);
  if (fromOrig) {
    r[fIdx.en] = fromOrig.en;
    r[fIdx.yo] = fromOrig.yo;
    r[fIdx.ig] = fromOrig.ig;
    r[fIdx.pg] = fromOrig.pg;
    repaired++;
  } else {
    stillBad++;
  }
}

fs.writeFileSync(outPath, toCsv(filled), "utf8");

console.log("✅ Wrote:", outPath);
console.log("Repaired rows:", repaired);
console.log("Still bad rows (no clean match in flashcards.csv):", stillBad);

if (stillBad > 0) {
  console.log("👉 Next: your original flashcards.csv doesn’t have clean values for some ids.");
  console.log("   Tell me the output of: node scripts/show_bad_ids.mjs");
}
