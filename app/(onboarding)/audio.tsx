import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { palette } from "../theme/palette";
import { spacing } from "../theme/spacing";
import { radii } from "../theme/radii";
import { shadows } from "../theme/shadows";
import { duration, easing } from "../theme/motion";
import { Text } from "../components/ui/Text";
import { AudioButton } from "../components/ui/AudioButton";
import { Mascot } from "../components/illustrations/Mascot";
import { playWordAudio } from "../utils/play-word-audio";
import { markOnboarded } from "../hooks/useOnboarding";
import { OnboardingFrame } from "./OnboardingFrame";

const BARS = 9;

export default function AudioIntro() {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);

  const bars = useRef(
    Array.from({ length: BARS }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (!playing) {
      bars.forEach((b) => b.setValue(0.3));
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 60),
          Animated.timing(b, {
            toValue: 1,
            duration: 350,
            easing: easing.standard,
            useNativeDriver: false,
          }),
          Animated.timing(b, {
            toValue: 0.3,
            duration: 350,
            easing: easing.standard,
            useNativeDriver: false,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [playing, bars]);

  const handlePlay = async () => {
    setPlaying(true);
    try {
      await playWordAudio({
        lang: "yo",
        id: 1,
        ttsText: "Báwo",
        ttsLang: "yo-NG",
      });
    } catch {}
    setTimeout(() => setPlaying(false), 2400);
  };

  const skip = async () => {
    await markOnboarded();
    router.replace("/(tabs)");
  };

  return (
    <OnboardingFrame
      step={3}
      heroBg={palette.sunlitSoft}
      patternColor={palette.sunlitDeep}
      accentColor={palette.sunlitDeep}
      eyebrow="Real voices"
      title="Native audio, not robotic voices"
      subtitle="Every word is recorded by native speakers. Tap to hear the difference for yourself."
      heroContent={
        <View style={{ alignItems: "center" }}>
          <Mascot size={140} expression="listening" accent="pg" />
        </View>
      }
      body={
        <View style={[styles.card, shadows.md]}>
          <View style={styles.cardRow}>
            <AudioButton
              onPress={handlePlay}
              playing={playing}
              tint={palette.clay}
              size={64}
              accessibilityLabel="Play Yoruba greeting"
            />
            <View style={styles.equalizer}>
              {bars.map((b, i) => {
                const h = b.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 46],
                });
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.bar,
                      {
                        height: h,
                        backgroundColor: i % 2 === 0 ? palette.clay : palette.sunlitDeep,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>
          <View style={styles.cardLabel}>
            <Text variant="overline" tone="muted">
              Yoruba · báwo
            </Text>
            <Text variant="bodyStrong" tone="default">
              Hello
            </Text>
          </View>
        </View>
      }
      ctaLabel="Hear more"
      onCta={() => router.push("/(onboarding)/ready")}
      onSkip={skip}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.white,
    borderRadius: radii.xl2,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  equalizer: {
    flex: 1,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  bar: {
    flex: 1,
    borderRadius: 4,
  },
  cardLabel: {
    marginTop: spacing.md,
  },
});
