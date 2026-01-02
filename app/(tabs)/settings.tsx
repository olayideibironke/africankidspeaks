import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { colors } from "../theme";
import Watermark from "../components/watermark";
import ParentGateModal from "../components/parentgate.modal";

import { flashcards } from "../data/flashcards";
import { audiomap } from "../data/audiomap";

type Lang = "yo" | "ig" | "pg";

const keys_to_clear = [
  "learn_practiced_keys_v1",
  "games_soundquiz_score_v1",
  "games_soundquiz_streak_v1",
  "games_attempts_v1",
  "games_correct_v1",
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function SettingsScreen() {
  const mountedRef = useRef(true);

  const [gateVisible, setGateVisible] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // audio coverage uses this to refresh after reload / updates
  const [coverageTick, setCoverageTick] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const openGate = () => setGateVisible(true);
  const closeGate = () => setGateVisible(false);

  const doReset = async () => {
    if (isResetting) return;
    setIsResetting(true);

    // ✅ important: close modal FIRST (prevents crash)
    closeGate();

    try {
      await AsyncStorage.multiRemove(keys_to_clear);
    } catch {
      // ignore
    } finally {
      if (mountedRef.current) {
        setIsResetting(false);
        // refresh coverage section UI (just in case)
        setCoverageTick((t) => t + 1);
      }
    }
  };

  // -------------------------
  // ✅ AUDIO COVERAGE DASHBOARD
  // -------------------------
  const totalWords = flashcards.length;

  const coverage = useMemo(() => {
    const langs: Lang[] = ["yo", "ig", "pg"];

    const result: Record<
      Lang,
      {
        total: number;
        have: number;
        missing: number[];
        pct: number;
      }
    > = {
      yo: { total: totalWords, have: 0, missing: [], pct: 0 },
      ig: { total: totalWords, have: 0, missing: [], pct: 0 },
      pg: { total: totalWords, have: 0, missing: [], pct: 0 },
    };

    for (const lang of langs) {
      let have = 0;
      const missing: number[] = [];

      for (const c of flashcards) {
        const uri = (audiomap as any)?.[lang]?.[c.id];
        if (uri) have += 1;
        else missing.push(c.id);
      }

      const pct = totalWords === 0 ? 0 : Math.round((have / totalWords) * 100);

      result[lang] = {
        total: totalWords,
        have,
        missing,
        pct,
      };
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWords, coverageTick]);

  const renderCoverageRow = (lang: Lang, label: string) => {
    const c = coverage[lang];
    const pct = clamp(c.pct, 0, 100);

    // show a short “next to record” preview (first 6 ids)
    const preview = c.missing.slice(0, 6).join(", ");
    const more = c.missing.length > 6 ? ` +${c.missing.length - 6} more` : "";

    return (
      <View style={styles.coverageCard} key={lang}>
        <View style={styles.coverageTop}>
          <Text style={styles.coverageTitle}>{label}</Text>
          <Text style={styles.coverageKpi}>{pct}%</Text>
        </View>

        <Text style={styles.coverageMeta}>
          native audio: {c.have}/{c.total} • missing: {c.missing.length}
        </Text>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>

        <Text style={styles.coverageHint}>
          next ids: {preview || "none"}{more}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.page}>
      <Watermark />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>settings</Text>
        <Text style={styles.subtitle}>manage progress and audio quality</Text>

        {/* Reset section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>reset</Text>
          <Text style={styles.sectionText}>
            clears learn + games progress (safe parent gate).
          </Text>

          <Pressable
            onPress={openGate}
            disabled={isResetting}
            style={[styles.dangerBtn, isResetting && styles.btnDisabled]}
          >
            <Text style={styles.dangerText}>
              {isResetting ? "resetting..." : "reset all progress"}
            </Text>
          </Pressable>

          <Text style={styles.smallNote}>
            keys cleared: learn + games score/streak/attempts/correct
          </Text>
        </View>

        {/* ✅ Audio Coverage Dashboard */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>audio coverage</Text>
          <Text style={styles.sectionText}>
            native mp3 beats tts every time. this shows what’s recorded.
          </Text>

          {renderCoverageRow("yo", "yoruba")}
          {renderCoverageRow("ig", "igbo")}
          {renderCoverageRow("pg", "pidgin")}

          <Text style={styles.smallNote}>
            pro workflow: add mp3 files as assets/audio/&lt;lang&gt;/&lt;id&gt;.mp3 then run the
            audiomap generator.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ParentGateModal
        visible={gateVisible}
        title="parent gate"
        subtitle="solve the math to reset progress"
        onClose={closeGate}
        onCancel={closeGate}
        onSuccess={doReset}
        onPassed={doReset}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  scrollContent: {
    paddingBottom: 90,
  },

  title: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "900",
    color: colors.text,
    textTransform: "lowercase",
  },
  subtitle: {
    marginTop: 6,
    color: colors.muted,
    textTransform: "lowercase",
  },

  section: {
    marginTop: 16,
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: "900",
    textTransform: "lowercase",
    fontSize: 16,
  },
  sectionText: {
    marginTop: 6,
    color: colors.muted,
    textTransform: "lowercase",
  },

  dangerBtn: {
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,60,60,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,60,60,0.30)",
  },
  dangerText: {
    color: colors.text,
    fontWeight: "900",
    textTransform: "lowercase",
  },
  btnDisabled: {
    opacity: 0.6,
  },

  smallNote: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    textTransform: "lowercase",
  },

  // coverage cards
  coverageCard: {
    marginTop: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  coverageTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coverageTitle: {
    color: colors.text,
    fontWeight: "900",
    textTransform: "lowercase",
  },
  coverageKpi: {
    color: colors.text,
    fontWeight: "900",
  },
  coverageMeta: {
    marginTop: 6,
    color: colors.muted,
    textTransform: "lowercase",
  },
  track: {
    marginTop: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.40)",
  },
  coverageHint: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    textTransform: "lowercase",
  },
});
