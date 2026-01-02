// app/(tabs)/learn.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as speech from "expo-speech";

import { colors } from "../theme";
import Watermark from "../components/watermark";
import { flashcards } from "../data/flashcards";
import { getNativeAudioSource, hasNativeAudio, type AudioLang } from "../utils/nativeAudio";
import { getLearnedSetForLang, toggleLearnedForLang } from "../utils/learned";

const BTN_DARK = "#000";
const BTN_DARK_TEXT = "#fff";

function titleForLang(lang: AudioLang) {
  if (lang === "yo") return "Yoruba";
  if (lang === "ig") return "Igbo";
  return "Pidgin";
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function LearnTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [lang, setLang] = useState<AudioLang>("yo");
  const [revealed, setRevealed] = useState(false);

  const [learnedSet, setLearnedSet] = useState<Set<number>>(new Set());

  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);

  const stopAudio = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch {}
    try {
      speech.stop();
    } catch {}
  }, []);

  const refreshLearned = useCallback(async () => {
    const set = await getLearnedSetForLang(lang);
    setLearnedSet(new Set(set));
  }, [lang]);

  useFocusEffect(
    useCallback(() => {
      refreshLearned();
      return () => {
        stopAudio();
      };
    }, [refreshLearned, stopAudio])
  );

  useEffect(() => {
    const ids = (flashcards as any[]).map((c) => Number(c.id)).filter((n) => Number.isFinite(n));
    setOrder(shuffle(ids));
    setIdx(0);
    setRevealed(false);
  }, []);

  // when lang changes: refresh learned + keep current card id if possible
  useEffect(() => {
    (async () => {
      await refreshLearned();
    })();
  }, [lang, refreshLearned]);

  const currentId = order[idx] ?? Number((flashcards as any[])[0]?.id ?? 1);

  const current = useMemo(() => {
    const c = (flashcards as any[]).find((x) => Number(x.id) === Number(currentId));
    if (!c) return (flashcards as any[])[0];
    return c;
  }, [currentId]);

  const total = order.length || flashcards.length || 1;

  const en = String(current?.en ?? "");
  const tr = String(current?.[lang] ?? "");

  const learnedOn = learnedSet.has(Number(current?.id));

  const hasNative = hasNativeAudio({ lang, en, id: Number(current?.id) });

  const play = useCallback(async () => {
    await stopAudio();

    const id = Number(current?.id);
    const src = getNativeAudioSource({ lang, en, id });

    // 1) native audio
    if (src) {
      try {
        const s = new Audio.Sound();
        soundRef.current = s;
        await s.loadAsync(src as any, { shouldPlay: true });
        return;
      } catch {
        await stopAudio();
      }
    }

    // 2) TTS fallback
    const text = revealed ? (tr || en) : en;
    const rate = lang === "pg" ? 0.95 : 0.85;

    try {
      speech.speak(text, {
        language: lang === "yo" ? "yo-NG" : lang === "ig" ? "ig-NG" : "en-NG",
        rate,
      });
    } catch {}
  }, [stopAudio, current, lang, en, tr, revealed]);

  const next = useCallback(() => {
    setIdx((v) => {
      const n = v + 1;
      return n >= total ? 0 : n;
    });
    setRevealed(false);
  }, [total]);

  const prev = useCallback(() => {
    setIdx((v) => {
      const n = v - 1;
      return n < 0 ? total - 1 : n;
    });
    setRevealed(false);
  }, [total]);

  const reshuffle = useCallback(() => {
    const ids = (flashcards as any[]).map((c) => Number(c.id)).filter((n) => Number.isFinite(n));
    setOrder(shuffle(ids));
    setIdx(0);
    setRevealed(false);
    Alert.alert("Shuffled", "New practice order.");
  }, []);

  const toggleLearned = useCallback(async () => {
    const id = Number(current?.id);
    const set = await toggleLearnedForLang(lang, id);
    setLearnedSet(new Set(set));
  }, [current, lang]);

  const openWords = () => router.push({ pathname: "/words", params: { lang } });

  return (
    <View style={styles.screen}>
      <View style={styles.watermarkWrap} pointerEvents="none">
        <Watermark />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: 14 + insets.top, paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Learn</Text>
            <Text style={styles.sub}>
              {titleForLang(lang)} • Card {Math.min(idx + 1, total)}/{total} •{" "}
              {hasNative ? "Native audio" : "TTS fallback"}
            </Text>
          </View>
        </View>

        {/* Language pills */}
        <View style={styles.langRow}>
          {(["yo", "ig", "pg"] as AudioLang[]).map((k) => {
            const selected = k === lang;
            return (
              <Pressable
                key={k}
                onPress={() => setLang(k)}
                style={[styles.pill, selected && styles.pillOn]}
              >
                <Text style={[styles.pillText, selected && styles.pillTextOn]}>
                  {k.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.en}>{en}</Text>

          <View style={{ height: 10 }} />

          {revealed ? (
            <Text style={styles.tr}>{tr || "—"}</Text>
          ) : (
            <Text style={styles.hidden}>Tap “Reveal” to show translation</Text>
          )}

          <View style={styles.badgesRow}>
            {hasNative ? (
              <View style={[styles.badge, styles.badgeOk]}>
                <Text style={styles.badgeText}>Audio</Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.badgeMissing]}>
                <Text style={styles.badgeText}>Missing</Text>
              </View>
            )}

            {learnedOn ? (
              <View style={[styles.badge, styles.badgeLearned]}>
                <Text style={styles.badgeText}>Learned</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actionsRow}>
            <Pressable onPress={() => setRevealed((v) => !v)} style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>{revealed ? "Hide" : "Reveal"}</Text>
            </Pressable>

            <Pressable onPress={play} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>Play</Text>
              <Text style={styles.primarySub}>Native first</Text>
            </Pressable>
          </View>

          <View style={styles.actionsRow}>
            <Pressable onPress={prev} style={styles.navBtn}>
              <Text style={styles.navText}>← Prev</Text>
            </Pressable>

            <Pressable onPress={next} style={styles.navBtn}>
              <Text style={styles.navText}>Next →</Text>
            </Pressable>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={toggleLearned}
              style={[styles.learnBtn, learnedOn && styles.learnBtnOn]}
            >
              <Text style={[styles.learnText, learnedOn && styles.learnTextOn]}>
                {learnedOn ? "Unmark Learned" : "Mark Learned"}
              </Text>
            </Pressable>

            <Pressable onPress={reshuffle} style={styles.ghostBtn}>
              <Text style={styles.ghostText}>Shuffle</Text>
            </Pressable>
          </View>
        </View>

        {/* Quick link */}
        <Pressable onPress={openWords} style={styles.darkBtn}>
          <Text style={styles.darkText}>Open Words List</Text>
          <Text style={styles.darkSub}>Search + missing audio + learned</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  watermarkWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 0 },
  container: { padding: 16, zIndex: 1 },

  headerRow: { flexDirection: "row", alignItems: "center" },
  h1: { fontSize: 26, fontWeight: "900", color: colors.text },
  sub: { marginTop: 6, color: colors.muted, fontWeight: "700" },

  langRow: { marginTop: 14, flexDirection: "row", gap: 10 as any },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillOn: { borderColor: colors.primary, backgroundColor: colors.background },
  pillText: { color: colors.muted, fontWeight: "900" },
  pillTextOn: { color: colors.primary },

  card: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  en: { color: colors.text, fontSize: 22, fontWeight: "900" },
  tr: { color: colors.text, fontSize: 18, fontWeight: "900" },
  hidden: { color: colors.muted, fontWeight: "800" },

  badgesRow: { marginTop: 12, flexDirection: "row", gap: 8 as any, flexWrap: "wrap" },
  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontWeight: "900", fontSize: 11, color: colors.text },
  badgeMissing: { borderColor: "#d00", backgroundColor: "transparent" },
  badgeOk: { borderColor: colors.primary, backgroundColor: "transparent" },
  badgeLearned: { borderColor: colors.border, backgroundColor: colors.background },

  actionsRow: { marginTop: 12, flexDirection: "row", gap: 10 as any },

  primaryBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: BTN_DARK,
    borderWidth: 1,
    borderColor: BTN_DARK,
    alignItems: "center",
  },
  primaryText: { color: BTN_DARK_TEXT, fontWeight: "900" },
  primarySub: { marginTop: 2, color: BTN_DARK_TEXT, opacity: 0.75, fontSize: 12, fontWeight: "700" },

  secondaryBtn: {
    width: 120,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: colors.text, fontWeight: "900" },

  navBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  navText: { color: colors.text, fontWeight: "900" },

  learnBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  learnBtnOn: { borderColor: colors.primary, backgroundColor: colors.background },
  learnText: { color: colors.text, fontWeight: "900" },
  learnTextOn: { color: colors.primary },

  ghostBtn: {
    width: 120,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  ghostText: { color: colors.text, fontWeight: "900" },

  darkBtn: {
    marginTop: 14,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: BTN_DARK,
    borderWidth: 1,
    borderColor: BTN_DARK,
  },
  darkText: { color: BTN_DARK_TEXT, fontWeight: "900", fontSize: 15 },
  darkSub: { marginTop: 3, color: BTN_DARK_TEXT, opacity: 0.85, fontSize: 12, fontWeight: "800" },
});
