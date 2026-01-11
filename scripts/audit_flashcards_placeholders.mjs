import fs from "fs";
import path from "path";

const root = process.cwd();
const file = path.join(root, "app", "data", "flashcards.ts");

if (!fs.existsSync(file)) {
  console.log("❌ Could not find:", file);
  process.exit(1);
}

const src = fs.readFileSync(file, "utf8");

function extractArrayFromIndex(text, openIdx) {
  let depth = 0;
  let inStr = false;
  let strChar = "";
  let escaped = false;

  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];

    if (inStr) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === strChar) {
        inStr = false;
        strChar = "";
      }
      continue;
    } else {
      if (ch === "'" || ch === '"' || ch === "`") {
        inStr = true;
        strChar = ch;
        continue;
      }
      if (ch === "[") depth++;
      if (ch === "]") depth--;

      if (depth === 0) return text.slice(openIdx, i + 1);
    }
  }
  throw new Error("Could not match closing `]` for the array.");
}

function findCandidateArray(text) {
  const patterns = [
    // export const flashcards = [
    /export\s+const\s+flashcards[\s\S]{0,80}?=\s*\[/g,
    // const flashcards = [
    /(^|\n)\s*const\s+flashcards[\s\S]{0,80}?=\s*\[/g,
    // let/var flashcards = [
    /(^|\n)\s*(let|var)\s+flashcards[\s\S]{0,80}?=\s*\[/g,
    // export default [
    /export\s+default\s*\[/g,
  ];

  const hits = [];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) {
      const start = m.index + m[0].lastIndexOf("[");
      hits.push({ start, label: re.toString() });
    }
  }

  if (!hits.length) {
    return null;
  }

  // Choose the candidate whose extracted array is largest (most likely the real flashcards list)
  let best = null;
  for (const h of hits) {
    try {
      const arrText = extractArrayFromIndex(text, h.start);
      const arr = Function(`"use strict"; return (${arrText});`)();
      const len = Array.isArray(arr) ? arr.length : 0;
      if (!best || len > best.len) best = { ...h, len, arrText, arr };
    } catch {
      // ignore bad candidates
    }
  }

  return best;
}

const best = findCandidateArray(src);

if (!best) {
  console.log("❌ Could not find a flashcards array assignment/export in flashcards.ts");
  console.log("👉 Next: paste the FIRST ~40 lines of app/data/flashcards.ts here.");
  process.exit(1);
}

console.log("✅ Found candidate array. Length =", best.len);

const flashcards = best.arr;

const fields = ["en", "yo", "ig", "pg"];
const isPlaceholder = (v) => typeof v === "string" && /^word_\d+$/i.test(v.trim());

const counts = {};
for (const f of fields) counts[f] = { placeholders: 0, total: 0 };

for (const c of flashcards) {
  for (const f of fields) {
    counts[f].total += 1;
    if (isPlaceholder(c?.[f])) counts[f].placeholders += 1;
  }
}

console.log("\n✅ Placeholder audit (word_###):");
for (const f of fields) {
  const { placeholders, total } = counts[f];
  console.log(`- ${f}: ${placeholders}/${total}`);
}

const sample = flashcards
  .filter((c) => fields.some((f) => isPlaceholder(c?.[f])))
  .slice(0, 10)
  .map((c) => ({ id: c.id, en: c.en, yo: c.yo, ig: c.ig, pg: c.pg }));

console.log("\nSample rows (first 10 with placeholders):");
console.log(sample);

const sampleAny = flashcards.slice(0, 5).map((c) => ({ id: c.id, en: c.en, yo: c.yo, ig: c.ig, pg: c.pg }));
console.log("\nSample first 5 rows:");
console.log(sampleAny);
