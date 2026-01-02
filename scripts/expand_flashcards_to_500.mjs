// scripts/expand_flashcards_to_500.mjs
// Expands data/flashcards.csv to ids 1..500 safely (keeps existing rows).
// - Removes any row with id=100 (old dev/test row) by default
// - Fills missing ids with placeholders (en=word_<id>, yo/ig/pg blank)
// - Keeps header exactly as-is

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, "data", "flashcards.csv");

const TARGET_MAX_ID = 500;
const REMOVE_IDS = new Set([100]); // old dev/test id

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // handle escaped quotes ""
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

function toCSVCell(value) {
  const s = String(value ?? "");
  if (s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  if (s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s}"`;
  }
  return s;
}

function chooseCategory(id) {
  const cats = [
    "greetings",
    "family",
    "food",
    "school",
    "numbers",
    "colors",
    "actions",
    "travel",
    "health",
    "polite",
  ];
  return cats[(id - 1) % cats.length];
}

function chooseDifficulty(id) {
  if (id <= 180) return "1";
  if (id <= 360) return "2";
  return "3";
}

function makePlaceholderRow(id, header) {
  // Ensure we return columns in the exact header order
  const row = {};
  for (const h of header) row[h] = "";

  row.id = String(id);
  row.en = `word_${id}`;
  row.yo = "";
  row.ig = "";
  row.pg = "";
  row.category = chooseCategory(id);
  row.difficulty = chooseDifficulty(id);
  row.tags = ""; // keep empty (not "")
  row.notes_yo = "";
  row.notes_ig = "";
  row.notes_pg = "";
  row.synonyms_yo = "";
  row.synonyms_ig = "";
  row.synonyms_pg = "";

  return row;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error("❌ Cannot find:", CSV_PATH);
    process.exit(1);
  }

  const raw = fs.readFileSync(CSV_PATH, "utf8").trimEnd();
  const lines = raw.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    console.error("❌ CSV looks empty / missing rows.");
    process.exit(1);
  }

  const header = parseCSVLine(lines[0]).map((h) => h.trim());
  const rowsById = new Map();

  // Read existing rows
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row = {};
    for (let c = 0; c < header.length; c++) {
      row[header[c]] = cols[c] ?? "";
    }

    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    if (REMOVE_IDS.has(id)) continue;
    if (id < 1 || id > TARGET_MAX_ID) continue;

    rowsById.set(id, row);
  }

  // Fill missing ids with placeholders
  for (let id = 1; id <= TARGET_MAX_ID; id++) {
    if (!rowsById.has(id)) {
      rowsById.set(id, makePlaceholderRow(id, header));
    }
  }

  // Build output in sorted order
  const outLines = [];
  outLines.push(header.map(toCSVCell).join(","));

  for (let id = 1; id <= TARGET_MAX_ID; id++) {
    const row = rowsById.get(id);
    const line = header.map((h) => toCSVCell(row?.[h] ?? "")).join(",");
    outLines.push(line);
  }

  fs.writeFileSync(CSV_PATH, outLines.join("\n") + "\n", "utf8");
  console.log(`✅ Expanded flashcards.csv to ${TARGET_MAX_ID} rows (ids 1..${TARGET_MAX_ID}).`);
  console.log("✅ Placeholders use en=word_<id>; translations blank (safe).");
}

main();
