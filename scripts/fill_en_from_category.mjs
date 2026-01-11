// scripts/fill_en_from_category.mjs
// Fills ONLY the "en" column where it's a placeholder like word_33
// Uses the existing "category" column to pick reasonable English words.
// Output: data/flashcards.filled.enfixed.csv

import fs from "fs";
import path from "path";

const root = process.cwd();
const inPath = path.join(root, "data", "flashcards.filled.csv");
const outPath = path.join(root, "data", "flashcards.filled.enfixed.csv");

function isPlaceholder(v) {
  return typeof v === "string" && /^word_\d+$/i.test(v.trim());
}

// Very simple CSV parser (handles quoted commas)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }

    if (ch === "\n" && !inQuotes) {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }

    cur += ch;
  }

  // last line
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows;
}

function toCSV(rows) {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          // quote if needed
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(",")
    )
    .join("\n");
}

// Word bank by category (you can expand later; this is enough to fill 468 rows)
const BANK = {
  greetings: [
    "hello", "good morning", "good afternoon", "good evening", "good night",
    "welcome", "how are you", "nice to meet you", "see you later", "goodbye"
  ],
  polite: [
    "please", "thank you", "you’re welcome", "sorry", "excuse me",
    "no problem", "may I", "help me", "I understand", "I don’t understand"
  ],
  family: [
    "mother", "father", "parent", "child", "son", "daughter", "baby",
    "brother", "sister", "grandmother", "grandfather", "aunt", "uncle",
    "cousin", "family"
  ],
  food: [
    "food", "water", "rice", "bread", "beans", "yam", "plantain", "pepper",
    "salt", "sugar", "milk", "tea", "juice", "fruit", "banana", "orange",
    "apple", "fish", "meat", "egg", "soup", "stew", "tomato", "onion",
    "garlic", "oil", "breakfast", "lunch", "dinner", "snack"
  ],
  school: [
    "school", "teacher", "student", "class", "book", "pen", "pencil",
    "paper", "bag", "desk", "chair", "board", "homework", "test",
    "lesson", "read", "write", "learn", "playground", "uniform"
  ],
  numbers: [
    "one","two","three","four","five","six","seven","eight","nine","ten",
    "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen",
    "eighteen","nineteen","twenty"
  ],
  colors: [
    "red","blue","green","yellow","black","white","orange","purple","pink","brown"
  ],
  actions: [
    "come", "go", "stop", "sit", "stand", "walk", "run", "jump", "dance",
    "sing", "eat", "drink", "sleep", "wake up", "listen", "look", "open",
    "close", "help", "share", "give", "take", "wait", "clap", "smile"
  ],
  travel: [
    "where is it", "here", "there", "left", "right", "up", "down",
    "near", "far", "inside", "outside", "home", "street", "market",
    "bus", "car", "stop", "station", "go straight", "turn around"
  ],
  health: [
    "I am fine", "I am tired", "I am sick", "my head hurts", "pain",
    "doctor", "medicine", "hospital", "rest", "sleep", "drink water",
    "eat food", "help", "I feel better", "I feel bad"
  ],
};

// fallback bank if category is unknown
const FALLBACK = [
  "hello", "family", "food", "school", "water", "come", "go", "stop",
  "please", "thank you", "red", "blue", "one", "two", "three"
];

function pickFromBank(cat, usedCounts) {
  const key = (cat || "").toLowerCase().trim();
  const bank = BANK[key] || FALLBACK;

  // round-robin pick so we spread words evenly
  const idx = usedCounts[key] ?? 0;
  usedCounts[key] = idx + 1;
  return bank[idx % bank.length];
}

function main() {
  if (!fs.existsSync(inPath)) {
    console.error("❌ Missing input:", inPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(inPath, "utf8");
  const rows = parseCSV(raw);

  const header = rows[0];
  const data = rows.slice(1);

  const idx_id = header.indexOf("id");
  const idx_en = header.indexOf("en");
  const idx_cat = header.indexOf("category");

  if (idx_id < 0 || idx_en < 0 || idx_cat < 0) {
    console.error("❌ CSV must include columns: id, en, category");
    console.error("Found header:", header);
    process.exit(1);
  }

  const usedCounts = {};
  let changed = 0;

  for (const r of data) {
    const id = Number(r[idx_id]);
    const en = String(r[idx_en] ?? "");
    const cat = String(r[idx_cat] ?? "");

    if (id >= 33 && isPlaceholder(en)) {
      r[idx_en] = pickFromBank(cat, usedCounts);
      changed++;
    }
  }

  const out = toCSV([header, ...data]);
  fs.writeFileSync(outPath, out, "utf8");

  console.log("✅ Wrote:", outPath);
  console.log("✅ Updated EN placeholders:", changed);
  console.log("👉 Next step will replace your current filled.csv with this file.");
}

main();
