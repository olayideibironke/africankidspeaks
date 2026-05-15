import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { palette } from "../theme/palette";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radii } from "../theme/radii";
import { shadows } from "../theme/shadows";
import { duration, easing } from "../theme/motion";
import { Text } from "../components/ui/Text";
import { Button } from "../components/ui/Button";
import { PatternBackdrop } from "../components/illustrations/PatternBackdrop";

type Props = {
  step: 1 | 2 | 3 | 4;
  totalSteps?: number;
  accentColor?: string;
  heroBg?: string;
  patternColor?: string;
  heroContent: React.ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  body?: React.ReactNode;
  ctaLabel: string;
  onCta: () => void;
  ctaDisabled?: boolean;
  ctaVariant?: "primary" | "secondary" | "inverse";
  onSkip?: () => void;
  showSkip?: boolean;
};

export function OnboardingFrame({
  step,
  totalSteps = 4,
  accentColor = palette.clay,
  heroBg = palette.linen,
  patternColor = palette.indigo,
  heroContent,
  eyebrow,
  title,
  subtitle,
  body,
  ctaLabel,
  onCta,
  ctaDisabled,
  ctaVariant = "primary",
  onSkip,
  showSkip = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideIn = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: duration.slow,
        easing: easing.emphasized,
        useNativeDriver: true,
      }),
      Animated.timing(slideIn, {
        toValue: 0,
        duration: duration.slow,
        easing: easing.emphasized,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeIn, slideIn]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View
          style={[
            styles.hero,
            {
              backgroundColor: heroBg,
              paddingTop: insets.top + spacing.md,
              paddingBottom: spacing.xl2,
            },
          ]}
        >
          <View style={styles.patternLayer} pointerEvents="none">
            <PatternBackdrop
              variant="adire-dots"
              color={patternColor}
              width={520}
              height={520}
              opacity={0.18}
            />
          </View>

          <View style={styles.heroTopRow}>
            <View style={styles.progressDots}>
              {Array.from({ length: totalSteps }).map((_, i) => {
                const active = i + 1 === step;
                const past = i + 1 < step;
                return (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      active && [styles.dotActive, { backgroundColor: accentColor }],
                      past && [styles.dotPast, { backgroundColor: accentColor }],
                    ]}
                  />
                );
              })}
            </View>

            {showSkip && onSkip ? (
              <Pressable onPress={onSkip} hitSlop={12}>
                <Text variant="caption" tone="soft">
                  Skip
                </Text>
              </Pressable>
            ) : (
              <View style={{ width: 32 }} />
            )}
          </View>

          <View style={styles.heroCenter}>{heroContent}</View>
        </View>

        <Animated.View
          style={[
            styles.body,
            {
              opacity: fadeIn,
              transform: [{ translateY: slideIn }],
              paddingBottom: insets.bottom + spacing.xl,
            },
          ]}
        >
          {eyebrow ? (
            <Text
              variant="overline"
              tone="accent"
              style={{
                color: accentColor,
                marginBottom: spacing.sm,
              }}
            >
              {eyebrow}
            </Text>
          ) : null}

          <Text variant="display3" style={styles.title}>
            {title}
          </Text>

          {subtitle ? (
            <Text variant="subtitle" tone="soft" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}

          {body ? <View style={styles.extra}>{body}</View> : null}

          <View style={styles.cta}>
            <Button
              label={ctaLabel}
              onPress={onCta}
              disabled={ctaDisabled}
              size="lg"
              fullWidth
              variant={ctaVariant}
            />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  hero: {
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: radii.xl3,
    borderBottomRightRadius: radii.xl3,
    overflow: "hidden",
    minHeight: 300,
    ...shadows.md,
  },

  patternLayer: {
    position: "absolute",
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  progressDots: {
    flexDirection: "row",
    gap: 6,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(27, 20, 40, 0.18)",
  },

  dotActive: {
    width: 24,
    height: 8,
  },

  dotPast: {
    opacity: 0.55,
  },

  heroCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },

  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },

  title: {
    marginBottom: spacing.sm,
  },

  subtitle: {
    marginBottom: spacing.lg,
  },

  extra: {
    marginBottom: spacing.xl,
  },

  cta: {
    marginTop: spacing.lg,
  },
});