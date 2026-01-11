// app/(tabs)/learn.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as speech from "expo-speech";

import { colors } from "../theme";
import Watermark from "../components/watermark";
import { flashcards } from "../data/flashcards";
import { getLearnedSetForLang, toggleLearnedForLang } from "../utils/learned";
import { playWordAudio, type AudioLang } from "../utils/play-word-audio";

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

/**
 * ✅ Prevent placeholder "word_77" from showing.
 * - "word_77" -> "Word 77"
 */
function prettyWordLabel(raw: string, id: number) {
  const s = String(raw ?? "");
  if (/^word_\d+$/i.test(s)) return `Word ${id}`;
  return s;
}

export default function LearnTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [lang, setLang] = useState<AudioLang>("yo");
  const [revealed, setRevealed] = useState(false);

  const [learnedSet, setLearnedSet] = useState<Set<number>>(new Set());

  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);

  // ✅ sparkles celebration
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  const runSparkles = useCallback(() => {
    sparkleAnim.setValue(0);
    Animated.timing(sparkleAnim, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(sparkleAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  }, [sparkleAnim]);

  const stopAudio = useCallback(async () => {
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
    const ids = (flashcards as any[])
      .map((c) => Number(c.id))
      .filter((n) => Number.isFinite(n));
    setOrder(shuffle(ids));
    setIdx(0);
    setRevealed(false);
  }, []);

  useEffect(() => {
    (async () => {
      await refreshLearned();
    })();
  }, [lang, refreshLearned]);

  const currentId = order[idx] ?? Number((flashcards as any[])[0]?.id ?? 1);

  const current = useMemo(() => {
    const c = (flashcards as any[]).find(
      (x) => Number(x.id) === Number(currentId)
    );
    if (!c) return (flashcards as any[])[0];
    return c;
  }, [currentId]);

  const total = order.length || flashcards.length || 1;
  const idNum = Number(current?.id ?? currentId);

  // ✅ english (never show word_77)
  const enRaw = String(current?.en ?? "");
  const en = useMemo(() => prettyWordLabel(enRaw, idNum), [enRaw, idNum]);

  // translation for current lang
  const tr = String(current?.[lang] ?? "");

  const learnedOn = learnedSet.has(idNum);

  const play = useCallback(async () => {
    await stopAudio();

    // If revealed, user expects to hear translation; otherwise English.
    const text = revealed ? tr || en : en;
    const clean = String(text || "").trim();
    if (!clean) return;

    const ttsLang =
      lang === "yo" ? "yo-NG" : lang === "ig" ? "ig-NG" : "en-NG";

    const rate = lang === "pg" ? 0.95 : 0.85;

    await playWordAudio({
      lang,
      id: idNum,
      ttsText: clean,
      ttsLang,
      rate,
    });
  }, [stopAudio, revealed, tr, en, lang, idNum]);

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
    const ids = (flashcards as any[])
      .map((c) => Number(c.id))
      .filter((n) => Number.isFinite(n));
    setOrder(shuffle(ids));
    setIdx(0);
    setRevealed(false);
    Alert.alert("Shuffled", "New practice order.");
  }, []);

  // ✅ sparkles only when marking learned ON
  const toggleLearned = useCallback(async () => {
    const wasLearned = learnedSet.has(idNum);

    const set = await toggleLearnedForLang(lang, idNum);
    setLearnedSet(new Set(set));

    if (!wasLearned) runSparkles();
  }, [lang, idNum, learnedSet, runSparkles]);

  const openWords = () => router.push({ pathname: "/words", params: { lang } });

  return (
    <View style={styles.screen}>
      <View style={styles.watermarkWrap} pointerEvents="none">
        <Watermark />
      </View>

      {/* ✅ Sparkles overlay */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sparkles,
          {
            opacity: sparkleAnim,
            transform: [
              {
                scale: sparkleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 1.2],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.sparkleText}>✨✨✨</Text>
      </Animated.View>

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
              {titleForLang(lang)} • Card {Math.min(idx + 1, total)}/{total}
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

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => setRevealed((v) => !v)}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryText}>
                {revealed ? "Hide" : "Reveal"}
              </Text>
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
  watermarkWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
  },
  container: { padding: 16, zIndex: 1 },

  sparkles: {
    position: "absolute",
    top: 90,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 3,
  },
  sparkleText: { fontSize: 26 },

  headerRow: { flexDirection: "row", alignItems: "center" },
  h1: { fontSize: 26, fontWeight: "900", color: colors.text },
  sub: { marginTop: 6, color: colors.muted, fontWeight: "700" },

  langRow: { marginTop: 14, flexDirection: "row", gap: 10 as any },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    backgroundColor: "#fff",
  },
  pillOn: { borderColor: colors.text, backgroundColor: "#f3f3f3" },
  pillText: { color: colors.muted, fontWeight: "900" },
  pillTextOn: { color: colors.text },

  card: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
  },
  en: { color: colors.text, fontSize: 22, fontWeight: "900" },
  tr: { color: colors.text, fontSize: 18, fontWeight: "900" },
  hidden: { color: colors.muted, fontWeight: "800" },

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
  primarySub: {
    marginTop: 2,
    color: BTN_DARK_TEXT,
    opacity: 0.75,
    fontSize: 12,
    fontWeight: "700",
  },

  secondaryBtn: {
    width: 120,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    backgroundColor: "#fafafa",
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
    borderColor: "rgba(0,0,0,0.10)",
    backgroundColor: "transparent",
  },
  navText: { color: colors.text, fontWeight: "900" },

  learnBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    backgroundColor: "transparent",
  },
  learnBtnOn: { borderColor: colors.accent, backgroundColor: "#fffaf0" },
  learnText: { color: colors.text, fontWeight: "900" },
  learnTextOn: { color: colors.text },

  ghostBtn: {
    width: 120,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    backgroundColor: "#fafafa",
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
  darkSub: {
    marginTop: 3,
    color: BTN_DARK_TEXT,
    opacity: 0.85,
    fontSize: 12,
    fontWeight: "800",
  },
});
