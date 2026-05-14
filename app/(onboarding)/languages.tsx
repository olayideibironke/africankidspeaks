import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { palette } from "../theme/palette";
import { lang as langTheme } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radii } from "../theme/radii";
import { duration, easing } from "../theme/motion";
import { shadows } from "../theme/shadows";
import { Text } from "../components/ui/Text";
import { Mascot } from "../components/illustrations/Mascot";
import { markOnboarded } from "../hooks/useOnboarding";
import { OnboardingFrame } from "./OnboardingFrame";

type Row = { key: "yo" | "ig" | "pg"; title: string; greeting: string; English: string };

const ROWS: Row[] = [
  { key: "yo", title: "Yoruba", greeting: "Báwo", English: "Hello" },
  { key: "ig", title: "Igbo", greeting: "Ndewo", English: "Hello" },
  { key: "pg", title: "Pidgin", greeting: "How far", English: "How are you" },
];

export default function Languages() {
  const router = useRouter();

  const fade = useRef(ROWS.map(() => new Animated.Value(0))).current;
  const lift = useRef(ROWS.map(() => new Animated.Value(14))).current;

  useEffect(() => {
    Animated.stagger(
      90,
      ROWS.map((_, i) =>
        Animated.parallel([
          Animated.timing(fade[i], {
            toValue: 1,
            duration: duration.slow,
            easing: easing.emphasized,
            useNativeDriver: true,
          }),
          Animated.timing(lift[i], {
            toValue: 0,
            duration: duration.slow,
            easing: easing.emphasized,
            useNativeDriver: true,
          }),
        ])
      )
    ).start();
  }, [fade, lift]);

  const skip = async () => {
    await markOnboarded();
    router.replace("/(tabs)");
  };

  return (
    <OnboardingFrame
      step={2}
      heroBg={palette.indigoSoft}
      patternColor={palette.indigo}
      accentColor={palette.indigo}
      eyebrow="Three languages"
      title="Yoruba, Igbo and Nigerian Pidgin"
      subtitle="Start with one — or learn all three. Progress is tracked for each language separately."
      heroContent={
        <View style={{ alignItems: "center" }}>
          <Mascot size={150} expression="happy" accent="ig" />
        </View>
      }
      body={
        <View style={styles.list}>
          {ROWS.map((row, i) => {
            const t = langTheme[row.key];
            return (
              <Animated.View
                key={row.key}
                style={[
                  styles.card,
                  shadows.sm,
                  {
                    backgroundColor: t.surface,
                    opacity: fade[i],
                    transform: [{ translateY: lift[i] }],
                  },
                ]}
              >
                <View style={[styles.tag, { backgroundColor: t.chip }]}>
                  <Text variant="overline" style={{ color: t.chipText, fontSize: 10 }}>
                    {row.key.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text variant="bodyStrong" style={{ color: t.onSurface }}>
                    {row.title}
                  </Text>
                  <Text variant="caption" tone="soft">
                    {row.greeting} · {row.English}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
      }
      ctaLabel="Sounds great"
      onCta={() => router.push("/(onboarding)/audio")}
      onSkip={skip}
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.xl,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
});
