// app/(tabs)/index.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  const learnedCountSelected = useMemo(() => {
    let n = 0;
    for (const c of flashcards as any[]) {
      const id = Number(c.id);
      if (learnedSetForSelected.has(id)) n++;
    }
    return n;
  }, [learnedSetForSelected]);

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

  // Learned breakdown by language (per-language sets, honest)
  const learnedCounts = useMemo(() => {
    const yo = learnedYo.size;
    const ig = learnedIg.size;
    const pg = learnedPg.size;
    return { yo, ig, pg };
  }, [learnedYo, learnedIg, learnedPg]);

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
      await refresh();
      Alert.alert("Reset", `${titleForLang(lang)} learned progress cleared.`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Watermark overlay */}
      <View style={styles.watermarkWrap} pointerEvents="none">
        <Watermark />
      </View>

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
            <Text style={styles.sub}>Pick a language, then jump in.</Text>
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

          {/* Placeholder */}
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
            <Text style={styles.progressTitle}>Learning progress • {titleForLang(lang)}</Text>

            <Pressable
              onPress={requestResetLang}
              style={({ pressed }) => [styles.resetLearnedBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.resetLearnedText}>Parent Reset</Text>
            </Pressable>
          </View>

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

          {/* Learned breakdown (now truly per-language) */}
          <View style={styles.breakdownRow}>
            {(
              [
                { k: "yo" as Lang, label: "YO", v: learnedCounts.yo },
                { k: "ig" as Lang, label: "IG", v: learnedCounts.ig },
                { k: "pg" as Lang, label: "PG", v: learnedCounts.pg },
              ] as const
            ).map(({ k, label, v }) => (
              <View key={k} style={styles.breakBox}>
                <Text style={styles.breakLabel}>{label} learned</Text>
                <Text style={styles.breakValue}>{v}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={openWordsLearned}
            style={({ pressed }) => [styles.learnedBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.learnedBtnText}>Learned Summary</Text>
            <Text style={styles.learnedBtnSub}>Open words you marked learned • {lang.toUpperCase()}</Text>
          </Pressable>

          <Text style={styles.progressHint}>Tip: learned is now tracked per language.</Text>
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

  breakdownRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  breakBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakLabel: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  breakValue: { marginTop: 4, color: colors.text, fontWeight: "900", fontSize: 18 },

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
