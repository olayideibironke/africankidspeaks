// app/utils/audioChecklist.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AudioLang = "yo" | "ig" | "pg";

function keyFor(lang: AudioLang) {
  return `audio_recorded_done_${lang}_v1`;
}

export async function getRecordedDoneSet(lang: AudioLang): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(lang));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(String));
  } catch {
    return new Set();
  }
}

export async function saveRecordedDoneSet(lang: AudioLang, set: Set<string>) {
  try {
    await AsyncStorage.setItem(keyFor(lang), JSON.stringify(Array.from(set)));
  } catch {}
}

export async function toggleRecordedDone(lang: AudioLang, file: string): Promise<Set<string>> {
  const set = await getRecordedDoneSet(lang);
  const k = String(file);
  if (set.has(k)) set.delete(k);
  else set.add(k);
  await saveRecordedDoneSet(lang, set);
  return set;
}

export async function clearRecordedDone(lang: AudioLang): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(lang));
  } catch {}
}

/**
 * ✅ Auto-clear done items that are no longer missing.
 * Keep only done entries that STILL appear in the current missing list.
 */
export async function pruneRecordedDoneToMissing(
  lang: AudioLang,
  missingFiles: Set<string>
): Promise<Set<string>> {
  const set = await getRecordedDoneSet(lang);
  let changed = false;

  for (const f of Array.from(set)) {
    if (!missingFiles.has(f)) {
      set.delete(f);
      changed = true;
    }
  }

  if (changed) await saveRecordedDoneSet(lang, set);
  return set;
}
