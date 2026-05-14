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

function accentForLang(lang: AudioLang) {
  if (lang === "yo") {
    return {
      hero: "#6d5efc",
      heroSoft: "#ece9ff",
      pill: "#7c6cff",
      pillSoft: "#f1eeff",
      card: "#fff4dc",
      cardBorder: "#ffd98a",
      translation: "#fff8e8",
      translationBorder: "#ffd56e",
      action: "#ff8a3d",
      actionDark: "#eb6e1d",
      chip: "#efeaff",
      chipText: "#5846ea",
      progress: "#7c6cff",
      glow: "#ffd86c",
      bubbleA: "#ffd86c",
      bubbleB: "#8ee3ff",
      bubbleC: "#ff9ed1",
      ribbon: "#6f5cff",
      ribbonDark: "#5440ea",
      ribbonSoft: "#eee9ff",
    };
  }

  if (lang === "ig") {
    return {
      hero: "#11a36a",
      heroSoft: "#e4fff4",
      pill: "#16b879",
      pillSoft: "#ebfff6",
      card: "#effff7",
      cardBorder: "#93e4bc",
      translation: "#f4fff9",
      translationBorder: "#8be2b5",
      action: "#0f9f68",
      actionDark: "#0a8555",
      chip: "#e6fff3",
      chipText: "#0e8a59",
      progress: "#16b879",
      glow: "#8ff0bf",
      bubbleA: "#8ff0bf",
      bubbleB: "#ffe27b",
      bubbleC: "#99d5ff",
      ribbon: "#19b67b",
      ribbonDark: "#0e965f",
      ribbonSoft: "#e9fff3",
    };
  }

  return {
    hero: "#ff6b57",
    heroSoft: "#fff0ec",
    pill: "#ff7f6d",
    pillSoft: "#fff2ef",
    card: "#fff1e7",
    cardBorder: "#ffc79f",
    translation: "#fff8f4",
    translationBorder: "#ffc38d",
    action: "#ff6b57",
    actionDark: "#eb5541",
    chip: "#fff1ed",
    chipText: "#d54a37",
    progress: "#ff7f6d",
    glow: "#ffbf8b",
    bubbleA: "#ffbf8b",
    bubbleB: "#93deff",
    bubbleC: "#ff9bc0",
    ribbon: "#ff7f50",
    ribbonDark: "#e25f31",
    ribbonSoft: "#fff0e8",
  };
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
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const stopAudio = useCallback(async () => {
    try {
      speech.stop();
    } catch {}
  }, []);

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2300,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2300,
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [floatAnim, pulseAnim]);

  const runLearnedCelebration = useCallback(() => {
    sparkleAnim.setValue(0);
    badgeAnim.setValue(0);

    Animated.parallel([
      Animated.timing(sparkleAnim, {
        toValue: 1,
        duration: 700,
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
  const learnedCount = useMemo(() => learnedSet.size, [learnedSet]);
  const langAccent = useMemo(() => accentForLang(lang), [lang]);

  const progressPct = useMemo(() => {
    return total > 0 ? Math.round(((idx + 1) / total) * 100) : 0;
  }, [idx, total]);

  const mascotEmoji = useMemo(() => {
    if (lang === "yo") return "🦁";
    if (lang === "ig") return "🌟";
    return "🦜";
  }, [lang]);

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

  const heroBob = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const heroScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  const sparkleRise = sparkleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, -12],
  });

  return (
    <View style={styles.screen}>
      <View style={[styles.bgGlowTop, { backgroundColor: colors.primary }]} />
      <View style={[styles.bgGlowRight, { backgroundColor: colors.sky }]} />
      <View style={[styles.bgGlowBottom, { backgroundColor: colors.pink }]} />
      <View style={styles.bgGlowCenter} />

      <View style={[styles.backgroundOrbTop, { backgroundColor: langAccent.bubbleA }]} />
      <View style={[styles.backgroundOrbRight, { backgroundColor: langAccent.bubbleB }]} />
      <View style={[styles.backgroundOrbBottom, { backgroundColor: langAccent.bubbleC }]} />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.sparkleWrap,
          {
            opacity: sparkleAnim,
            transform: [
              { translateY: sparkleRise },
              {
                scale: sparkleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1.12],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.sparkleText}>✨ Great job! ✨</Text>
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
        <View style={[styles.learnedBadge, { backgroundColor: langAccent.action }]}>
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
        <View style={styles.headerRibbonRow}>
          <View
            style={[
              styles.headerRibbon,
              {
                backgroundColor: langAccent.ribbonSoft,
                borderColor: langAccent.ribbon,
              },
            ]}
          >
            <View
              style={[
                styles.headerRibbonCap,
                { backgroundColor: langAccent.ribbonDark },
              ]}
            />
            <Text style={[styles.headerRibbonEmoji, { color: langAccent.ribbonDark }]}>
              📚
            </Text>
            <Text style={[styles.headerRibbonText, { color: langAccent.ribbonDark }]}>
              learn
            </Text>
          </View>
        </View>

        <Animated.View
          style={[
            styles.hero,
            {
              backgroundColor: langAccent.hero,
              transform: [{ translateY: heroBob }],
            },
          ]}
        >
          <View style={[styles.heroBubbleOne, { backgroundColor: langAccent.bubbleA }]} />
          <View style={[styles.heroBubbleTwo, { backgroundColor: langAccent.bubbleB }]} />
          <View style={[styles.heroBubbleThree, { backgroundColor: langAccent.bubbleC }]} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroTextWrap}>
              <View style={[styles.heroBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <Text style={styles.heroBadgeText}>{titleForLang(lang)}</Text>
              </View>

              <Text style={styles.heroTitle}>Let’s learn new words</Text>
              <Text style={styles.heroSubtitle}>
                Flip cards, hear the sound, and celebrate each new word.
              </Text>
            </View>

            <Animated.View
              style={[
                styles.heroMascotWrap,
                {
                  backgroundColor: "rgba(255,255,255,0.2)",
                  transform: [{ scale: heroScale }],
                },
              ]}
            >
              <Text style={styles.heroMascot}>{mascotEmoji}</Text>
            </Animated.View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{Math.min(idx + 1, total)}</Text>
              <Text style={styles.heroStatLabel}>card</Text>
            </View>

            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{learnedCount}</Text>
              <Text style={styles.heroStatLabel}>learned</Text>
            </View>

            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{progressPct}%</Text>
              <Text style={styles.heroStatLabel}>progress</Text>
            </View>
          </View>

          <View style={styles.heroProgressRow}>
            <Text style={styles.heroProgressLabel}>Session progress</Text>
            <Text style={styles.heroProgressValue}>
              {Math.min(idx + 1, total)}/{total}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPct}%`,
                  backgroundColor: "#ffffff",
                },
              ]}
            />
          </View>
        </Animated.View>

        <View style={styles.languageSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pick your language</Text>
            <Text style={styles.sectionHint}>Tap to switch</Text>
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
                    { backgroundColor: "#ffffff", borderColor: "#ffffff" },
                    selected && {
                      backgroundColor: langAccent.pill,
                      borderColor: langAccent.pill,
                    },
                    pressed && styles.pressDown,
                  ]}
                >
                  <Text
                    style={[
                      styles.langPillText,
                      selected && styles.langPillTextOn,
                    ]}
                  >
                    {shortForLang(k)}
                  </Text>
                  <Text
                    style={[
                      styles.langPillSub,
                      selected && styles.langPillSubOn,
                    ]}
                  >
                    {k === "yo" ? "Yoruba" : k === "ig" ? "Igbo" : "Pidgin"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.flashcard,
            {
              backgroundColor: langAccent.card,
              borderColor: langAccent.cardBorder,
            },
          ]}
        >
          <View style={styles.flashcardTop}>
            <View>
              <Text style={styles.flashcardLabel}>Today’s word</Text>
              <Text style={styles.flashcardSmall}>
                Tap reveal when you’re ready
              </Text>
            </View>

            <View style={[styles.learnedChip, { backgroundColor: langAccent.chip }]}>
              <Text style={[styles.learnedChipText, { color: langAccent.chipText }]}>
                {learnedOn ? "learned" : `${learnedCount} learned`}
              </Text>
            </View>
          </View>

          <Text style={styles.wordText}>{en}</Text>

          <View
            style={[
              styles.translationWrap,
              {
                backgroundColor: langAccent.translation,
                borderColor: langAccent.translationBorder,
              },
            ]}
          >
            <Text style={styles.translationLabel}>Translation</Text>

            {revealed ? (
              <Text style={styles.translationText}>{tr || "—"}</Text>
            ) : (
              <View style={styles.hiddenState}>
                <Text style={styles.hiddenEmoji}>🎁</Text>
                <Text style={styles.translationHint}>Tap Reveal to open this word</Text>
              </View>
            )}
          </View>

          <View style={styles.primaryActionRow}>
            <Pressable
              onPress={revealOrHide}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: "#ffffff", borderColor: "#ffffff" },
                pressed && styles.pressDown,
              ]}
            >
              <Text style={styles.secondaryBtnEmoji}>{revealed ? "🙈" : "👀"}</Text>
              <Text style={styles.secondaryBtnText}>{revealed ? "Hide" : "Reveal"}</Text>
            </Pressable>

            <Pressable
              onPress={play}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: langAccent.action, borderColor: langAccent.actionDark },
                pressed && styles.pressDown,
              ]}
            >
              <Text style={styles.primaryBtnText}>▶ Play audio</Text>
              <Text style={styles.primaryBtnSub}>Native voice first</Text>
            </Pressable>
          </View>

          <View style={styles.navRow}>
            <Pressable
              onPress={prev}
              style={({ pressed }) => [
                styles.navBtn,
                { backgroundColor: "#ffffff", borderColor: "#ffffff" },
                pressed && styles.pressDown,
              ]}
            >
              <Text style={styles.navBtnText}>← Prev</Text>
            </Pressable>

            <Pressable
              onPress={next}
              style={({ pressed }) => [
                styles.navBtn,
                { backgroundColor: "#ffffff", borderColor: "#ffffff" },
                pressed && styles.pressDown,
              ]}
            >
              <Text style={styles.navBtnText}>Next →</Text>
            </Pressable>
          </View>

          <View style={styles.utilityRow}>
            <Pressable
              onPress={toggleLearned}
              style={({ pressed }) => [
                styles.learnBtn,
                {
                  backgroundColor: learnedOn ? langAccent.pillSoft : "#ffffff",
                  borderColor: learnedOn ? langAccent.pill : "#ffffff",
                },
                pressed && styles.pressDown,
              ]}
            >
              <Text
                style={[
                  styles.learnBtnText,
                  learnedOn && { color: langAccent.pill },
                ]}
              >
                {learnedOn ? "Unmark learned" : "Mark learned"}
              </Text>
            </Pressable>

            <Pressable
              onPress={reshuffle}
              style={({ pressed }) => [
                styles.ghostBtn,
                { backgroundColor: "#fff7ea", borderColor: "#ffe3a4" },
                pressed && styles.pressDown,
              ]}
            >
              <Text style={styles.ghostBtnText}>Shuffle</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.bottomCard, { backgroundColor: langAccent.heroSoft }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>More word fun</Text>
            <Text style={styles.sectionHint}>{titleForLang(lang)}</Text>
          </View>

          <Text style={styles.bottomCardText}>
            Open the full words list to search, review, and keep learning at your own pace.
          </Text>

          <Pressable
            onPress={openWords}
            style={({ pressed }) => [
              styles.bottomPrimary,
              { backgroundColor: langAccent.hero },
              pressed && styles.pressDown,
            ]}
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
    backgroundColor: "#8f7cff",
  },

  bgGlowTop: {
    position: "absolute",
    top: -40,
    left: -24,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: colors.primary,
    opacity: 0.22,
  },
  bgGlowRight: {
    position: "absolute",
    top: 150,
    right: -42,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: colors.sky,
    opacity: 0.18,
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: 110,
    left: -44,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: colors.pink,
    opacity: 0.18,
  },
  bgGlowCenter: {
    position: "absolute",
    top: 340,
    left: "35%",
    width: 145,
    height: 145,
    borderRadius: 999,
    backgroundColor: "#ffd86c",
    opacity: 0.14,
  },

  backgroundOrbTop: {
    position: "absolute",
    top: 92,
    left: -34,
    width: 130,
    height: 130,
    borderRadius: 999,
    opacity: 0.14,
  },
  backgroundOrbRight: {
    position: "absolute",
    top: 220,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 999,
    opacity: 0.12,
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: 120,
    left: -26,
    width: 120,
    height: 120,
    borderRadius: 999,
    opacity: 0.12,
  },

  container: {
    paddingHorizontal: 18,
  },

  headerRibbonRow: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginBottom: 14,
  },
  headerRibbon: {
    minWidth: 132,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingLeft: 16,
    paddingRight: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 2,
    position: "relative",
  },
  headerRibbonCap: {
    position: "absolute",
    left: 10,
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  headerRibbonEmoji: {
    fontSize: 14,
  },
  headerRibbonText: {
    fontSize: 15,
    fontWeight: "900",
    textTransform: "lowercase",
  },

  sparkleWrap: {
    position: "absolute",
    top: 88,
    left: 0,
    right: 0,
    zIndex: 15,
    alignItems: "center",
  },
  sparkleText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
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
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  learnedBadgeText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },

  hero: {
    marginTop: 2,
    borderRadius: 34,
    padding: 20,
    overflow: "hidden",
  },
  heroBubbleOne: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 999,
    top: -30,
    right: -14,
    opacity: 0.35,
  },
  heroBubbleTwo: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 999,
    bottom: 24,
    right: 22,
    opacity: 0.22,
  },
  heroBubbleThree: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    left: -34,
    bottom: -42,
    opacity: 0.2,
  },
  heroTopRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  heroTextWrap: {
    flex: 1,
  },
  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    color: "#ffffff",
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.92)",
    fontWeight: "700",
    maxWidth: 260,
  },
  heroMascotWrap: {
    width: 78,
    height: 78,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  heroMascot: {
    fontSize: 34,
  },
  heroStatsRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroStatValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  heroStatLabel: {
    marginTop: 4,
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "lowercase",
  },
  heroProgressRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroProgressLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  heroProgressValue: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  progressTrack: {
    marginTop: 10,
    height: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(255,255,255,0.78)",
  },

  languageSection: {
    marginTop: 20,
  },
  langRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  langPill: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  langPillText: {
    color: "#2a2340",
    fontWeight: "900",
    fontSize: 15,
  },
  langPillTextOn: {
    color: "#ffffff",
  },
  langPillSub: {
    marginTop: 4,
    color: "#8b86a2",
    fontWeight: "800",
    fontSize: 11,
  },
  langPillSubOn: {
    color: "rgba(255,255,255,0.85)",
  },

  flashcard: {
    marginTop: 18,
    borderRadius: 32,
    borderWidth: 2,
    padding: 18,
  },
  flashcardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  flashcardLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: "#6c628f",
    textTransform: "uppercase",
  },
  flashcardSmall: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#8b86a2",
    fontWeight: "700",
  },
  learnedChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  learnedChipText: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "lowercase",
  },
  wordText: {
    marginTop: 16,
    fontSize: 38,
    lineHeight: 42,
    color: "#2a2340",
    fontWeight: "900",
  },

  translationWrap: {
    marginTop: 20,
    borderRadius: 24,
    padding: 18,
    borderWidth: 2,
    minHeight: 130,
    justifyContent: "center",
  },
  translationLabel: {
    color: "#7c7696",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  translationText: {
    marginTop: 10,
    color: "#2a2340",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
  },
  hiddenState: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  hiddenEmoji: {
    fontSize: 30,
    marginBottom: 8,
  },
  translationHint: {
    color: "#7c7696",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center",
  },

  primaryActionRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
  },
  secondaryBtn: {
    width: 126,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  secondaryBtnText: {
    color: "#2a2340",
    fontWeight: "900",
    fontSize: 15,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },
  primaryBtnSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontWeight: "800",
  },

  navRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 12,
  },
  navBtn: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  navBtnText: {
    color: "#2a2340",
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
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  learnBtnText: {
    color: "#2a2340",
    fontWeight: "900",
    fontSize: 15,
  },
  ghostBtn: {
    width: 126,
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  ghostBtnText: {
    color: "#7b5219",
    fontWeight: "900",
    fontSize: 15,
  },

  bottomCard: {
    marginTop: 18,
    borderRadius: 30,
    padding: 18,
    marginBottom: 8,
  },
  bottomCardText: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    color: "#5c5674",
    fontWeight: "700",
  },
  bottomPrimary: {
    marginTop: 16,
    borderRadius: 24,
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
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontWeight: "800",
  },

  pressDown: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});
