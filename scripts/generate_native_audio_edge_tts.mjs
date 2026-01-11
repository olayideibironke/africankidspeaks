// scripts/generate_native_audio_edge_tts.mjs
// auto-generate mp3s using Microsoft Edge TTS (edge-tts via Python module `edge_tts`)
// output: assets/audio/<lang>/<id>.mp3
// safe: skips files that already exist
//
// usage examples:
//   node scripts/generate_native_audio_edge_tts.mjs --lang yo
//   node scripts/generate_native_audio_edge_tts.mjs --lang yo --from 11 --to 20
//
// requirements (one time):
//   py -m pip install edge-tts
// or
//   python -m pip install edge-tts

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

// Voice mapping (locked)
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

  // Add a little uniqueness so parallel runs never collide
  const stamp = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const p = path.join(tmpDir, `${lang}_${id}_${stamp}.txt`);

  fs.writeFileSync(p, text, "utf8");
  return p;
}

/**
 * Try running edge_tts using:
 * 1) py -m edge_tts
 * 2) python -m edge_tts   (fallback)
 */
function runEdgeTtsOnce({ cmd, voice, textFilePath, outPath }) {
  return new Promise((resolve) => {
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

async function runEdgeTts({ voice, textFilePath, outPath }) {
  // First try `py`
  const res1 = await runEdgeTtsOnce({ cmd: "py", voice, textFilePath, outPath });
  if (res1.ok) return res1;

  // If it looks like py isn't found, try python
  const pyNotFound =
    /'py' is not recognized|py: not found|cannot find the file/i.test(res1.stderr || "");
  const moduleMissing =
    /no module named edge_tts/i.test(res1.stderr || "") ||
    /ModuleNotFoundError:.*edge_tts/i.test(res1.stderr || "");

  // If module missing, python will also fail — but we still try once so the user gets clearer logs.
  if (pyNotFound || moduleMissing) {
    const res2 = await runEdgeTtsOnce({
      cmd: "python",
      voice,
      textFilePath,
      outPath,
    });
    // Prefer the second result if it succeeded, else return the "best" error output.
    if (res2.ok) return res2;

    // Merge stderr for clarity
    const merged = [
      `Tried: py -m edge_tts (failed)`,
      (res1.stderr || "").trim(),
      `\nTried: python -m edge_tts (failed)`,
      (res2.stderr || "").trim(),
    ]
      .filter(Boolean)
      .join("\n");

    return { ok: false, code: res2.code, stderr: merged };
  }

  // Otherwise, return first failure
  return res1;
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

  // Friendly warning (expected behavior)
  if (lang === "yo" || lang === "ig") {
    console.log(
      `\nNOTE: ${lang.toUpperCase()} is using a Nigeria English voice (${voice}) for automation.\n`
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
    } catch {}

    if (res.ok && fileExists(outPath)) {
      made++;
      console.log("ok");
    } else {
      failed++;
      console.log("FAILED\n");

      const msg = String(res.stderr || "").trim();
      if (msg) console.log(msg);

      // Specific hint for the most common problem
      if (/no module named edge_tts/i.test(msg)) {
        console.log(
          "\nFIX THIS ONCE:\n  py -m pip install edge-tts\n(or)\n  python -m pip install edge-tts\n"
        );
      }

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
