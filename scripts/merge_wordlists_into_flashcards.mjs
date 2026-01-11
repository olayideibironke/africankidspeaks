// scripts/merge_wordlists_into_flashcards.mjs
// Merge 3 notepad wordlists (en-yo, en-ig, en-pg) into data/flashcards.csv
// Output: data/flashcards.filled.csv
//
// Assumption (IMPORTANT):
// - Each notepad file contains ONE entry per line in this form:
//     English - Translation
//   (hyphen can be "-", "–", or "—")
// - We will use LINE POSITION as the ID mapping:
//     line 1 => id 1, line 2 => id 2, ... line 500 => id 500
//
// What it does:
// - Keeps your existing metadata columns (category, difficulty, tags, notes, synonyms)
// - Replaces en/yo/ig/pg for ids 33..500 (and can also replace 1..32 if you want later)
// - Strips trailing numbers like "Food 133" from the English text automatically

import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const FLASHCARDS_IN = path.join(ROOT, "data", "flashcards.csv");
const FLASHCARDS_OUT = path.join(ROOT, "data", "flashcards.filled.csv");

// Put your notepad files here (create the folder and drop them in)
const YO_FILE = path.join(ROOT, "data", "wordlists", "en-yo.txt");
const IG_FILE = path.join(ROOT, "data", "wordlists", "en-ig.txt");
const PG_FILE = path.join(ROOT, "data", "wordlists", "en-pg.txt");

function assertExists(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing file: ${p}`);
  }
}

/** Robust-ish CSV parsing (handles commas + quotes) */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        // escaped quote
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    // not in quotes
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }

    field += c;
    i++;
  }

  // last field
  row.push(field);
  rows.push(row);
  return rows;
}

function toCsv(rows) {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v ?? "";
          const needsQuotes = /[",\n\r]/.test(s);
          const escaped = s.replace(/"/g, '""');
          return needsQuotes ? `"${escaped}"` : escaped;
        })
        .join(",")
    )
    .join("\n");
}

function stripTrailingNumber(s) {
  return String(s ?? "")
    .replace(/\s*\d+\s*$/g, "")
    .trim();
}

// parse "English - Translation" lines
function parseWordlist(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items = lines.map((line, idx) => {
    // accept "-", "–", "—"
    const m = line.match(/^(.*?)\s*[-–—]\s*(.*?)$/);
    if (!m) {
      throw new Error(
        `Bad line format in ${path.basename(filePath)} at line ${idx + 1}:\n${line}\nExpected: English - Translation`
      );
    }
    const en = stripTrailingNumber(m[1]);
    const tr = (m[2] ?? "").trim();
    return { en, tr };
  });

  return items;
}

function isPlaceholder(x) {
  const s = String(x ?? "").trim();
  return s === "" || /^word_\d+$/i.test(s);
}

function main() {
  assertExists(FLASHCARDS_IN);
  assertExists(YO_FILE);
  assertExists(IG_FILE);
  assertExists(PG_FILE);

  const yo = parseWordlist(YO_FILE);
  const ig = parseWordlist(IG_FILE);
  const pg = parseWordlist(PG_FILE);

  // need at least 500
  const need = 500;
  if (yo.length < need || ig.length < need || pg.length < need) {
    throw new Error(
      `Wordlists must have at least ${need} lines.\n` +
        `en-yo: ${yo.length}, en-ig: ${ig.length}, en-pg: ${pg.length}`
    );
  }

  const csvRaw = fs.readFileSync(FLASHCARDS_IN, "utf8");
  const rows = parseCsv(csvRaw);

  const header = rows[0];
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  // required cols
  for (const col of ["id", "en", "yo", "ig", "pg"]) {
    if (!(col in idx)) {
      throw new Error(`flashcards.csv missing required column: ${col}`);
    }
  }

  // Fill ids 33..500 using line position == id
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const id = Number(row[idx.id]);
    if (!Number.isFinite(id) || id < 1 || id > 500) continue;

    if (id >= 33 && id <= 500) {
      const k = id - 1; // line position

      // Always replace EN from your wordlists (kills word_33 etc)
      row[idx.en] = yo[k].en; // use yo file's English side as source of truth

      // Replace translations (yo/ig/pg)
      row[idx.yo] = yo[k].tr;
      row[idx.ig] = ig[k].tr;
      row[idx.pg] = pg[k].tr;
    } else {
      // ids 1..32: only patch if placeholders exist (safety)
      if (isPlaceholder(row[idx.en])) row[idx.en] = yo[id - 1].en;
      if (isPlaceholder(row[idx.yo])) row[idx.yo] = yo[id - 1].tr;
      if (isPlaceholder(row[idx.ig])) row[idx.ig] = ig[id - 1].tr;
      if (isPlaceholder(row[idx.pg])) row[idx.pg] = pg[id - 1].tr;
    }
  }

  const out = toCsv(rows);
  fs.writeFileSync(FLASHCARDS_OUT, out, "utf8");

  console.log(`✅ Wrote: ${path.relative(ROOT, FLASHCARDS_OUT)}`);
  console.log(`Next: point your generator to flashcards.filled.csv (or replace flashcards.csv)`);
}

main();
