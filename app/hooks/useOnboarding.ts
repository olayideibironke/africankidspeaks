import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LangKey } from "../theme/colors";

const ONBOARDING_KEY = "africankidspeaks_onboarded_v1";
const DEFAULT_LANG_KEY = "africankidspeaks_default_lang_v1";

export async function isOnboarded(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

export async function markOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
  } catch {}
}

export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch {}
}

export async function getDefaultLang(): Promise<LangKey> {
  try {
    const raw = await AsyncStorage.getItem(DEFAULT_LANG_KEY);
    if (raw === "yo" || raw === "ig" || raw === "pg") return raw;
  } catch {}
  return "yo";
}

export async function setDefaultLang(lang: LangKey): Promise<void> {
  try {
    await AsyncStorage.setItem(DEFAULT_LANG_KEY, lang);
  } catch {}
}

type OnboardingState =
  | { loaded: false; completed: false }
  | { loaded: true; completed: boolean };

export function useOnboardingState(): OnboardingState & {
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<OnboardingState>({
    loaded: false,
    completed: false,
  });

  const refresh = useCallback(async () => {
    const done = await isOnboarded();
    setState({ loaded: true, completed: done });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
