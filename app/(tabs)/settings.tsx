import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as speech from "expo-speech";

import ParentGateModal from "../components/parentgate.modal";
import { flashcards } from "../data/flashcards";
import { audiomap } from "../data/audiomap.generated";
import {
  getsettings,
  updatesettings,
  type settings,
  type AudioLang,
} from "../utils/settings";
import { clearLearned } from "../utils/learned";

type Lang = "yo" | "ig" | "pg";
type GateAction = "reset_session" | "factory_reset";

const keys_to_clear_session = [
  "learn_practiced_keys_v1",
  "games_soundquiz_score_v1",
  "games_soundquiz_streak_v1",
  "games_attempts_v1",
  "games_correct_v1",
];

const HOME_LAST_PCT_KEY = (lang: Lang) => `home_last_pct_v1_${lang}`;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

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

function speechLocale(lang: AudioLang) {
  if (lang === "yo") return "yo-NG";
  if (lang === "ig") return "ig-NG";
  return "en-NG";
}

export default function SettingsScreen() {
  const mountedRef = useRef(true);

  const [gateVisible, setGateVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<GateAction | null>(null);

  const [isResetting, setIsResetting] = useState(false);
  const [coverageTick, setCoverageTick] = useState(0);

  const [appSettings, setAppSettings] = useState<settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        speech.stop();
      } catch {}
    };
  }, []);

  const loadSettings = useCallback(async () => {
    const s = await getsettings();
    if (mountedRef.current) setAppSettings(s);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const savePatch = useCallback(
    async (patch: Partial<settings>) => {
      if (saving) return;
      setSaving(true);
      try {
        const next = await updatesettings(patch);
        if (mountedRef.current) setAppSettings(next);
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [saving]
  );

  const testVoice = useCallback(() => {
    if (!appSettings) return;

    try {
      speech.stop();
    } catch {}

    const lang = appSettings.targetLang;
    const sample =
      lang === "yo"
        ? "Báwo ni. Ẹ káàrọ̀."
        : lang === "ig"
        ? "Ndewo. Ụtụtụ ọma."
        : "How far. Good morning.";

    try {
      speech.speak(sample, {
        language: speechLocale(lang),
        rate: clamp(appSettings.speechRate, 0.5, 1.2),
        pitch: clamp(appSettings.speechPitch, 0.6, 1.4),
      });
    } catch {}
  }, [appSettings]);

  const resetSessionOnly = useCallback(async () => {
    await AsyncStorage.multiRemove(keys_to_clear_session);
    await AsyncStorage.multiRemove([
      HOME_LAST_PCT_KEY("yo"),
      HOME_LAST_PCT_KEY("ig"),
      HOME_LAST_PCT_KEY("pg"),
    ]);
  }, []);

  const factoryResetAll = useCallback(async () => {
    await clearLearned();
    await resetSessionOnly();
  }, [resetSessionOnly]);

  const openGateFor = (action: GateAction) => {
    setPendingAction(action);
    setGateVisible(true);
  };

  const closeGate = () => {
    setGateVisible(false);
    setPendingAction(null);
  };

  const onGatePassed = useCallback(async () => {
    const action = pendingAction;
    closeGate();

    if (!action || isResetting) return;

    setIsResetting(true);
    try {
      if (action === "reset_session") {
        await resetSessionOnly();
        Alert.alert("Reset complete", "Learn + Games session progress cleared.");
      } else if (action === "factory_reset") {
        await factoryResetAll();
        Alert.alert("Factory reset complete", "All learned progress + session data cleared.");
      }
    } catch {
      Alert.alert("Reset failed", "Please try again.");
    } finally {
      if (mountedRef.current) {
        setIsResetting(false);
        setCoverageTick((t) => t + 1);
      }
    }
  }, [pendingAction, isResetting, resetSessionOnly, factoryResetAll]);

  const totalWords = flashcards.length;

  const coverage = useMemo(() => {
    const langs: Lang[] = ["yo", "ig", "pg"];

    const result: Record<
      Lang,
      { total: number; have: number; missing: number[]; pct: number }
    > = {
      yo: { total: totalWords, have: 0, missing: [], pct: 0 },
      ig: { total: totalWords, have: 0, missing: [], pct: 0 },
      pg: { total: totalWords, have: 0, missing: [], pct: 0 },
    };

    for (const lang of langs) {
      let have = 0;
      const missing: number[] = [];

      for (const c of flashcards as any[]) {
        const id = Number(c.id);
        const key = `${lang}/${id}`;
        if ((audiomap as any)[key]) have += 1;
        else missing.push(id);
      }

      const pct = totalWords === 0 ? 0 : Math.round((have / totalWords) * 100);
      result[lang] = { total: totalWords, have, missing, pct };
    }

    return result;
  }, [totalWords, coverageTick]);

  const renderCoverageRow = (lang: Lang) => {
    const c = coverage[lang];
    const pct = clamp(c.pct, 0, 100);

    const preview = c.missing.slice(0, 8).join(", ");
    const more = c.missing.length > 8 ? ` +${c.missing.length - 8} more` : "";

    return (
      <View style={styles.coverageCard} key={lang}>
        <View style={styles.coverageTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.coverageTitleRow}>
              <Text style={styles.coverageTag}>{shortForLang(lang)}</Text>
              <Text style={styles.coverageTitle}>{titleForLang(lang)}</Text>
            </View>

            <Text style={styles.coverageMeta}>
              Native audio{" "}
              <Text style={styles.coverageStrong}>
                {c.have}/{c.total}
              </Text>{" "}
              • Missing <Text style={styles.coverageStrong}>{c.missing.length}</Text>
            </Text>
          </View>

          <View style={styles.coveragePctPill}>
            <Text style={styles.coveragePctText}>{pct}%</Text>
          </View>
        </View>

        <View style={styles.coverageTrack}>
          <View style={[styles.coverageFill, { width: `${pct}%` }]} />
        </View>

        <Text style={styles.coverageHint}>
          Next IDs: {preview || "none"}
          {more}
        </Text>
      </View>
    );
  };

  const rate = appSettings?.speechRate ?? 0.85;
  const pitch = appSettings?.speechPitch ?? 1.0;
  const target = appSettings?.targetLang ?? "yo";

  const setLang = (l: AudioLang) => savePatch({ targetLang: l });
  const bumpRate = (delta: number) =>
    savePatch({ speechRate: clamp(rate + delta, 0.5, 1.2) });
  const bumpPitch = (delta: number) =>
    savePatch({ speechPitch: clamp(pitch + delta, 0.6, 1.4) });

  const gateTitle = "Parent gate";
  const gateSubtitle =
    pendingAction === "factory_reset"
      ? "Solve the math to factory reset (clears learned + session)"
      : "Solve the math to reset session progress";

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Text style={styles.topLabel}>settings</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextWrap}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Parent controls</Text>
              </View>

              <Text style={styles.heroTitle}>Settings</Text>
              <Text style={styles.heroSubtitle}>
                Fine-tune learning defaults, voice fallback, and protected reset tools.
              </Text>
            </View>

            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{coverage[target].pct}%</Text>
              <Text style={styles.heroStatLabel}>audio</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Learning defaults</Text>
            <Text style={styles.sectionHint}>Default language</Text>
          </View>

          <Text style={styles.sectionText}>
            Choose the default language used across the app.
          </Text>

          <View style={styles.langRow}>
            {(["yo", "ig", "pg"] as AudioLang[]).map((l) => {
              const active = l === target;
              return (
                <Pressable
                  key={l}
                  onPress={() => setLang(l)}
                  disabled={!appSettings || saving}
                  style={({ pressed }) => [
                    styles.langPill,
                    active && styles.langPillOn,
                    pressed && styles.pressDown,
                    (!appSettings || saving) && styles.disabledButton,
                  ]}
                >
                  <Text style={[styles.langPillText, active && styles.langPillTextOn]}>
                    {l.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionNote}>
            Learned progress is tracked separately for each language.
          </Text>
        </View>

        <View style={styles.voiceCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Voice tuning</Text>
            <Text style={styles.sectionHint}>TTS fallback</Text>
          </View>

          <Text style={styles.sectionText}>
            Native audio plays first. These controls only affect fallback speech.
          </Text>

          <View style={styles.kpiRow}>
            <View style={styles.kpiDarkCard}>
              <Text style={styles.kpiDarkLabel}>Rate</Text>
              <Text style={styles.kpiDarkValue}>{rate.toFixed(2)}</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Pitch</Text>
              <Text style={styles.kpiValue}>{pitch.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.controlBlock}>
            <Text style={styles.controlLabel}>Speech rate</Text>

            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => bumpRate(-0.05)}
                disabled={!appSettings || saving}
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed && styles.pressDown,
                  (!appSettings || saving) && styles.disabledButton,
                ]}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>

              <Pressable
                onPress={() => savePatch({ speechRate: 0.85 })}
                disabled={!appSettings || saving}
                style={({ pressed }) => [
                  styles.midBtn,
                  pressed && styles.pressDown,
                  (!appSettings || saving) && styles.disabledButton,
                ]}
              >
                <Text style={styles.midText}>Default</Text>
              </Pressable>

              <Pressable
                onPress={() => bumpRate(0.05)}
                disabled={!appSettings || saving}
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed && styles.pressDown,
                  (!appSettings || saving) && styles.disabledButton,
                ]}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.controlBlock}>
            <Text style={styles.controlLabel}>Speech pitch</Text>

            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => bumpPitch(-0.05)}
                disabled={!appSettings || saving}
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed && styles.pressDown,
                  (!appSettings || saving) && styles.disabledButton,
                ]}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>

              <Pressable
                onPress={() => savePatch({ speechPitch: 1.0 })}
                disabled={!appSettings || saving}
                style={({ pressed }) => [
                  styles.midBtn,
                  pressed && styles.pressDown,
                  (!appSettings || saving) && styles.disabledButton,
                ]}
              >
                <Text style={styles.midText}>Default</Text>
              </Pressable>

              <Pressable
                onPress={() => bumpPitch(0.05)}
                disabled={!appSettings || saving}
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed && styles.pressDown,
                  (!appSettings || saving) && styles.disabledButton,
                ]}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={testVoice}
            disabled={!appSettings}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressDown,
              !appSettings && styles.disabledButton,
            ]}
          >
            <Text style={styles.primaryButtonText}>Test voice</Text>
            <Text style={styles.primaryButtonSub}>
              Plays a short sample in the selected language
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reset tools</Text>
            <Text style={styles.sectionHint}>Parent protected</Text>
          </View>

          <Text style={styles.sectionText}>
            Both actions below require Parent Gate before they can run.
          </Text>

          <Pressable
            onPress={() => openGateFor("reset_session")}
            disabled={isResetting}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && !isResetting && styles.pressDown,
              isResetting && styles.disabledButton,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {isResetting ? "Please wait…" : "Reset learn + games"}
            </Text>
            <Text style={styles.secondaryButtonSub}>
              Clears practice + game stats only
            </Text>
          </Pressable>

          <Pressable
            onPress={() => openGateFor("factory_reset")}
            disabled={isResetting}
            style={({ pressed }) => [
              styles.dangerButton,
              pressed && !isResetting && styles.pressDown,
              isResetting && styles.disabledButton,
            ]}
          >
            <Text style={styles.dangerButtonText}>Factory reset (all)</Text>
            <Text style={styles.dangerButtonSub}>
              Clears learned words and session progress
            </Text>
          </Pressable>

          <Text style={styles.sectionNote}>
            Factory reset also clears milestone trackers so progress celebrations stay clean.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Audio coverage</Text>
            <Text style={styles.sectionHint}>Recorded MP3 status</Text>
          </View>

          <Text style={styles.sectionText}>
            Current native-audio coverage for Yoruba, Igbo, and Pidgin.
          </Text>

          {renderCoverageRow("yo")}
          {renderCoverageRow("ig")}
          {renderCoverageRow("pg")}

          <Text style={styles.sectionNote}>
            Workflow: assets/audio/&lt;lang&gt;/&lt;id&gt;.mp3 then rebuild audiomap.
          </Text>
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>

      <ParentGateModal
        visible={gateVisible}
        title={gateTitle}
        subtitle={gateSubtitle}
        onClose={closeGate}
        onCancel={closeGate}
        onSuccess={onGatePassed}
        onPassed={onGatePassed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  container: {
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 40,
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

  hero: {
    marginTop: 6,
    backgroundColor: "#f6f8fc",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#e9edf5",
    padding: 18,
  },
  heroTopRow: {
    flexDirection: "row",
    gap: 12,
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
  heroStatCard: {
    width: 92,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e9edf5",
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  heroStatValue: {
    fontSize: 24,
    color: "#111111",
    fontWeight: "900",
  },
  heroStatLabel: {
    marginTop: 4,
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "lowercase",
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

  sectionCard: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eceff4",
  },
  voiceCard: {
    marginTop: 18,
    backgroundColor: "#f7f8fa",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eceff4",
  },

  sectionText: {
    marginTop: 8,
    color: "#667085",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  sectionNote: {
    marginTop: 12,
    color: "#98a2b3",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  langRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  langPill: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e6eaf1",
    backgroundColor: "#ffffff",
  },
  langPillOn: {
    borderColor: "#bfd7ff",
    backgroundColor: "#f5faff",
  },
  langPillText: {
    color: "#667085",
    fontWeight: "900",
    fontSize: 14,
  },
  langPillTextOn: {
    color: "#1864d9",
  },

  kpiRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12,
  },
  kpiDarkCard: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 24,
    padding: 16,
  },
  kpiDarkLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  kpiDarkValue: {
    marginTop: 10,
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e7ebf2",
  },
  kpiLabel: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  kpiValue: {
    marginTop: 10,
    color: "#111111",
    fontSize: 30,
    fontWeight: "900",
  },

  controlBlock: {
    marginTop: 16,
  },
  controlLabel: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 15,
  },
  stepperRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  stepBtn: {
    width: 54,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e7ebf2",
    backgroundColor: "#ffffff",
  },
  stepText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 20,
  },
  midBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e7ebf2",
    backgroundColor: "#ffffff",
  },
  midText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 14,
  },

  primaryButton: {
    marginTop: 16,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#111111",
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },
  primaryButtonSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "700",
  },

  secondaryButton: {
    marginTop: 16,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e7ebf2",
  },
  secondaryButtonText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButtonSub: {
    marginTop: 4,
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
  },

  dangerButton: {
    marginTop: 12,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#fff5f4",
    borderWidth: 1.5,
    borderColor: "#d92d20",
  },
  dangerButtonText: {
    color: "#d92d20",
    fontWeight: "900",
    fontSize: 16,
  },
  dangerButtonSub: {
    marginTop: 4,
    color: "#b42318",
    fontSize: 12,
    fontWeight: "700",
  },

  coverageCard: {
    marginTop: 14,
    backgroundColor: "#f7f8fa",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eceff4",
  },
  coverageTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  coverageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  coverageTag: {
    backgroundColor: "#111111",
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  coverageTitle: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 15,
  },
  coverageMeta: {
    marginTop: 8,
    color: "#667085",
    fontWeight: "700",
    fontSize: 12,
  },
  coverageStrong: {
    color: "#111111",
    fontWeight: "900",
  },
  coveragePctPill: {
    minWidth: 58,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e7ebf2",
    backgroundColor: "#ffffff",
  },
  coveragePctText: {
    color: "#111111",
    fontWeight: "900",
  },
  coverageTrack: {
    marginTop: 12,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#e8edf5",
    overflow: "hidden",
  },
  coverageFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#1864d9",
  },
  coverageHint: {
    marginTop: 10,
    color: "#98a2b3",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },

  disabledButton: {
    opacity: 0.6,
  },
  pressDown: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});