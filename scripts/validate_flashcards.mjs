// scripts/validate_flashcards.mjs
// Usage: node scripts/validate_flashcards.mjs
import { flashcards } from "../app/data/flashcards.js"; // <-- adjust path if needed

function isPlainObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function hasWeirdChars(s) {
  // catches invisible control chars except tab/newline
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s);
}

const requiredStringFields = ["en", "yo", "ig", "pg", "category"];
const errors = [];
const idSet = new Set();

flashcards.forEach((c, idx) => {
  const at = `index=${idx} id=${c?.id ?? "?"}`;

  if (!isPlainObject(c)) {
    errors.push(`${at}: card is not an object`);
    return;
  }

  if (!Number.isInteger(c.id)) errors.push(`${at}: id must be an integer`);
  else {
    if (idSet.has(c.id)) errors.push(`${at}: duplicate id ${c.id}`);
    idSet.add(c.id);
  }

  for (const f of requiredStringFields) {
    if (typeof c[f] !== "string") errors.push(`${at}: ${f} must be a string`);
    else {
      if (c[f].trim() !== c[f]) errors.push(`${at}: ${f} has leading/trailing spaces`);
      if (c[f].length === 0) errors.push(`${at}: ${f} is empty string`);
      if (hasWeirdChars(c[f])) errors.push(`${at}: ${f} contains hidden control characters`);
    }
  }

  if (c.tags && !Array.isArray(c.tags)) errors.push(`${at}: tags must be an array if present`);
  if (c.notes && !isPlainObject(c.notes)) errors.push(`${at}: notes must be an object if present`);
  if (c.synonyms && !isPlainObject(c.synonyms)) errors.push(`${at}: synonyms must be an object if present`);
});

if (errors.length) {
  console.error(`❌ Validation failed (${errors.length} issues):`);
  for (const e of errors.slice(0, 200)) console.error(" - " + e);
  if (errors.length > 200) console.error(`... plus ${errors.length - 200} more`);
  process.exit(1);
} else {
  console.log(`✅ Validation passed: ${flashcards.length} cards, ${idSet.size} unique ids`);
}
