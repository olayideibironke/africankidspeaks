import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { palette } from "../theme/palette";
import { lang as langTheme, type LangKey } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radii } from "../theme/radii";
import { shadows } from "../theme/shadows";
import { duration, easing, pressScale } from "../theme/motion";
import { Text } from "../components/ui/Text";
import { Mascot } from "../components/illustrations/Mascot";
import { markOnboarded, setDefaultLang } from "../hooks/useOnboarding";
import { playWordAudio } from "../utils/play-word-audio";
import { OnboardingFrame } from "./OnboardingFrame";

type Choice = {
  key: LangKey;
  title: string;
  greeting: string;
  english: string;
  ttsLang: string;
};

const CHOICES: Choice[] = [
  { key: "yo", title: "Yoruba", greeting: "Báwo", english: "Hello", ttsLang: "yo-NG" },
  { key: "ig", title: "Igbo", greeting: "Ndewo", english: "Hello", ttsLang: "ig-NG" },
  { key: "pg", title: "Pidgin", greeting: "How far", english: "How are you", ttsLang: "en-NG" },
];

export default function Ready() {
  const router = useRouter();
  const [selected, setSelected] = useState<LangKey>("yo");

  const onSelect = async (k: LangKey) => {
    setSelected(k);
    const c = CHOICES.find((x) => x.key === k)!;
    try {
      await playWordAudio({ lang: k, id: 1, ttsText: c.greeting, ttsLang: c.ttsLang });
    } catch {}
  };

  const finish = async () => {
    await setDefaultLang(selected);
    await markOnboarded();
    router.replace("/(tabs)");
  };

  const skip = finish;

  const accent = langTheme[selected];

  return (
    <OnboardingFrame
      step={4}
      heroBg={accent.surface}
      patternColor={accent.primary}
      accentColor={accent.primary}
      eyebrow="One more step"
      title="Pick your starting language"
      subtitle="You can switch any time — and tap any card to hear its greeting now."
      heroContent={
        <View style={{ alignItems: "center" }}>
          <Mascot size={140} expression="happy" accent={selected} />
        </View>
      }
      body={
        <View style={styles.list}>
          {CHOICES.map((c) => (
            <ChoiceCard
              key={c.key}
              choice={c}
              selected={selected === c.key}
              onPress={() => onSelect(c.key)}
            />
          ))}
        </View>
      }
      ctaLabel={`Start learning ${CHOICES.find((c) => c.key === selected)!.title}`}
      onCta={finish}
      ctaVariant="primary"
      onSkip={skip}
      showSkip={false}
    />
  );
}

function ChoiceCard({
  choice,
  selected,
  onPress,
}: {
  choice: Choice;
  selected: boolean;
  onPress: () => void;
}) {
  const t = langTheme[choice.key];
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to: number) =>
    Animated.timing(scale, {
      toValue: to,
      duration: duration.fast,
      easing: easing.standard,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animate(pressScale.medium)}
        onPressOut={() => animate(1)}
        style={[
          styles.card,
          shadows.sm,
          {
            backgroundColor: selected ? t.surface : palette.white,
            borderColor: selected ? t.primary : "transparent",
            borderWidth: 2,
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: t.primary }]} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text variant="bodyStrong" style={{ color: selected ? t.onSurface : palette.ink }}>
            {choice.title}
          </Text>
          <Text variant="caption" tone="soft">
            {choice.greeting} · {choice.english}
          </Text>
        </View>
        <View
          style={[
            styles.radio,
            {
              borderColor: selected ? t.primary : palette.mist,
              backgroundColor: selected ? t.primary : "transparent",
            },
          ]}
        >
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
      </Pressable>
    </Animated.View>
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
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
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
});
