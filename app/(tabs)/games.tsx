import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as speech from "expo-speech";
import * as haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { palette } from "../theme/palette";
import { colors, lang as langTheme, type LangKey } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radii } from "../theme/radii";
import { shadows } from "../theme/shadows";
import { duration, easing, pressScale } from "../theme/motion";

import { Text } from "../components/ui/Text";
import { Pill } from "../components/ui/Pill";
import { AudioButton } from "../components/ui/AudioButton";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Mascot } from "../components/illustrations/Mascot";
import { PatternBackdrop } from "../components/illustrations/PatternBackdrop";

import { flashcards } from "../data/flashcards";
import { playWordAudio } from "../utils/play-word-audio";
import { getDefaultLang } from "../hooks/useOnboarding";
import ParentGateModal from "../components/parentgate.modal";

type Mode = "sound" | "match";
type Difficulty = "easy" | "normal" | "hard";

const SCORE_KEY = "games_soundquiz_score_v1";
const STREAK_KEY = "games_soundquiz_streak_v1";
const ADAPTIVE_KEY = (lang: LangKey, mode: Mode) =>
  `games_adaptive_v1_${lang}_${mode}`;
const ADAPTIVE_WINDOW = 20;

const LANG_LABELS: Record<LangKey, string> = {
  yo: "Yoruba",
  ig: "Igbo",
  pg: "Pidgin",
};
const TTS_LANG: Record<LangKey, string> = {
  yo: "yo-NG",
  ig: "ig-NG",
  pg: "en-NG",
};

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function pickN<T>(a: T[], n: number): T[] {
  return shuffle(a).slice(0, n);
}

function computeLevel(streak: number) {
  if (streak >= 20) return 5;
  if (streak >= 14) return 4;
  if (streak >= 9) return 3;
  if (streak >= 5) return 2;
  return 1;
}
function difficultyForLevel(l: number): Difficulty {
  if (l >= 4) return "hard";
  if (l >= 2) return "normal";
  return "easy";
}
function choicesCount(d: Difficulty) {
  if (d === "hard") return 6;
  if (d === "normal") return 4;
  return 3;
}
function stepUp(d: Difficulty): Difficulty {
  return d === "easy" ? "normal" : "hard";
}
function stepDown(d: Difficulty): Difficulty {
  return d === "hard" ? "normal" : "easy";
}

function isPlaceholder(s: string) {
  return /^word_\d+$/i.test(String(s ?? ""));
}
function prettyWord(raw: string, id: number) {
  return isPlaceholder(raw) ? `Word ${id}` : String(raw ?? "");
}

function parseBoolArray(raw: string | null): boolean[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => !!x) : [];
  } catch {
    return [];
  }
}

export default function GamesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ lang?: string }>();

  const [lang, setLang] = useState<LangKey>("yo");
  const [mode, setMode] = useState<Mode>("sound");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [recent, setRecent] = useState<boolean[]>([]);

  const [questionId, setQuestionId] = useState<number>(
    () => Number((flashcards as readonly any[])[0]?.id ?? 1)
  );
  const [choices, setChoices] = useState<any[]>([]);
  const [locked, setLocked] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  const feedbackAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const p = params.lang;
      if (p === "yo" || p === "ig" || p === "pg") setLang(p);
      else setLang(await getDefaultLang());
    })();
  }, [params.lang]);

  const accent = langTheme[lang];

  const level = useMemo(() => computeLevel(streak), [streak]);
  const baseDiff = useMemo(() => difficultyForLevel(level), [level]);
  const recentAcc = useMemo(() => {
    if (!recent.length) return 0;
    return Math.round((recent.filter(Boolean).length / recent.length) * 100);
  }, [recent]);
  const difficulty = useMemo<Difficulty>(() => {
    if (recent.length < 8) return baseDiff;
    if (recentAcc >= 85) return stepUp(baseDiff);
    if (recentAcc <= 55) return stepDown(baseDiff);
    return baseDiff;
  }, [baseDiff, recent.length, recentAcc]);

  const accuracy = useMemo(() => {
    if (attempts <= 0) return 0;
    return Math.round((correct / attempts) * 100);
  }, [attempts, correct]);

  const current = useMemo(() => {
    return (
      (flashcards as readonly any[]).find((x) => Number(x.id) === questionId) ??
      (flashcards as readonly any[])[0]
    );
  }, [questionId]);

  const questionEn = useMemo(
    () => prettyWord(String(current?.en ?? ""), Number(current?.id ?? questionId)),
    [current, questionId]
  );
  const targetTr = String(current?.[lang] ?? "").trim();

  const loadStats = useCallback(async () => {
    try {
      const s = await AsyncStorage.getItem(SCORE_KEY);
      const st = await AsyncStorage.getItem(STREAK_KEY);
      if (s) setScore(parseInt(s, 10) || 0);
      if (st) setStreak(parseInt(st, 10) || 0);
    } catch {}
  }, []);

  const saveStats = useCallback(async (s: number, st: number) => {
    try {
      await AsyncStorage.setItem(SCORE_KEY, String(s));
      await AsyncStorage.setItem(STREAK_KEY, String(st));
    } catch {}
  }, []);

  const loadAdaptive = useCallback(async (l: LangKey, m: Mode) => {
    try {
      const raw = await AsyncStorage.getItem(ADAPTIVE_KEY(l, m));
      setRecent(parseBoolArray(raw).slice(-ADAPTIVE_WINDOW));
    } catch {
      setRecent([]);
    }
  }, []);

  const saveAdaptive = useCallback(
    async (l: LangKey, m: Mode, arr: boolean[]) => {
      try {
        await AsyncStorage.setItem(
          ADAPTIVE_KEY(l, m),
          JSON.stringify(arr.slice(-ADAPTIVE_WINDOW))
        );
      } catch {}
    },
    []
  );

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadAdaptive(lang, mode);
  }, [lang, mode, loadAdaptive]);

  const prime = useCallback(() => {
    const cnt = choicesCount(difficulty);
    const all = flashcards as readonly any[];
    const candidates = all.filter((c) => {
      const tr = String((c as any)?.[lang] ?? "").trim();
      return tr.length > 0 && !isPlaceholder(tr);
    });
    if (candidates.length === 0) return;

    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const others = candidates.filter((c) => Number(c.id) !== Number(target.id));
    const distractors = pickN(others, cnt - 1);
    const pool = shuffle([target, ...distractors]);

    setQuestionId(Number(target.id));
    setChoices(pool);
    setPicked(null);
    setLocked(false);
    setFeedback(null);
  }, [difficulty, lang]);

  useFocusEffect(
    useCallback(() => {
      prime();
      return () => {
        try {
          speech.stop();
        } catch {}
      };
    }, [prime])
  );

  useEffect(() => {
    prime();
  }, [lang, mode, prime]);

  const playQuestion = useCallback(async () => {
    setAudioPlaying(true);
    try {
      speech.stop();
    } catch {}
    try {
      await playWordAudio({
        lang,
        id: Number(current?.id ?? questionId),
        ttsText: targetTr || questionEn,
        ttsLang: TTS_LANG[lang],
        rate: lang === "pg" ? 0.95 : 0.85,
      });
    } catch {}
    setTimeout(() => setAudioPlaying(false), 2200);
  }, [lang, current, questionId, targetTr, questionEn]);

  useEffect(() => {
    if (mode === "sound") {
      const t = setTimeout(() => {
        playQuestion();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [mode, questionId, playQuestion]);

  const animateFeedback = (state: "correct" | "wrong") => {
    setFeedback(state);
    feedbackAnim.setValue(0);
    Animated.sequence([
      Animated.timing(feedbackAnim, {
        toValue: 1,
        duration: 280,
        easing: easing.emphasized,
        useNativeDriver: true,
      }),
      Animated.delay(state === "correct" ? 600 : 900),
      Animated.timing(feedbackAnim, {
        toValue: 0,
        duration: 200,
        easing: easing.standard,
        useNativeDriver: true,
      }),
    ]).start(() => setFeedback(null));
  };

  const handleChoice = async (choice: any) => {
    if (locked) return;
    setLocked(true);
    setPicked(Number(choice.id));

    const isCorrect = Number(choice.id) === Number(current?.id ?? questionId);
    const nextAttempts = attempts + 1;
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextScore = isCorrect ? score + 10 + Math.floor(streak / 3) : score;
    const nextStreak = isCorrect ? streak + 1 : 0;

    setAttempts(nextAttempts);
    setCorrect(nextCorrect);
    setScore(nextScore);
    setStreak(nextStreak);
    saveStats(nextScore, nextStreak);

    setRecent((prev) => {
      const next = [...prev, isCorrect].slice(-ADAPTIVE_WINDOW);
      saveAdaptive(lang, mode, next);
      return next;
    });

    try {
      haptics.notificationAsync(
        isCorrect
          ? haptics.NotificationFeedbackType.Success
          : haptics.NotificationFeedbackType.Warning
      );
    } catch {}

    animateFeedback(isCorrect ? "correct" : "wrong");

    if (isCorrect && mode === "match") {
      try {
        await playWordAudio({
          lang,
          id: Number(choice.id),
          ttsText: String(choice[lang] ?? ""),
          ttsLang: TTS_LANG[lang],
        });
      } catch {}
    }

    setTimeout(
      () => {
        prime();
      },
      isCorrect ? 900 : 1200
    );
  };

  const skip = () => {
    setStreak(0);
    saveStats(score, 0);
    prime();
  };

  const resetStats = async () => {
    setGateOpen(false);
    setScore(0);
    setStreak(0);
    setAttempts(0);
    setCorrect(0);
    setRecent([]);
    await saveStats(0, 0);
    try {
      await AsyncStorage.removeItem(ADAPTIVE_KEY(lang, mode));
    } catch {}
    Alert.alert("Reset", "Games progress cleared.");
  };

  return (
    <>
      {gateOpen ? (
        <ParentGateModal
          visible={gateOpen}
          onClose={() => setGateOpen(false)}
          onCancel={() => setGateOpen(false)}
          onSuccess={resetStats}
          onPassed={resetStats}
          title="parent gate"
          subtitle="solve the math to reset games progress"
        />
      ) : null}

      <View
        style={[
          styles.root,
          { backgroundColor: accent.surface, paddingTop: insets.top + spacing.sm },
        ]}
      >
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <PatternBackdrop
            variant="adire-dots"
            color={accent.primary}
            width={520}
            height={800}
            opacity={0.1}
          />
        </View>

        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.push("/(tabs)")}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={accent.primaryDeep} />
          </Pressable>

          <Pill
            label={`${LANG_LABELS[lang]} · ${lang.toUpperCase()}`}
            variant="solid"
            bg={accent.primary}
            color={palette.white}
          />

          <Pressable
            onPress={() => setGateOpen(true)}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <Ionicons name="refresh" size={22} color={accent.primaryDeep} />
          </Pressable>
        </View>

        <View style={styles.modeTabs}>
          <ModeTab
            label="Sound"
            icon="volume-high"
            active={mode === "sound"}
            accent={accent.primary}
            accentDeep={accent.primaryDeep}
            onPress={() => setMode("sound")}
          />
          <ModeTab
            label="Match"
            icon="git-compare"
            active={mode === "match"}
            accent={accent.primary}
            accentDeep={accent.primaryDeep}
            onPress={() => setMode("match")}
          />
        </View>

        <View style={styles.statsRow}>
          <StatChip icon="trophy" label="Score" value={String(score)} accent={accent.primary} />
          <StatChip icon="flame" label="Streak" value={String(streak)} accent={palette.clay} />
          <StatChip
            icon="speedometer"
            label="Accuracy"
            value={`${accuracy}%`}
            accent={palette.mint}
          />
        </View>

        <View style={styles.questionWrap}>
          {mode === "sound" ? (
            <View style={[styles.questionCard, shadows.lg]}>
              <Text variant="overline" tone="muted">Listen</Text>
              <View style={{ height: spacing.md }} />
              <AudioButton
                onPress={playQuestion}
                playing={audioPlaying}
                tint={accent.primary}
                size={92}
              />
              <View style={{ height: spacing.md }} />
              <Text variant="caption" tone="soft" align="center">
                Tap the speaker to hear the word again.{"\n"}Then pick what you heard.
              </Text>
            </View>
          ) : (
            <View style={[styles.questionCard, shadows.lg]}>
              <Text variant="overline" tone="muted">Pick the {LANG_LABELS[lang]} word for</Text>
              <Text variant="display3" align="center" style={{ marginTop: spacing.sm }}>
                {questionEn}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.choicesGrid}>
          {choices.map((c) => (
            <ChoiceCard
              key={c.id}
              choice={c}
              lang={lang}
              mode={mode}
              correctId={Number(current?.id ?? questionId)}
              picked={picked}
              locked={locked}
              accent={accent.primary}
              onPress={() => handleChoice(c)}
            />
          ))}
        </View>

        <View style={[styles.bottomRow, { paddingBottom: insets.bottom + 100 }]}>
          <Pressable
            onPress={skip}
            style={({ pressed }) => [
              styles.skipBtn,
              { backgroundColor: palette.white },
              pressed && { transform: [{ scale: pressScale.medium }] },
            ]}
            disabled={locked}
          >
            <Ionicons name="play-skip-forward" size={18} color={accent.primaryDeep} />
            <Text
              variant="button"
              style={{ color: accent.primaryDeep, marginLeft: spacing.xs }}
            >
              Skip
            </Text>
          </Pressable>
        </View>

        {feedback ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.feedbackOverlay,
              {
                opacity: feedbackAnim,
                transform: [
                  {
                    scale: feedbackAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.7, 1.05],
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.feedbackChip,
                {
                  backgroundColor:
                    feedback === "correct" ? palette.mint : palette.clay,
                },
              ]}
            >
              <Ionicons
                name={feedback === "correct" ? "checkmark-circle" : "close-circle"}
                size={28}
                color={palette.white}
              />
              <Text variant="title" style={{ color: palette.white, marginLeft: 8 }}>
                {feedback === "correct" ? "Nice one" : "Try again"}
              </Text>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </>
  );
}

function ModeTab({
  label,
  icon,
  active,
  accent,
  accentDeep,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  accent: string;
  accentDeep: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeTab,
        {
          backgroundColor: active ? accent : palette.white,
        },
        pressed && { transform: [{ scale: pressScale.light }] },
      ]}
    >
      <Ionicons name={icon} size={16} color={active ? palette.white : accentDeep} />
      <Text
        variant="button"
        style={{ color: active ? palette.white : accentDeep, marginLeft: 6 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatChip({
  icon,
  label,
  value,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={[styles.statChip, shadows.xs]}>
      <View style={[styles.statIcon, { backgroundColor: accent }]}>
        <Ionicons name={icon} size={14} color={palette.white} />
      </View>
      <View>
        <Text variant="overline" tone="muted" style={{ fontSize: 9 }}>
          {label}
        </Text>
        <Text variant="bodyStrong">{value}</Text>
      </View>
    </View>
  );
}

function ChoiceCard({
  choice,
  lang,
  mode,
  correctId,
  picked,
  locked,
  accent,
  onPress,
}: {
  choice: any;
  lang: LangKey;
  mode: Mode;
  correctId: number;
  picked: number | null;
  locked: boolean;
  accent: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to: number) =>
    Animated.timing(scale, {
      toValue: to,
      duration: duration.fast,
      easing: easing.standard,
      useNativeDriver: true,
    }).start();

  const id = Number(choice.id);
  const isPicked = picked === id;
  const isCorrect = id === correctId;

  let bg: string = palette.white;
  let border: string = palette.hairline;
  let fg: string = palette.ink;

  if (locked && isCorrect) {
    bg = palette.mint;
    border = palette.mintDeep;
    fg = palette.white;
  } else if (locked && isPicked && !isCorrect) {
    bg = palette.clay;
    border = palette.clayDeep;
    fg = palette.white;
  }

  const en = prettyWord(String(choice.en ?? ""), id);
  const tr = String(choice[lang] ?? "").trim();
  const display = mode === "sound" ? tr || en : tr || en;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, styles.choiceWrap]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => !locked && animate(pressScale.medium)}
        onPressOut={() => animate(1)}
        disabled={locked}
        style={[
          styles.choice,
          shadows.sm,
          { backgroundColor: bg, borderColor: border },
        ]}
      >
        <Text variant="bodyStrong" align="center" style={{ color: fg, fontSize: 16 }}>
          {display}
        </Text>
        {locked && isCorrect ? (
          <View style={styles.choiceTick}>
            <Ionicons name="checkmark" size={14} color={palette.white} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },

  modeTabs: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    flexDirection: "row",
    gap: spacing.sm,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
  },

  statsRow: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    flexDirection: "row",
    gap: spacing.sm,
  },
  statChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: palette.white,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
  },
  statIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  questionWrap: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  questionCard: {
    backgroundColor: palette.white,
    borderRadius: radii.xl2,
    padding: spacing.xl,
    alignItems: "center",
    minHeight: 180,
  },

  choicesGrid: {
    flex: 1,
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignContent: "flex-start",
  },
  choiceWrap: {
    width: "48.5%",
  },
  choice: {
    minHeight: 64,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  choiceTick: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.mintDeep,
    alignItems: "center",
    justifyContent: "center",
  },

  bottomRow: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    alignItems: "center",
  },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
  },

  feedbackOverlay: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  feedbackChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: radii.pill,
  },
});
