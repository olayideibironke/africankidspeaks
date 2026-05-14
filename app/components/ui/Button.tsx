import React, { useRef } from "react";
import {
  Pressable,
  Animated,
  StyleSheet,
  ViewStyle,
  Text,
  AccessibilityProps,
} from "react-native";
import { colors } from "../../theme/colors";
import { radii } from "../../theme/radii";
import { spacing } from "../../theme/spacing";
import { shadows } from "../../theme/shadows";
import { textStyles } from "../../theme/typography";
import { duration, easing, pressScale } from "../../theme/motion";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "inverse";
type Size = "sm" | "md" | "lg";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  fullWidth?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  style?: ViewStyle;
} & AccessibilityProps;

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  fullWidth,
  leading,
  trailing,
  style,
  ...a11y
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (to: number) => {
    Animated.timing(scale, {
      toValue: to,
      duration: duration.fast,
      easing: easing.standard,
      useNativeDriver: true,
    }).start();
  };

  const sizing = SIZE_MAP[size];
  const look = lookFor(variant, disabled);

  return (
    <Animated.View
      style={[
        { transform: [{ scale }], alignSelf: fullWidth ? "stretch" : "flex-start" },
        style,
      ]}
    >
      <Pressable
        onPressIn={() => !disabled && animateTo(pressScale.medium)}
        onPressOut={() => animateTo(1)}
        onPress={() => !disabled && onPress?.()}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        {...a11y}
        style={[
          styles.base,
          {
            paddingVertical: sizing.py,
            paddingHorizontal: sizing.px,
            backgroundColor: look.bg,
            borderColor: look.border,
            borderWidth: look.borderWidth,
          },
          variant === "primary" && !disabled ? shadows.sm : null,
        ]}
      >
        {leading ? <Animated.View style={styles.lead}>{leading}</Animated.View> : null}
        <Text
          style={[
            textStyles.button,
            { color: look.fg, fontSize: sizing.fs },
            { lineHeight: sizing.fs * 1.2 },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {trailing ? <Animated.View style={styles.trail}>{trailing}</Animated.View> : null}
      </Pressable>
    </Animated.View>
  );
}

const SIZE_MAP: Record<Size, { py: number; px: number; fs: number }> = {
  sm: { py: 10, px: 16, fs: 13 },
  md: { py: 14, px: 22, fs: 15 },
  lg: { py: 18, px: 28, fs: 17 },
};

function lookFor(v: Variant, disabled?: boolean) {
  if (disabled) {
    return {
      bg: colors.surfaceMuted,
      fg: colors.muted,
      border: "transparent",
      borderWidth: 0,
    };
  }
  switch (v) {
    case "primary":
      return { bg: colors.primary, fg: colors.white, border: "transparent", borderWidth: 0 };
    case "secondary":
      return { bg: colors.primarySoft, fg: colors.primaryDark, border: "transparent", borderWidth: 0 };
    case "ghost":
      return { bg: "transparent", fg: colors.text, border: colors.border, borderWidth: 1.5 };
    case "danger":
      return { bg: colors.danger, fg: colors.white, border: "transparent", borderWidth: 0 };
    case "inverse":
      return { bg: colors.dark, fg: colors.white, border: "transparent", borderWidth: 0 };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  lead: { marginRight: spacing.sm },
  trail: { marginLeft: spacing.sm },
});
