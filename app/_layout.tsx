// app/_layout.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import * as Speech from "expo-speech";

/**
 * 🔥 Nuclear global TTS guard:
 * - Prevents ANY part of the app from speaking placeholder strings like "word_###"
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

/**
 * ✅ Manual build tag (so testers can prove they installed the right build)
 * Update this string whenever you create a new Play Console release.
 */
const BUILD_TAG = "v1.0.1+6-TTS-GUARD";

export default function RootLayout() {
  const [showBar, setShowBar] = useState(true);

  useEffect(() => {
    installGlobalTTSGuard();
  }, []);

  const buildInfo = useMemo(() => {
    return { buildTag: BUILD_TAG, ts: new Date().toISOString() };
  }, []);

  useEffect(() => {
    console.log("[BUILD]", buildInfo);
  }, [buildInfo]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />

      {showBar && (
        <Pressable
          onLongPress={() => setShowBar(false)}
          style={styles.bar}
          accessibilityLabel="Build fingerprint"
        >
          <Text style={styles.barText} numberOfLines={1}>
            Africankidspeaks • {buildInfo.buildTag}
          </Text>
          <Text style={styles.barTiny} numberOfLines={1}>
            (long-press to hide)
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  barText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
  barTiny: {
    marginTop: 2,
    color: "#fff",
    opacity: 0.85,
    fontWeight: "800",
    fontSize: 10,
  },
});
