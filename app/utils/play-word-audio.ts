// app/utils/play-word-audio.ts
import { Audio } from "expo-av";
import * as speech from "expo-speech";
import { audiomap } from "../data/audiomap.generated";

export type AudioLang = "yo" | "ig" | "pg";

type PlayArgs = {
  lang: AudioLang; // yo | ig | pg
  id: number | string; // card id
  ttsText: string; // what to speak if native is missing
  ttsLang?: string; // expo-speech language, e.g. "yo-NG"
  rate?: number; // optional speech rate
};

function isPlaceholderWord(text: string) {
  return /^word_\d+$/i.test(String(text ?? "").trim());
}

export async function playWordAudio({
  lang,
  id,
  ttsText,
  ttsLang,
  rate,
}: PlayArgs) {
  const idNorm = String(id ?? "").trim();
  const key = `${lang}/${idNorm}`;
  const src = (audiomap as any)[key];

  // --- NATIVE FIRST ---
  if (src) {
    try {
      // IMPORTANT: always create+unload properly
      const { sound } = await Audio.Sound.createAsync(src, { shouldPlay: true });
      sound.setOnPlaybackStatusUpdate((status) => {
        // @ts-ignore
        if (status?.didJustFinish) sound.unloadAsync();
      });

      console.log("[playWordAudio] NATIVE_OK", { key });
      return;
    } catch (e: any) {
      // If map says native exists but playback fails, LOG IT HARD.
      // We still allow fallback so kids hear something, but now we can diagnose.
      console.log("[playWordAudio] NATIVE_FAIL", {
        key,
        error: String(e?.message ?? e),
      });
    }
  } else {
    console.log("[playWordAudio] NATIVE_MISS", { key });
  }

  // --- TTS FALLBACK (NEVER speak placeholders) ---
  const clean = String(ttsText ?? "").trim();

  if (!clean || isPlaceholderWord(clean)) {
    console.log("[playWordAudio] TTS_BLOCKED_BAD_TEXT", {
      key,
      clean,
    });
    return;
  }

  try {
    speech.stop();
  } catch {}

  try {
    speech.speak(clean, {
      ...(ttsLang ? { language: ttsLang } : {}),
      ...(typeof rate === "number" ? { rate } : {}),
    });
    console.log("[playWordAudio] TTS_OK", { key, clean });
  } catch (e: any) {
    console.log("[playWordAudio] TTS_FAIL", {
      key,
      clean,
      error: String(e?.message ?? e),
    });
  }
}
