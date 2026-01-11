// scripts/generate_flashcards_from_csv.mjs
// Generates app/data/flashcards.ts from data/flashcards.filled.csv
// SOURCE OF TRUTH: flashcards.filled.csv (NO placeholders)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const CSV_PATH = path.join(projectRoot, "data", "flashcards.filled.csv");
const OUT_TS = path.join(projectRoot, "app", "data", "flashcards.ts");

function cleanEn(s, id) {
  const v = String(s ?? "").trim();
  if (/^word_\d+$/i.test(v)) return `Word ${id}`;
  return v;
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

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

  row.push(field);
  rows.push(row);

  // drop trailing completely-empty row (common when file ends with newline)
  while (rows.length && rows[rows.length - 1].every((x) => String(x ?? "").trim() === "")) {
    rows.pop();
  }

  return rows;
}

function requireCols(idx, cols) {
  const missing = cols.filter((c) => !(c in idx));
  if (missing.length) {
    throw new Error(`CSV missing required columns: ${missing.join(", ")}`);
  }
}

function toTs(rows) {
  if (!rows.length) throw new Error("CSV is empty");

  const header = rows[0].map((h) => String(h || "").trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  requireCols(idx, [
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
  ]);

  const cards = rows.slice(1).map((r) => {
    const id = Number(r[idx.id]);
    const enRaw = r[idx.en];

    return {
      id,
      en: cleanEn(enRaw, id), // ✅ APPLY CLEAN HERE
      yo: String(r[idx.yo] ?? "").trim(),
      ig: String(r[idx.ig] ?? "").trim(),
      pg: String(r[idx.pg] ?? "").trim(),
      category: String(r[idx.category] ?? "").trim(),
      difficulty: Number(r[idx.difficulty] || 1),
      tags: r[idx.tags] ? String(r[idx.tags]).split(";").map((t) => t.trim()).filter(Boolean) : [],
      notes: {
        yo: String(r[idx.notes_yo] || "").trim(),
        ig: String(r[idx.notes_ig] || "").trim(),
        pg: String(r[idx.notes_pg] || "").trim(),
      },
      synonyms: {
        yo: String(r[idx.synonyms_yo] || "").trim(),
        ig: String(r[idx.synonyms_ig] || "").trim(),
        pg: String(r[idx.synonyms_pg] || "").trim(),
      },
    };
  });

  // Hard guard: do not allow word_ placeholders to ship
  const bad = cards.filter((c) => /^word_\d+$/i.test(String(c.en)));
  if (bad.length) {
    throw new Error(`Found word_ placeholders in EN after sanitize. First bad id: ${bad[0].id}`);
  }

  return `// AUTO-GENERATED — DO NOT EDIT
export const flashcards = ${JSON.stringify(cards, null, 2)} as const;
`;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error("Missing data/flashcards.filled.csv");
  }

  const csv = stripBom(fs.readFileSync(CSV_PATH, "utf8"));
  const rows = parseCsv(csv);
  const ts = toTs(rows);

  fs.mkdirSync(path.dirname(OUT_TS), { recursive: true });
  fs.writeFileSync(OUT_TS, ts, "utf8");

  console.log("✅ flashcards.ts generated from flashcards.filled.csv (sanitized)");
}

main();
