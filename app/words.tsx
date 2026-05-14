// app/words.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as speech from "expo-speech";

import { colors } from "./theme";
import { flashcards } from "./data/flashcards";
import {
  getNativeAudioSource,
  hasNativeAudio,
  type AudioLang,
} from "./utils/nativeAudio";
import {
  getLearnedSetForLang,
  toggleLearnedForLang,
  type LearnedLang,
} from "./utils/learned";

const BTN_DARK = "#000";
const BTN_DARK_TEXT = "#fff";

function normEn(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toLearnedLang(lang: AudioLang): LearnedLang {
  return lang === "yo" ? "yo" : lang === "ig" ? "ig" : "pg";
}

export default function WordsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    lang?: string;
    onlyMissing?: string;
    onlyLearned?: string;
  }>();

  const initialLang = (params.lang as AudioLang) || "yo";
  const initialOnlyMissing = params.onlyMissing === "1";
  const initialOnlyLearned = params.onlyLearned === "1";

  const [lang, setLang] = useState<AudioLang>(initialLang);
  const [q, setQ] = useState("");
  const [learned, setLearned] = useState<Set<number>>(new Set());
  const [onlyMissing, setOnlyMissing] = useState<boolean>(initialOnlyMissing);
  const [onlyLearned, setOnlyLearned] = useState<boolean>(initialOnlyLearned);

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

  const refreshLearned = useCallback(async (l: AudioLang) => {
    try {
      const set = await getLearnedSetForLang(toLearnedLang(l));
      setLearned(new Set(set));
    } catch {
      setLearned(new Set());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshLearned(lang);
      return () => {
        stopAudio();
      };
    }, [lang, refreshLearned, stopAudio])
  );

  // ✅ FIX: side-effect belongs in useEffect (not useMemo)
  useEffect(() => {
    refreshLearned(lang);
  }, [lang, refreshLearned]);

  const allRows = useMemo(() => {
    return (flashcards as readonly any[]).map((c) => {
      const enRaw = String(c.en ?? "");
      const enN = normEn(enRaw);
      const id = Number(c.id);
      const tr = String(c?.[lang] ?? "");
      const missing = !hasNativeAudio({ lang, en: enRaw, id });
      return { id, enRaw, enN, tr, missing };
    });
  }, [lang]);

  const counts = useMemo(() => {
    const total = allRows.length;
    const missing = allRows.filter((x) => x.missing).length;
    const covered = total - missing;
    const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
    return { total, missing, covered, pct };
  }, [allRows]);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return allRows
      .filter((x) => (onlyMissing ? x.missing : true))
      .filter((x) => (onlyLearned ? learned.has(x.id) : true))
      .filter((x) => {
        if (!query) return true;
        return (
          x.enN.includes(query) ||
          x.enRaw.toLowerCase().includes(query) ||
          x.tr.toLowerCase().includes(query)
        );
      });
  }, [allRows, q, onlyMissing, onlyLearned, learned]);

  const play = useCallback(
    async (id: number, enRaw: string, tr: string) => {
      await stopAudio();

      const src = getNativeAudioSource({ lang, en: enRaw, id });

      // 1) Native audio
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
      const text = tr || enRaw;
      const rate = lang === "pg" ? 0.95 : 0.85;

      try {
        speech.speak(text, {
          language: lang === "yo" ? "yo-NG" : lang === "ig" ? "ig-NG" : "en-NG",
          rate,
        });
      } catch {}
    },
    [lang, stopAudio]
  );

  const toggle = useCallback(
    async (id: number) => {
      const set = await toggleLearnedForLang(toLearnedLang(lang), id);
      setLearned(new Set(set));
    },
    [lang]
  );

  const LanguagePills = (
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
  );

  const openAudioReport = () =>
    router.push({ pathname: "/audio-report", params: { lang } });

  const filterLabel =
    onlyMissing && onlyLearned
      ? "Learned + Missing"
      : onlyLearned
      ? "Learned Only"
      : onlyMissing
      ? "Missing Only"
      : "All Words";

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: 14 + insets.top, paddingBottom: 40 + insets.bottom },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Words List</Text>
            <Text style={styles.sub}>
              Lang: {lang.toUpperCase()} • {filterLabel} • Learned: {learned.size} •
              Audio: {counts.pct}%
            </Text>
          </View>
        </View>

        {LanguagePills}

        <View style={styles.searchWrap}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search English or translation"
            placeholderTextColor={colors.muted}
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable onPress={() => setQ("")} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>

        <View style={styles.topButtons}>
          <Pressable onPress={openAudioReport} style={styles.darkBtn}>
            <Text style={styles.darkText}>Open Audio Report</Text>
            <Text style={styles.darkSub}>See missing mp3 files</Text>
          </Pressable>

          <Pressable
            onPress={() => setOnlyMissing((v) => !v)}
            style={[styles.toggleBtn, onlyMissing && styles.toggleBtnOn]}
          >
            <Text style={[styles.toggleText, onlyMissing && styles.toggleTextOn]}>
              {onlyMissing ? "Showing: Missing Only" : "Showing: All Words"}
            </Text>
            <Text style={[styles.toggleSub, onlyMissing && styles.toggleSubOn]}>
              Tap to switch
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setOnlyLearned((v) => !v)}
            style={[styles.toggleBtn, onlyLearned && styles.toggleBtnOn]}
          >
            <Text style={[styles.toggleText, onlyLearned && styles.toggleTextOn]}>
              {onlyLearned
                ? "Showing: Learned Only"
                : "Showing: All (Learned + Unlearned)"}
            </Text>
            <Text style={[styles.toggleSub, onlyLearned && styles.toggleSubOn]}>
              Tap to switch
            </Text>
          </Pressable>
        </View>

        <View style={{ height: 12 }} />

        {list.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.goodTitle}>No results</Text>
            <Text style={styles.goodSub}>
              {onlyMissing
                ? "Good news: no missing audio under the current rules. Switch filters to browse more."
                : onlyLearned
                ? "No learned words match this filter/search."
                : "Try a different search."}
            </Text>

            {onlyMissing || onlyLearned ? (
              <Pressable
                onPress={() => {
                  setOnlyMissing(false);
                  setOnlyLearned(false);
                }}
                style={[styles.darkBtn, { marginTop: 12 }]}
              >
                <Text style={styles.darkText}>Show All Words</Text>
                <Text style={styles.darkSub}>Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.list}>
            {list.map((w) => {
              const learnedOn = learned.has(w.id);
              return (
                <View key={w.id} style={styles.item}>
                  <View style={styles.itemTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.en}>{w.enRaw}</Text>
                      <Text style={styles.tr}>{w.tr}</Text>
                    </View>

                    <View style={styles.badges}>
                      {w.missing ? (
                        <View style={[styles.badge, styles.badgeMissing]}>
                          <Text style={styles.badgeText}>Missing</Text>
                        </View>
                      ) : (
                        <View style={[styles.badge, styles.badgeOk]}>
                          <Text style={styles.badgeText}>Audio</Text>
                        </View>
                      )}

                      {learnedOn ? (
                        <View style={[styles.badge, styles.badgeLearned]}>
                          <Text style={styles.badgeText}>Learned</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={() => play(w.id, w.enRaw, w.tr)}
                      style={styles.playBtn}
                    >
                      <Text style={styles.playText}>Play</Text>
                      <Text style={styles.playSub}>Native first</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => toggle(w.id)}
                      style={[styles.learnBtn, learnedOn && styles.learnBtnOn]}
                    >
                      <Text style={[styles.learnText, learnedOn && styles.learnTextOn]}>
                        {learnedOn ? "Unmark" : "Mark Learned"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  watermarkWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 0 },
  container: { padding: 20, zIndex: 1 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 as any },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: colors.text, fontSize: 20, fontWeight: "900" },

  h1: { fontSize: 26, fontWeight: "900", color: colors.text },
  sub: { marginTop: 4, color: colors.muted },

  langRow: { marginTop: 12, flexDirection: "row", gap: 10 as any },
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

  searchWrap: { marginTop: 12, flexDirection: "row", gap: 10 as any, alignItems: "center" },
  search: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontWeight: "700",
  },
  clearBtn: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  clearText: { color: colors.text, fontWeight: "900" },

  topButtons: { marginTop: 10, gap: 10 as any },

  darkBtn: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: BTN_DARK,
    borderWidth: 1,
    borderColor: BTN_DARK,
  },
  darkText: { color: BTN_DARK_TEXT, fontWeight: "900", fontSize: 15 },
  darkSub: { marginTop: 3, color: BTN_DARK_TEXT, opacity: 0.85, fontSize: 12, fontWeight: "800" },

  toggleBtn: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtnOn: { borderColor: colors.primary, backgroundColor: colors.background },
  toggleText: { color: colors.text, fontWeight: "900", fontSize: 14 },
  toggleTextOn: { color: colors.primary },
  toggleSub: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: "800" },
  toggleSubOn: { color: colors.text, opacity: 0.8 },

  card: { backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border },
  goodTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
  goodSub: { marginTop: 6, color: colors.muted },

  list: { marginTop: 10, gap: 10 as any },

  item: { backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border },
  itemTop: { flexDirection: "row", gap: 10 as any, alignItems: "flex-start" },

  en: { color: colors.text, fontWeight: "900", fontSize: 16 },
  tr: { marginTop: 2, color: colors.muted, fontWeight: "800" },

  badges: { gap: 6 as any, alignItems: "flex-end" },
  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontWeight: "900", fontSize: 11, color: colors.text },

  badgeMissing: { borderColor: "#d00", backgroundColor: "transparent" },
  badgeOk: { borderColor: colors.primary, backgroundColor: "transparent" },
  badgeLearned: { borderColor: colors.border, backgroundColor: colors.background },

  actionsRow: { marginTop: 10, flexDirection: "row", gap: 10 as any },

  playBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: BTN_DARK,
    borderWidth: 1,
    borderColor: BTN_DARK,
    alignItems: "center",
  },
  playText: { color: BTN_DARK_TEXT, fontWeight: "900" },
  playSub: { marginTop: 2, color: BTN_DARK_TEXT, opacity: 0.75, fontSize: 12, fontWeight: "700" },

  learnBtn: {
    width: 140,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  learnBtnOn: { borderColor: colors.primary, backgroundColor: colors.background },
  learnText: { color: colors.text, fontWeight: "900", fontSize: 12 },
  learnTextOn: { color: colors.primary, fontWeight: "900" },
});
