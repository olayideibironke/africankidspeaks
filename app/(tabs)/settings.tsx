import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Animated } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as speech from "expo-speech";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme";
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

function themeForLang(lang: Lang) {
  if (lang === "yo") {
    return {
      page: "#73D7FF",
      hero: "#6f5cff",
      heroSoft: "#eee9ff",
      accent: "#ff9f43",
      accentDark: "#ef7e1a",
      pill: "#7f6cff",
      pillSoft: "#f2efff",
      text: "#2d2355",
      muted: "#7c7599",
      card: "#ffffff",
      cardAlt: "#fff3d6",
      cardAltBorder: "#ffd98a",
      orbA: "#ffd76e",
      orbB: "#9bdfff",
      orbC: "#ff9ac8",
      mascot: "🛡️",
      ribbon: "#6f5cff",
      ribbonDark: "#5440ea",
      ribbonSoft: "#eee9ff",
    };
  }

  if (lang === "ig") {
    return {
      page: "#73D7FF",
      hero: "#13ae73",
      heroSoft: "#e7fff3",
      accent: "#19b67b",
      accentDark: "#0d8f5e",
      pill: "#12a56d",
      pillSoft: "#e9fff3",
      text: "#17392d",
      muted: "#5d8071",
      card: "#ffffff",
      cardAlt: "#ecfff5",
      cardAltBorder: "#98e4be",
      orbA: "#9cf0c1",
      orbB: "#ffe07e",
      orbC: "#9ad8ff",
      mascot: "⚙️",
      ribbon: "#19b67b",
      ribbonDark: "#0e965f",
      ribbonSoft: "#e9fff3",
    };
  }

  return {
    page: "#73D7FF",
    hero: "#ff6f61",
    heroSoft: "#fff0eb",
    accent: "#ff7f50",
    accentDark: "#e85d37",
    pill: "#ff826b",
    pillSoft: "#fff0eb",
    text: "#522c2a",
    muted: "#8d6a69",
    card: "#ffffff",
    cardAlt: "#fff1e8",
    cardAltBorder: "#ffcba8",
    orbA: "#ffc190",
    orbB: "#9bdfff",
    orbC: "#ff9fc0",
    mascot: "🔐",
    ribbon: "#ff7f50",
    ribbonDark: "#e25f31",
    ribbonSoft: "#fff0e8",
  };
}

export default function SettingsScreen() {
  const mountedRef = useRef(true);
  const insets = useSafeAreaInsets();

  const [gateVisible, setGateVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<GateAction | null>(null);

  const [isResetting, setIsResetting] = useState(false);
  const [coverageTick, setCoverageTick] = useState(0);

  const [appSettings, setAppSettings] = useState<settings | null>(null);
  const [saving, setSaving] = useState(false);

  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;
  const [badgeText, setBadgeText] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        speech.stop();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2400,
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1700,
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [floatAnim, pulseAnim]);

  const loadSettings = useCallback(async () => {
    const s = await getsettings();
    if (mountedRef.current) setAppSettings(s);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const showSavedBadge = useCallback(
    (text: string) => {
      setBadgeText(text);
      badgeAnim.setValue(0);

      Animated.sequence([
        Animated.timing(badgeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(badgeAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [badgeAnim]
  );

  const savePatch = useCallback(
    async (patch: Partial<settings>, successText?: string) => {
      if (saving) return;
      setSaving(true);
      try {
        const next = await updatesettings(patch);
        if (mountedRef.current) {
          setAppSettings(next);
          if (successText) showSavedBadge(successText);
        }
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [saving, showSavedBadge]
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
  const target = (appSettings?.targetLang ?? "yo") as Lang;
  const theme = useMemo(() => themeForLang(target), [target]);

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
    const isActive = lang === target;

    return (
      <View
        style={[
          styles.coverageCard,
          {
            backgroundColor: isActive ? theme.cardAlt : "#ffffff",
            borderColor: isActive ? theme.cardAltBorder : "#ffffff",
          },
        ]}
        key={lang}
      >
        <View style={styles.coverageTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.coverageTitleRow}>
              <View
                style={[
                  styles.coverageTagWrap,
                  { backgroundColor: isActive ? theme.pill : theme.heroSoft },
                ]}
              >
                <Text
                  style={[
                    styles.coverageTag,
                    { color: isActive ? "#ffffff" : theme.text },
                  ]}
                >
                  {shortForLang(lang)}
                </Text>
              </View>

              <Text style={[styles.coverageTitle, { color: theme.text }]}>
                {titleForLang(lang)}
              </Text>
            </View>

            <Text style={[styles.coverageMeta, { color: theme.muted }]}>
              Native audio{" "}
              <Text style={[styles.coverageStrong, { color: theme.text }]}>
                {c.have}/{c.total}
              </Text>{" "}
              • Missing{" "}
              <Text style={[styles.coverageStrong, { color: theme.text }]}>
                {c.missing.length}
              </Text>
            </Text>
          </View>

          <View
            style={[
              styles.coveragePctPill,
              { backgroundColor: isActive ? theme.hero : theme.heroSoft },
            ]}
          >
            <Text
              style={[
                styles.coveragePctText,
                { color: isActive ? "#ffffff" : theme.text },
              ]}
            >
              {pct}%
            </Text>
          </View>
        </View>

        <View style={styles.coverageTrack}>
          <View
            style={[
              styles.coverageFill,
              {
                width: `${pct}%`,
                backgroundColor: isActive ? theme.accent : theme.pill,
              },
            ]}
          />
        </View>

        <Text style={[styles.coverageHint, { color: theme.muted }]}>
          Next IDs: {preview || "none"}
          {more}
        </Text>
      </View>
    );
  };

  const rate = appSettings?.speechRate ?? 0.85;
  const pitch = appSettings?.speechPitch ?? 1.0;

  const setLang = (l: AudioLang) => savePatch({ targetLang: l }, "Language saved");
  const bumpRate = (delta: number) =>
    savePatch({ speechRate: clamp(rate + delta, 0.5, 1.2) }, "Rate updated");
  const bumpPitch = (delta: number) =>
    savePatch({ speechPitch: clamp(pitch + delta, 0.6, 1.4) }, "Pitch updated");

  const gateTitle = "Parent gate";
  const gateSubtitle =
    pendingAction === "factory_reset"
      ? "Solve the math to factory reset (clears learned + session)"
      : "Solve the math to reset session progress";

  const mascotBob = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const mascotScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  return (
    <View style={[styles.screen, { backgroundColor: theme.page }]}>
      <View style={[styles.bgGlowTop, { backgroundColor: colors.primary }]} />
      <View style={[styles.bgGlowRight, { backgroundColor: colors.sky }]} />
      <View style={[styles.bgGlowBottom, { backgroundColor: colors.pink }]} />
      <View style={styles.bgGlowCenter} />

      <View style={[styles.bgOrbTop, { backgroundColor: theme.orbA }]} />
      <View style={[styles.bgOrbRight, { backgroundColor: theme.orbB }]} />
      <View style={[styles.bgOrbBottom, { backgroundColor: theme.orbC }]} />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.badgeWrap,
          {
            opacity: badgeAnim,
            transform: [
              {
                translateY: badgeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[styles.badgeCard, { backgroundColor: theme.accent }]}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRibbonRow}>
          <View
            style={[
              styles.headerRibbon,
              {
                backgroundColor: theme.ribbonSoft,
                borderColor: theme.ribbon,
              },
            ]}
          >
            <View
              style={[
                styles.headerRibbonCap,
                { backgroundColor: theme.ribbonDark },
              ]}
            />
            <Text style={[styles.headerRibbonEmoji, { color: theme.ribbonDark }]}>
              ⚙️
            </Text>
            <Text style={[styles.headerRibbonText, { color: theme.ribbonDark }]}>
              settings
            </Text>
          </View>
        </View>

        <View style={[styles.hero, { backgroundColor: theme.hero }]}>
          <View style={[styles.heroBubbleOne, { backgroundColor: theme.orbA }]} />
          <View style={[styles.heroBubbleTwo, { backgroundColor: theme.orbB }]} />
          <View style={[styles.heroBubbleThree, { backgroundColor: theme.orbC }]} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroTextWrap}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Parent controls</Text>
              </View>

              <Text style={styles.heroTitle}>Set up your learning space</Text>
              <Text style={styles.heroSubtitle}>
                Tune language, voice fallback, and protected reset tools for a kid-friendly experience.
              </Text>
            </View>

            <Animated.View
              style={[
                styles.heroMascotWrap,
                {
                  transform: [{ translateY: mascotBob }, { scale: mascotScale }],
                },
              ]}
            >
              <Text style={styles.heroMascot}>{theme.mascot}</Text>
            </Animated.View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{coverage[target].pct}%</Text>
              <Text style={styles.heroStatLabel}>audio</Text>
            </View>

            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{titleForLang(target)}</Text>
              <Text style={styles.heroStatLabel}>default</Text>
            </View>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: "#ffffff" }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Learning defaults</Text>
            <Text style={[styles.sectionHint, { color: theme.muted }]}>Default language</Text>
          </View>

          <Text style={[styles.sectionText, { color: theme.muted }]}>
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
                    {
                      backgroundColor: active ? theme.pill : "#ffffff",
                      borderColor: active ? theme.pill : "#ffffff",
                    },
                    pressed && styles.pressDown,
                    (!appSettings || saving) && styles.disabledButton,
                  ]}
                >
                  <Text
                    style={[
                      styles.langPillText,
                      { color: active ? "#ffffff" : theme.text },
                    ]}
                  >
                    {shortForLang(l)}
                  </Text>
                  <Text
                    style={[
                      styles.langPillSub,
                      { color: active ? "rgba(255,255,255,0.85)" : theme.muted },
                    ]}
                  >
                    {titleForLang(l as Lang)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionNote, { color: theme.muted }]}>
            Learned progress is tracked separately for each language.
          </Text>
        </View>

        <View style={[styles.voiceCard, { backgroundColor: theme.heroSoft }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Voice tuning</Text>
            <Text style={[styles.sectionHint, { color: theme.muted }]}>TTS fallback</Text>
          </View>

          <Text style={[styles.sectionText, { color: theme.muted }]}>
            Native audio plays first. These controls only affect fallback speech.
          </Text>

          <View style={styles.kpiRow}>
            <View style={[styles.kpiCardBig, { backgroundColor: theme.accent }]}>
              <Text style={styles.kpiBigLabel}>Rate</Text>
              <Text style={styles.kpiBigValue}>{rate.toFixed(2)}</Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: "#ffffff" }]}>
              <Text style={[styles.kpiLabel, { color: theme.muted }]}>Pitch</Text>
              <Text style={[styles.kpiValue, { color: theme.text }]}>{pitch.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.controlBlock}>
            <Text style={[styles.controlLabel, { color: theme.text }]}>Speech rate</Text>

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
                <Text style={[styles.stepText, { color: theme.text }]}>−</Text>
              </Pressable>

              <Pressable
                onPress={() => savePatch({ speechRate: 0.85 }, "Rate reset")}
                disabled={!appSettings || saving}
                style={({ pressed }) => [
                  styles.midBtn,
                  pressed && styles.pressDown,
                  (!appSettings || saving) && styles.disabledButton,
                ]}
              >
                <Text style={[styles.midText, { color: theme.text }]}>Default</Text>
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
                <Text style={[styles.stepText, { color: theme.text }]}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.controlBlock}>
            <Text style={[styles.controlLabel, { color: theme.text }]}>Speech pitch</Text>

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
                <Text style={[styles.stepText, { color: theme.text }]}>−</Text>
              </Pressable>

              <Pressable
                onPress={() => savePatch({ speechPitch: 1.0 }, "Pitch reset")}
                disabled={!appSettings || saving}
                style={({ pressed }) => [
                  styles.midBtn,
                  pressed && styles.pressDown,
                  (!appSettings || saving) && styles.disabledButton,
                ]}
              >
                <Text style={[styles.midText, { color: theme.text }]}>Default</Text>
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
                <Text style={[styles.stepText, { color: theme.text }]}>+</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={testVoice}
            disabled={!appSettings}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: theme.hero,
                borderColor: theme.hero,
              },
              pressed && styles.pressDown,
              !appSettings && styles.disabledButton,
            ]}
          >
            <Text style={styles.primaryButtonEmoji}>🔊</Text>
            <Text style={styles.primaryButtonText}>Test voice</Text>
            <Text style={styles.primaryButtonSub}>
              Plays a short sample in the selected language
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: theme.cardAlt, borderColor: theme.cardAltBorder },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Reset tools</Text>
            <Text style={[styles.sectionHint, { color: theme.muted }]}>Parent protected</Text>
          </View>

          <Text style={[styles.sectionText, { color: theme.muted }]}>
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
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
              {isResetting ? "Please wait…" : "Reset learn + games"}
            </Text>
            <Text style={[styles.secondaryButtonSub, { color: theme.muted }]}>
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

          <Text style={[styles.sectionNote, { color: theme.muted }]}>
            Factory reset also clears milestone trackers so progress celebrations stay clean.
          </Text>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: "#ffffff" }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Audio coverage</Text>
            <Text style={[styles.sectionHint, { color: theme.muted }]}>Recorded MP3 status</Text>
          </View>

          <Text style={[styles.sectionText, { color: theme.muted }]}>
            Current native-audio coverage for Yoruba, Igbo, and Pidgin.
          </Text>

          {renderCoverageRow("yo")}
          {renderCoverageRow("ig")}
          {renderCoverageRow("pg")}

          <Text style={[styles.sectionNote, { color: theme.muted }]}>
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
  },

  bgGlowTop: {
    position: "absolute",
    top: -36,
    left: -24,
    width: 190,
    height: 190,
    borderRadius: 999,
    opacity: 0.22,
  },
  bgGlowRight: {
    position: "absolute",
    top: 180,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 999,
    opacity: 0.18,
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: 120,
    left: -36,
    width: 190,
    height: 190,
    borderRadius: 999,
    opacity: 0.18,
  },
  bgGlowCenter: {
    position: "absolute",
    top: 360,
    left: "34%",
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "#ffd76e",
    opacity: 0.16,
  },

  bgOrbTop: {
    position: "absolute",
    top: 94,
    left: -28,
    width: 128,
    height: 128,
    borderRadius: 999,
    opacity: 0.12,
  },
  bgOrbRight: {
    position: "absolute",
    top: 220,
    right: -32,
    width: 150,
    height: 150,
    borderRadius: 999,
    opacity: 0.12,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: 120,
    left: -22,
    width: 118,
    height: 118,
    borderRadius: 999,
    opacity: 0.12,
  },

  container: {
    paddingHorizontal: 18,
  },

  badgeWrap: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 20,
    alignItems: "center",
  },
  badgeCard: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  badgeText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },

  headerRibbonRow: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerRibbon: {
    minWidth: 144,
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

  hero: {
    marginTop: 2,
    borderRadius: 34,
    padding: 20,
    overflow: "hidden",
  },
  heroBubbleOne: {
    position: "absolute",
    width: 122,
    height: 122,
    borderRadius: 999,
    top: -24,
    right: -10,
    opacity: 0.3,
  },
  heroBubbleTwo: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 999,
    bottom: 24,
    right: 24,
    opacity: 0.22,
  },
  heroBubbleThree: {
    position: "absolute",
    width: 118,
    height: 118,
    borderRadius: 999,
    left: -30,
    bottom: -42,
    opacity: 0.2,
  },
  heroTopRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  heroTextWrap: {
    flex: 1,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    color: "#ffffff",
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.92)",
    fontWeight: "700",
    maxWidth: 255,
  },
  heroMascotWrap: {
    width: 82,
    height: 82,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroMascot: {
    fontSize: 34,
  },
  heroStatsRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  heroStatValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  heroStatLabel: {
    marginTop: 4,
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "lowercase",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: "800",
  },

  sectionCard: {
    marginTop: 18,
    borderRadius: 30,
    padding: 18,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  voiceCard: {
    marginTop: 18,
    borderRadius: 30,
    padding: 18,
    borderWidth: 2,
    borderColor: "transparent",
  },

  sectionText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  sectionNote: {
    marginTop: 12,
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
    flex: 1,
    borderRadius: 24,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  langPillText: {
    fontWeight: "900",
    fontSize: 15,
  },
  langPillSub: {
    marginTop: 4,
    fontWeight: "800",
    fontSize: 11,
  },

  kpiRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12,
  },
  kpiCardBig: {
    flex: 1,
    borderRadius: 28,
    padding: 16,
  },
  kpiBigLabel: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  kpiBigValue: {
    marginTop: 10,
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
  },
  kpiCard: {
    flex: 1,
    borderRadius: 28,
    padding: 16,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  kpiValue: {
    marginTop: 10,
    fontSize: 30,
    fontWeight: "900",
  },

  controlBlock: {
    marginTop: 16,
  },
  controlLabel: {
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
    width: 56,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
  },
  stepText: {
    fontWeight: "900",
    fontSize: 22,
  },
  midBtn: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
  },
  midText: {
    fontWeight: "900",
    fontSize: 14,
  },

  primaryButton: {
    marginTop: 16,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 2,
    alignItems: "center",
  },
  primaryButtonEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },
  primaryButtonSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  secondaryButton: {
    marginTop: 16,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  secondaryButtonText: {
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButtonSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },

  dangerButton: {
    marginTop: 12,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#fff5f4",
    borderWidth: 2,
    borderColor: "#ef5a4f",
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
    borderRadius: 24,
    padding: 16,
    borderWidth: 2,
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
  coverageTagWrap: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  coverageTag: {
    fontWeight: "900",
    fontSize: 11,
  },
  coverageTitle: {
    fontWeight: "900",
    fontSize: 15,
  },
  coverageMeta: {
    marginTop: 8,
    fontWeight: "700",
    fontSize: 12,
  },
  coverageStrong: {
    fontWeight: "900",
  },
  coveragePctPill: {
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  coveragePctText: {
    fontWeight: "900",
  },
  coverageTrack: {
    marginTop: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#ece8fb",
    overflow: "hidden",
  },
  coverageFill: {
    height: "100%",
    borderRadius: 999,
  },
  coverageHint: {
    marginTop: 10,
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
