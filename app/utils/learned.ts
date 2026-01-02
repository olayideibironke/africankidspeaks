// app/utils/learned.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type LearnedLang = "yo" | "ig" | "pg";

/**
 * Legacy key (v1): stored a single global learned set.
 * We keep reading it for backward compatibility.
 */
const LEGACY_KEY = "learned_words_v1";

/**
 * New keys (v2): learned set per language
 */
const KEY_V2 = (lang: LearnedLang) => `learned_words_v2_${lang}`;

function sanitizeSet(arr: any): Set<number> {
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr.map((x) => Number(x)).filter((n) => Number.isFinite(n)));
}

async function readSetLegacy(): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    if (!raw) return new Set();
    return sanitizeSet(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

async function readSetV2(lang: LearnedLang): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(KEY_V2(lang));
    if (!raw) return new Set();
    return sanitizeSet(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

async function writeSetV2(lang: LearnedLang, set: Set<number>) {
  try {
    await AsyncStorage.setItem(KEY_V2(lang), JSON.stringify(Array.from(set.values())));
  } catch {}
}

/**
 * One-time-ish migration:
 * If v2 is empty for ALL langs but legacy has values, copy legacy into all langs.
 * This keeps existing users from "losing" progress after the upgrade.
 */
async function migrateIfNeeded() {
  try {
    const legacy = await readSetLegacy();
    if (legacy.size === 0) return;

    const [yo, ig, pg] = await Promise.all([
      readSetV2("yo"),
      readSetV2("ig"),
      readSetV2("pg"),
    ]);

    const allEmpty = yo.size === 0 && ig.size === 0 && pg.size === 0;
    if (!allEmpty) return;

    await Promise.all([
      writeSetV2("yo", legacy),
      writeSetV2("ig", legacy),
      writeSetV2("pg", legacy),
    ]);
  } catch {}
}

/**
 * NEW: per-language APIs (recommended)
 */
export async function getLearnedSetForLang(lang: LearnedLang) {
  await migrateIfNeeded();
  return await readSetV2(lang);
}

export async function isLearnedForLang(lang: LearnedLang, id: number) {
  const set = await getLearnedSetForLang(lang);
  return set.has(id);
}

export async function toggleLearnedForLang(lang: LearnedLang, id: number) {
  const set = await getLearnedSetForLang(lang);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  await writeSetV2(lang, set);
  return set;
}

export async function clearLearnedForLang(lang: LearnedLang) {
  try {
    await AsyncStorage.removeItem(KEY_V2(lang));
  } catch {}
}

/**
 * LEGACY APIs (kept so existing screens don't crash).
 * They map to Yoruba by default.
 * We'll update screens next to pass lang explicitly.
 */
export async function learnedCount() {
  const set = await getLearnedSetForLang("yo");
  return set.size;
}

export async function isLearned(id: number) {
  const set = await getLearnedSetForLang("yo");
  return set.has(id);
}

export async function getLearnedSet() {
  return await getLearnedSetForLang("yo");
}

export async function toggleLearned(id: number) {
  return await toggleLearnedForLang("yo", id);
}

/**
 * Clears ALL learned progress (all languages + legacy key).
 * Used by parent-gated reset actions.
 */
export async function clearLearned() {
  try {
    await Promise.all([
      AsyncStorage.removeItem(LEGACY_KEY),
      AsyncStorage.removeItem(KEY_V2("yo")),
      AsyncStorage.removeItem(KEY_V2("ig")),
      AsyncStorage.removeItem(KEY_V2("pg")),
    ]);
  } catch {}
}
