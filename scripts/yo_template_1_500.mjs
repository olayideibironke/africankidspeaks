// scripts/yo_template_1_500.mjs
import fs from "fs";

const INPUT = "data/flashcards.csv";
const OUTPUT = "data/yo_1_500_template.csv";

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // escaped quote
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
      continue;
    }

    if (ch === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const raw = fs.readFileSync(INPUT, "utf8").trimEnd();
const lines = raw.split(/\r?\n/);
if (lines.length < 2) {
  console.error("❌ flashcards.csv looks empty.");
  process.exit(1);
}

const header = parseCsvLine(lines[0]);
const idx = (k) => header.indexOf(k);

const required = ["id", "en", "yo", "category", "difficulty", "tags", "notes_yo"];
for (const k of required) {
  if (idx(k) === -1) {
    console.error(`❌ Missing column in flashcards.csv header: ${k}`);
    process.exit(1);
  }
}

const out = [];
out.push(required.join(","));

for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i]);
  const id = Number(cols[idx("id")] ?? "");
  if (!Number.isFinite(id)) continue;
  if (id < 1 || id > 500) continue;

  const row = required.map((k) => csvEscape(cols[idx(k)] ?? ""));
  out.push(row.join(","));
}

fs.writeFileSync(OUTPUT, out.join("\n") + "\n", "utf8");
console.log(`✅ wrote ${OUTPUT} (${out.length - 1} rows)`);
