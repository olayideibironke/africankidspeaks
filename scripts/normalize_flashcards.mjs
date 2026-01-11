// scripts/normalize_flashcards.mjs
// Usage: node scripts/normalize_flashcards.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// INPUT: change this path to where your flashcards live as JSON (recommended)
// If you only have TS, export JSON once or paste JSON into data/flashcards.json
const inputPath = path.join(__dirname, "..", "data", "flashcards.json");
const outputPath = path.join(__dirname, "..", "data", "flashcards.normalized.json");

function stripNumberPrefix(s) {
  // removes patterns like "66. word", "66 - word", "66) word", "66: word"
  return s.replace(/^\s*\d+\s*([.)\-:]+)\s*/u, "");
}

function cleanString(x) {
  if (x == null) return "";
  let s = String(x);

  // normalize newlines + trim
  s = s.replace(/\r\n/g, "\n").trim();

  // remove number prefixes that often appear after copy/paste
  s = stripNumberPrefix(s);

  // remove hidden control chars
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

  return s;
}

const raw = fs.readFileSync(inputPath, "utf8");
const cards = JSON.parse(raw);

const normalized = cards.map((c, i) => {
  const id = Number(c.id);
  const out = {
    id: Number.isFinite(id) ? id : i + 1,
    en: cleanString(c.en),
    yo: cleanString(c.yo),
    ig: cleanString(c.ig),
    pg: cleanString(c.pg),
    category: cleanString(c.category || "misc"),
    difficulty: Number(c.difficulty) || 1,
    tags: Array.isArray(c.tags) ? c.tags.map(cleanString).filter(Boolean) : [],
    notes: {
      yo: cleanString(c?.notes?.yo),
      ig: cleanString(c?.notes?.ig),
      pg: cleanString(c?.notes?.pg),
    },
    synonyms: {
      yo: cleanString(c?.synonyms?.yo),
      ig: cleanString(c?.synonyms?.ig),
      pg: cleanString(c?.synonyms?.pg),
    },
  };
  return out;
});

// enforce unique IDs (if duplicates exist, reassign safely)
const seen = new Set();
for (const c of normalized) {
  if (!Number.isInteger(c.id) || seen.has(c.id)) {
    let newId = 1;
    while (seen.has(newId)) newId++;
    c.id = newId;
  }
  seen.add(c.id);
}

fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2), "utf8");
console.log(`✅ Wrote normalized file: ${outputPath}`);
console.log(`Cards: ${normalized.length}, unique ids: ${seen.size}`);
