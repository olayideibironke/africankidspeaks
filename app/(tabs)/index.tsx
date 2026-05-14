import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { palette } from "../theme/palette";
import { colors, lang as langTheme, type LangKey } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radii } from "../theme/radii";
import { shadows } from "../theme/shadows";
import { duration, easing, pressScale } from "../theme/motion";

import { Screen } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Pill } from "../components/ui/Pill";
import { ProgressBar } from "../components/ui/ProgressBar";
import { AudioButton } from "../components/ui/AudioButton";
import { Mascot } from "../components/illustrations/Mascot";
import { PatternBackdrop } from "../components/illustrations/PatternBackdrop";

import { flashcards } from "../data/flashcards";
import { audiomap } from "../data/audiomap.generated";
import {
  clearLearnedForLang,
  getLearnedSetForLang,
  type LearnedLang,
} from "../utils/learned";
import { playWordAudio } from "../utils/play-word-audio";
import { getDefaultLang, setDefaultLang } from "../hooks/useOnboarding";

import ParentGateModal from "../components/parentgate.modal";

type Lang = LangKey;

const LANG_LABELS: Record<Lang, string> = {
  yo: "Yoruba",
  ig: "Igbo",
  pg: "Pidgin",
};

const LANG_GREETING: Record<Lang, { native: string; ttsLang: string }> = {
  yo: { native: "Báwo", ttsLang: "yo-NG" },
  ig: { native: "Ndewo", ttsLang: "ig-NG" },
  pg: { native: "How far", ttsLang: "en-NG" },
};

const HOME_LAST_PCT_KEY = (lang: Lang) => `home_last_pct_v1_${lang}`;
const DAILY_WORD_KEY = "home_daily_word_v1";

function hitMilestone(prev: number, next: number): number | null {
  for (const g of [25, 50, 75, 100]) {
    if (prev < g && next >= g) return g;
  }
  return null;
}

function pickDailyWordIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % flashcards.length;
}

export default function Home() {
  const router = useRouter();

  const [lang, setLang] = useState<Lang>("yo");
  const [learned, setLearned] = useState<Record<Lang, Set<number>>>({
    yo: new Set(),
    ig: new Set(),
    pg: new Set(),
  });
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [milestone, setMilestone] = useState<number | null>(null);

  const milestoneOpacity = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2600,
          easing: easing.standard,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2600,
          easing: easing.standard,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  useEffect(() => {
    (async () => {
      const d = await getDefaultLang();
      setLang(d);
    })();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [yo, ig, pg] = await Promise.all([
        getLearnedSetForLang("yo"),
        getLearnedSetForLang("ig"),
        getLearnedSetForLang("pg"),
      ]);
      setLearned({ yo: new Set(yo), ig: new Set(ig), pg: new Set(pg) });
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const total = flashcards.length;

  const learnedCount = useCallback(
    (l: Lang) => {
      let n = 0;
      const s = learned[l];
      for (const c of flashcards as readonly any[]) {
        if (s.has(Number(c.id))) n++;
      }
      return n;
    },
    [learned]
  );

  const learnedPct = useCallback(
    (l: Lang) => (total > 0 ? Math.round((learnedCount(l) / total) * 100) : 0),
    [learnedCount, total]
  );

  const selectedCount = useMemo(() => learnedCount(lang), [learnedCount, lang]);
  const selectedPct = useMemo(() => learnedPct(lang), [learnedPct, lang]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HOME_LAST_PCT_KEY(lang));
        const prev = raw ? parseInt(raw, 10) || 0 : 0;
        const hit = hitMilestone(prev, selectedPct);
        if (hit) {
          setMilestone(hit);
          milestoneOpacity.setValue(0);
          Animated.sequence([
            Animated.timing(milestoneOpacity, {
              toValue: 1,
              duration: 300,
              easing: easing.emphasized,
              useNativeDriver: true,
            }),
            Animated.delay(2000),
            Animated.timing(milestoneOpacity, {
              toValue: 0,
              duration: 300,
              easing: easing.standard,
              useNativeDriver: true,
            }),
          ]).start(() => setMilestone(null));
        }
        await AsyncStorage.setItem(HOME_LAST_PCT_KEY(lang), String(selectedPct));
      } catch {}
    })();
  }, [lang, selectedPct, milestoneOpacity]);

  const dailyWord = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const idx = pickDailyWordIndex(today + lang);
    return flashcards[idx] as any;
  }, [lang]);

  const playDaily = async () => {
    setAudioPlaying(true);
    try {
      await playWordAudio({
        lang,
        id: dailyWord.id,
        ttsText: dailyWord[lang],
        ttsLang: LANG_GREETING[lang].ttsLang,
      });
    } catch {}
    setTimeout(() => setAudioPlaying(false), 2200);
  };

  const switchLang = async (l: Lang) => {
    setLang(l);
    try {
      await setDefaultLang(l);
    } catch {}
  };

  const tBg = langTheme[lang].surface;
  const tPrimary = langTheme[lang].primary;
  const tDeep = langTheme[lang].primaryDeep;
  const tOn = langTheme[lang].onSurface;

  const onParentReset = async () => {
    setGateOpen(false);
    try {
      await clearLearnedForLang(lang as LearnedLang);
      await AsyncStorage.setItem(HOME_LAST_PCT_KEY(lang), "0");
    } catch {}
    await refresh();
    Alert.alert("Reset", `${LANG_LABELS[lang]} progress cleared.`);
  };

  return (
    <>
      {gateOpen ? (
        <ParentGateModal
          visible={gateOpen}
          onClose={() => setGateOpen(false)}
          onCancel={() => setGateOpen(false)}
          onSuccess={onParentReset}
          onPassed={onParentReset}
          title="parent gate"
          subtitle={`solve the math to reset ${LANG_LABELS[lang].toLowerCase()} progress`}
        />
      ) : null}

      <Screen
        background={colors.background}
        scroll
        padded={false}
        bottomInsetExtra={100}
      >
        <View style={styles.topRow}>
          <View>
            <Text variant="overline" tone="muted">Welcome back</Text>
            <Text variant="title">Let's learn today</Text>
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressDown]}
            hitSlop={8}
          >
            <Ionicons name="person-circle-outline" size={32} color={palette.slate} />
          </Pressable>
        </View>

        {milestone ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.milestoneBar, { opacity: milestoneOpacity, backgroundColor: tPrimary }]}
          >
            <Text variant="bodyStrong" style={{ color: palette.white }}>
              {LANG_LABELS[lang]} · {milestone}% milestone reached
            </Text>
          </Animated.View>
        ) : null}

        <View style={[styles.hero, { backgroundColor: tBg }]}>
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <PatternBackdrop
              variant="adire-dots"
              color={tPrimary}
              width={520}
              height={420}
              opacity={0.18}
            />
          </View>

          <View style={styles.heroTop}>
            <Pill
              label={`${LANG_LABELS[lang]} · ${lang.toUpperCase()}`}
              variant="solid"
              bg={tPrimary}
              color={palette.white}
            />
            <Text variant="caption" tone="soft">
              {selectedCount}/{total} words
            </Text>
          </View>

          <View style={styles.heroMiddle}>
            <View style={{ flex: 1 }}>
              <Text variant="display3" style={{ color: tOn }}>
                {selectedPct === 0
                  ? "Start your first lesson"
                  : selectedPct === 100
                  ? "You mastered it"
                  : "Continue learning"}
              </Text>
              <Text variant="body" tone="soft" style={{ marginTop: spacing.xs }}>
                {selectedPct === 0
                  ? "Tap a sound, repeat it back, and keep going."
                  : `${selectedPct}% of ${LANG_LABELS[lang]} learned so far.`}
              </Text>
            </View>

            <Animated.View
              style={{
                transform: [
                  {
                    translateY: float.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -8],
                    }),
                  },
                ],
              }}
            >
              <Mascot size={130} expression="happy" accent={lang} />
            </Animated.View>
          </View>

          <View style={styles.heroProgressRow}>
            <View style={{ flex: 1 }}>
              <ProgressBar
                value={selectedPct}
                fillColor={tPrimary}
                trackColor="rgba(27, 20, 40, 0.08)"
                height={10}
              />
            </View>
            <Text variant="bodyStrong" style={{ color: tDeep, minWidth: 48, textAlign: "right" }}>
              {selectedPct}%
            </Text>
          </View>

          <Button
            label={selectedPct === 0 ? "Start learning" : "Continue learning"}
            onPress={() => router.push({ pathname: "/(tabs)/learn", params: { lang } })}
            variant="primary"
            fullWidth
            size="lg"
            style={{ marginTop: spacing.lg, backgroundColor: tPrimary } as any}
          />
        </View>

        <View style={styles.langPicker}>
          {(["yo", "ig", "pg"] as Lang[]).map((l) => {
            const active = l === lang;
            const t = langTheme[l];
            return (
              <Pressable
                key={l}
                onPress={() => switchLang(l)}
                style={({ pressed }) => [
                  styles.langChip,
                  {
                    backgroundColor: active ? t.primary : palette.white,
                    borderColor: active ? t.primary : palette.hairline,
                  },
                  pressed && styles.pressDown,
                ]}
              >
                <Text
                  variant="bodyStrong"
                  style={{
                    color: active ? palette.white : palette.ink,
                    fontSize: 13,
                  }}
                >
                  {LANG_LABELS[l]}
                </Text>
                <Text
                  variant="caption"
                  style={{
                    color: active ? "rgba(255,255,255,0.85)" : palette.slate,
                    marginTop: 2,
                  }}
                >
                  {learnedPct(l)}%
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="overline" tone="muted">Word of the day</Text>
          </View>

          <Card variant="elevated" padding="lg" radius="xl2">
            <View style={styles.dailyRow}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" tone="muted">
                  {LANG_LABELS[lang]} · {String(dailyWord.category ?? "").toUpperCase()}
                </Text>
                <Text variant="display3" style={{ marginTop: spacing.xs }}>
                  {dailyWord[lang]}
                </Text>
                <Text variant="subtitle" tone="soft">
                  {dailyWord.en}
                </Text>
              </View>

              <AudioButton
                onPress={playDaily}
                playing={audioPlaying}
                tint={tPrimary}
                size={64}
                accessibilityLabel={`Play ${dailyWord[lang]}`}
              />
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="overline" tone="muted">Quick actions</Text>
          </View>

          <View style={styles.actionGrid}>
            <ActionTile
              icon="book"
              label="Learn"
              hint="Flashcards"
              accent={palette.clay}
              tint={palette.claySoft}
              onPress={() => router.push({ pathname: "/(tabs)/learn", params: { lang } })}
            />
            <ActionTile
              icon="game-controller"
              label="Games"
              hint="Practice"
              accent={palette.indigo}
              tint={palette.indigoSoft}
              onPress={() => router.push({ pathname: "/(tabs)/games", params: { lang } })}
            />
            <ActionTile
              icon="list"
              label="All words"
              hint="Browse"
              accent={palette.mint}
              tint={palette.mintSoft}
              onPress={() => router.push({ pathname: "/words", params: { lang } })}
            />
            <ActionTile
              icon="settings"
              label="Parent zone"
              hint="Controls"
              accent={palette.plum}
              tint={palette.plumSoft}
              onPress={() => router.push("/(tabs)/settings")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="overline" tone="muted">Your progress</Text>
          </View>

          <Card variant="elevated" padding="lg" radius="xl2">
            {(["yo", "ig", "pg"] as Lang[]).map((l, i) => {
              const t = langTheme[l];
              const c = learnedCount(l);
              const p = learnedPct(l);
              return (
                <View
                  key={l}
                  style={[styles.progressRow, i > 0 && { marginTop: spacing.md }]}
                >
                  <View style={[styles.langBadge, { backgroundColor: t.primary }]}>
                    <Text variant="overline" style={{ color: palette.white, fontSize: 10 }}>
                      {l.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowBetween}>
                      <Text variant="bodyStrong">{LANG_LABELS[l]}</Text>
                      <Text variant="caption" tone="soft">
                        {c}/{total}
                      </Text>
                    </View>
                    <View style={{ marginTop: 6 }}>
                      <ProgressBar value={p} fillColor={t.primary} height={6} />
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        </View>

        <View style={styles.section}>
          <Card variant="soft" tint={palette.bone} padding="lg" radius="xl2">
            <View style={styles.parentRow}>
              <View style={styles.parentIcon}>
                <Ionicons name="shield-checkmark" size={22} color={palette.indigo} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Parent tools</Text>
                <Text variant="caption" tone="soft">
                  Reset progress, change audio, manage settings.
                </Text>
              </View>
              <Button
                label="Reset"
                size="sm"
                variant="ghost"
                onPress={() => setGateOpen(true)}
              />
            </View>
          </Card>
        </View>

      </Screen>
    </>
  );
}

function ActionTile({
  icon,
  label,
  hint,
  accent,
  tint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  accent: string;
  tint: string;
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

  return (
    <Animated.View style={[{ transform: [{ scale }] }, styles.actionTileWrap]}>
      <Pressable
        onPressIn={() => animate(pressScale.medium)}
        onPressOut={() => animate(1)}
        onPress={onPress}
        style={[styles.actionTile, shadows.sm, { backgroundColor: tint }]}
      >
        <View style={[styles.actionIcon, { backgroundColor: accent }]}>
          <Ionicons name={icon} size={20} color={palette.white} />
        </View>
        <Text variant="bodyStrong" style={{ marginTop: spacing.md }}>
          {label}
        </Text>
        <Text variant="caption" tone="soft">
          {hint}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pressDown: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },

  milestoneBar: {
    marginTop: spacing.md,
    marginHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: "center",
  },

  hero: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    borderRadius: radii.xl3,
    padding: spacing.xl,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroMiddle: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  heroProgressRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  langPicker: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    flexDirection: "row",
    gap: spacing.sm,
  },
  langChip: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    alignItems: "center",
  },

  section: {
    marginTop: spacing.xl2,
    paddingHorizontal: spacing.xl,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  dailyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  actionTileWrap: {
    width: "47%",
  },
  actionTile: {
    borderRadius: radii.xl2,
    padding: spacing.lg,
    minHeight: 120,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  langBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  parentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  parentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.indigoSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
