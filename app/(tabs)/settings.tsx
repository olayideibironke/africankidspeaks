import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { palette } from "../theme/palette";
import { colors, lang as langTheme, type LangKey } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radii } from "../theme/radii";
import { shadows } from "../theme/shadows";
import { pressScale } from "../theme/motion";

import { Screen } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { Pill } from "../components/ui/Pill";
import { ProgressBar } from "../components/ui/ProgressBar";
import { LogoMark } from "../components/illustrations/LogoMark";

import { flashcards } from "../data/flashcards";
import { audiomap } from "../data/audiomap.generated";
import { clearLearned, getLearnedSetForLang } from "../utils/learned";
import { getsettings, updatesettings, type settings } from "../utils/settings";
import {
  getDefaultLang,
  setDefaultLang,
  resetOnboarding,
} from "../hooks/useOnboarding";

import ParentGateModal from "../components/parentgate.modal";

const LANG_LABELS: Record<LangKey, string> = {
  yo: "Yoruba",
  ig: "Igbo",
  pg: "Pidgin",
};

const SESSION_KEYS = [
  "learn_practiced_keys_v1",
  "games_soundquiz_score_v1",
  "games_soundquiz_streak_v1",
  "games_attempts_v1",
  "games_correct_v1",
  "games_adaptive_v1_yo_sound",
  "games_adaptive_v1_ig_sound",
  "games_adaptive_v1_pg_sound",
  "games_adaptive_v1_yo_match",
  "games_adaptive_v1_ig_match",
  "games_adaptive_v1_pg_match",
  "home_last_pct_v1_yo",
  "home_last_pct_v1_ig",
  "home_last_pct_v1_pg",
];

type GateAction = "reset_session" | "factory_reset" | "redo_onboarding";

export default function SettingsScreen() {
  const router = useRouter();
  const [defaultLang, setDefaultLangState] = useState<LangKey>("yo");
  const [settingsState, setSettingsState] = useState<settings | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<GateAction | null>(null);
  const [counts, setCounts] = useState<Record<LangKey, number>>({
    yo: 0,
    ig: 0,
    pg: 0,
  });

  const total = flashcards.length;

  const loadAll = useCallback(async () => {
    try {
      const [d, s, yo, ig, pg] = await Promise.all([
        getDefaultLang(),
        getsettings(),
        getLearnedSetForLang("yo"),
        getLearnedSetForLang("ig"),
        getLearnedSetForLang("pg"),
      ]);
      setDefaultLangState(d);
      setSettingsState(s);
      setCounts({ yo: yo.size, ig: ig.size, pg: pg.size });
    } catch {}
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const audioCoverage = useMemo(() => {
    const result: Record<LangKey, number> = { yo: 0, ig: 0, pg: 0 };
    for (const l of ["yo", "ig", "pg"] as LangKey[]) {
      let has = 0;
      for (const c of flashcards as readonly any[]) {
        const k = `${l}/${c.id}`;
        if ((audiomap as any)[k]) has++;
      }
      result[l] = total > 0 ? Math.round((has / total) * 100) : 0;
    }
    return result;
  }, [total]);

  const handleSelectLang = async (l: LangKey) => {
    setDefaultLangState(l);
    await setDefaultLang(l);
    if (settingsState) {
      const next = await updatesettings({ targetLang: l });
      setSettingsState(next);
    }
  };

  const setSpeechRate = async (rate: number) => {
    if (!settingsState) return;
    const next = await updatesettings({ speechRate: rate });
    setSettingsState(next);
  };

  const openGate = (action: GateAction) => {
    setPendingAction(action);
    setGateOpen(true);
  };

  const closeGate = () => {
    setGateOpen(false);
    setPendingAction(null);
  };

  const onGatePass = async () => {
    const action = pendingAction;
    closeGate();
    if (!action) return;

    if (action === "reset_session") {
      try {
        await Promise.all(SESSION_KEYS.map((k) => AsyncStorage.removeItem(k)));
      } catch {}
      Alert.alert("Cleared", "Session progress was reset.");
    }

    if (action === "factory_reset") {
      try {
        await clearLearned();
        await Promise.all(SESSION_KEYS.map((k) => AsyncStorage.removeItem(k)));
      } catch {}
      await loadAll();
      Alert.alert("Reset", "All learning progress cleared.");
    }

    if (action === "redo_onboarding") {
      await resetOnboarding();
      router.replace("/(onboarding)/welcome");
    }
  };

  const gateTitle = pendingAction === "factory_reset" ? "factory reset" : "parent gate";
  const gateSubtitle =
    pendingAction === "factory_reset"
      ? "solve the math to wipe all learning progress"
      : pendingAction === "redo_onboarding"
      ? "solve the math to redo the onboarding"
      : "solve the math to reset this session";

  return (
    <>
      {gateOpen ? (
        <ParentGateModal
          visible={gateOpen}
          onClose={closeGate}
          onCancel={closeGate}
          onSuccess={onGatePass}
          onPassed={onGatePass}
          title={gateTitle}
          subtitle={gateSubtitle}
        />
      ) : null}

      <Screen background={colors.background} bottomInsetExtra={100}>
        <View style={styles.header}>
          <Text variant="overline" tone="muted">Settings</Text>
          <Text variant="title">Parent zone</Text>
          <Text variant="caption" tone="soft">
            Manage preferences, audio, and your child's progress.
          </Text>
        </View>

        <SectionLabel label="Default language" />
        <Card variant="elevated" padding="md" radius="xl2">
          {(["yo", "ig", "pg"] as LangKey[]).map((l, i) => {
            const active = l === defaultLang;
            const t = langTheme[l];
            return (
              <Pressable
                key={l}
                onPress={() => handleSelectLang(l)}
                style={({ pressed }) => [
                  styles.langRow,
                  i > 0 && styles.langRowBorder,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={[styles.langDot, { backgroundColor: t.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{LANG_LABELS[l]}</Text>
                  <Text variant="caption" tone="soft">
                    {counts[l]}/{total} learned · {audioCoverage[l]}% native audio
                  </Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: active ? t.primary : palette.mist,
                      backgroundColor: active ? t.primary : "transparent",
                    },
                  ]}
                >
                  {active ? <View style={styles.radioInner} /> : null}
                </View>
              </Pressable>
            );
          })}
        </Card>

        <SectionLabel label="Speech rate (TTS fallback)" />
        <Card variant="elevated" padding="lg" radius="xl2">
          <Text variant="caption" tone="soft" style={{ marginBottom: spacing.md }}>
            Used only when a native recording is unavailable. Slower is easier for younger kids.
          </Text>
          <View style={styles.rateRow}>
            <RateChip
              label="Slow"
              active={(settingsState?.speechRate ?? 0.85) <= 0.75}
              onPress={() => setSpeechRate(0.7)}
            />
            <RateChip
              label="Normal"
              active={
                (settingsState?.speechRate ?? 0.85) > 0.75 &&
                (settingsState?.speechRate ?? 0.85) < 1.0
              }
              onPress={() => setSpeechRate(0.85)}
            />
            <RateChip
              label="Fast"
              active={(settingsState?.speechRate ?? 0.85) >= 1.0}
              onPress={() => setSpeechRate(1.05)}
            />
          </View>
        </Card>

        <SectionLabel label="Audio coverage" />
        <Card variant="elevated" padding="lg" radius="xl2">
          {(["yo", "ig", "pg"] as LangKey[]).map((l, i) => {
            const t = langTheme[l];
            const pct = audioCoverage[l];
            return (
              <View
                key={l}
                style={[styles.coverageRow, i > 0 && { marginTop: spacing.md }]}
              >
                <Pill
                  label={l.toUpperCase()}
                  variant="solid"
                  bg={t.primary}
                  color={palette.white}
                  size="sm"
                />
                <View style={{ flex: 1 }}>
                  <View style={styles.coverageHead}>
                    <Text variant="bodyStrong">{LANG_LABELS[l]}</Text>
                    <Text variant="caption" tone="soft">{pct}%</Text>
                  </View>
                  <ProgressBar value={pct} fillColor={t.primary} height={6} />
                </View>
              </View>
            );
          })}
        </Card>

        <SectionLabel label="Parent controls" />
        <Card variant="elevated" padding="lg" radius="xl2">
          <ControlRow
            icon="refresh"
            iconBg={palette.sunlit}
            title="Reset session"
            subtitle="Clear today's score, streak, and milestones"
            onPress={() => openGate("reset_session")}
          />
          <View style={styles.divider} />
          <ControlRow
            icon="trash"
            iconBg={palette.clay}
            title="Reset all progress"
            subtitle="Wipe learned words and game stats across all languages"
            onPress={() => openGate("factory_reset")}
          />
          <View style={styles.divider} />
          <ControlRow
            icon="sparkles"
            iconBg={palette.indigo}
            title="Redo onboarding"
            subtitle="Show the first-launch flow again"
            onPress={() => openGate("redo_onboarding")}
          />
        </Card>

        <SectionLabel label="About" />
        <Card variant="elevated" padding="lg" radius="xl2">
          <View style={styles.aboutHead}>
            <LogoMark size={48} variant="icon" />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="bodyStrong">AfricanKidSpeaks</Text>
              <Text variant="caption" tone="soft">
                Yoruba · Igbo · Pidgin · Native audio
              </Text>
            </View>
          </View>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
            Built for African kids in the diaspora to reconnect with their native
            languages through real native speakers, not robotic voices.
          </Text>
        </Card>
      </Screen>
    </>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text
      variant="overline"
      tone="muted"
      style={{ marginTop: spacing.xl2, marginBottom: spacing.md }}
    >
      {label}
    </Text>
  );
}

function RateChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rateChip,
        {
          backgroundColor: active ? palette.clay : palette.white,
          borderColor: active ? palette.clay : palette.hairline,
        },
        pressed && { transform: [{ scale: pressScale.medium }] },
      ]}
    >
      <Text
        variant="button"
        style={{ color: active ? palette.white : palette.ink }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ControlRow({
  icon,
  iconBg,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.controlRow, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.controlIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={palette.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="soft">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={palette.mist} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },

  langRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  langRowBorder: {
    borderTopWidth: 1,
    borderTopColor: palette.hairline,
  },
  langDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.white,
  },

  rateRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  rateChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: "center",
  },

  coverageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  coverageHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  controlIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: palette.hairline,
  },

  aboutHead: {
    flexDirection: "row",
    alignItems: "center",
  },
});
