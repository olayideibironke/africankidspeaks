import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { useRouter } from "expo-router";

import { palette } from "../theme/palette";
import { duration, easing } from "../theme/motion";
import { Mascot } from "../components/illustrations/Mascot";
import { LogoMark } from "../components/illustrations/LogoMark";
import { markOnboarded } from "../hooks/useOnboarding";
import { OnboardingFrame } from "./OnboardingFrame";

export default function Welcome() {
  const router = useRouter();
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2400,
          easing: easing.standard,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2400,
          easing: easing.standard,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const skip = async () => {
    await markOnboarded();
    router.replace("/(tabs)");
  };

  return (
    <OnboardingFrame
      step={1}
      heroBg={palette.claySoft}
      patternColor={palette.clayDeep}
      accentColor={palette.clay}
      eyebrow="Welcome"
      title="Learn African languages the fun way"
      subtitle="A premium voice-first learning app for kids in the diaspora, built around real native speakers."
      heroContent={
        <View style={{ alignItems: "center" }}>
          <View style={{ marginBottom: 24 }}>
            <LogoMark size={68} variant="lockup-stacked" />
          </View>
          <Animated.View style={{ transform: [{ translateY }] }}>
            <Mascot size={180} expression="wave" accent="yo" />
          </Animated.View>
        </View>
      }
      ctaLabel="Get started"
      onCta={() => router.push("/(onboarding)/languages")}
      onSkip={skip}
    />
  );
}
