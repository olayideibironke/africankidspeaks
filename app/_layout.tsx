// app/_layout.tsx
import React, { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as Speech from "expo-speech";

/**
 * Global TTS guard:
 * - Prevents any part of the app from speaking placeholder strings like "word_###"
 * - Works even if a stray Speech.speak() exists somewhere
 */
function installGlobalTTSGuard() {
  const mod: any = Speech as any;
  if (mod.__AFK_TTS_GUARD_INSTALLED__) return;

  const originalSpeak = mod.speak?.bind(mod);
  if (typeof originalSpeak !== "function") return;

  const looksLikePlaceholder = (t: any) => {
    const s = String(t ?? "").trim().toLowerCase();
    if (!s) return false;
    if (s.startsWith("word_")) return true;
    if (/^word_\d+$/i.test(s)) return true;
    return false;
  };

  mod.speak = (text: any, options?: any) => {
    if (looksLikePlaceholder(text)) {
      console.log("[TTS-GUARD] BLOCKED placeholder speak:", text);
      return;
    }
    return originalSpeak(text, options);
  };

  mod.__AFK_TTS_GUARD_INSTALLED__ = true;
  console.log("[TTS-GUARD] installed ✅");
}

export default function RootLayout() {
  useEffect(() => {
    installGlobalTTSGuard();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
