import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as speech from "expo-speech";
import * as haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import ParentGateModal from "../components/parentgate.modal";
import { flashcards } from "../data/flashcards";
import { getsettings, type settings } from "../utils/settings";
import { playWordAudio, type AudioLang } from "../utils/play-word-audio";

type Mode = "sound" | "match";
type Difficulty = "easy" | "normal" | "hard";

const score_key = "games_soundquiz_score_v1";
const streak_key = "games_soundquiz_streak_v1";

const adaptive_key = (lang: AudioLang, mode: Mode) =>
  `games_adaptive_v1_${lang}_${mode}`;
const ADAPTIVE_WINDOW = 20;

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN<T>(arr: T[], n: number) {
  return shuffle(arr).slice(0, n);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeLevelFromStreak(streak: number) {
  if (streak >= 20) return 5;
  if (streak >= 14) return 4;
  if (streak >= 9) return 3;
  if (streak >= 5) return 2;
  return 1;
}

function difficultyForLevel(level: number): Difficulty {
  if (level >= 4) return "hard";
  if (level >= 2) return "normal";
  return "easy";
}

function choicesCount(d: Difficulty) {
  if (d === "hard") return 6;
  if (d === "normal") return 4;
  return 3;
}

function difficultyStepUp(d: Difficulty): Difficulty {
  if (d === "easy") return "normal";
  if (d === "normal") return "hard";
  return "hard";
}

function difficultyStepDown(d: Difficulty): Difficulty {
  if (d === "hard") return "normal";
  if (d === "normal") return "easy";
  return "easy";
}

function parseBoolArray(raw: string | null): boolean[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.map((x) => !!x);
  } catch {
    return [];
  }
}

function isPlaceholderWord(raw: string) {
  return /^word_\d+$/i.test(String(raw ?? ""));
}

function prettyWordLabel(raw: string, id: number) {
  const s = String(raw ?? "");
  if (isPlaceholderWord(s)) return `Word ${id}`;
  return s;
}

function safeTTSTextForSoundQuiz(tr: string, id: number) {
  const s = String(tr ?? "").trim();
  if (s) return s;
  return `Audio missing ${id}`;
}

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

export default function GamesScreen() {
  const params = useLocalSearchParams<{ lang?: string }>();
  const initialLang = (params.lang as AudioLang) || "yo";

  const [lang, setLang] = useState<AudioLang>(initialLang);
  const [mode, setMode] = useState<Mode>("sound");

  const [gateOpen, setGateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

  const [settingsState, setSettingsState] = useState<settings | null>(null);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [correct, setCorrect] = useState(0);

  const [questionId, setQuestionId] = useState<number>(
    () => (flashcards as any[])[0]?.id ?? 1
  );
  const [choices, setChoices] = useState<any[]>([]);
  const [locked, setLocked] = useState(false);

  const [recentResults, setRecentResults] = useState<boolean[]>([]);

  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;
  const [feedbackText, setFeedbackText] = useState<string>("");

  useEffect(() => {
    const p = params.lang as string | undefined;
    if (p === "yo" || p === "ig" || p === "pg") setLang(p);
  }, [params.lang]);

  const level = useMemo(() => computeLevelFromStreak(streak), [streak]);
  const baseDifficulty = useMemo(() => difficultyForLevel(level), [level]);

  const accuracy = useMemo(() => {
    if (attempts <= 0) return 0;
    return Math.round((correct / attempts) * 100);
  }, [attempts, correct]);

  const recentAccuracy = useMemo(() => {
    if (!recentResults.length) return 0;
    const c = recentResults.filter(Boolean).length;
    return Math.round((c / recentResults.length) * 100);
  }, [recentResults]);

  const difficulty = useMemo((): Difficulty => {
    if (recentResults.length < 8) return baseDifficulty;
    if (recentAccuracy >= 85) return difficultyStepUp(baseDifficulty);
    if (recentAccuracy <= 55) return difficultyStepDown(baseDifficulty);
    return baseDifficulty;
  }, [baseDifficulty, recentResults.length, recentAccuracy]);

  const current = useMemo(() => {
    const c =
      (flashcards as any[]).find((x) => x.id === questionId) ??
      (flashcards as any[])[0];
    return c;
  }, [questionId]);

  const currentId = Number((current as any)?.id ?? questionId);

  const questionWordEn = useMemo(() => {
    const raw = String((current as any)?.en ?? "");
    return prettyWordLabel(raw, currentId);
  }, [current, currentId]);

  const targetTr = useMemo(() => {
    return String((current as any)?.[lang] ?? "").trim();
  }, [current, lang]);

  const totalCards = flashcards.length || 1;
  const learnedPercent = useMemo(() => {
    if (!attempts) return 0;
    return Math.round((correct / attempts) * 100);
  }, [correct, attempts]);

  const loadStats = useCallback(async () => {
    try {
      const s = await AsyncStorage.getItem(score_key);
      const st = await AsyncStorage.getItem(streak_key);
      if (s) setScore(parseInt(s, 10) || 0);
      if (st) setStreak(parseInt(st, 10) || 0);
    } catch {}
  }, []);

  const saveStats = useCallback(async (nextScore: number, nextStreak: number) => {
    try {
      await AsyncStorage.setItem(score_key, String(nextScore));
      await AsyncStorage.setItem(streak_key, String(nextStreak));
    } catch {}
  }, []);

  const loadAdaptive = useCallback(async (l: AudioLang, m: Mode) => {
    try {
      const raw = await AsyncStorage.getItem(adaptive_key(l, m));
      setRecentResults(parseBoolArray(raw).slice(-ADAPTIVE_WINDOW));
    } catch {
      setRecentResults([]);
    }
  }, []);

  const saveAdaptive = useCallback(async (l: AudioLang, m: Mode, arr: boolean[]) => {
    try {
      await AsyncStorage.setItem(
        adaptive_key(l, m),
        JSON.stringify(arr.slice(-ADAPTIVE_WINDOW))
      );
    } catch {}
  }, []);

  const pushAdaptiveResult = useCallback(
    async (isCorrect: boolean) => {
      setRecentResults((prev) => {
        const next = [...prev, isCorrect].slice(-ADAPTIVE_WINDOW);
        saveAdaptive(lang, mode, next);
        return next;
      });
    },
    [lang, mode, saveAdaptive]
  );

  const stopAudio = useCallback(async () => {
    try {
      speech.stop();
    } catch {}
  }, []);

  const primeQuestion = useCallback(() => {
    const cnt = choicesCount(difficulty);
    const picked = pickN(
      flashcards as any[],
      clamp(cnt, 3, (flashcards as any[]).length)
    );
    const hasCurrent = picked.some((x) => x.id === (current as any)?.id);
    const finalChoices = hasCurrent
      ? picked
      : shuffle([current, ...picked]).slice(0, cnt);
    setChoices(shuffle(finalChoices));
    setLocked(false);
  }, [difficulty, current]);

  const nextQuestion = useCallback(() => {
    const next =
      (flashcards as any[])[
        Math.floor(Math.random() * (flashcards as any[]).length)
      ];
    setQuestionId(next.id);
  }, []);

  useEffect(() => {
    primeQuestion();
  }, [questionId, lang, mode, difficulty, primeQuestion]);

  useEffect(() => {
    loadAdaptive(lang, mode);
  }, [lang, mode, loadAdaptive]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
      (async () => {
        try {
          const s = await getsettings();
          setSettingsState(s);
        } catch {}
      })();

      return () => {
        stopAudio();
      };
    }, [loadStats, stopAudio])
  );

  const runGoodFeedback = useCallback((text: string) => {
    setFeedbackText(text);
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
        Animated.delay(900),
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

  const runConfetti = useCallback(() => {
    confettiAnim.setValue(0);
    Animated.timing(confettiAnim, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(confettiAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start();
    });
  }, [confettiAnim]);

  const gated = useCallback(
    (fn: () => void) => {
      const gateEnabled = settingsState
        ? !!(settingsState as any).parent_gate
        : true;

      if (!gateEnabled) {
        fn();
        return;
      }

      setPendingAction(() => fn);
      setGateOpen(true);
    },
    [settingsState]
  );

  const playQuestionAudio = useCallback(async () => {
    await stopAudio();

    const ttsText =
      mode === "sound"
        ? safeTTSTextForSoundQuiz(targetTr, currentId)
        : safeTTSTextForSoundQuiz(targetTr, currentId);

    const ttsLang = lang === "yo" ? "yo-NG" : lang === "ig" ? "ig-NG" : "en-NG";
    const rate = lang === "pg" ? 0.95 : 0.85;

    await playWordAudio({
      lang,
      id: currentId,
      ttsText,
      ttsLang,
      rate,
    });
  }, [stopAudio, mode, targetTr, currentId, lang]);

  const onPick = useCallback(
    async (picked: any) => {
      if (locked) return;
      setLocked(true);

      const isCorrect = picked?.id === (current as any)?.id;

      setAttempts((a) => a + 1);
      if (isCorrect) setCorrect((c) => c + 1);

      pushAdaptiveResult(isCorrect);

      if (settingsState?.haptics !== false) {
        try {
          await haptics.notificationAsync(
            isCorrect
              ? (haptics.NotificationFeedbackType as any).Success
              : (haptics.NotificationFeedbackType as any).Error
          );
        } catch {}
      }

      if (isCorrect) {
        const nextScore = score + 10;
        const nextStreak = streak + 1;
        setScore(nextScore);
        setStreak(nextStreak);
        await saveStats(nextScore, nextStreak);

        runGoodFeedback("Correct ✅");

        if (difficulty === "hard") runConfetti();

        const prevLevel = computeLevelFromStreak(streak);
        const nextLevel = computeLevelFromStreak(nextStreak);
        if (nextLevel > prevLevel) {
          runGoodFeedback(`Level ${nextLevel} 🎉`);
          runConfetti();
        }

        setTimeout(() => nextQuestion(), 450);
      } else {
        const nextStreak = 0;
        setStreak(nextStreak);
        await saveStats(score, nextStreak);
        runGoodFeedback("Try again");
        setTimeout(() => setLocked(false), 500);
      }
    },
    [
      locked,
      current,
      pushAdaptiveResult,
      settingsState,
      score,
      streak,
      saveStats,
      runGoodFeedback,
      runConfetti,
      nextQuestion,
      difficulty,
    ]
  );

  const resetProgress = useCallback(async () => {
    const doReset = async () => {
      setScore(0);
      setStreak(0);
      setAttempts(0);
      setCorrect(0);
      setRecentResults([]);
      setFeedbackText("");

      try {
        await AsyncStorage.setItem(score_key, "0");
        await AsyncStorage.setItem(streak_key, "0");

        const langs: AudioLang[] = ["yo", "ig", "pg"];
        const modes: Mode[] = ["sound", "match"];
        await Promise.all(
          langs.flatMap((l) =>
            modes.map((m) => AsyncStorage.removeItem(adaptive_key(l, m)))
          )
        );
      } catch {}
    };

    gated(() => {
      doReset();
    });
  }, [gated]);

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
                  outputRange: [0.7, 1.2],
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
          styles.badgeWrap,
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
        <View style={styles.badgeCard}>
          <Text style={styles.badgeText}>{feedbackText}</Text>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.confettiWrap,
          {
            opacity: confettiAnim,
            transform: [
              {
                translateY: confettiAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 40],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.confettiText}>🎉 🎊 🎉 🎊</Text>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Text style={styles.topLabel}>games</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextWrap}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{titleForLang(lang)}</Text>
              </View>

              <Text style={styles.heroTitle}>Games</Text>
              <Text style={styles.heroSubtitle}>
                Listen, match, and build confidence through quick practice rounds.
              </Text>
            </View>

            <View style={styles.heroModeCard}>
              <Text style={styles.heroModeValue}>{mode === "sound" ? "Sound" : "Match"}</Text>
              <Text style={styles.heroModeLabel}>mode</Text>
            </View>
          </View>

          <View style={styles.heroBottomRow}>
            <View style={styles.heroMiniPill}>
              <Text style={styles.heroMiniPillText}>{difficulty.toUpperCase()}</Text>
            </View>
            <View style={styles.heroMiniPillSoft}>
              <Text style={styles.heroMiniPillSoftText}>
                {recentResults.length ? `${recentAccuracy}% recent` : "warming up"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.langSection}>
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

        <View style={styles.kpiRow}>
          <View style={styles.kpiCardDark}>
            <Text style={styles.kpiDarkLabel}>Score</Text>
            <Text style={styles.kpiDarkValue}>{score}</Text>
            <Text style={styles.kpiDarkSub}>Keep the streak alive</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Level</Text>
            <Text style={styles.kpiValue}>{level}</Text>
            <Text style={styles.kpiSub}>{difficulty.toUpperCase()}</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Streak</Text>
            <Text style={styles.kpiValue}>{streak}</Text>
            <Text style={styles.kpiSub}>best run</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricWide}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Accuracy</Text>
              <Text style={styles.sectionHint}>
                {correct}/{attempts || 0}
              </Text>
            </View>
            <Text style={styles.metricBig}>{accuracy}%</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${clamp(accuracy, 0, 100)}%` }]} />
            </View>
          </View>

          <View style={styles.metricSmall}>
            <Text style={styles.metricSmallLabel}>Window</Text>
            <Text style={styles.metricSmallValue}>
              {recentResults.length ? `${recentAccuracy}%` : "—"}
            </Text>
            <Text style={styles.metricSmallSub}>
              {recentResults.length}/{ADAPTIVE_WINDOW}
            </Text>
          </View>
        </View>

        <View style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionLabel}>Question</Text>
            <View style={styles.questionTag}>
              <Text style={styles.questionTagText}>
                {mode === "sound" ? "Sound quiz" : "Match mode"}
              </Text>
            </View>
          </View>

          <Text style={styles.questionText}>
            {mode === "sound"
              ? "Listen and pick the English word"
              : "Match the English word"}
          </Text>

          <Pressable
            onPress={playQuestionAudio}
            style={({ pressed }) => [styles.playButton, pressed && styles.pressDown]}
          >
            <Text style={styles.playButtonText}>Play sound</Text>
            <Text style={styles.playButtonSub}>Target: {questionWordEn}</Text>
          </Pressable>

          <View style={styles.choiceList}>
            {choices.map((c) => {
              const id = Number((c as any)?.id ?? 0);
              const rawEn = String((c as any)?.en ?? "");

              const label =
                mode === "sound"
                  ? prettyWordLabel(rawEn, id)
                  : String((c as any)?.[lang] ?? "");

              const isCorrect = c?.id === (current as any)?.id;

              return (
                <Pressable
                  key={c.id}
                  disabled={locked}
                  onPress={() => onPick(c)}
                  style={({ pressed }) => [
                    styles.choiceCard,
                    locked && isCorrect && styles.choiceCardCorrect,
                    locked && !isCorrect && styles.choiceCardDim,
                    pressed && !locked && styles.pressDown,
                  ]}
                >
                  <Text style={styles.choiceCardText}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.controlsCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Controls</Text>
            <Text style={styles.sectionHint}>Round tools</Text>
          </View>

          <View style={styles.controlRow}>
            <Pressable
              disabled={locked}
              onPress={() => setMode((m) => (m === "sound" ? "match" : "sound"))}
              style={({ pressed }) => [
                styles.modeButton,
                locked && styles.disabledButton,
                pressed && !locked && styles.pressDown,
              ]}
            >
              <Text style={styles.modeButtonText}>
                Mode: {mode === "sound" ? "Sound Quiz" : "Match"}
              </Text>
              <Text style={styles.modeButtonSub}>
                {locked ? "Finish this question" : "Tap to switch"}
              </Text>
            </Pressable>

            <Pressable
              onPress={resetProgress}
              style={({ pressed }) => [styles.resetButton, pressed && styles.pressDown]}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>

      <ParentGateModal
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        onSuccess={() => {
          setGateOpen(false);
          if (pendingAction) pendingAction();
          setPendingAction(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  container: {
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 36,
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
    zIndex: 20,
    alignItems: "center",
  },
  sparkleText: {
    fontSize: 24,
  },

  badgeWrap: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 21,
    alignItems: "center",
  },
  badgeCard: {
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  badgeText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },

  confettiWrap: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    zIndex: 19,
    alignItems: "center",
  },
  confettiText: {
    fontSize: 26,
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
  heroModeCard: {
    width: 96,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e9edf5",
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  heroModeValue: {
    fontSize: 18,
    color: "#111111",
    fontWeight: "900",
    textAlign: "center",
  },
  heroModeLabel: {
    marginTop: 4,
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "lowercase",
  },
  heroBottomRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroMiniPill: {
    backgroundColor: "#111111",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroMiniPillText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 12,
  },
  heroMiniPillSoft: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e7ebf2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroMiniPillSoftText: {
    color: "#344054",
    fontWeight: "800",
    fontSize: 12,
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

  langSection: {
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

  kpiRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
  },
  kpiCardDark: {
    flex: 1.05,
    backgroundColor: "#111111",
    borderRadius: 24,
    padding: 16,
  },
  kpiDarkLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  kpiDarkValue: {
    marginTop: 10,
    color: "#ffffff",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },
  kpiDarkSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "700",
  },

  kpiCard: {
    flex: 0.9,
    backgroundColor: "#f7f8fa",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eceff4",
  },
  kpiLabel: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  kpiValue: {
    marginTop: 10,
    color: "#111111",
    fontSize: 28,
    fontWeight: "900",
  },
  kpiSub: {
    marginTop: 4,
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
  },

  metricsRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
  },
  metricWide: {
    flex: 1.2,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eceff4",
  },
  metricSmall: {
    flex: 0.8,
    backgroundColor: "#f7f8fa",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eceff4",
    justifyContent: "center",
  },
  metricBig: {
    marginTop: 10,
    color: "#111111",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },
  track: {
    marginTop: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#e8edf5",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#1864d9",
  },
  metricSmallLabel: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metricSmallValue: {
    marginTop: 10,
    color: "#111111",
    fontSize: 28,
    fontWeight: "900",
  },
  metricSmallSub: {
    marginTop: 4,
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
  },

  questionCard: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eceff4",
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  questionLabel: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  questionTag: {
    backgroundColor: "#f7f8fa",
    borderWidth: 1,
    borderColor: "#eceff4",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  questionTagText: {
    color: "#344054",
    fontSize: 12,
    fontWeight: "800",
  },
  questionText: {
    marginTop: 12,
    color: "#111111",
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
  },
  playButton: {
    marginTop: 16,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#111111",
    alignItems: "center",
  },
  playButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },
  playButtonSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "700",
  },

  choiceList: {
    marginTop: 14,
    gap: 12,
  },
  choiceCard: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e7ebf2",
    backgroundColor: "#ffffff",
  },
  choiceCardText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 16,
  },
  choiceCardCorrect: {
    borderColor: "#1864d9",
    backgroundColor: "#f5faff",
  },
  choiceCardDim: {
    opacity: 0.65,
  },

  controlsCard: {
    marginTop: 18,
    backgroundColor: "#f7f8fa",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eceff4",
  },
  controlRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12,
  },
  modeButton: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e7ebf2",
  },
  modeButtonText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 16,
  },
  modeButtonSub: {
    marginTop: 4,
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
  },
  resetButton: {
    width: 120,
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e7ebf2",
  },
  resetButtonText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.55,
  },

  pressDown: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});