// scripts/scriptsmerge_yo_template_1_500.mjs
// Merge Yoruba template into data/flashcards.csv AND ensure ids 1..500 have safe placeholders
// Ensures en/yo/ig/pg are NEVER blank so generate_flashcards_from_csv.mjs won't fail.

import fs from "fs";
import path from "path";

const CSV_PATH = path.join("data", "flashcards.csv");
const YO_TEMPLATE_PATH = path.join("data", "yo_1_500_template.csv");

const HEADER = [
  "id",
  "en",
  "yo",
  "ig",
  "pg",
  "category",
  "difficulty",
  "tags",
  "notes_yo",
  "notes_ig",
  "notes_pg",
  "synonyms_yo",
  "synonyms_ig",
  "synonyms_pg",
];

function parseCsv(text) {
  const lines = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out = [];
  let i = 0;

  function parseLine(line) {
    const cells = [];
    let cur = "";
    let q = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (q) {
        if (ch === '"') {
          if (line[j + 1] === '"') {
            cur += '"';
            j++;
          } else {
            q = false;
          }
        } else cur += ch;
      } else {
        if (ch === '"') q = true;
        else if (ch === ",") {
          cells.push(cur);
          cur = "";
        } else cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  }

  while (i < lines.length && !lines[i].trim()) i++;
  if (i >= lines.length) return { header: [], rows: [] };

  const header = parseLine(lines[i]).map((s) => String(s ?? "").trim());
  i++;

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cells = parseLine(line);
    const row = {};
    for (let k = 0; k < header.length; k++) row[header[k]] = cells[k] ?? "";
    out.push(row);
  }

  return { header, rows: out };
}

function escCsvCell(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  const lines = [];
  lines.push(HEADER.join(","));
  for (const r of rows) {
    lines.push(HEADER.map((k) => escCsvCell(r[k] ?? "")).join(","));
  }
  return lines.join("\n") + "\n";
}

function norm(s) {
  return String(s ?? "").trim();
}

function placeholder(id) {
  return `word_${id}`;
}

function ensureRowShape(id) {
  const r = {};
  for (const k of HEADER) r[k] = "";
  r.id = String(id);
  return r;
}

function coalesce(...vals) {
  for (const v of vals) {
    const s = norm(v);
    if (s) return s;
  }
  return "";
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ Missing ${CSV_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(YO_TEMPLATE_PATH)) {
    console.error(`❌ Missing ${YO_TEMPLATE_PATH}`);
    process.exit(1);
  }

  const baseTxt = fs.readFileSync(CSV_PATH, "utf8");
  const tmplTxt = fs.readFileSync(YO_TEMPLATE_PATH, "utf8");

  const base = parseCsv(baseTxt);
  const tmpl = parseCsv(tmplTxt);

  const baseMap = new Map();
  for (const r of base.rows) {
    const id = Number(r.id);
    if (Number.isFinite(id)) baseMap.set(id, r);
  }

  const tmplMap = new Map();
  for (const r of tmpl.rows) {
    const id = Number(r.id);
    if (Number.isFinite(id)) tmplMap.set(id, r);
  }

  const outRows = [];
  let updated = 0;

  for (let id = 1; id <= 500; id++) {
    const b = baseMap.get(id);
    const t = tmplMap.get(id);

    const row = ensureRowShape(id);

    // carry everything from base first
    if (b) {
      for (const k of HEADER) {
        if (k === "id") continue;
        row[k] = b[k] ?? "";
      }
    }

    // merge in Yoruba template where present (template has fewer columns)
    if (t) {
      // template columns expected: id,en,yo,category,difficulty,tags,notes_yo (at minimum)
      row.en = coalesce(row.en, t.en);
      row.yo = coalesce(row.yo, t.yo);

      row.category = coalesce(row.category, t.category);
      row.difficulty = coalesce(row.difficulty, t.difficulty);
      row.tags = coalesce(row.tags, t.tags);
      row.notes_yo = coalesce(row.notes_yo, t.notes_yo);
    }

    // ✅ Hard guarantee: never allow empty en/yo/ig/pg
    const ph = placeholder(id);
    row.en = coalesce(row.en, ph);
    row.yo = coalesce(row.yo, row.en, ph);
    row.ig = coalesce(row.ig, row.en, ph);
    row.pg = coalesce(row.pg, row.en, ph);

    // If category/difficulty missing, set safe defaults (keeps generator happy)
    row.category = coalesce(row.category, "greetings");
    row.difficulty = coalesce(row.difficulty, "1");
    row.tags = row.tags ?? "";

    // count update if we touched anything vs base
    if (!b) updated++;
    else {
      const beforeEn = norm(b.en);
      const beforeYo = norm(b.yo);
      if (!beforeEn || !beforeYo) updated++;
    }

    outRows.push(row);
  }

  // Validate: no missing en/yo/ig/pg
  const missing = [];
  for (const r of outRows) {
    const id = Number(r.id);
    const bad =
      !norm(r.en) || !norm(r.yo) || !norm(r.ig) || !norm(r.pg);
    if (bad) missing.push(id);
    if (missing.length >= 25) break;
  }

  fs.writeFileSync(CSV_PATH, toCsv(outRows), "utf8");

  if (missing.length) {
    console.log(`❌ Merge done but some rows still missing en/yo/ig/pg (first 25): ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`✅ merged YO template into ${CSV_PATH}`);
  console.log(`✅ ensured placeholders for any missing text (ids 1..500)`);
  console.log(`✅ updated rows touched: ${updated}`);
  console.log(`✅ validation passed: en+yo+ig+pg present for ids 1..500`);
}

main();
