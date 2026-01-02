import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const AUDIO_ROOT = path.join(ROOT, "assets", "audio");
const OUT_FILE = path.join(ROOT, "app", "data", "audiomap.generated.ts");

const langs = ["yo", "ig", "pg"];
const entries = [];

for (const lang of langs) {
  const dir = path.join(AUDIO_ROOT, lang);
  if (!fs.existsSync(dir)) continue;

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".mp3"));

  for (const file of files) {
    const id = path.basename(file, ".mp3");
    if (!/^\d+$/.test(id)) continue;

    entries.push(
      `  "${lang}/${id}": require("../../assets/audio/${lang}/${file}")`
    );
  }
}

const out = `/* eslint-disable */
// AUTO-GENERATED — DO NOT EDIT BY HAND

export type AudioLang = "yo" | "ig" | "pg";
export type AudioMap = Record<string, any>;

export const audiomap: AudioMap = {
${entries.join(",\n")}
};
`;

fs.writeFileSync(OUT_FILE, out, "utf8");

console.log("✅ Wrote", OUT_FILE);
console.log("✅ Entries:", entries.length);
