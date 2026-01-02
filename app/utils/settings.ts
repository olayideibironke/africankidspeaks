import AsyncStorage from "@react-native-async-storage/async-storage";

export type AudioLang = "yo" | "ig" | "pg";

export type settings = {
  targetLang: AudioLang;
  speechRate: number; // expo-speech rate
  speechPitch: number; // expo-speech pitch
};

const SETTINGS_KEY = "app_settings_v1";

const DEFAULTS: settings = {
  targetLang: "yo",
  speechRate: 0.85,
  speechPitch: 1.0,
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isLang(v: any): v is AudioLang {
  return v === "yo" || v === "ig" || v === "pg";
}

export async function getsettings(): Promise<settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;

    const parsed = JSON.parse(raw) ?? {};
    const merged: settings = {
      targetLang: isLang(parsed.targetLang) ? parsed.targetLang : DEFAULTS.targetLang,
      speechRate:
        typeof parsed.speechRate === "number"
          ? clamp(parsed.speechRate, 0.5, 1.2)
          : DEFAULTS.speechRate,
      speechPitch:
        typeof parsed.speechPitch === "number"
          ? clamp(parsed.speechPitch, 0.6, 1.4)
          : DEFAULTS.speechPitch,
    };

    return merged;
  } catch {
    return DEFAULTS;
  }
}

export async function setsettings(next: settings): Promise<void> {
  const safe: settings = {
    targetLang: isLang(next.targetLang) ? next.targetLang : DEFAULTS.targetLang,
    speechRate: clamp(next.speechRate, 0.5, 1.2),
    speechPitch: clamp(next.speechPitch, 0.6, 1.4),
  };

  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(safe));
}

export async function updatesettings(patch: Partial<settings>): Promise<settings> {
  const cur = await getsettings();
  const next: settings = {
    targetLang: patch.targetLang && isLang(patch.targetLang) ? patch.targetLang : cur.targetLang,
    speechRate: typeof patch.speechRate === "number" ? patch.speechRate : cur.speechRate,
    speechPitch: typeof patch.speechPitch === "number" ? patch.speechPitch : cur.speechPitch,
  };
  await setsettings(next);
  return next;
}
