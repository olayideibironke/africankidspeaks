import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { colors } from "../theme";
import ParentGateModal from "../components/parentgate.modal";
import { flashcards } from "../data/flashcards";
import { audiomap } from "../data/audiomap.generated";
import {
  getLearnedSetForLang,
  clearLearnedForLang,
  type LearnedLang,
} from "../utils/learned";

type Lang = "yo" | "ig" | "pg";

const APP_LOGO = require("../../assets/icon.png");

const LANG_COLORS: Record<
  Lang,
  {
    bg: string;
    bgSoft: string;
    chip: string;
    text: string;
    accent: string;
    bubbleA: string;
    bubbleB: string;
    ribbon: string;
    ribbonDark: string;
    ribbonSoft: string;
  }
> = {
  yo: {
    bg: "#4F8CFF",
    bgSoft: "#EAF2FF",
    chip: "#1C5DE7",
    text: "#16356C",
    accent: "#8FC2FF",
    bubbleA: "rgba(255,255,255,0.22)",
    bubbleB: "rgba(255,255,255,0.12)",
    ribbon: "#6f5cff",
    ribbonDark: "#5440ea",
    ribbonSoft: "#eee9ff",
  },
  ig: {
    bg: "#8B5CF6",
    bgSoft: "#F1EAFE",
    chip: "#6F3DE9",
    text: "#4D277F",
    accent: "#C6A8FF",
    bubbleA: "rgba(255,255,255,0.22)",
    bubbleB: "rgba(255,255,255,0.12)",
    ribbon: "#19b67b",
    ribbonDark: "#0e965f",
    ribbonSoft: "#e9fff3",
  },
  pg: {
    bg: "#FF9E2C",
    bgSoft: "#FFF1DF",
    chip: "#F28400",
    text: "#844600",
    accent: "#FFD08A",
    bubbleA: "rgba(255,255,255,0.22)",
    bubbleB: "rgba(255,255,255,0.12)",
    ribbon: "#ff7f50",
    ribbonDark: "#e25f31",
    ribbonSoft: "#fff0e8",
  },
};

function titleForLang(lang: Lang) {
  if (lang === "yo") return "Yoruba";
  if (lang === "ig") return "Igbo";
  return "Pidgin";
}

function shortForLang(lang: Lang) {
  if (lang === "yo") return "YO";
  if (lang === "ig") return "IG";
  return "PG";
}

function funTaglineForLang(lang: Lang) {
  if (lang === "yo") return "Play and learn Yoruba words";
  if (lang === "ig") return "Jump into bright Igbo practice";
  return "Fun Nigerian Pidgin for kids";
}

function nextGoalPct(pct: number) {
  if (pct >= 100) return 100;
  if (pct < 25) return 25;
  if (pct < 50) return 50;
  if (pct < 75) return 75;
  return 100;
}

function clampPct(pct: number) {
  return Math.max(0, Math.min(100, pct));
}

function toLearnedLang(lang: Lang): LearnedLang {
  return lang === "yo" ? "yo" : lang === "ig" ? "ig" : "pg";
}

function hitMilestone(prevPct: number, nextPct: number) {
  const goals = [25, 50, 75, 100];
  for (const g of goals) {
    if (prevPct < g && nextPct >= g) return g;
  }
  return null;
}

const HOME_LAST_PCT_KEY = (lang: Lang) => `home_last_pct_v1_${lang}`;
const HOME_RELEASE_READY_SHOWN_KEY = "home_release_ready_shown_v1";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [lang, setLang] = useState<Lang>("yo");

  const [learnedYo, setLearnedYo] = useState<Set<number>>(new Set());
  const [learnedIg, setLearnedIg] = useState<Set<number>>(new Set());
  const [learnedPg, setLearnedPg] = useState<Set<number>>(new Set());

  const [gateOpen, setGateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | "reset_lang">(null);

  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const [milestoneHit, setMilestoneHit] = useState<number | null>(null);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim]);

  const refresh = useCallback(async () => {
    try {
      const [yo, ig, pg] = await Promise.all([
        getLearnedSetForLang("yo"),
        getLearnedSetForLang("ig"),
        getLearnedSetForLang("pg"),
      ]);
      setLearnedYo(new Set(yo));
      setLearnedIg(new Set(ig));
      setLearnedPg(new Set(pg));
    } catch {
      setLearnedYo(new Set());
      setLearnedIg(new Set());
      setLearnedPg(new Set());
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalWords = flashcards.length;
  const activePalette = LANG_COLORS[lang];

  const learnedSetForSelected = useMemo(() => {
    if (lang === "yo") return learnedYo;
    if (lang === "ig") return learnedIg;
    return learnedPg;
  }, [lang, learnedYo, learnedIg, learnedPg]);

  const countLearnedForSet = useCallback((set: Set<number>) => {
    let n = 0;
    for (const c of flashcards as any[]) {
      const id = Number(c.id);
      if (set.has(id)) n++;
    }
    return n;
  }, []);

  const learnedCountSelected = useMemo(() => {
    return countLearnedForSet(learnedSetForSelected);
  }, [learnedSetForSelected, countLearnedForSet]);

  const learnedPctSelected = useMemo(() => {
    return totalWords > 0 ? Math.round((learnedCountSelected / totalWords) * 100) : 0;
  }, [learnedCountSelected, totalWords]);

  const goalPct = useMemo(() => nextGoalPct(learnedPctSelected), [learnedPctSelected]);

  const nativeCoverageFor = useCallback(
    (l: Lang) => {
      let has = 0;
      for (const c of flashcards as any[]) {
        const id = Number(c.id);
        const key = `${l}/${id}`;
        if ((audiomap as any)[key]) has++;
      }
      const pct = totalWords ? Math.round((has / totalWords) * 100) : 0;
      return { has, pct };
    },
    [totalWords]
  );

  const nativeCoverage = useMemo(() => nativeCoverageFor(lang), [lang, nativeCoverageFor]);

  const learnedCounts = useMemo(() => {
    const yo = countLearnedForSet(learnedYo);
    const ig = countLearnedForSet(learnedIg);
    const pg = countLearnedForSet(learnedPg);
    return { yo, ig, pg };
  }, [learnedYo, learnedIg, learnedPg, countLearnedForSet]);

  const learnedPcts = useMemo(() => {
    const yo = totalWords ? Math.round((learnedCounts.yo / totalWords) * 100) : 0;
    const ig = totalWords ? Math.round((learnedCounts.ig / totalWords) * 100) : 0;
    const pg = totalWords ? Math.round((learnedCounts.pg / totalWords) * 100) : 0;
    return { yo, ig, pg };
  }, [learnedCounts, totalWords]);

  const overall = useMemo(() => {
    const denom = totalWords * 3;
    const num = learnedCounts.yo + learnedCounts.ig + learnedCounts.pg;
    const pct = denom > 0 ? Math.round((num / denom) * 100) : 0;
    return { num, denom, pct };
  }, [learnedCounts, totalWords]);

  const releaseReady = useMemo(() => {
    const yo = nativeCoverageFor("yo").pct;
    const ig = nativeCoverageFor("ig").pct;
    const pg = nativeCoverageFor("pg").pct;
    return totalWords >= 500 && yo === 100 && ig === 100 && pg === 100;
  }, [nativeCoverageFor, totalWords]);

  useEffect(() => {
    (async () => {
      if (!releaseReady) return;
      try {
        const shown = await AsyncStorage.getItem(HOME_RELEASE_READY_SHOWN_KEY);
        if (shown === "1") return;
        await AsyncStorage.setItem(HOME_RELEASE_READY_SHOWN_KEY, "1");
        Alert.alert(
          "Release Ready ✅",
          "All native audio is complete for YO / IG / PG. You’re good to ship."
        );
      } catch {}
    })();
  }, [releaseReady]);

  const runMilestone = useCallback(() => {
    sparkleAnim.setValue(0);
    bannerAnim.setValue(0);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(sparkleAnim, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(bannerAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.delay(1700),
        Animated.timing(bannerAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setMilestoneHit(null);
    });
  }, [sparkleAnim, bannerAnim]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HOME_LAST_PCT_KEY(lang));
        const prev = raw ? parseInt(raw, 10) || 0 : 0;
        const next = learnedPctSelected;

        const hit = hitMilestone(prev, next);
        if (hit) {
          setMilestoneHit(hit);
          runMilestone();
        }

        await AsyncStorage.setItem(HOME_LAST_PCT_KEY(lang), String(next));
      } catch {}
    })();
  }, [lang, learnedPctSelected, runMilestone]);

  const goLearn = useCallback(() => {
    router.push({ pathname: "/learn", params: { lang } });
  }, [router, lang]);

  const goGames = useCallback(() => {
    router.push({ pathname: "/games", params: { lang } });
  }, [router, lang]);

  const openWordsAll = useCallback(() => {
    router.push({ pathname: "/words", params: { lang } });
  }, [router, lang]);

  const openWordsMissing = useCallback(() => {
    router.push({ pathname: "/words", params: { lang, onlyMissing: "1" } });
  }, [router, lang]);

  const openWordsLearned = useCallback(() => {
    router.push({ pathname: "/words", params: { lang, onlyLearned: "1" } });
  }, [router, lang]);

  const openAudioReport = useCallback(() => {
    router.push({ pathname: "/audio-report", params: { lang } });
  }, [router, lang]);

  const requestResetLang = () => {
    setPendingAction("reset_lang");
    setGateOpen(true);
  };

  const onGateCancel = () => {
    setGateOpen(false);
    setPendingAction(null);
  };

  const onGatePassed = async () => {
    const action = pendingAction;
    setGateOpen(false);
    setPendingAction(null);

    if (action === "reset_lang") {
      const l = toLearnedLang(lang);
      await clearLearnedForLang(l);

      try {
        await AsyncStorage.setItem(HOME_LAST_PCT_KEY(lang), "0");
      } catch {}

      await refresh();
      setMilestoneHit(null);
      Alert.alert("Reset", `${titleForLang(lang)} learned progress cleared.`);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowRight} />
      <View style={styles.bgGlowBottom} />
      <View style={styles.bgGlowCenter} />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.milestoneWrap,
          {
            opacity: bannerAnim,
            transform: [
              {
                translateY: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[styles.milestoneCard, { backgroundColor: activePalette.ribbon }]}>
          <Text style={styles.milestoneCardText}>
            {titleForLang(lang)} hit {milestoneHit ?? 0}% 🎉
          </Text>
        </View>
      </Animated.View>

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
                  outputRange: [0.82, 1.08],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.sparkleText}>✨ 🎉 ✨</Text>
      </Animated.View>

      {gateOpen ? (
        <ParentGateModal
          visible={gateOpen}
          onClose={onGateCancel}
          onCancel={onGateCancel}
          onSuccess={onGatePassed}
          onPassed={onGatePassed}
          title="parent gate"
          subtitle={`solve the math to reset ${titleForLang(lang).toLowerCase()} learned progress`}
        />
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + 6,
          paddingBottom: insets.bottom + 112,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRibbonRow}>
          <View
            style={[
              styles.headerRibbon,
              {
                backgroundColor: activePalette.ribbonSoft,
                borderColor: activePalette.ribbon,
              },
            ]}
          >
            <View
              style={[
                styles.headerRibbonCap,
                { backgroundColor: activePalette.ribbonDark },
              ]}
            />
            <Text style={[styles.headerRibbonEmoji, { color: activePalette.ribbonDark }]}>
              ✨
            </Text>
            <Text style={[styles.headerRibbonText, { color: activePalette.ribbonDark }]}>
              home
            </Text>
          </View>
        </View>

        <View style={[styles.hero, { backgroundColor: activePalette.bg }]}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.heroBubbleLg,
              {
                backgroundColor: activePalette.bubbleA,
                transform: [
                  {
                    translateY: floatAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -8],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.heroBubbleMd,
              {
                backgroundColor: activePalette.bubbleB,
                transform: [
                  {
                    translateY: floatAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 10],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.heroBubbleSm,
              {
                backgroundColor: activePalette.bubbleA,
                transform: [
                  {
                    translateY: floatAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -6],
                    }),
                  },
                ],
              },
            ]}
          />

          <View style={styles.heroHeaderRow}>
            <View style={styles.heroLogoPill}>
              <Image source={APP_LOGO} style={styles.heroLogo} resizeMode="contain" />
            </View>

            <View style={styles.heroStarsWrap}>
              <Text style={styles.heroStars}>⭐ ⭐ ⭐</Text>
            </View>
          </View>

          <View style={styles.heroCopyWrap}>
            <Text style={styles.heroEyebrow}>
              {releaseReady ? "Release ready" : "Play • listen • learn"}
            </Text>

            <Text style={styles.heroTitle}>AfricanKidSpeaks</Text>
            <Text style={styles.heroSubtitle}>{funTaglineForLang(lang)}</Text>

            <View style={styles.heroPillsRow}>
              <View style={styles.heroDarkPill}>
                <Text style={styles.heroDarkPillText}>{titleForLang(lang)}</Text>
              </View>
              <View style={styles.heroSoftPill}>
                <Text style={styles.heroSoftPillText}>{nativeCoverage.pct}% native audio</Text>
              </View>
            </View>
          </View>

          <View style={styles.heroMascotRow}>
            <View style={styles.heroMascotBubble}>
              <Text style={styles.heroMascotEmoji}>🦁</Text>
            </View>
            <View style={styles.heroMascotBubbleSmall}>
              <Text style={styles.heroMascotEmojiSmall}>🎵</Text>
            </View>
            <View style={styles.heroMascotBubbleSmallAlt}>
              <Text style={styles.heroMascotEmojiSmall}>✨</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Pick your language</Text>
          <Text style={styles.sectionHint}>Kids love tapping colorful cards</Text>
        </View>

        <View style={styles.languageGrid}>
          {(["yo", "ig", "pg"] as Lang[]).map((l) => {
            const palette = LANG_COLORS[l];
            const active = l === lang;
            const cov = nativeCoverageFor(l);

            return (
              <Pressable
                key={l}
                onPress={() => setLang(l)}
                style={({ pressed }) => [
                  styles.languageCard,
                  {
                    backgroundColor: palette.bgSoft,
                    borderColor: active ? palette.bg : "#e6ebf3",
                  },
                  pressed && styles.pressDown,
                ]}
              >
                <Animated.View
                  style={[
                    styles.languageBlob,
                    {
                      backgroundColor: palette.accent,
                      transform: active
                        ? [
                            {
                              translateY: floatAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -4],
                              }),
                            },
                          ]
                        : [{ translateY: 0 }],
                    },
                  ]}
                />

                <View style={styles.languageTop}>
                  <Text style={[styles.languageTag, { backgroundColor: palette.chip }]}>
                    {shortForLang(l)}
                  </Text>
                  {active ? (
                    <Text style={styles.languageSelected}>●</Text>
                  ) : (
                    <Text style={styles.languageIdle}>○</Text>
                  )}
                </View>

                <Text style={[styles.languageTitle, { color: palette.text }]}>{titleForLang(l)}</Text>
                <Text style={[styles.languageSub, { color: palette.text }]}>
                  Native audio <Text style={styles.languageSubStrong}>{cov.pct}%</Text>
                </Text>
                <Text style={styles.languageFun}>{funTaglineForLang(l)}</Text>
              </Pressable>
            );
          })}

          <View style={[styles.languageCard, styles.moreCard]}>
            <View style={styles.morePlus}>
              <Text style={styles.morePlusText}>+</Text>
            </View>
            <Text style={styles.moreTitle}>More soon</Text>
            <Text style={styles.moreSub}>New languages are coming in a future phase.</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={goLearn}
            style={({ pressed }) => [
              styles.mainActionCard,
              { backgroundColor: activePalette.bg },
              pressed && styles.pressDown,
            ]}
          >
            <Text style={styles.mainActionEmoji}>📚</Text>
            <Text style={styles.mainActionTitle}>Start learning</Text>
            <Text style={styles.mainActionSub}>Tap, reveal, play, and keep going</Text>
          </Pressable>

          <Pressable
            onPress={goGames}
            style={({ pressed }) => [
              styles.mainActionCard,
              { backgroundColor: "#111111" },
              pressed && styles.pressDown,
            ]}
          >
            <Text style={styles.mainActionEmoji}>🎮</Text>
            <Text style={styles.mainActionTitle}>Play games</Text>
            <Text style={styles.mainActionSub}>Sound quiz and fun review time</Text>
          </Pressable>
        </View>

        <View style={styles.progressShell}>
          <View style={styles.progressHeaderRow}>
            <Text style={styles.progressTitle}>Your progress</Text>
            <Text style={styles.progressHint}>{titleForLang(lang)}</Text>
          </View>

          <View style={styles.progressMainCard}>
            <View style={styles.progressMainTop}>
              <View style={styles.progressBigWrap}>
                <Text style={styles.progressBig}>{learnedPctSelected}%</Text>
                <Text style={styles.progressBigSub}>learned</Text>
              </View>

              <View style={styles.progressInfoWrap}>
                <Text style={styles.progressInfoTitle}>Great job so far 🎉</Text>
                <Text style={styles.progressInfoSub}>
                  {learnedCountSelected}/{totalWords} words learned
                </Text>
                <Text style={styles.progressInfoSub}>
                  Next goal: <Text style={styles.progressInfoStrong}>{goalPct}%</Text>
                </Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${clampPct(learnedPctSelected)}%`,
                    backgroundColor: activePalette.bg,
                  },
                ]}
              />
            </View>

            <Pressable
              onPress={openWordsLearned}
              style={({ pressed }) => [styles.learnedButton, pressed && styles.pressDown]}
            >
              <Text style={styles.learnedButtonText}>Open learned words</Text>
            </Pressable>
          </View>

          <View style={styles.kpiMiniRow}>
            <View style={styles.kpiMiniCard}>
              <Text style={styles.kpiMiniLabel}>Overall</Text>
              <Text style={styles.kpiMiniValue}>{overall.pct}%</Text>
              <Text style={styles.kpiMiniSub}>
                {overall.num}/{overall.denom}
              </Text>
            </View>

            <View style={styles.kpiMiniCard}>
              <Text style={styles.kpiMiniLabel}>Native audio</Text>
              <Text style={styles.kpiMiniValue}>{nativeCoverage.pct}%</Text>
              <Text style={styles.kpiMiniSub}>
                {nativeCoverage.has}/{totalWords}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Language stars</Text>
          <Text style={styles.sectionHint}>A quick look at each track</Text>
        </View>

        <View style={styles.breakdownRow}>
          {(
            [
              { k: "yo" as Lang, label: "YO", pct: learnedPcts.yo, count: learnedCounts.yo },
              { k: "ig" as Lang, label: "IG", pct: learnedPcts.ig, count: learnedCounts.ig },
              { k: "pg" as Lang, label: "PG", pct: learnedPcts.pg, count: learnedCounts.pg },
            ] as const
          ).map(({ k, label, pct, count }) => {
            const palette = LANG_COLORS[k];
            const active = k === lang;

            return (
              <View
                key={k}
                style={[
                  styles.breakdownCard,
                  { backgroundColor: palette.bgSoft, borderColor: active ? palette.bg : "#e6ebf3" },
                ]}
              >
                <View style={styles.breakdownTop}>
                  <Text style={[styles.breakdownTag, { backgroundColor: palette.chip }]}>{label}</Text>
                  <Text style={[styles.breakdownPct, { color: palette.text }]}>{pct}%</Text>
                </View>

                <Text style={[styles.breakdownCount, { color: palette.text }]}>
                  {count}/{totalWords} learned
                </Text>

                <View style={styles.breakdownTrack}>
                  <View
                    style={[
                      styles.breakdownFill,
                      { width: `${clampPct(pct)}%`, backgroundColor: palette.bg },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.utilityShell}>
          <Text style={styles.utilityTitle}>More to explore</Text>

          <View style={styles.utilityRow}>
            <Pressable
              onPress={openWordsAll}
              style={({ pressed }) => [styles.utilityPill, pressed && styles.pressDown]}
            >
              <Text style={styles.utilityPillEmoji}>📝</Text>
              <Text style={styles.utilityPillText}>Words</Text>
            </Pressable>

            <Pressable
              onPress={openWordsMissing}
              style={({ pressed }) => [styles.utilityPill, pressed && styles.pressDown]}
            >
              <Text style={styles.utilityPillEmoji}>🔊</Text>
              <Text style={styles.utilityPillText}>Missing audio</Text>
            </Pressable>
          </View>

          <View style={styles.utilityRow}>
            <Pressable
              onPress={openAudioReport}
              style={({ pressed }) => [styles.utilityPill, pressed && styles.pressDown]}
            >
              <Text style={styles.utilityPillEmoji}>📊</Text>
              <Text style={styles.utilityPillText}>Audio report</Text>
            </Pressable>

            <Pressable
              onPress={refresh}
              style={({ pressed }) => [styles.utilityPill, pressed && styles.pressDown]}
            >
              <Text style={styles.utilityPillEmoji}>🔄</Text>
              <Text style={styles.utilityPillText}>Refresh</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.parentShell}>
          <View style={styles.parentTop}>
            <View style={styles.parentIconWrap}>
              <Text style={styles.parentIcon}>👨‍👩‍👧</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.parentTitle}>Parent tools</Text>
              <Text style={styles.parentSub}>
                Progress is tracked separately for Yoruba, Igbo, and Pidgin.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={requestResetLang}
            style={({ pressed }) => [styles.resetButton, pressed && styles.pressDown]}
          >
            <Text style={styles.resetButtonText}>Parent reset</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.homeBg,
  },

  scroll: {
    flex: 1,
  },

  bgGlowTop: {
    position: "absolute",
    top: -40,
    left: -20,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: "#9b8cff",
    opacity: 0.24,
  },
  bgGlowRight: {
    position: "absolute",
    top: 150,
    right: -45,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: "#7fe1ff",
    opacity: 0.18,
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: 110,
    left: -45,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: "#ff9ecb",
    opacity: 0.18,
  },
  bgGlowCenter: {
    position: "absolute",
    top: 340,
    left: "35%",
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "#ffd86c",
    opacity: 0.12,
  },

  headerRibbonRow: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerRibbon: {
    minWidth: 128,
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

  milestoneWrap: {
    position: "absolute",
    top: 10,
    left: 16,
    right: 16,
    zIndex: 20,
    alignItems: "center",
  },
  milestoneCard: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  milestoneCardText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },

  sparkleWrap: {
    position: "absolute",
    top: 78,
    left: 0,
    right: 0,
    zIndex: 19,
    alignItems: "center",
  },
  sparkleText: {
    fontSize: 24,
  },

  hero: {
    marginTop: 2,
    borderRadius: 34,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    overflow: "hidden",
  },
  heroBubbleLg: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 999,
    top: -22,
    right: -18,
  },
  heroBubbleMd: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 999,
    bottom: 26,
    left: -10,
  },
  heroBubbleSm: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 999,
    top: 86,
    right: 90,
  },

  heroHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLogoPill: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.45)",
  },
  heroLogo: {
    width: 46,
    height: 46,
    borderRadius: 14,
  },
  heroStarsWrap: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroStars: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  heroCopyWrap: {
    marginTop: 16,
  },
  heroEyebrow: {
    color: "#ffffff",
    opacity: 0.92,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    color: "#ffffff",
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 23,
    color: "#ffffff",
    opacity: 0.96,
    fontWeight: "700",
    maxWidth: "88%",
  },

  heroPillsRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroDarkPill: {
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  heroDarkPillText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 12,
  },
  heroSoftPill: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  heroSoftPillText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 12,
  },

  heroMascotRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroMascotBubble: {
    width: 66,
    height: 66,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroMascotBubbleSmall: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroMascotBubbleSmallAlt: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroMascotEmoji: {
    fontSize: 30,
  },
  heroMascotEmojiSmall: {
    fontSize: 18,
  },

  sectionRow: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  sectionHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    maxWidth: 120,
  },

  languageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  languageCard: {
    width: "48%",
    borderRadius: 28,
    borderWidth: 2,
    padding: 16,
    minHeight: 184,
    overflow: "hidden",
  },
  languageBlob: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 999,
    top: -18,
    right: -18,
  },
  languageTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  languageTag: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
  },
  languageSelected: {
    color: "#1864d9",
    fontSize: 14,
    fontWeight: "900",
  },
  languageIdle: {
    color: "#c2c8d1",
    fontSize: 14,
    fontWeight: "900",
  },
  languageTitle: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: "900",
  },
  languageSub: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
  },
  languageSubStrong: {
    color: "#111111",
    fontWeight: "900",
  },
  languageFun: {
    marginTop: 12,
    color: "#667085",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    maxWidth: "84%",
  },

  moreCard: {
    backgroundColor: colors.homeBgSoft,
    borderColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
  },
  morePlus: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  morePlusText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  moreTitle: {
    marginTop: 20,
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  moreSub: {
    marginTop: 8,
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    maxWidth: "85%",
  },

  actionRow: {
    marginTop: 18,
    gap: 12,
  },
  mainActionCard: {
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  mainActionEmoji: {
    fontSize: 26,
  },
  mainActionTitle: {
    marginTop: 10,
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  mainActionSub: {
    marginTop: 6,
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },

  progressShell: {
    marginTop: 18,
  },
  progressHeaderRow: {
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  progressHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "800",
  },
  progressMainCard: {
    backgroundColor: "#ffffff",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#e7ebf2",
    padding: 18,
  },
  progressMainTop: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  progressBigWrap: {
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: "#f7f8fa",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e7ebf2",
  },
  progressBig: {
    color: "#111111",
    fontSize: 28,
    fontWeight: "900",
  },
  progressBigSub: {
    marginTop: 2,
    color: "#667085",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  progressInfoWrap: {
    flex: 1,
  },
  progressInfoTitle: {
    color: "#111111",
    fontSize: 17,
    fontWeight: "900",
  },
  progressInfoSub: {
    marginTop: 5,
    color: "#667085",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  progressInfoStrong: {
    color: "#111111",
    fontWeight: "900",
  },
  progressTrack: {
    marginTop: 16,
    height: 14,
    borderRadius: 999,
    backgroundColor: "#e9edf5",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  learnedButton: {
    marginTop: 16,
    alignSelf: "flex-start",
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  learnedButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },

  kpiMiniRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 12,
  },
  kpiMiniCard: {
    flex: 1,
    backgroundColor: "#f7f8fa",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#eceff4",
    padding: 16,
  },
  kpiMiniLabel: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  kpiMiniValue: {
    marginTop: 8,
    color: "#111111",
    fontSize: 28,
    fontWeight: "900",
  },
  kpiMiniSub: {
    marginTop: 4,
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
  },

  breakdownRow: {
    flexDirection: "row",
    gap: 10,
  },
  breakdownCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 2,
    padding: 14,
  },
  breakdownTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  breakdownTag: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 11,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  breakdownPct: {
    fontSize: 15,
    fontWeight: "900",
  },
  breakdownCount: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  breakdownTrack: {
    marginTop: 12,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.75)",
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    borderRadius: 999,
  },

  utilityShell: {
    marginTop: 18,
    backgroundColor: colors.homeBgSoft,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 18,
  },
  utilityTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  utilityRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  utilityPill: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e7ebf2",
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 74,
  },
  utilityPillEmoji: {
    fontSize: 18,
  },
  utilityPillText: {
    marginTop: 6,
    color: "#111111",
    fontWeight: "900",
    fontSize: 13,
    textAlign: "center",
  },

  parentShell: {
    marginTop: 18,
    backgroundColor: "#FFF1DF",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#FFD9AA",
    padding: 18,
  },
  parentTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  parentIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  parentIcon: {
    fontSize: 24,
  },
  parentTitle: {
    color: "#844600",
    fontSize: 22,
    fontWeight: "900",
  },
  parentSub: {
    marginTop: 6,
    color: "#844600",
    opacity: 0.86,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  resetButton: {
    marginTop: 16,
    alignSelf: "flex-start",
    backgroundColor: "#111111",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  resetButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
    textTransform: "uppercase",
  },

  pressDown: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});
