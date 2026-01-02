// scripts/generate_native_audio_edge_tts.mjs
// auto-generate mp3s using Microsoft Edge TTS (edge-tts via `py -m edge_tts`)
// output: assets/audio/<lang>/<id>.mp3
// safe: skips files that already exist
//
// usage examples:
//   node scripts/generate_native_audio_edge_tts.mjs --lang yo
//   node scripts/generate_native_audio_edge_tts.mjs --lang yo --from 11 --to 20
//
// requirements:
//   py -m pip install edge-tts

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");
const flashcardsCsvPath = path.join(projectRoot, "data", "flashcards.csv");

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const key = a.replace(/^--/, "");
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i++;
    } else {
      args.set(key, "true");
    }
  }
}

const lang = (args.get("lang") || "").toLowerCase();
if (!["yo", "ig", "pg"].includes(lang)) {
  console.log("missing/invalid --lang. use: --lang yo | --lang ig | --lang pg");
  process.exit(1);
}

const fromId = args.get("from") ? Number(args.get("from")) : null;
const toId = args.get("to") ? Number(args.get("to")) : null;

const rate = args.get("rate") || "+0%";
const pitch = args.get("pitch") || "+0Hz";
const volume = args.get("volume") || "+0%";

// Yoruba voices are not available in your list right now (yo-* returned nothing).
// Using Nigeria English as a safe fallback so automation can scale.
// You can later swap to Azure/Google for true Yoruba pronunciation.
const voices = {
  yo: "en-NG-EzinneNeural",
  ig: "en-NG-EzinneNeural",
  pg: "en-NG-AbeoNeural",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((x) => x.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }

  if (cur.length || row.length) {
    row.push(cur);
    if (row.some((x) => x.length > 0)) rows.push(row);
  }

  return rows;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fileExists(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function writeTempTextFile(id, lang, text) {
  const tmpDir = path.join(projectRoot, ".tmp");
  ensureDir(tmpDir);
  const p = path.join(tmpDir, `${lang}_${id}.txt`);
  fs.writeFileSync(p, text, "utf8");
  return p;
}

// IMPORTANT: use --file instead of --text to avoid punctuation/quoting problems.
function runEdgeTts({ voice, textFilePath, outPath }) {
  return new Promise((resolve) => {
    const cmd = "py";
    const a = [
      "-m",
      "edge_tts",
      "--voice",
      voice,
      "--file",
      textFilePath,
      "--write-media",
      outPath,
      "--rate",
      rate,
      "--pitch",
      pitch,
      "--volume",
      volume,
    ];

    const child = spawn(cmd, a, { shell: true });

    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });

    child.on("close", (code) => {
      resolve({ ok: code === 0, code, stderr });
    });
  });
}

async function main() {
  if (!fileExists(flashcardsCsvPath)) {
    console.log(`missing: ${flashcardsCsvPath}`);
    process.exit(1);
  }

  const csv = fs.readFileSync(flashcardsCsvPath, "utf8");
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    console.log("flashcards.csv appears empty.");
    process.exit(1);
  }

  const header = rows[0].map((h) => String(h || "").trim());
  const idxId = header.findIndex((h) => h === "id");
  const idxYo = header.findIndex((h) => h === "yo");
  const idxIg = header.findIndex((h) => h === "ig");
  const idxPg = header.findIndex((h) => h === "pg");

  if (idxId < 0) {
    console.log('flashcards.csv must have an "id" column.');
    process.exit(1);
  }

  const idxLang = lang === "yo" ? idxYo : lang === "ig" ? idxIg : idxPg;
  if (idxLang < 0) {
    console.log(`flashcards.csv must have a "${lang}" column.`);
    process.exit(1);
  }

  const voice = voices[lang];
  if (!voice) {
    console.log(`no voice configured for ${lang}`);
    process.exit(1);
  }

  if (lang === "yo" && voice.startsWith("en-")) {
    console.log(
      "\nWARNING: Yoruba (yo-*) voices are not available in your Edge TTS voice list."
    );
    console.log(
      `Using fallback voice "${voice}" to generate mp3s so you can scale automation now.\n`
    );
  }

  const outDir = path.join(projectRoot, "assets", "audio", lang);
  ensureDir(outDir);

  console.log(`lang: ${lang}`);
  console.log(`voice: ${voice}`);
  console.log(`output: ${path.relative(projectRoot, outDir)}\n`);

  let made = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = Number(String(r[idxId] ?? "").trim());
    if (!Number.isFinite(id)) continue;

    if (fromId !== null && id < fromId) continue;
    if (toId !== null && id > toId) continue;

    const text = String(r[idxLang] ?? "").trim();
    if (!text) {
      skipped++;
      continue;
    }

    const outPath = path.join(outDir, `${id}.mp3`);
    if (fileExists(outPath)) {
      skipped++;
      continue;
    }

    const textFilePath = writeTempTextFile(id, lang, text);

    process.stdout.write(`id ${id} -> ${lang}/${id}.mp3 ... `);

    const res = await runEdgeTts({ voice, textFilePath, outPath });

    // cleanup temp file
    try {
      fs.unlinkSync(textFilePath);
    } catch {
      // no-op
    }

    if (res.ok && fileExists(outPath)) {
      made++;
      console.log("ok");
    } else {
      failed++;
      console.log("FAILED");
      if (res.stderr) console.log(res.stderr.trim());
      process.exit(1);
    }

    await sleep(120);
  }

  console.log(`\ndone.`);
  console.log(`created: ${made}`);
  console.log(`skipped: ${skipped}`);
  console.log(`failed: ${failed}\n`);
}

main().catch((e) => {
  console.log(String(e?.stack || e));
  process.exit(1);
});
