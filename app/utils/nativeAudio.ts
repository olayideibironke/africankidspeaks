// app/utils/nativeAudio.ts
import { audiomap as generatedAudioMap } from "../data/audiomap";

/**
 * Many past iterations existed:
 * 1) Flat map: { "yo/1": require(...), "ig/23": require(...) }
 * 2) Nested map: { [en]: { [lang]: require(...) } }
 *
 * This helper supports both without breaking.
 */

type AudioLang = "yo" | "ig" | "pg";

type FlatAudioMap = Record<string, any>;
type NestedAudioMap = Record<string, Partial<Record<AudioLang, any>>>;

type GetNativeAudioArgs = {
  lang: AudioLang;
  id?: number | string | null;
  en?: string | null;
};

/**
 * Toggle logging:
 * - Dev: on by default for failures
 * - Prod: off by default, but you can enable by setting:
 *   globalThis.__AFK_DEBUG_NATIVE_AUDIO__ = true
 */
function isDebugEnabled(): boolean {
  // @ts-ignore
  const forced =
    typeof globalThis !== "undefined" &&
    (globalThis as any).__AFK_DEBUG_NATIVE_AUDIO__ === true;
  return forced || (__DEV__ ?? false);
}

function dbg(...args: any[]) {
  if (!isDebugEnabled()) return;
  console.log("[nativeAudio]", ...args);
}

function normalizeEn(en?: string | null): string {
  return String(en ?? "")
    .trim()
    .toLowerCase();
}

function normalizeId(id?: number | string | null): string {
  if (id === null || id === undefined) return "";
  const s = String(id).trim();
  const n = Number(s);
  if (Number.isFinite(n) && String(Math.trunc(n)) === String(n).split(".")[0]) {
    return String(Math.trunc(n));
  }
  return s;
}

function hasOwn(obj: any, key: string): boolean {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function getFromFlatMap(map: FlatAudioMap, key: string): any | null {
  if (!key) return null;
  if (hasOwn(map, key)) return map[key];
  return null;
}

function getFromNestedMap(
  map: NestedAudioMap,
  enKey: string,
  lang: AudioLang
): any | null {
  if (!enKey) return null;
  const entry = hasOwn(map, enKey) ? map[enKey] : undefined;
  if (!entry) return null;
  const v = (entry as any)[lang];
  return v ?? null;
}

function isLikelyFlatMap(m: any): m is FlatAudioMap {
  if (!m || typeof m !== "object") return false;
  const keys = Object.keys(m);
  const sample = keys.slice(0, 25);
  return sample.some((k) => k.includes("/"));
}

/**
 * Returns a require()-able asset module for expo-av, or null if not found.
 *
 * Lookup order:
 *  a) `${lang}/${id}`   (PRIMARY)
 *  b) `${lang}/${en}`
 *  c) nested: `{ [en]: { [lang]: mp3 } }`
 */
export function getNativeAudioSource({
  lang,
  en,
  id,
}: GetNativeAudioArgs): any | null {
  const mapAny: any = generatedAudioMap as any;

  const flat = isLikelyFlatMap(mapAny) ? (mapAny as FlatAudioMap) : null;
  const nested = !flat ? (mapAny as NestedAudioMap) : null;

  const enNorm = normalizeEn(en);
  const idNorm = normalizeId(id);

  const tried: string[] = [];

  // a) PRIMARY: `${lang}/${id}`
  const keyA = idNorm ? `${lang}/${idNorm}` : "";
  if (keyA) tried.push(keyA);

  let hit: any | null = null;

  if (flat && keyA) hit = getFromFlatMap(flat, keyA);

  // b) `${lang}/${en}`
  const keyB = enNorm ? `${lang}/${enNorm}` : "";
  if (!hit && keyB) {
    tried.push(keyB);
    if (flat) hit = getFromFlatMap(flat, keyB);
  }

  // c) nested: `{ [en]: { [lang] } }`
  if (!hit && nested && enNorm) {
    tried.push(`nested:${enNorm}.${lang}`);
    hit = getFromNestedMap(nested, enNorm, lang);
  }

  if (!hit) {
    const suspicious =
      (typeof en === "string" && en.includes("word_")) ||
      (typeof enNorm === "string" && enNorm.includes("word_"));

    dbg("MISS → will fall back to TTS", {
      lang,
      id,
      idNorm,
      en,
      enNorm,
      suspicious_en_contains_word_placeholder: suspicious,
      tried,
      map_type: flat ? "flat" : "nested/unknown",
    });
  }

  return hit ?? null;
}

export function shouldUseTTS(args: GetNativeAudioArgs): boolean {
  return !getNativeAudioSource(args);
}
