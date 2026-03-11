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
  const [milestoneHit, setMilestoneHit] = useState<number | null>(null);

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
      Animated.timing(sparkleAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(bannerAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.delay(1800),
        Animated.timing(bannerAnim, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      sparkleAnim.setValue(0);
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
                  outputRange: [-18, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.milestoneCard}>
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
            opacity: sparkleAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
            transform: [
              {
                scale: sparkleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.75, 1.08],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.sparkleText}>✨ ✨ ✨</Text>
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
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Text style={styles.topLabel}>home</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTextWrap}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                {releaseReady ? "Release ready" : "Learn African languages"}
              </Text>
            </View>

            <Text style={styles.heroTitle}>AfricanKidSpeaks</Text>
            <Text style={styles.heroSubtitle}>
              Fun language learning for kids with native audio, simple practice, and playful review.
            </Text>

            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaPill}>
                <Text style={styles.heroMetaPillText}>{titleForLang(lang)}</Text>
              </View>
              <View style={styles.heroMetaPillSoft}>
                <Text style={styles.heroMetaPillSoftText}>
                  {nativeCoverage.pct}% native audio
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.heroLogoWrap}>
            <Image source={APP_LOGO} style={styles.heroLogo} resizeMode="contain" />
          </View>
        </View>

        <View style={styles.languageSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Choose a language</Text>
            <Text style={styles.sectionHint}>Tap a card to switch</Text>
          </View>

          <View style={styles.languageGrid}>
            {(["yo", "ig", "pg"] as Lang[]).map((l) => {
              const active = l === lang;
              const cov = nativeCoverageFor(l);

              return (
                <Pressable
                  key={l}
                  onPress={() => setLang(l)}
                  style={({ pressed }) => [
                    styles.languageCard,
                    active && styles.languageCardActive,
                    pressed && styles.pressDown,
                  ]}
                >
                  <View style={styles.languageCardTop}>
                    <Text style={[styles.languageMini, active && styles.languageMiniActive]}>
                      {shortForLang(l)}
                    </Text>
                    <View style={[styles.dot, active && styles.dotActive]} />
                  </View>

                  <Text style={styles.languageName}>{titleForLang(l)}</Text>
                  <Text style={styles.languageCoverage}>
                    Native audio <Text style={styles.languageCoverageStrong}>{cov.pct}%</Text>
                  </Text>
                </Pressable>
              );
            })}

            <View style={[styles.languageCard, styles.languageCardMuted]}>
              <View style={styles.languageCardTop}>
                <Text style={styles.languageMiniMuted}>+</Text>
              </View>
              <Text style={styles.languageNameMuted}>More soon</Text>
              <Text style={styles.languageMutedText}>More languages coming in Phase 2+</Text>
            </View>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCardLarge}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your progress</Text>
              <Text style={styles.sectionHint}>{titleForLang(lang)}</Text>
            </View>

            <View style={styles.kpiMainRow}>
              <Text style={styles.kpiBig}>{learnedPctSelected}%</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.kpiLabel}>
                  Learned{" "}
                  <Text style={styles.kpiStrong}>
                    {learnedCountSelected}/{totalWords}
                  </Text>
                </Text>
                <Text style={styles.kpiSub}>
                  Next goal <Text style={styles.kpiStrong}>{goalPct}%</Text>
                </Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${clampPct(learnedPctSelected)}%` }]} />
            </View>

            <Pressable
              onPress={openWordsLearned}
              style={({ pressed }) => [styles.inlinePrimary, pressed && styles.pressDown]}
            >
              <Text style={styles.inlinePrimaryText}>Open learned words</Text>
            </Pressable>
          </View>

          <View style={styles.kpiStack}>
            <View style={styles.kpiSmallCard}>
              <Text style={styles.kpiSmallLabel}>Overall</Text>
              <Text style={styles.kpiSmallValue}>{overall.pct}%</Text>
              <Text style={styles.kpiSmallSub}>
                {overall.num}/{overall.denom}
              </Text>
            </View>

            <View style={styles.kpiSmallCard}>
              <Text style={styles.kpiSmallLabel}>Native audio</Text>
              <Text style={styles.kpiSmallValue}>{nativeCoverage.pct}%</Text>
              <Text style={styles.kpiSmallSub}>
                {nativeCoverage.has}/{totalWords}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.breakdownCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Language breakdown</Text>
            <Text style={styles.sectionHint}>YO • IG • PG</Text>
          </View>

          <View style={styles.breakdownRow}>
            {(
              [
                { k: "yo" as Lang, label: "YO", pct: learnedPcts.yo, count: learnedCounts.yo },
                { k: "ig" as Lang, label: "IG", pct: learnedPcts.ig, count: learnedCounts.ig },
                { k: "pg" as Lang, label: "PG", pct: learnedPcts.pg, count: learnedCounts.pg },
              ] as const
            ).map(({ k, label, pct, count }) => {
              const active = k === lang;
              return (
                <View key={k} style={[styles.breakdownMini, active && styles.breakdownMiniActive]}>
                  <View style={styles.breakdownMiniTop}>
                    <Text style={[styles.breakdownTag, active && styles.breakdownTagActive]}>
                      {label}
                    </Text>
                    <Text style={styles.breakdownPct}>{pct}%</Text>
                  </View>
                  <Text style={styles.breakdownSub}>
                    {count}/{totalWords} learned
                  </Text>
                  <View style={styles.breakdownTrack}>
                    <View style={[styles.breakdownFill, { width: `${clampPct(pct)}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.quickActionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
            <Text style={styles.sectionHint}>Jump in fast</Text>
          </View>

          <View style={styles.actionGrid}>
            <Pressable
              onPress={goLearn}
              style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressDown]}
            >
              <Text style={styles.actionPrimaryTitle}>Start learning</Text>
              <Text style={styles.actionPrimarySub}>Practice {titleForLang(lang)}</Text>
            </Pressable>

            <Pressable
              onPress={goGames}
              style={({ pressed }) => [styles.actionSecondary, pressed && styles.pressDown]}
            >
              <Text style={styles.actionSecondaryTitle}>Play games</Text>
              <Text style={styles.actionSecondarySub}>Review with sound quiz</Text>
            </Pressable>
          </View>

          <View style={styles.pillRow}>
            <Pressable
              onPress={openWordsAll}
              style={({ pressed }) => [styles.utilityPill, pressed && styles.pressDown]}
            >
              <Text style={styles.utilityPillText}>Words</Text>
            </Pressable>

            <Pressable
              onPress={openWordsMissing}
              style={({ pressed }) => [styles.utilityPill, pressed && styles.pressDown]}
            >
              <Text style={styles.utilityPillText}>Missing audio</Text>
            </Pressable>

            <Pressable
              onPress={openAudioReport}
              style={({ pressed }) => [styles.utilityPill, pressed && styles.pressDown]}
            >
              <Text style={styles.utilityPillText}>Audio report</Text>
            </Pressable>

            <Pressable
              onPress={refresh}
              style={({ pressed }) => [styles.utilityPill, pressed && styles.pressDown]}
            >
              <Text style={styles.utilityPillText}>Refresh</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.parentCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Parent tools</Text>
            <Text style={styles.sectionHint}>Protected reset</Text>
          </View>

          <Text style={styles.parentText}>
            Learned progress is tracked separately for Yoruba, Igbo, and Pidgin.
          </Text>

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
    backgroundColor: "#ffffff",
  },

  scroll: {
    flex: 1,
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

  milestoneWrap: {
    position: "absolute",
    top: 10,
    left: 16,
    right: 16,
    zIndex: 20,
    alignItems: "center",
  },
  milestoneCard: {
    backgroundColor: "#111111",
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
    marginTop: 6,
    padding: 20,
    borderRadius: 28,
    backgroundColor: "#f6f8fc",
    borderWidth: 1,
    borderColor: "#e9edf5",
    flexDirection: "row",
    gap: 14,
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
  heroMetaRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroMetaPill: {
    backgroundColor: "#111111",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroMetaPillText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 12,
  },
  heroMetaPillSoft: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e7ebf2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroMetaPillSoftText: {
    color: "#344054",
    fontWeight: "800",
    fontSize: 12,
  },
  heroLogoWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e9edf5",
  },
  heroLogo: {
    width: 52,
    height: 52,
    borderRadius: 16,
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
  languageGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  languageCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e7ebf2",
    padding: 16,
  },
  languageCardActive: {
    backgroundColor: "#f7fbff",
    borderColor: "#b9d4ff",
  },
  languageCardMuted: {
    backgroundColor: "#fafafa",
  },
  languageCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  languageMini: {
    backgroundColor: "#111111",
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  languageMiniActive: {
    backgroundColor: "#1864d9",
  },
  languageMiniMuted: {
    backgroundColor: "#eceff4",
    color: "#667085",
    fontWeight: "900",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#d0d5dd",
  },
  dotActive: {
    backgroundColor: "#1864d9",
  },
  languageName: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: "900",
    color: "#111111",
  },
  languageCoverage: {
    marginTop: 8,
    fontSize: 14,
    color: "#667085",
    fontWeight: "700",
  },
  languageCoverageStrong: {
    color: "#111111",
    fontWeight: "900",
  },
  languageNameMuted: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: "900",
    color: "#98a2b3",
  },
  languageMutedText: {
    marginTop: 8,
    fontSize: 14,
    color: "#98a2b3",
    fontWeight: "700",
  },

  kpiRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
  },
  kpiCardLarge: {
    flex: 1.2,
    backgroundColor: "#111111",
    borderRadius: 26,
    padding: 18,
  },
  kpiStack: {
    flex: 0.82,
    gap: 12,
  },
  kpiSmallCard: {
    flex: 1,
    backgroundColor: "#f7f8fa",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eceff4",
  },
  kpiSmallLabel: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  kpiSmallValue: {
    marginTop: 10,
    color: "#111111",
    fontSize: 28,
    fontWeight: "900",
  },
  kpiSmallSub: {
    marginTop: 4,
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
  },

  kpiMainRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  kpiBig: {
    fontSize: 40,
    lineHeight: 44,
    color: "#ffffff",
    fontWeight: "900",
  },
  kpiLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "700",
  },
  kpiSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "700",
  },
  kpiStrong: {
    color: "#ffffff",
    fontWeight: "900",
  },
  progressTrack: {
    marginTop: 14,
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#5da0ff",
  },
  inlinePrimary: {
    marginTop: 14,
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inlinePrimaryText: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "900",
  },

  breakdownCard: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eceff4",
  },
  breakdownRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  breakdownMini: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eceff4",
  },
  breakdownMiniActive: {
    backgroundColor: "#f5faff",
    borderColor: "#bfd7ff",
  },
  breakdownMiniTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  breakdownTag: {
    backgroundColor: "#111111",
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  breakdownTagActive: {
    backgroundColor: "#1864d9",
  },
  breakdownPct: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 14,
  },
  breakdownSub: {
    marginTop: 8,
    color: "#667085",
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },
  breakdownTrack: {
    marginTop: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#e9edf5",
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#1864d9",
  },

  quickActionCard: {
    marginTop: 18,
    backgroundColor: "#f7f8fa",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eceff4",
  },
  actionGrid: {
    marginTop: 14,
    gap: 12,
  },
  actionPrimary: {
    backgroundColor: "#1864d9",
    borderRadius: 22,
    padding: 18,
  },
  actionPrimaryTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  actionPrimarySub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontWeight: "700",
  },
  actionSecondary: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e7ebf2",
  },
  actionSecondaryTitle: {
    color: "#111111",
    fontSize: 18,
    fontWeight: "900",
  },
  actionSecondarySub: {
    marginTop: 4,
    color: "#667085",
    fontSize: 13,
    fontWeight: "700",
  },

  pillRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  utilityPill: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e7ebf2",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  utilityPillText: {
    color: "#111111",
    fontWeight: "800",
    fontSize: 13,
  },

  parentCard: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eceff4",
  },
  parentText: {
    marginTop: 10,
    color: "#667085",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  resetButton: {
    marginTop: 16,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: "#d92d20",
    backgroundColor: "#fff5f4",
  },
  resetButtonText: {
    color: "#d92d20",
    fontWeight: "900",
    fontSize: 13,
    textTransform: "uppercase",
  },

  pressDown: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});