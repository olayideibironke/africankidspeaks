// app/(tabs)/games.tsx
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

import { colors } from "../theme";
import { flashcards } from "../data/flashcards";
import ParentGateModal from "../components/parentgate.modal";
import Watermark from "../components/watermark";
import { getsettings, type settings } from "../utils/settings";
import { playWordAudio, type AudioLang } from "../utils/play-word-audio";

type Mode = "sound" | "match";
type Difficulty = "easy" | "normal" | "hard";

const score_key = "games_soundquiz_score_v1";
const streak_key = "games_soundquiz_streak_v1";

// ✅ Adaptive difficulty (per lang + mode)
const adaptive_key = (lang: AudioLang, mode: Mode) =>
  `games_adaptive_v1_${lang}_${mode}`;
const ADAPTIVE_WINDOW = 20;

const BTN_DARK = "#000";
const BTN_DARK_TEXT = "#fff";

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

/**
 * ✅ Prevent placeholder strings like "word_77" from showing (UI).
 */
function isPlaceholderWord(raw: string) {
  return /^word_\d+$/i.test(String(raw ?? ""));
}
function prettyWordLabel(raw: string, id: number) {
  const s = String(raw ?? "");
  if (isPlaceholderWord(s)) return `Word ${id}`;
  return s;
}

/**
 * ✅ Safe text for TTS fallback (NEVER speak "word_###")
 * For sound quiz we speak the target translation (yo/ig/pg). If missing, speak a safe message.
 */
function safeTTSTextForSoundQuiz(tr: string, id: number) {
  const s = String(tr ?? "").trim();
  if (s) return s;
  return `Audio missing ${id}`;
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

  // ✅ pretty label for the target English word (UI only)
  const questionWordEn = useMemo(() => {
    const raw = String((current as any)?.en ?? "");
    return prettyWordLabel(raw, currentId);
  }, [current, currentId]);

  // ✅ target translation (what we WANT to speak in sound mode)
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

  const saveStats = useCallback(
    async (nextScore: number, nextStreak: number) => {
      try {
        await AsyncStorage.setItem(score_key, String(nextScore));
        await AsyncStorage.setItem(streak_key, String(nextStreak));
      } catch {}
    },
    []
  );

  const loadAdaptive = useCallback(async (l: AudioLang, m: Mode) => {
    try {
      const raw = await AsyncStorage.getItem(adaptive_key(l, m));
      setRecentResults(parseBoolArray(raw).slice(-ADAPTIVE_WINDOW));
    } catch {
      setRecentResults([]);
    }
  }, []);

  const saveAdaptive = useCallback(
    async (l: AudioLang, m: Mode, arr: boolean[]) => {
      try {
        await AsyncStorage.setItem(
          adaptive_key(l, m),
          JSON.stringify(arr.slice(-ADAPTIVE_WINDOW))
        );
      } catch {}
    },
    []
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, lang, mode, difficulty]);

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

    const ttsLang =
      lang === "yo" ? "yo-NG" : lang === "ig" ? "ig-NG" : "en-NG";

    const rate = lang === "pg" ? 0.95 : 0.85;

    await playWordAudio({
      lang,
      id: currentId,
      ttsText,
      ttsLang,
      rate,
    });
  }, [stopAudio, lang, currentId, targetTr, mode]);

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

        runSparkles();
        if (difficulty === "hard") runConfetti();

        const prevLevel = computeLevelFromStreak(streak);
        const nextLevel = computeLevelFromStreak(nextStreak);
        if (nextLevel > prevLevel) runConfetti();

        setTimeout(() => nextQuestion(), 450);
      } else {
        const nextStreak = 0;
        setStreak(nextStreak);
        await saveStats(score, nextStreak);
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
      runSparkles,
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

  return (
    <View style={styles.screen}>
      <View style={styles.watermarkWrap} pointerEvents="none">
        <Watermark />
      </View>

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

      <Animated.View
        pointerEvents="none"
        style={[
          styles.confetti,
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
        <Text style={styles.confettiText}>🎉🎊🎉🎊</Text>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.h1}>Games</Text>
        <Text style={styles.sub}>
          Pick the correct word • Lang: {lang.toUpperCase()}
        </Text>

        {LanguagePills}

        <View style={styles.topRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{level}</Text>
            <Text style={styles.statLabel}>Level</Text>
            <Text style={styles.statTiny}>{difficulty.toUpperCase()}</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statValue}>{accuracy}%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
            <Text style={styles.statTiny}>
              {correct}/{attempts}
            </Text>
          </View>
        </View>

        <View style={styles.adaptiveRow}>
          <Text style={styles.adaptiveText}>
            Adaptive:{" "}
            <Text style={{ fontWeight: "900", color: colors.text }}>
              {difficulty.toUpperCase()}
            </Text>
          </Text>
          <Text style={styles.adaptiveText}>
            Recent:{" "}
            <Text style={{ fontWeight: "900", color: colors.text }}>
              {recentResults.length ? `${recentAccuracy}%` : "—"}
            </Text>{" "}
            <Text style={styles.adaptiveTiny}>
              ({recentResults.length}/{ADAPTIVE_WINDOW})
            </Text>
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Question</Text>
          <Text style={styles.big}>
            {mode === "sound"
              ? "Listen and pick the English word"
              : "Match the English word"}
          </Text>

          <View style={{ height: 12 }} />

          <Pressable onPress={playQuestionAudio} style={styles.darkBtn}>
            <Text style={styles.darkText}>Play Sound</Text>
            <Text style={styles.darkSub}>Target: {questionWordEn}</Text>
          </Pressable>

          <View style={{ height: 10 }} />

          <View style={styles.choicesWrap}>
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
                  style={[
                    styles.choice,
                    locked && isCorrect && styles.choiceCorrect,
                    locked && !isCorrect && styles.choiceDim,
                  ]}
                >
                  <Text style={styles.choiceText}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.row}>
          <Pressable
            disabled={locked}
            onPress={() => setMode((m) => (m === "sound" ? "match" : "sound"))}
            style={[styles.btn, styles.btnSecondary, locked && { opacity: 0.5 }]}
          >
            <Text style={styles.btnSecondaryText}>
              Mode: {mode === "sound" ? "Sound Quiz" : "Match"}
            </Text>
            <Text style={styles.btnHint}>
              {locked ? "Finish this question" : "Tap to toggle"}
            </Text>
          </Pressable>

          <Pressable
            onPress={resetProgress}
            style={[styles.btn, styles.btnGhost]}
          >
            <Text style={styles.btnGhostText}>Reset</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
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
  screen: { flex: 1, backgroundColor: colors.background },
  watermarkWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
  },
  container: { padding: 20, paddingBottom: 40, zIndex: 1 },

  h1: { fontSize: 26, fontWeight: "900", color: colors.text },
  sub: { marginTop: 6, color: colors.muted },

  langRow: { marginTop: 12, flexDirection: "row", gap: 10 as any },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: (colors as any).border ?? "#e5e5e5",
    backgroundColor: (colors as any).card ?? "#f6f6f6",
  },
  pillOn: { borderColor: colors.primary, backgroundColor: colors.background },
  pillText: { color: colors.muted, fontWeight: "900" },
  pillTextOn: { color: colors.primary },

  topRow: { marginTop: 14, flexDirection: "row", gap: 10 as any },
  statBox: {
    flex: 1,
    backgroundColor: (colors as any).card ?? "#f6f6f6",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: (colors as any).border ?? "#e5e5e5",
  },
  statValue: { color: colors.text, fontWeight: "900", fontSize: 20 },
  statLabel: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  statTiny: { marginTop: 6, color: colors.muted, fontSize: 11 },

  adaptiveRow: {
    marginTop: 10,
    paddingHorizontal: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10 as any,
  },
  adaptiveText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  adaptiveTiny: { color: colors.muted, fontSize: 11, fontWeight: "700" },

  card: {
    marginTop: 12,
    backgroundColor: (colors as any).card ?? "#f6f6f6",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: (colors as any).border ?? "#e5e5e5",
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  big: { marginTop: 6, color: colors.text, fontSize: 16, fontWeight: "900" },

  darkBtn: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: BTN_DARK,
    borderWidth: 1,
    borderColor: BTN_DARK,
    alignItems: "center",
  },
  darkText: { color: BTN_DARK_TEXT, fontWeight: "900" },
  darkSub: {
    marginTop: 3,
    color: BTN_DARK_TEXT,
    opacity: 0.85,
    fontSize: 12,
    fontWeight: "800",
  },

  btn: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: (colors as any).border ?? "#e5e5e5",
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondary: { backgroundColor: colors.background },
  btnSecondaryText: { color: colors.text, fontWeight: "900" },
  btnGhost: { backgroundColor: "transparent" },
  btnGhostText: { color: colors.text, fontWeight: "900" },
  btnHint: { marginTop: 3, color: colors.muted, fontSize: 12 },

  choicesWrap: { marginTop: 10, gap: 10 as any },
  choice: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: (colors as any).border ?? "#e5e5e5",
    backgroundColor: colors.background,
  },
  choiceText: { color: colors.text, fontWeight: "900", fontSize: 16 },
  choiceCorrect: { borderColor: colors.primary },
  choiceDim: { opacity: 0.65 },

  row: { marginTop: 12, flexDirection: "row", gap: 10 as any },

  sparkles: {
    position: "absolute",
    top: 90,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 3,
  },
  sparkleText: { fontSize: 26 },

  confetti: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 4,
  },
  confettiText: { fontSize: 28 },
});
