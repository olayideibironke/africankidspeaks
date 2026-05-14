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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme";
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

function themeForLang(lang: AudioLang) {
  if (lang === "yo") {
    return {
      page: "#73D7FF",
      hero: "#6f5cff",
      heroSoft: "#eee9ff",
      accent: "#ff9f43",
      accentDark: "#ef7e1a",
      pill: "#7f6cff",
      pillSoft: "#f2efff",
      text: "#2d2355",
      muted: "#7c7599",
      card: "#ffffff",
      cardAlt: "#fff3d6",
      cardAltBorder: "#ffd98a",
      correct: "#e8fff4",
      correctBorder: "#53d396",
      orbA: "#ffd76e",
      orbB: "#9bdfff",
      orbC: "#ff9ac8",
      mascot: "🦁",
      ribbon: "#6f5cff",
      ribbonDark: "#5440ea",
      ribbonSoft: "#eee9ff",
    };
  }

  if (lang === "ig") {
    return {
      page: "#73D7FF",
      hero: "#13ae73",
      heroSoft: "#e7fff3",
      accent: "#19b67b",
      accentDark: "#0d8f5e",
      pill: "#12a56d",
      pillSoft: "#e9fff3",
      text: "#17392d",
      muted: "#5d8071",
      card: "#ffffff",
      cardAlt: "#ecfff5",
      cardAltBorder: "#98e4be",
      correct: "#eafff3",
      correctBorder: "#48c888",
      orbA: "#9cf0c1",
      orbB: "#ffe07e",
      orbC: "#9ad8ff",
      mascot: "🌟",
      ribbon: "#19b67b",
      ribbonDark: "#0e965f",
      ribbonSoft: "#e9fff3",
    };
  }

  return {
    page: "#73D7FF",
    hero: "#ff6f61",
    heroSoft: "#fff0eb",
    accent: "#ff7f50",
    accentDark: "#e85d37",
    pill: "#ff826b",
    pillSoft: "#fff0eb",
    text: "#522c2a",
    muted: "#8d6a69",
    card: "#ffffff",
    cardAlt: "#fff1e8",
    cardAltBorder: "#ffcba8",
    correct: "#fff7db",
    correctBorder: "#ffc85f",
    orbA: "#ffc190",
    orbB: "#9bdfff",
    orbC: "#ff9fc0",
    mascot: "🦜",
    ribbon: "#ff7f50",
    ribbonDark: "#e25f31",
    ribbonSoft: "#fff0e8",
  };
}

export default function GamesScreen() {
  const params = useLocalSearchParams<{ lang?: string }>();
  const initialLang = (params.lang as AudioLang) || "yo";
  const insets = useSafeAreaInsets();

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
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [feedbackText, setFeedbackText] = useState<string>("");

  useEffect(() => {
    const p = params.lang as string | undefined;
    if (p === "yo" || p === "ig" || p === "pg") setLang(p);
  }, [params.lang]);

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2400,
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1600,
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

  const level = useMemo(() => computeLevelFromStreak(streak), [streak]);
  const baseDifficulty = useMemo(() => difficultyForLevel(level), [level]);
  const theme = useMemo(() => themeForLang(lang), [lang]);

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

  const runGoodFeedback = useCallback(
    (text: string) => {
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
    },
    [sparkleAnim, badgeAnim]
  );

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

  const mascotBob = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const mascotScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const sparkleRise = sparkleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, -10],
  });

  return (
    <View style={[styles.screen, { backgroundColor: theme.page }]}>
      <View style={[styles.bgGlowTop, { backgroundColor: colors.primary }]} />
      <View style={[styles.bgGlowRight, { backgroundColor: colors.sky }]} />
      <View style={[styles.bgGlowBottom, { backgroundColor: colors.pink }]} />
      <View style={styles.bgGlowCenter} />

      <View style={[styles.bgOrbTop, { backgroundColor: theme.orbA }]} />
      <View style={[styles.bgOrbRight, { backgroundColor: theme.orbB }]} />
      <View style={[styles.bgOrbBottom, { backgroundColor: theme.orbC }]} />

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
                  outputRange: [0.75, 1.18],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.sparkleText}>✨ Awesome! ✨</Text>
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
        <View style={[styles.badgeCard, { backgroundColor: theme.accent }]}>
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
                  outputRange: [-16, 38],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.confettiText}>🎉 🎊 🌟 🎉</Text>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 36,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRibbonRow}>
          <View
            style={[
              styles.headerRibbon,
              {
                backgroundColor: theme.ribbonSoft,
                borderColor: theme.ribbon,
              },
            ]}
          >
            <View
              style={[
                styles.headerRibbonCap,
                { backgroundColor: theme.ribbonDark },
              ]}
            />
            <Text style={[styles.headerRibbonEmoji, { color: theme.ribbonDark }]}>
              🎮
            </Text>
            <Text style={[styles.headerRibbonText, { color: theme.ribbonDark }]}>
              games
            </Text>
          </View>
        </View>

        <View style={[styles.hero, { backgroundColor: theme.hero }]}>
          <View style={[styles.heroBubbleOne, { backgroundColor: theme.orbA }]} />
          <View style={[styles.heroBubbleTwo, { backgroundColor: theme.orbB }]} />
          <View style={[styles.heroBubbleThree, { backgroundColor: theme.orbC }]} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroTextWrap}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{titleForLang(lang)}</Text>
              </View>

              <Text style={styles.heroTitle}>Play and learn</Text>
              <Text style={styles.heroSubtitle}>
                Listen, tap, and grow your word power with quick colorful rounds.
              </Text>
            </View>

            <Animated.View
              style={[
                styles.heroMascotWrap,
                {
                  transform: [{ translateY: mascotBob }, { scale: mascotScale }],
                },
              ]}
            >
              <Text style={styles.heroMascot}>{theme.mascot}</Text>
            </Animated.View>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroModeCard}>
              <Text style={styles.heroModeValue}>
                {mode === "sound" ? "Sound" : "Match"}
              </Text>
              <Text style={styles.heroModeLabel}>mode</Text>
            </View>

            <View style={styles.heroModeCard}>
              <Text style={styles.heroModeValue}>{difficulty.toUpperCase()}</Text>
              <Text style={styles.heroModeLabel}>level</Text>
            </View>

            <View style={styles.heroModeCard}>
              <Text style={styles.heroModeValue}>
                {recentResults.length ? `${recentAccuracy}%` : "New"}
              </Text>
              <Text style={styles.heroModeLabel}>recent</Text>
            </View>
          </View>
        </View>

        <View style={styles.langSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pick a language</Text>
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
                    {
                      backgroundColor: "#ffffff",
                      borderColor: "#ffffff",
                    },
                    selected && {
                      backgroundColor: theme.pill,
                      borderColor: theme.pill,
                    },
                    pressed && styles.pressDown,
                  ]}
                >
                  <Text
                    style={[
                      styles.langPillText,
                      { color: selected ? "#ffffff" : theme.text },
                    ]}
                  >
                    {shortForLang(k)}
                  </Text>
                  <Text
                    style={[
                      styles.langPillSub,
                      { color: selected ? "rgba(255,255,255,0.82)" : theme.muted },
                    ]}
                  >
                    {k === "yo" ? "Yoruba" : k === "ig" ? "Igbo" : "Pidgin"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpiCardBig, { backgroundColor: theme.accent }]}>
            <Text style={styles.kpiBigLabel}>Score</Text>
            <Text style={styles.kpiBigValue}>{score}</Text>
            <Text style={styles.kpiBigSub}>Keep the fun going</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.heroSoft }]}>
            <Text style={[styles.kpiLabel, { color: theme.muted }]}>Level</Text>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{level}</Text>
            <Text style={[styles.kpiSub, { color: theme.muted }]}>
              {difficulty.toUpperCase()}
            </Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: "#ffffff" }]}>
            <Text style={[styles.kpiLabel, { color: theme.muted }]}>Streak</Text>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{streak}</Text>
            <Text style={[styles.kpiSub, { color: theme.muted }]}>best run</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={[styles.metricWide, { backgroundColor: "#ffffff" }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.metricTitle}>Accuracy</Text>
              <Text style={styles.metricHint}>
                {correct}/{attempts || 0}
              </Text>
            </View>

            <Text style={[styles.metricBig, { color: theme.text }]}>{accuracy}%</Text>

            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${clamp(accuracy, 0, 100)}%`,
                    backgroundColor: theme.pill,
                  },
                ]}
              />
            </View>
          </View>

          <View
            style={[
              styles.metricSmall,
              { backgroundColor: theme.cardAlt, borderColor: theme.cardAltBorder },
            ]}
          >
            <Text style={[styles.metricSmallLabel, { color: theme.muted }]}>Window</Text>
            <Text style={[styles.metricSmallValue, { color: theme.text }]}>
              {recentResults.length ? `${recentAccuracy}%` : "—"}
            </Text>
            <Text style={[styles.metricSmallSub, { color: theme.muted }]}>
              {recentResults.length}/{ADAPTIVE_WINDOW}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.questionCard,
            { backgroundColor: theme.cardAlt, borderColor: theme.cardAltBorder },
          ]}
        >
          <View style={styles.questionHeader}>
            <View>
              <Text style={[styles.questionLabel, { color: theme.muted }]}>Round</Text>
              <Text style={[styles.questionText, { color: theme.text }]}>
                {mode === "sound"
                  ? "Listen and pick the English word"
                  : "Match the translation"}
              </Text>
            </View>

            <View style={[styles.questionTag, { backgroundColor: "#ffffff" }]}>
              <Text style={[styles.questionTagText, { color: theme.text }]}>
                {mode === "sound" ? "Sound quiz" : "Match mode"}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={playQuestionAudio}
            style={({ pressed }) => [
              styles.playButton,
              {
                backgroundColor: theme.hero,
                borderColor: theme.hero,
              },
              pressed && styles.pressDown,
            ]}
          >
            <Text style={styles.playButtonEmoji}>🔊</Text>
            <Text style={styles.playButtonText}>Play sound</Text>
            <Text style={styles.playButtonSub}>
              {mode === "sound" ? "Hear the word, then choose" : `Target: ${questionWordEn}`}
            </Text>
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
                    {
                      backgroundColor: "#ffffff",
                      borderColor: "#ffffff",
                    },
                    locked &&
                      isCorrect && {
                        backgroundColor: theme.correct,
                        borderColor: theme.correctBorder,
                      },
                    locked && !isCorrect && styles.choiceCardDim,
                    pressed && !locked && styles.pressDown,
                  ]}
                >
                  <Text style={styles.choiceEmoji}>
                    {mode === "sound" ? "🎯" : "🧩"}
                  </Text>
                  <Text style={[styles.choiceCardText, { color: theme.text }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.controlsCard, { backgroundColor: theme.heroSoft }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Game tools</Text>
            <Text style={styles.sectionHint}>Round controls</Text>
          </View>

          <View style={styles.controlRow}>
            <Pressable
              disabled={locked}
              onPress={() => setMode((m) => (m === "sound" ? "match" : "sound"))}
              style={({ pressed }) => [
                styles.modeButton,
                {
                  backgroundColor: "#ffffff",
                  borderColor: "#ffffff",
                },
                locked && styles.disabledButton,
                pressed && !locked && styles.pressDown,
              ]}
            >
              <Text style={[styles.modeButtonText, { color: theme.text }]}>
                Mode: {mode === "sound" ? "Sound Quiz" : "Match"}
              </Text>
              <Text style={[styles.modeButtonSub, { color: theme.muted }]}>
                {locked ? "Finish this question" : "Tap to switch"}
              </Text>
            </Pressable>

            <Pressable
              onPress={resetProgress}
              style={({ pressed }) => [
                styles.resetButton,
                {
                  backgroundColor: "#ffffff",
                  borderColor: "#ffffff",
                },
                pressed && styles.pressDown,
              ]}
            >
              <Text style={[styles.resetButtonText, { color: theme.text }]}>Reset</Text>
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
  },

  bgGlowTop: {
    position: "absolute",
    top: -36,
    left: -24,
    width: 190,
    height: 190,
    borderRadius: 999,
    opacity: 0.22,
  },
  bgGlowRight: {
    position: "absolute",
    top: 170,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 999,
    opacity: 0.18,
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: 120,
    left: -38,
    width: 190,
    height: 190,
    borderRadius: 999,
    opacity: 0.18,
  },
  bgGlowCenter: {
    position: "absolute",
    top: 360,
    left: "36%",
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "#ffd76e",
    opacity: 0.16,
  },

  bgOrbTop: {
    position: "absolute",
    top: 92,
    left: -30,
    width: 128,
    height: 128,
    borderRadius: 999,
    opacity: 0.12,
  },
  bgOrbRight: {
    position: "absolute",
    top: 220,
    right: -32,
    width: 150,
    height: 150,
    borderRadius: 999,
    opacity: 0.12,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: 120,
    left: -24,
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
    marginBottom: 12,
  },
  headerRibbon: {
    minWidth: 136,
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
    top: 86,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: "center",
  },
  sparkleText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
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
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  badgeText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },

  confettiWrap: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    zIndex: 19,
    alignItems: "center",
  },
  confettiText: {
    fontSize: 26,
  },

  hero: {
    marginTop: 2,
    borderRadius: 34,
    padding: 20,
    overflow: "hidden",
  },
  heroBubbleOne: {
    position: "absolute",
    width: 122,
    height: 122,
    borderRadius: 999,
    top: -26,
    right: -10,
    opacity: 0.3,
  },
  heroBubbleTwo: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 999,
    bottom: 20,
    right: 26,
    opacity: 0.22,
  },
  heroBubbleThree: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 999,
    left: -30,
    bottom: -42,
    opacity: 0.2,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
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
    maxWidth: 250,
  },
  heroMascotWrap: {
    width: 82,
    height: 82,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroMascot: {
    fontSize: 35,
  },
  heroMetaRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  heroModeCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  heroModeValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  heroModeLabel: {
    marginTop: 4,
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "lowercase",
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

  metricTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2d2355",
  },
  metricHint: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7c7599",
  },

  langSection: {
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
    fontWeight: "900",
    fontSize: 15,
  },
  langPillSub: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "800",
  },

  kpiRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
  },
  kpiCardBig: {
    flex: 1.05,
    borderRadius: 28,
    padding: 16,
  },
  kpiBigLabel: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  kpiBigValue: {
    marginTop: 10,
    color: "#ffffff",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },
  kpiBigSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontWeight: "700",
  },
  kpiCard: {
    flex: 0.9,
    borderRadius: 28,
    padding: 16,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  kpiValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: "900",
  },
  kpiSub: {
    marginTop: 4,
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
    borderRadius: 28,
    padding: 16,
  },
  metricSmall: {
    flex: 0.8,
    borderRadius: 28,
    padding: 16,
    borderWidth: 2,
    justifyContent: "center",
  },
  metricBig: {
    marginTop: 10,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },
  track: {
    marginTop: 12,
    height: 14,
    borderRadius: 999,
    backgroundColor: "#ece8fb",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
  metricSmallLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  metricSmallValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: "900",
  },
  metricSmallSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },

  questionCard: {
    marginTop: 18,
    borderRadius: 32,
    padding: 18,
    borderWidth: 2,
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  questionLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  questionTag: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  questionTagText: {
    fontSize: 12,
    fontWeight: "900",
  },
  questionText: {
    marginTop: 6,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    maxWidth: 250,
  },

  playButton: {
    marginTop: 16,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 2,
    alignItems: "center",
  },
  playButtonEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  playButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },
  playButtonSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  choiceList: {
    marginTop: 14,
    gap: 12,
  },
  choiceCard: {
    minHeight: 64,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  choiceEmoji: {
    fontSize: 20,
  },
  choiceCardText: {
    flex: 1,
    fontWeight: "900",
    fontSize: 16,
  },
  choiceCardDim: {
    opacity: 0.6,
  },

  controlsCard: {
    marginTop: 18,
    borderRadius: 30,
    padding: 18,
  },
  controlRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12,
  },
  modeButton: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 2,
  },
  modeButtonText: {
    fontWeight: "900",
    fontSize: 16,
  },
  modeButtonSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  resetButton: {
    width: 120,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  resetButtonText: {
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
