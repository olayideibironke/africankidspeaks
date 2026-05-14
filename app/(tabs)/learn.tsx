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
import {
  getLearnedSetForLang,
  toggleLearnedForLang,
} from "../utils/learned";
import { playWordAudio } from "../utils/play-word-audio";
import { getDefaultLang } from "../hooks/useOnboarding";

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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function prettyWord(raw: string, id: number) {
  const s = String(raw ?? "");
  if (/^word_\d+$/i.test(s)) return `Word ${id}`;
  return s;
}

export default function LearnTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ lang?: string }>();

  const [lang, setLang] = useState<LangKey>("yo");
  const [revealed, setRevealed] = useState(false);
  const [learnedSet, setLearnedSet] = useState<Set<number>>(new Set());
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const flip = useRef(new Animated.Value(0)).current;
  const swipe = useRef(new Animated.Value(0)).current;
  const celebrate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const p = params.lang;
      if (p === "yo" || p === "ig" || p === "pg") {
        setLang(p);
        return;
      }
      const d = await getDefaultLang();
      setLang(d);
    })();
  }, [params.lang]);

  useEffect(() => {
    const ids = (flashcards as readonly any[])
      .map((c) => Number(c.id))
      .filter((n) => Number.isFinite(n));
    setOrder(shuffle(ids));
    setIdx(0);
    setRevealed(false);
  }, []);

  const refresh = useCallback(async () => {
    const set = await getLearnedSetForLang(lang);
    setLearnedSet(new Set(set));
  }, [lang]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {
        try {
          speech.stop();
        } catch {}
      };
    }, [refresh])
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentId =
    order[idx] ?? Number((flashcards as readonly any[])[0]?.id ?? 1);

  const current = useMemo(() => {
    return (
      (flashcards as readonly any[]).find(
        (c) => Number(c.id) === Number(currentId)
      ) ?? (flashcards as readonly any[])[0]
    );
  }, [currentId]);

  const total = order.length || flashcards.length;
  const idNum = Number(current?.id ?? currentId);
  const en = useMemo(
    () => prettyWord(String(current?.en ?? ""), idNum),
    [current, idNum]
  );
  const tr = String(current?.[lang] ?? "");
  const category = String(current?.category ?? "");
  const isLearned = learnedSet.has(idNum);

  const accent = langTheme[lang];

  const play = useCallback(async () => {
    setAudioPlaying(true);
    try {
      speech.stop();
    } catch {}
    const text = revealed ? tr || en : tr || en;
    if (!text) {
      setAudioPlaying(false);
      return;
    }
    try {
      await playWordAudio({
        lang,
        id: idNum,
        ttsText: text,
        ttsLang: TTS_LANG[lang],
        rate: lang === "pg" ? 0.95 : 0.85,
      });
    } catch {}
    setTimeout(() => setAudioPlaying(false), 2200);
  }, [revealed, tr, en, lang, idNum]);

  const animateFlip = useCallback(() => {
    Animated.timing(flip, {
      toValue: revealed ? 0 : 1,
      duration: 320,
      easing: easing.emphasized,
      useNativeDriver: true,
    }).start();
    setRevealed((v) => !v);
    try {
      haptics.selectionAsync();
    } catch {}
  }, [flip, revealed]);

  const goNext = useCallback(() => {
    Animated.sequence([
      Animated.timing(swipe, {
        toValue: -40,
        duration: 200,
        easing: easing.accel,
        useNativeDriver: true,
      }),
      Animated.timing(swipe, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();
    flip.setValue(0);
    setRevealed(false);
    setIdx((v) => (v + 1 >= total ? 0 : v + 1));
  }, [swipe, flip, total]);

  const goPrev = useCallback(() => {
    Animated.sequence([
      Animated.timing(swipe, {
        toValue: 40,
        duration: 200,
        easing: easing.accel,
        useNativeDriver: true,
      }),
      Animated.timing(swipe, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();
    flip.setValue(0);
    setRevealed(false);
    setIdx((v) => (v - 1 < 0 ? total - 1 : v - 1));
  }, [swipe, flip, total]);

  const toggleLearned = useCallback(async () => {
    const wasLearned = learnedSet.has(idNum);
    const next = await toggleLearnedForLang(lang, idNum);
    setLearnedSet(new Set(next));

    try {
      haptics.notificationAsync(
        wasLearned
          ? haptics.NotificationFeedbackType.Warning
          : haptics.NotificationFeedbackType.Success
      );
    } catch {}

    if (!wasLearned) {
      celebrate.setValue(0);
      Animated.sequence([
        Animated.timing(celebrate, {
          toValue: 1,
          duration: 280,
          easing: easing.emphasized,
          useNativeDriver: true,
        }),
        Animated.delay(700),
        Animated.timing(celebrate, {
          toValue: 0,
          duration: 220,
          easing: easing.standard,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [learnedSet, idNum, lang, celebrate]);

  const reshuffleDeck = () => {
    const ids = (flashcards as readonly any[])
      .map((c) => Number(c.id))
      .filter((n) => Number.isFinite(n));
    setOrder(shuffle(ids));
    setIdx(0);
    setRevealed(false);
    flip.setValue(0);
    Alert.alert("Shuffled", "New deck order ready.");
  };

  const frontRotate = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotate = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });
  const frontOpacity = flip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });
  const backOpacity = flip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
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
          onPress={reshuffleDeck}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <Ionicons name="shuffle" size={22} color={accent.primaryDeep} />
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressMeta}>
          <Text variant="caption" tone="soft">
            {idx + 1} / {total}
          </Text>
          <Text variant="caption" tone="soft">
            {learnedSet.size} learned
          </Text>
        </View>
        <ProgressBar
          value={idx + 1}
          max={total}
          fillColor={accent.primary}
          trackColor="rgba(27, 20, 40, 0.08)"
          height={6}
        />
      </View>

      <View style={styles.cardArea}>
        <Animated.View
          style={{ transform: [{ translateX: swipe }] }}
          collapsable={false}
        >
          <Pressable onPress={animateFlip} accessibilityRole="button">
            <View style={styles.flipWrap}>
              <Animated.View
                style={[
                  styles.card,
                  shadows.lg,
                  {
                    backgroundColor: palette.white,
                    transform: [{ perspective: 1000 }, { rotateY: frontRotate }],
                    opacity: frontOpacity,
                  },
                ]}
              >
                <CardContent
                  eyebrow={category.toUpperCase()}
                  big={tr || prettyWord(en, idNum)}
                  small={`Tap to reveal English`}
                  accent={accent.primary}
                  accentDeep={accent.primaryDeep}
                  isLearned={isLearned}
                />
              </Animated.View>

              <Animated.View
                style={[
                  styles.card,
                  styles.cardBack,
                  shadows.lg,
                  {
                    backgroundColor: accent.surface,
                    transform: [{ perspective: 1000 }, { rotateY: backRotate }],
                    opacity: backOpacity,
                  },
                ]}
              >
                <CardContent
                  eyebrow="ENGLISH"
                  big={en}
                  small={tr ? `${tr} · ${LANG_LABELS[lang]}` : LANG_LABELS[lang]}
                  accent={accent.primary}
                  accentDeep={accent.primaryDeep}
                  isLearned={isLearned}
                  flipped
                />
              </Animated.View>
            </View>
          </Pressable>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.celebrate,
            {
              opacity: celebrate,
              transform: [
                {
                  scale: celebrate.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1.1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.celebrateChip, { backgroundColor: accent.primary }]}>
            <Ionicons name="checkmark-circle" size={18} color={palette.white} />
            <Text variant="bodyStrong" style={{ color: palette.white }}>Learned</Text>
          </View>
        </Animated.View>

        <View style={styles.audioWrap}>
          <AudioButton
            onPress={play}
            playing={audioPlaying}
            tint={accent.primary}
            size={72}
            accessibilityLabel={`Play ${tr || en}`}
          />
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 100 }]}>
        <NavButton icon="chevron-back" onPress={goPrev} accent={accent.primary} />

        <Pressable
          onPress={toggleLearned}
          style={({ pressed }) => [
            styles.learnedButton,
            {
              backgroundColor: isLearned ? accent.primary : palette.white,
              borderColor: isLearned ? accent.primary : palette.hairline,
            },
            pressed && { transform: [{ scale: pressScale.medium }] },
          ]}
        >
          <Ionicons
            name={isLearned ? "checkmark-circle" : "ellipse-outline"}
            size={20}
            color={isLearned ? palette.white : accent.primaryDeep}
          />
          <Text
            variant="button"
            style={{
              color: isLearned ? palette.white : accent.primaryDeep,
              marginLeft: spacing.xs,
            }}
          >
            {isLearned ? "Learned" : "Mark learned"}
          </Text>
        </Pressable>

        <NavButton icon="chevron-forward" onPress={goNext} accent={accent.primary} />
      </View>
    </View>
  );
}

function CardContent({
  eyebrow,
  big,
  small,
  accent,
  accentDeep,
  isLearned,
  flipped,
}: {
  eyebrow: string;
  big: string;
  small: string;
  accent: string;
  accentDeep: string;
  isLearned: boolean;
  flipped?: boolean;
}) {
  return (
    <View style={styles.cardInner}>
      {isLearned ? (
        <View style={[styles.learnedTick, { backgroundColor: accent }]}>
          <Ionicons name="checkmark" size={14} color={palette.white} />
        </View>
      ) : null}

      <Text
        variant="overline"
        tone="muted"
        style={{ color: flipped ? accentDeep : palette.slate, opacity: 0.8 }}
      >
        {eyebrow || "—"}
      </Text>

      <View style={styles.bigWrap}>
        <Text
          variant="display1"
          align="center"
          style={{
            color: flipped ? accentDeep : palette.ink,
            fontSize: big.length > 14 ? 36 : big.length > 8 ? 48 : 56,
          }}
          numberOfLines={2}
        >
          {big}
        </Text>
      </View>

      <Text variant="subtitle" tone="soft" align="center" style={{ marginTop: spacing.sm }}>
        {small}
      </Text>
    </View>
  );
}

function NavButton({
  icon,
  onPress,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navBtn,
        shadows.sm,
        { backgroundColor: palette.white },
        pressed && { transform: [{ scale: pressScale.medium }] },
      ]}
      hitSlop={6}
    >
      <Ionicons name={icon} size={26} color={accent} />
    </Pressable>
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

  progressWrap: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  cardArea: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
    alignItems: "stretch",
  },
  flipWrap: {
    width: "100%",
    aspectRatio: 0.78,
    maxHeight: 460,
    alignSelf: "center",
    position: "relative",
  },
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.xl3,
    padding: spacing.xl2,
    backfaceVisibility: "hidden",
    overflow: "hidden",
  },
  cardBack: {},
  cardInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bigWrap: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  learnedTick: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  celebrate: {
    position: "absolute",
    top: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  celebrateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },

  audioWrap: {
    alignItems: "center",
    marginTop: spacing.xl,
  },

  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  navBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  learnedButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1.5,
    paddingVertical: spacing.md,
  },
});
