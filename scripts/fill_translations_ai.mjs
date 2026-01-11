// scripts/fill_translations_ai.mjs
// Fills missing yo/ig/pg in data/flashcards.csv using an AI translation API.
// Output: data/flashcards.filled.csv
//
// Usage:
//   node scripts/fill_translations_ai.mjs
//
// Required env var:
//   OPENAI_API_KEY
//
// IMPORTANT:
// This treats as "missing":
// - blank
// - same as English (case-insensitive)
// - obvious placeholders like: word_33, word 33, todo, n/a, -, —
//
// It only fills cells that are missing by these rules.

import fs from "fs";
import path from "path";

const CSV_IN = path.join(process.cwd(), "data", "flashcards.csv");
const CSV_OUT = path.join(process.cwd(), "data", "flashcards.filled.csv");

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function toCSVField(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function norm(s) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isPlaceholder(val, en) {
  const v = norm(val);
  const e = norm(en);

  if (!v) return true;
  if (v === e) return true;

  // common placeholders
  if (v === "-" || v === "—" || v === "n/a" || v === "na" || v === "none") return true;
  if (v === "todo" || v === "tbd" || v === "placeholder") return true;

  // word_33 / word 33 / word-33
  if (/^word[\s_-]*\d+$/i.test(val.trim())) return true;

  return false;
}

async function translateRow(en) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY in environment.");

  const prompt = `
Translate the English phrase into:
- Yoruba (yo) with tone marks when appropriate
- Igbo (ig)
- Nigerian Pidgin (pg)
Return STRICT JSON only in this shape:
{"yo":"...","ig":"...","pg":"..."}
English: ${en}
`.trim();

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`API error: ${res.status} ${t}`);
  }

  const data = await res.json();
  const text =
    data.output_text ||
    (data.output && data.output[0]?.content?.[0]?.text) ||
    "";

  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error(`Bad JSON from model: ${text}`);
  }

  return {
    yo: String(obj.yo ?? "").trim(),
    ig: String(obj.ig ?? "").trim(),
    pg: String(obj.pg ?? "").trim(),
  };
}

async function main() {
  const raw = fs.readFileSync(CSV_IN, "utf8").trimEnd();
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV has no rows.");

  const header = parseCSVLine(lines[0]);
  const idx = (name) => header.indexOf(name);

  const i_en = idx("en");
  const i_yo = idx("yo");
  const i_ig = idx("ig");
  const i_pg = idx("pg");

  if ([i_en, i_yo, i_ig, i_pg].some((x) => x < 0)) {
    throw new Error("CSV header must include: en,yo,ig,pg");
  }

  const outLines = [lines[0]];

  let scanned = 0;
  let filledRows = 0;
  let filledYo = 0;
  let filledIg = 0;
  let filledPg = 0;

  for (let r = 1; r < lines.length; r++) {
    const cols = parseCSVLine(lines[r]);
    while (cols.length < header.length) cols.push("");

    const en = String(cols[i_en] ?? "").trim();
    const yo = String(cols[i_yo] ?? "");
    const ig = String(cols[i_ig] ?? "");
    const pg = String(cols[i_pg] ?? "");

    scanned++;

    if (!en) {
      outLines.push(cols.map(toCSVField).join(","));
      continue;
    }

    const needYo = isPlaceholder(yo, en);
    const needIg = isPlaceholder(ig, en);
    const needPg = isPlaceholder(pg, en);

    if (!needYo && !needIg && !needPg) {
      outLines.push(cols.map(toCSVField).join(","));
      continue;
    }

    const tr = await translateRow(en);

    if (needYo) {
      cols[i_yo] = tr.yo;
      filledYo++;
    }
    if (needIg) {
      cols[i_ig] = tr.ig;
      filledIg++;
    }
    if (needPg) {
      cols[i_pg] = tr.pg;
      filledPg++;
    }

    filledRows++;
    outLines.push(cols.map(toCSVField).join(","));

    if (filledRows % 10 === 0) console.log(`✅ filled ${filledRows} rows...`);
  }

  fs.writeFileSync(CSV_OUT, outLines.join("\n"), "utf8");

  console.log(`\nDONE ✅ scanned=${scanned} filled_rows=${filledRows}`);
  console.log(`filled_cells: yo=${filledYo} ig=${filledIg} pg=${filledPg}`);
  console.log(`Wrote: ${CSV_OUT}`);
  console.log(`Next: replace data/flashcards.csv with flashcards.filled.csv then regenerate TS + audio.`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
