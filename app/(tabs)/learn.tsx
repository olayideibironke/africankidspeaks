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

import ParentGateModal from "../components/parentgate.modal";
import { flashcards } from "../data/flashcards";
import { getLearnedSetForLang, toggleLearnedForLang } from "../utils/learned";
import { playWordAudio, type AudioLang } from "../utils/play-word-audio";

function titleForLang(lang: AudioLang) {
  if (lang === "yo") return "Yoruba";
  if (lang === "ig") return "Igbo";
  return "Pidgin";
}

function shortForLang(lang: AudioLang) {
  if (lang === "yo") return "YO";
  if (lang === "ig") return "IG";
  return "PG";
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;

  const stopAudio = useCallback(async () => {
    try {
      speech.stop();
    } catch {}
  }, []);

  const runLearnedCelebration = useCallback(() => {
    sparkleAnim.setValue(0);
    badgeAnim.setValue(0);

    Animated.parallel([
      Animated.timing(sparkleAnim, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(badgeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.delay(1300),
        Animated.timing(badgeAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      sparkleAnim.setValue(0);
    });
  }, [sparkleAnim, badgeAnim]);

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
    const c = (flashcards as any[]).find((x) => Number(x.id) === Number(currentId));
    if (!c) return (flashcards as any[])[0];
    return c;
  }, [currentId]);

  const total = order.length || flashcards.length || 1;
  const idNum = Number(current?.id ?? currentId);

  const enRaw = String(current?.en ?? "");
  const en = useMemo(() => prettyWordLabel(enRaw, idNum), [enRaw, idNum]);
  const tr = String(current?.[lang] ?? "");
  const learnedOn = learnedSet.has(idNum);

  const progressPct = useMemo(() => {
    return total > 0 ? Math.round(((idx + 1) / total) * 100) : 0;
  }, [idx, total]);

  const learnedCount = useMemo(() => learnedSet.size, [learnedSet]);

  const play = useCallback(async () => {
    await stopAudio();

    const text = revealed ? tr || en : en;
    const clean = String(text || "").trim();
    if (!clean) return;

    const ttsLang = lang === "yo" ? "yo-NG" : lang === "ig" ? "ig-NG" : "en-NG";
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
    Alert.alert("Shuffled", "New learning order ready.");
  }, []);

  const toggleLearned = useCallback(async () => {
    const wasLearned = learnedSet.has(idNum);
    const set = await toggleLearnedForLang(lang, idNum);
    setLearnedSet(new Set(set));

    if (!wasLearned) runLearnedCelebration();
  }, [lang, idNum, learnedSet, runLearnedCelebration]);

  const openWords = useCallback(() => {
    router.push({ pathname: "/words", params: { lang } });
  }, [router, lang]);

  const revealOrHide = useCallback(() => {
    setRevealed((v) => !v);
  }, []);

  return (
    <View style={styles.screen}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sparkleWrap,
          {
            opacity: sparkleAnim,
            transform: [
              {
                scale: sparkleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.75, 1.12],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.sparkleText}>✨ ✨ ✨</Text>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.learnedBadgeWrap,
          {
            opacity: badgeAnim,
            transform: [
              {
                translateY: badgeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.learnedBadge}>
          <Text style={styles.learnedBadgeText}>Marked learned ✅</Text>
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Text style={styles.topLabel}>learn</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextWrap}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{titleForLang(lang)}</Text>
              </View>

              <Text style={styles.heroTitle}>Learn</Text>
              <Text style={styles.heroSubtitle}>
                Tap reveal, hear the word, and mark it learned as you go.
              </Text>
            </View>

            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>
                {Math.min(idx + 1, total)}/{total}
              </Text>
              <Text style={styles.heroStatLabel}>cards</Text>
            </View>
          </View>

          <View style={styles.heroProgressRow}>
            <Text style={styles.heroProgressLabel}>Session progress</Text>
            <Text style={styles.heroProgressValue}>{progressPct}%</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>

        <View style={styles.languageSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Choose a language</Text>
            <Text style={styles.sectionHint}>Switch anytime</Text>
          </View>

          <View style={styles.langRow}>
            {(["yo", "ig", "pg"] as AudioLang[]).map((k) => {
              const selected = k === lang;
              return (
                <Pressable
                  key={k}
                  onPress={() => setLang(k)}
                  style={({ pressed }) => [
                    styles.langPill,
                    selected && styles.langPillOn,
                    pressed && styles.pressDown,
                  ]}
                >
                  <Text style={[styles.langPillText, selected && styles.langPillTextOn]}>
                    {shortForLang(k)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.flashcard}>
          <View style={styles.flashcardTop}>
            <Text style={styles.flashcardLabel}>Word</Text>
            <View style={styles.learnedChip}>
              <Text style={styles.learnedChipText}>
                {learnedOn ? "Learned" : `${learnedCount} learned`}
              </Text>
            </View>
          </View>

          <Text style={styles.wordText}>{en}</Text>

          <View style={styles.translationWrap}>
            <Text style={styles.translationLabel}>Translation</Text>
            {revealed ? (
              <Text style={styles.translationText}>{tr || "—"}</Text>
            ) : (
              <Text style={styles.translationHint}>Tap Reveal to show translation</Text>
            )}
          </View>

          <View style={styles.primaryActionRow}>
            <Pressable
              onPress={revealOrHide}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressDown]}
            >
              <Text style={styles.secondaryBtnText}>{revealed ? "Hide" : "Reveal"}</Text>
            </Pressable>

            <Pressable
              onPress={play}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressDown]}
            >
              <Text style={styles.primaryBtnText}>Play audio</Text>
              <Text style={styles.primaryBtnSub}>Native first</Text>
            </Pressable>
          </View>

          <View style={styles.navRow}>
            <Pressable
              onPress={prev}
              style={({ pressed }) => [styles.navBtn, pressed && styles.pressDown]}
            >
              <Text style={styles.navBtnText}>← Prev</Text>
            </Pressable>

            <Pressable
              onPress={next}
              style={({ pressed }) => [styles.navBtn, pressed && styles.pressDown]}
            >
              <Text style={styles.navBtnText}>Next →</Text>
            </Pressable>
          </View>

          <View style={styles.utilityRow}>
            <Pressable
              onPress={toggleLearned}
              style={({ pressed }) => [
                styles.learnBtn,
                learnedOn && styles.learnBtnOn,
                pressed && styles.pressDown,
              ]}
            >
              <Text style={[styles.learnBtnText, learnedOn && styles.learnBtnTextOn]}>
                {learnedOn ? "Unmark learned" : "Mark learned"}
              </Text>
            </Pressable>

            <Pressable
              onPress={reshuffle}
              style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressDown]}
            >
              <Text style={styles.ghostBtnText}>Shuffle</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bottomCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>More tools</Text>
            <Text style={styles.sectionHint}>{titleForLang(lang)}</Text>
          </View>

          <Pressable
            onPress={openWords}
            style={({ pressed }) => [styles.bottomPrimary, pressed && styles.pressDown]}
          >
            <Text style={styles.bottomPrimaryText}>Open words list</Text>
            <Text style={styles.bottomPrimarySub}>Search • missing audio • learned</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  container: {
    paddingHorizontal: 18,
  },

  topBar: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 12,
  },
  topLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
    textTransform: "lowercase",
  },

  sparkleWrap: {
    position: "absolute",
    top: 86,
    left: 0,
    right: 0,
    zIndex: 15,
    alignItems: "center",
  },
  sparkleText: {
    fontSize: 24,
  },

  learnedBadgeWrap: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 16,
    alignItems: "center",
  },
  learnedBadge: {
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  learnedBadgeText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },

  hero: {
    marginTop: 6,
    backgroundColor: "#f6f8fc",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#e9edf5",
    padding: 18,
  },
  heroTopRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  heroTextWrap: {
    flex: 1,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#e9f2ff",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: "#1864d9",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    color: "#111111",
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#667085",
    fontWeight: "600",
  },
  heroStatCard: {
    width: 90,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e9edf5",
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  heroStatValue: {
    fontSize: 24,
    color: "#111111",
    fontWeight: "900",
  },
  heroStatLabel: {
    marginTop: 4,
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
  },
  heroProgressRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroProgressLabel: {
    color: "#667085",
    fontSize: 13,
    fontWeight: "800",
  },
  heroProgressValue: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "900",
  },
  progressTrack: {
    marginTop: 10,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#e8edf5",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#1864d9",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111111",
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: "700",
    color: "#98a2b3",
  },

  languageSection: {
    marginTop: 18,
  },
  langRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  langPill: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e6eaf1",
    backgroundColor: "#ffffff",
  },
  langPillOn: {
    borderColor: "#bfd7ff",
    backgroundColor: "#f5faff",
  },
  langPillText: {
    color: "#667085",
    fontWeight: "900",
    fontSize: 14,
  },
  langPillTextOn: {
    color: "#1864d9",
  },

  flashcard: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#eceff4",
    padding: 18,
  },
  flashcardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  flashcardLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#667085",
    textTransform: "uppercase",
  },
  learnedChip: {
    backgroundColor: "#f7f8fa",
    borderWidth: 1,
    borderColor: "#eceff4",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  learnedChipText: {
    color: "#344054",
    fontSize: 12,
    fontWeight: "800",
  },
  wordText: {
    marginTop: 14,
    fontSize: 34,
    lineHeight: 38,
    color: "#111111",
    fontWeight: "900",
  },
  translationWrap: {
    marginTop: 20,
    backgroundColor: "#f7f8fa",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eceff4",
  },
  translationLabel: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  translationText: {
    marginTop: 8,
    color: "#111111",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },
  translationHint: {
    marginTop: 8,
    color: "#98a2b3",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },

  primaryActionRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
  },
  secondaryBtn: {
    width: 126,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#e7ebf2",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 15,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 15,
  },
  primaryBtnSub: {
    marginTop: 3,
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontWeight: "700",
  },

  navRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 12,
  },
  navBtn: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e7ebf2",
    backgroundColor: "#ffffff",
  },
  navBtnText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 16,
  },

  utilityRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 12,
  },
  learnBtn: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e7ebf2",
    backgroundColor: "#ffffff",
  },
  learnBtnOn: {
    backgroundColor: "#eef6ff",
    borderColor: "#bfd7ff",
  },
  learnBtnText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 15,
  },
  learnBtnTextOn: {
    color: "#1864d9",
  },
  ghostBtn: {
    width: 126,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e7ebf2",
    backgroundColor: "#f9fafb",
  },
  ghostBtnText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 15,
  },

  bottomCard: {
    marginTop: 18,
    backgroundColor: "#f7f8fa",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#eceff4",
    padding: 18,
  },
  bottomPrimary: {
    marginTop: 14,
    backgroundColor: "#111111",
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  bottomPrimaryText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },
  bottomPrimarySub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "700",
  },

  pressDown: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});