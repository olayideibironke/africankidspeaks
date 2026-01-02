// scripts/generate_native_audio_elevenlabs.mjs
// Generate MP3s from flashcards.csv using ElevenLabs TTS with YOUR voice clone.
// Output: assets/audio/<lang>/<id>.mp3
// Skips existing files. Safe to rerun.
// Uses Accept: audio/mpeg and writes binary MP3.
//
// Usage:
//   node scripts/generate_native_audio_elevenlabs.mjs --lang yo --from 1 --to 5
//   node scripts/generate_native_audio_elevenlabs.mjs --lang yo
//
// Env (create a .env in project root):
//   ELEVENLABS_API_KEY=...
//   ELEVENLABS_VOICE_ID=...          (your cloned voice id)
// Optional:
//   ELEVENLABS_MODEL_ID=eleven_multilingual_v2
//   ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
//
// Docs: Convert text to speech endpoint:
// POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id} :contentReference[oaicite:1]{index=1}

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const flashcardsCsvPath = path.join(projectRoot, "data", "flashcards.csv");

function loadDotEnv() {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const eq = s.indexOf("=");
    if (eq === -1) continue;
    const k = s.slice(0, eq).trim();
    let v = s.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function parseArgs() {
  const out = new Map();
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.replace(/^--/, "");
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) {
      out.set(key, next);
      i++;
    } else {
      out.set(key, "true");
    }
  }
  return out;
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function elevenlabsTts({ apiKey, voiceId, modelId, outputFormat, text }) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      output_format: outputFormat,
      // Keep settings neutral; you can tune later.
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    const err = new Error(`ElevenLabs error ${res.status}: ${msg || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function main() {
  loadDotEnv();
  const args = parseArgs();

  const lang = String(args.get("lang") || "").toLowerCase();
  if (!["yo", "ig", "pg"].includes(lang)) {
    console.log("missing/invalid --lang. use: --lang yo | --lang ig | --lang pg");
    process.exit(1);
  }

  const fromId = args.get("from") ? Number(args.get("from")) : null;
  const toId = args.get("to") ? Number(args.get("to")) : null;

  const apiKey = process.env.ELEVENLABS_API_KEY || "";
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "";
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";

  if (!apiKey) {
    console.log("Missing ELEVENLABS_API_KEY in .env");
    process.exit(1);
  }
  if (!voiceId) {
    console.log("Missing ELEVENLABS_VOICE_ID in .env (your cloned voice id)");
    process.exit(1);
  }

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

  const outDir = path.join(projectRoot, "assets", "audio", lang);
  ensureDir(outDir);

  console.log(`provider: elevenlabs`);
  console.log(`lang: ${lang}`);
  console.log(`voice_id: ${voiceId}`);
  console.log(`model_id: ${modelId}`);
  console.log(`output: ${path.relative(projectRoot, outDir)}\n`);

  let created = 0;
  let skipped = 0;

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

    process.stdout.write(`id ${id} -> ${lang}/${id}.mp3 ... `);

    try {
      const audio = await elevenlabsTts({
        apiKey,
        voiceId,
        modelId,
        outputFormat,
        text,
      });

      fs.writeFileSync(outPath, audio);
      created++;
      console.log("ok");
    } catch (e) {
      console.log("FAILED");
      console.log(String(e?.message || e));
      process.exit(1);
    }

    // light pacing to avoid rate limits
    await sleep(250);
  }

  console.log(`\ndone.`);
  console.log(`created: ${created}`);
  console.log(`skipped: ${skipped}`);
}

main().catch((e) => {
  console.log(String(e?.stack || e));
  process.exit(1);
});
