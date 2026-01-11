// app/(tabs)/index.tsx
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
import Watermark from "../components/watermark";
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

function badgeForLang(lang: Lang) {
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

// ✅ milestone helper
function hitMilestone(prevPct: number, nextPct: number) {
  const goals = [25, 50, 75, 100];
  for (const g of goals) {
    if (prevPct < g && nextPct >= g) return g;
  }
  return null;
}

const HOME_LAST_PCT_KEY = (lang: Lang) => `home_last_pct_v1_${lang}`;

// ✅ one-time "release ready" nudge
const HOME_RELEASE_READY_SHOWN_KEY = "home_release_ready_shown_v1";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [lang, setLang] = useState<Lang>("yo");

  // per-language learned sets
  const [learnedYo, setLearnedYo] = useState<Set<number>>(new Set());
  const [learnedIg, setLearnedIg] = useState<Set<number>>(new Set());
  const [learnedPg, setLearnedPg] = useState<Set<number>>(new Set());

  // Parent gate state
  const [gateOpen, setGateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | "reset_lang">(null);

  // ✅ celebration
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;
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

  // ✅ “Release Ready” condition (no UI layout change: just subtitle text + one-time alert)
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

  // ✅ celebration runners
  const runSparkles = useCallback(() => {
    sparkleAnim.setValue(0);
    Animated.timing(sparkleAnim, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(sparkleAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    });
  }, [sparkleAnim]);

  const runConfetti = useCallback(() => {
    confettiAnim.setValue(0);
    Animated.timing(confettiAnim, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(confettiAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start();
    });
  }, [confettiAnim]);

  // ✅ detect milestone crossing (selected language)
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HOME_LAST_PCT_KEY(lang));
        const prev = raw ? parseInt(raw, 10) || 0 : 0;
        const next = learnedPctSelected;

        const hit = hitMilestone(prev, next);
        if (hit) {
          setMilestoneHit(hit);
          runSparkles();
          runConfetti();
        }

        await AsyncStorage.setItem(HOME_LAST_PCT_KEY(lang), String(next));
      } catch {}
    })();
  }, [lang, learnedPctSelected, runSparkles, runConfetti]);

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

      // reset last pct for this lang so it won't immediately celebrate
      try {
        await AsyncStorage.setItem(HOME_LAST_PCT_KEY(lang), "0");
      } catch {}

      await refresh();
      setMilestoneHit(null);
      Alert.alert("Reset", `${titleForLang(lang)} learned progress cleared.`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Watermark overlay */}
      <View style={styles.watermarkWrap} pointerEvents="none">
        <Watermark />
      </View>

      {/* ✅ Celebration overlays */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sparkles,
          {
            opacity: sparkleAnim,
            transform: [
              { scale: sparkleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) },
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
              { translateY: confettiAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 40] }) },
            ],
          },
        ]}
      >
        <Text style={styles.confettiText}>🎉🎊🎉🎊</Text>
      </Animated.View>

      {milestoneHit ? (
        <View pointerEvents="none" style={styles.milestoneBanner}>
          <Text style={styles.milestoneText}>
            {titleForLang(lang)} hit {milestoneHit}%! 🎉
          </Text>
        </View>
      ) : null}

      {/* Parent Gate */}
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
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>AfricanKidSpeaks</Text>
            <Text style={styles.sub}>
              Pick a language, then jump in.
              {releaseReady ? " • Release Ready ✅" : ""}
            </Text>
          </View>

          <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" />
        </View>

        {/* Language cards */}
        <View style={styles.langGrid}>
          {(["yo", "ig", "pg"] as Lang[]).map((l) => {
            const active = l === lang;
            const cov = nativeCoverageFor(l);

            return (
              <Pressable
                key={l}
                onPress={() => setLang(l)}
                style={({ pressed }) => [
                  styles.langCard,
                  active && styles.langCardActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={styles.langRow}>
                  <Text style={[styles.langBadge, active && styles.langBadgeActive]}>
                    {badgeForLang(l)}
                  </Text>
                  <Text style={styles.langTitle}>{titleForLang(l)}</Text>
                </View>

                <Text style={styles.langMeta}>
                  Audio coverage: <Text style={styles.langMetaStrong}>{cov.pct}%</Text>
                </Text>
              </Pressable>
            );
          })}

          <View style={[styles.langCard, styles.langCardDisabled]}>
            <View style={styles.langRow}>
              <Text style={styles.langBadgeMuted}>+</Text>
              <Text style={styles.langTitleMuted}>More soon</Text>
            </View>
            <Text style={styles.langMetaMuted}>New languages coming in Phase 2+</Text>
          </View>
        </View>

        {/* Progress card */}
        <View style={styles.progressCard}>
          <View style={styles.progressTopRow}>
            <Text style={styles.progressTitle}>Progress summary</Text>

            <Pressable
              onPress={requestResetLang}
              style={({ pressed }) => [styles.resetLearnedBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.resetLearnedText}>Parent Reset</Text>
            </Pressable>
          </View>

          <View style={styles.summaryTop}>
            <Text style={styles.summaryLabel}>Overall (YO + IG + PG)</Text>
            <Text style={styles.summaryValue}>
              {overall.pct}%{" "}
              <Text style={styles.summaryValueSub}>
                ({overall.num}/{overall.denom})
              </Text>
            </Text>
          </View>

          <View style={styles.barOuter}>
            <View style={[styles.barInner, { width: `${clampPct(overall.pct)}%` }]} />
          </View>

          <View style={styles.miniGrid}>
            {(
              [
                { k: "yo" as Lang, label: "YO", pct: learnedPcts.yo, count: learnedCounts.yo },
                { k: "ig" as Lang, label: "IG", pct: learnedPcts.ig, count: learnedCounts.ig },
                { k: "pg" as Lang, label: "PG", pct: learnedPcts.pg, count: learnedCounts.pg },
              ] as const
            ).map(({ k, label, pct, count }) => {
              const active = k === lang;
              return (
                <View key={k} style={[styles.miniBox, active && styles.miniBoxActive]}>
                  <View style={styles.miniTopRow}>
                    <Text style={[styles.miniTag, active && styles.miniTagActive]}>{label}</Text>
                    <Text style={styles.miniPct}>{pct}%</Text>
                  </View>
                  <Text style={styles.miniSub}>
                    {count}/{totalWords} learned
                  </Text>

                  <View style={styles.miniBarOuter}>
                    <View style={[styles.miniBarInner, { width: `${clampPct(pct)}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.focusBlock}>
            <Text style={styles.focusTitle}>Learning progress • {titleForLang(lang)}</Text>

            <View style={styles.progressRow}>
              <Text style={styles.progressBig}>{learnedPctSelected}%</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.progressLabel}>
                  Learned:{" "}
                  <Text style={styles.progressStrong}>
                    {learnedCountSelected}/{totalWords}
                  </Text>
                </Text>
                <Text style={styles.progressSub}>
                  Next goal: <Text style={styles.progressStrong}>{goalPct}%</Text>
                </Text>
              </View>
            </View>

            <View style={styles.barOuter}>
              <View style={[styles.barInner, { width: `${clampPct(learnedPctSelected)}%` }]} />
            </View>

            <Pressable
              onPress={openWordsLearned}
              style={({ pressed }) => [styles.learnedBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.learnedBtnText}>Learned Summary</Text>
              <Text style={styles.learnedBtnSub}>
                Open words you marked learned • {lang.toUpperCase()}
              </Text>
            </Pressable>

            <Text style={styles.progressHint}>Tip: learned is tracked per language.</Text>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Quick stats • {lang.toUpperCase()}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Learned</Text>
              <Text style={styles.statValue}>
                {learnedCountSelected}/{totalWords}
              </Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Native audio</Text>
              <Text style={styles.statValue}>
                {nativeCoverage.pct}%{" "}
                <Text style={styles.statValueSub}>
                  ({nativeCoverage.has}/{totalWords})
                </Text>
              </Text>
            </View>
          </View>

          <View style={styles.quickLinks}>
            <Pressable
              onPress={openWordsAll}
              style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.smallBtnText}>Words (All)</Text>
            </Pressable>

            <Pressable
              onPress={openWordsMissing}
              style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.smallBtnText}>Missing Audio</Text>
            </Pressable>

            <Pressable
              onPress={openAudioReport}
              style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.smallBtnText}>Audio Report</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={refresh}
            style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={goLearn}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.primaryBtnText}>Start Learning</Text>
            <Text style={styles.primaryBtnSub}>Opens Learn • {titleForLang(lang)}</Text>
          </Pressable>

          <Pressable
            onPress={goGames}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.secondaryBtnText}>Play Games</Text>
            <Text style={styles.secondaryBtnSub}>Opens Games • {titleForLang(lang)}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  watermarkWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
  },

  // overlays
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
  milestoneBanner: {
    position: "absolute",
    top: 18,
    left: 16,
    right: 16,
    zIndex: 5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
  },
  milestoneText: { color: colors.text, fontWeight: "900" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12 as any,
    zIndex: 1,
  },

  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "transparent",
  },

  h1: { fontSize: 26, fontWeight: "900", color: colors.text },
  sub: { marginTop: 6, color: colors.muted, fontSize: 14 },

  langGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    zIndex: 1,
  },
  langCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langCardActive: {
    borderColor: colors.text,
  },
  langCardDisabled: {
    opacity: 0.65,
  },
  langRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  langBadge: {
    minWidth: 34,
    textAlign: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
    color: colors.text,
    fontWeight: "900",
    overflow: "hidden",
  },
  langBadgeActive: {
    backgroundColor: colors.text,
    color: colors.background,
  },
  langBadgeMuted: {
    minWidth: 34,
    textAlign: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
    color: colors.muted,
    fontWeight: "900",
    overflow: "hidden",
  },
  langTitle: { fontSize: 16, fontWeight: "900", color: colors.text },
  langTitleMuted: { fontSize: 16, fontWeight: "900", color: colors.muted },
  langMeta: { marginTop: 10, color: colors.muted, fontSize: 12 },
  langMetaStrong: { color: colors.text, fontWeight: "900" },
  langMetaMuted: { marginTop: 10, color: colors.muted, fontSize: 12 },

  progressCard: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 1,
  },
  progressTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10 as any,
  },
  progressTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: colors.text },

  resetLearnedBtn: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: "#d00",
    backgroundColor: "transparent",
  },
  resetLearnedText: { color: colors.text, fontWeight: "900", fontSize: 12 },

  summaryTop: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10 as any,
  },
  summaryLabel: { color: colors.muted, fontWeight: "800" },
  summaryValue: { color: colors.text, fontWeight: "900", fontSize: 16 },
  summaryValueSub: { color: colors.muted, fontSize: 12, fontWeight: "800" },

  barOuter: {
    marginTop: 10,
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  barInner: { height: "100%", backgroundColor: colors.text },

  miniGrid: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  miniBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniBoxActive: {
    borderColor: colors.text,
  },
  miniTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8 as any,
  },
  miniTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
    overflow: "hidden",
  },
  miniTagActive: {
    backgroundColor: colors.text,
    color: colors.background,
  },
  miniPct: { color: colors.text, fontWeight: "900", fontSize: 14 },
  miniSub: { marginTop: 4, color: colors.muted, fontWeight: "800", fontSize: 12 },
  miniBarOuter: {
    marginTop: 8,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  miniBarInner: { height: "100%", backgroundColor: colors.text },

  focusBlock: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  focusTitle: { fontSize: 16, fontWeight: "900", color: colors.text },

  progressRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12 as any,
  },
  progressBig: { fontSize: 34, fontWeight: "900", color: colors.text },
  progressLabel: { color: colors.muted, fontWeight: "800" },
  progressSub: { marginTop: 2, color: colors.muted, fontWeight: "800" },
  progressStrong: { color: colors.text, fontWeight: "900" },

  learnedBtn: {
    marginTop: 12,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.text,
    borderWidth: 1,
    borderColor: colors.text,
  },
  learnedBtnText: { color: colors.background, fontWeight: "900", fontSize: 15 },
  learnedBtnSub: {
    marginTop: 3,
    color: colors.background,
    opacity: 0.85,
    fontSize: 12,
    fontWeight: "800",
  },

  progressHint: { marginTop: 10, color: colors.muted, fontWeight: "700", fontSize: 12 },

  statsCard: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 1,
  },
  statsTitle: { fontSize: 16, fontWeight: "900", color: colors.text },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  statBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  statValue: { marginTop: 6, color: colors.text, fontSize: 18, fontWeight: "900" },
  statValueSub: { color: colors.muted, fontSize: 12, fontWeight: "700" },

  quickLinks: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  smallBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  smallBtnText: { color: colors.text, fontWeight: "900", fontSize: 12 },

  refreshBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  refreshText: { color: colors.text, fontWeight: "800" },

  actions: { marginTop: 16, gap: 12, zIndex: 1 },
  primaryBtn: {
    backgroundColor: colors.text,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  primaryBtnText: { color: colors.background, fontWeight: "900", fontSize: 16 },
  primaryBtnSub: { marginTop: 4, color: colors.background, opacity: 0.8, fontWeight: "700" },

  secondaryBtn: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.text, fontWeight: "900", fontSize: 16 },
  secondaryBtnSub: { marginTop: 4, color: colors.muted, fontWeight: "700" },
});
