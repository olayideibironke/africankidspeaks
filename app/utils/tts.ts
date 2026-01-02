import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";

export type SpeakLang = "yo" | "ig" | "pg";

const voice_override_key = (lang: SpeakLang) => `tts_voice_${lang}_v1`;

// cache voices so we don’t query repeatedly
let cachedVoices: Speech.Voice[] | null = null;

async function loadVoices(): Promise<Speech.Voice[]> {
  if (cachedVoices) return cachedVoices;

  try {
    const voices = await Speech.getAvailableVoicesAsync();
    cachedVoices = Array.isArray(voices) ? voices : [];
    return cachedVoices;
  } catch {
    cachedVoices = [];
    return [];
  }
}

function bestVoiceForLang(lang: SpeakLang, voices: Speech.Voice[]) {
  // preferred language codes (best → fallback)
  const preferred =
    lang === "yo"
      ? ["yo", "yo-NG", "en-NG", "en-GB", "en-US"]
      : lang === "ig"
      ? ["ig", "ig-NG", "en-NG", "en-GB", "en-US"]
      : ["en-NG", "en-GB", "en-US"]; // pidgin generally sounds best with Nigerian/UK English

  // 1) enhanced voices first
  for (const code of preferred) {
    const v = voices.find(
      (x) =>
        x.language?.toLowerCase().startsWith(code.toLowerCase()) &&
        String(x.quality).toLowerCase().includes("enhanced")
    );
    if (v) return v;
  }

  // 2) any matching language voice
  for (const code of preferred) {
    const v = voices.find((x) =>
      x.language?.toLowerCase().startsWith(code.toLowerCase())
    );
    if (v) return v;
  }

  // 3) default to first available
  return voices[0] ?? null;
}

function stripDiacritics(s: string) {
  // removes tone marks so English voices don’t choke
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(lang: SpeakLang, text: string, voiceLang?: string) {
  const t = (text ?? "").trim();

  // If we’re NOT actually speaking Yoruba/Igbo voice, diacritics often make it worse.
  const vl = (voiceLang ?? "").toLowerCase();
  const speakingNative =
    (lang === "yo" && vl.startsWith("yo")) || (lang === "ig" && vl.startsWith("ig"));

  if (!speakingNative && (lang === "yo" || lang === "ig")) {
    return stripDiacritics(t);
  }

  // keep diacritics if true native voice exists
  return t.normalize("NFC");
}

export async function getInstalledVoices(): Promise<Speech.Voice[]> {
  return await loadVoices();
}

export async function setVoiceOverride(lang: SpeakLang, voiceId: string) {
  await AsyncStorage.setItem(voice_override_key(lang), voiceId);
  cachedVoices = null; // re-evaluate next speak
}

export async function getVoiceOverride(lang: SpeakLang) {
  try {
    return await AsyncStorage.getItem(voice_override_key(lang));
  } catch {
    return null;
  }
}

export async function speakWord(lang: SpeakLang, text: string) {
  // stop anything queued
  try {
    await Speech.stop();
  } catch {}

  const voices = await loadVoices();
  const overrideId = await getVoiceOverride(lang);

  let voice: Speech.Voice | null = null;

  if (overrideId) {
    voice = voices.find((v) => v.identifier === overrideId) ?? null;
  }

  if (!voice) {
    voice = bestVoiceForLang(lang, voices);
  }

  const safeText = normalizeText(lang, text, voice?.language);

  // tuned per language (small improvements without sounding robotic)
  const tuned =
    lang === "yo"
      ? { rate: 0.78, pitch: 1.02 }
      : lang === "ig"
      ? { rate: 0.80, pitch: 1.00 }
      : { rate: 0.90, pitch: 1.00 };

  Speech.speak(safeText, {
    language:
      lang === "yo" ? "yo-NG" : lang === "ig" ? "ig-NG" : "en-NG",
    voice: voice?.identifier, // Expo supports voice selection
    rate: tuned.rate, // Expo supports rate
    pitch: tuned.pitch, // Expo supports pitch
  });
}
