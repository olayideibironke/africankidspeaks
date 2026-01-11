// app/(tabs)/settings.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as speech from "expo-speech";

import { colors } from "../theme";
import Watermark from "../components/watermark";
import ParentGateModal from "../components/parentgate.modal";

import { flashcards } from "../data/flashcards";
import { audiomap } from "../data/audiomap.generated";
import { getsettings, updatesettings, type settings, type AudioLang } from "../utils/settings";
import { clearLearned } from "../utils/learned";

type Lang = "yo" | "ig" | "pg";

const keys_to_clear_session = [
  "learn_practiced_keys_v1",
  "games_soundquiz_score_v1",
  "games_soundquiz_streak_v1",
  "games_attempts_v1",
  "games_correct_v1",
];

// Home milestone last-pct keys (per lang)
const HOME_LAST_PCT_KEY = (lang: Lang) => `home_last_pct_v1_${lang}`;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function titleForLang(lang: Lang) {
  if (lang === "yo") return "Yoruba";
  if (lang === "ig") return "Igbo";
  return "Pidgin";
}

function speechLocale(lang: AudioLang) {
  if (lang === "yo") return "yo-NG";
  if (lang === "ig") return "ig-NG";
  return "en-NG";
}

type GateAction = "reset_session" | "factory_reset";

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

  const openGateFor = (action: GateAction) => {
    setPendingAction(action);
    setGateVisible(true);
  };

  const closeGate = () => {
    setGateVisible(false);
    setPendingAction(null);
  };

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

  // ✅ reset helpers
  const resetSessionOnly = useCallback(async () => {
    await AsyncStorage.multiRemove(keys_to_clear_session);
    // also clear home pct keys so milestones don’t instantly retrigger weirdly after session reset
    await AsyncStorage.multiRemove([
      HOME_LAST_PCT_KEY("yo"),
      HOME_LAST_PCT_KEY("ig"),
      HOME_LAST_PCT_KEY("pg"),
    ]);
  }, []);

  const factoryResetAll = useCallback(async () => {
    // clears learned sets (yo/ig/pg) + legacy key
    await clearLearned();

    // clears session keys + home pct keys
    await resetSessionOnly();
  }, [resetSessionOnly]);

  const onGatePassed = useCallback(async () => {
    const action = pendingAction;

    // ✅ close modal FIRST (prevents crash)
    closeGate();

    if (!action) return;
    if (isResetting) return;

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

  // -------------------------
  // ✅ AUDIO COVERAGE (audiomap.generated format)
  // keys like: "yo/1"
  // -------------------------
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWords, coverageTick]);

  const renderCoverageRow = (lang: Lang) => {
    const c = coverage[lang];
    const pct = clamp(c.pct, 0, 100);

    const preview = c.missing.slice(0, 8).join(", ");
    const more = c.missing.length > 8 ? ` +${c.missing.length - 8} more` : "";

    return (
      <View style={styles.langCard} key={lang}>
        <View style={styles.langTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.langTitle}>{titleForLang(lang)}</Text>
            <Text style={styles.langMeta}>
              Native audio:{" "}
              <Text style={styles.strong}>
                {c.have}/{c.total}
              </Text>{" "}
              • Missing: <Text style={styles.strong}>{c.missing.length}</Text>
            </Text>
          </View>

          <View style={styles.pctPill}>
            <Text style={styles.pctText}>{pct}%</Text>
          </View>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>

        <Text style={styles.langHint}>
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
  const bumpRate = (delta: number) => savePatch({ speechRate: clamp(rate + delta, 0.5, 1.2) });
  const bumpPitch = (delta: number) => savePatch({ speechPitch: clamp(pitch + delta, 0.6, 1.4) });

  const gateTitle =
    pendingAction === "factory_reset" ? "Parent gate" : "Parent gate";
  const gateSubtitle =
    pendingAction === "factory_reset"
      ? "Solve the math to factory reset (clears learned + session)"
      : "Solve the math to reset session progress";

  return (
    <View style={styles.screen}>
      <View style={styles.watermarkWrap} pointerEvents="none">
        <Watermark />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.h1}>Settings</Text>
          <Text style={styles.sub}>Make it feel perfect for kids and parents.</Text>
        </View>

        {/* Learning defaults */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Learning defaults</Text>
          <Text style={styles.cardText}>Choose the default language used across the app.</Text>

          <View style={styles.pillRow}>
            {(["yo", "ig", "pg"] as AudioLang[]).map((l) => {
              const active = l === target;
              return (
                <Pressable
                  key={l}
                  onPress={() => setLang(l)}
                  disabled={!appSettings || saving}
                  style={({ pressed }) => [
                    styles.pill,
                    active && styles.pillOn,
                    pressed && { opacity: 0.9 },
                    (!appSettings || saving) && { opacity: 0.6 },
                  ]}
                >
                  <Text style={[styles.pillText, active && styles.pillTextOn]}>
                    {l.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.note}>Learned progress is tracked per language.</Text>
        </View>

        {/* Voice tuning */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Voice tuning (TTS fallback)</Text>
          <Text style={styles.cardText}>
            Native audio plays first. These settings only affect the fallback voice.
          </Text>

          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Rate</Text>
              <Text style={styles.kpiValue}>{rate.toFixed(2)}</Text>
            </View>

            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Pitch</Text>
              <Text style={styles.kpiValue}>{pitch.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Speech rate</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => bumpRate(-0.05)}
                disabled={!appSettings || saving}
                style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>

              <Pressable
                onPress={() => savePatch({ speechRate: 0.85 })}
                disabled={!appSettings || saving}
                style={({ pressed }) => [styles.midBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.midText}>Default</Text>
              </Pressable>

              <Pressable
                onPress={() => bumpRate(0.05)}
                disabled={!appSettings || saving}
                style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Speech pitch</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => bumpPitch(-0.05)}
                disabled={!appSettings || saving}
                style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>

              <Pressable
                onPress={() => savePatch({ speechPitch: 1.0 })}
                disabled={!appSettings || saving}
                style={({ pressed }) => [styles.midBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.midText}>Default</Text>
              </Pressable>

              <Pressable
                onPress={() => bumpPitch(0.05)}
                disabled={!appSettings || saving}
                style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={testVoice}
            disabled={!appSettings}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.92 },
              !appSettings && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.primaryText}>Test voice</Text>
            <Text style={styles.primarySub}>Plays a short sample in the selected language</Text>
          </Pressable>
        </View>

        {/* Resets */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reset</Text>
          <Text style={styles.cardText}>Both actions are protected by Parent Gate.</Text>

          <Pressable
            onPress={() => openGateFor("reset_session")}
            disabled={isResetting}
            style={({ pressed }) => [
              styles.secondaryBtn,
              isResetting && { opacity: 0.6 },
              pressed && !isResetting && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.secondaryText}>
              {isResetting ? "Please wait…" : "Reset Learn + Games (session)"}
            </Text>
            <Text style={styles.secondarySub}>
              Clears practice + games stats (does NOT clear learned words)
            </Text>
          </Pressable>

          <Pressable
            onPress={() => openGateFor("factory_reset")}
            disabled={isResetting}
            style={({ pressed }) => [
              styles.dangerBtn,
              isResetting && { opacity: 0.6 },
              pressed && !isResetting && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.dangerText}>Factory Reset (All)</Text>
            <Text style={styles.dangerSub}>
              Clears learned words (YO/IG/PG) + session stats
            </Text>
          </Pressable>

          <Text style={styles.note}>
            Factory reset also clears milestone trackers so celebrations stay clean.
          </Text>
        </View>

        {/* Audio coverage */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Audio coverage</Text>
          <Text style={styles.cardText}>Recorded MP3 coverage per language.</Text>

          {renderCoverageRow("yo")}
          {renderCoverageRow("ig")}
          {renderCoverageRow("pg")}

          <Text style={styles.note}>
            Workflow: assets/audio/&lt;lang&gt;/&lt;id&gt;.mp3 then rebuild audiomap.
          </Text>
        </View>

        <View style={{ height: 30 }} />
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
  screen: { flex: 1, backgroundColor: colors.background },
  watermarkWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 0 },
  container: { padding: 16, paddingBottom: 90, zIndex: 1 },

  header: { paddingTop: 8 },
  h1: { fontSize: 26, fontWeight: "900", color: colors.text },
  sub: { marginTop: 6, color: colors.muted, fontWeight: "700" },

  card: {
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
  },
  cardTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
  cardText: { marginTop: 6, color: colors.muted, fontWeight: "700", lineHeight: 18 },
  note: { marginTop: 10, color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 16 },

  pillRow: { marginTop: 12, flexDirection: "row", gap: 10 as any },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    backgroundColor: "#fff",
  },
  pillOn: { borderColor: colors.text, backgroundColor: "#f3f3f3" },
  pillText: { color: colors.muted, fontWeight: "900" },
  pillTextOn: { color: colors.text },

  kpiRow: { marginTop: 12, flexDirection: "row", gap: 12 as any },
  kpiBox: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "#fafafa",
  },
  kpiLabel: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  kpiValue: { marginTop: 6, color: colors.text, fontWeight: "900", fontSize: 18 },

  controlRow: { marginTop: 14 },
  controlLabel: { color: colors.text, fontWeight: "900" },

  stepper: { marginTop: 10, flexDirection: "row", gap: 10 as any, alignItems: "center" },
  stepBtn: {
    width: 52,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    backgroundColor: "#fff",
  },
  stepText: { color: colors.text, fontWeight: "900", fontSize: 18 },

  midBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    backgroundColor: "#fafafa",
  },
  midText: { color: colors.text, fontWeight: "900" },

  primaryBtn: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.text,
    borderWidth: 1,
    borderColor: colors.text,
  },
  primaryText: { color: colors.background, fontWeight: "900" },
  primarySub: { marginTop: 3, color: colors.background, opacity: 0.85, fontSize: 12, fontWeight: "800" },

  secondaryBtn: {
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  secondaryText: { color: colors.text, fontWeight: "900" },
  secondarySub: { marginTop: 3, color: colors.muted, fontWeight: "700", fontSize: 12 },

  dangerBtn: {
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,60,60,0.08)",
    borderWidth: 2,
    borderColor: "#d00",
  },
  dangerText: { color: colors.text, fontWeight: "900" },
  dangerSub: { marginTop: 3, color: colors.muted, fontWeight: "700", fontSize: 12 },

  langCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  langTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 as any },
  langTitle: { color: colors.text, fontWeight: "900", fontSize: 14 },
  langMeta: { marginTop: 4, color: colors.muted, fontWeight: "700", fontSize: 12 },
  strong: { color: colors.text, fontWeight: "900" },

  pctPill: {
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    backgroundColor: "#fff",
  },
  pctText: { color: colors.text, fontWeight: "900" },

  track: {
    marginTop: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 999, backgroundColor: colors.accent },

  langHint: { marginTop: 10, color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 16 },
});
