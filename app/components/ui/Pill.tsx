import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors } from "../../theme/colors";
import { radii } from "../../theme/radii";
import { spacing } from "../../theme/spacing";
import { textStyles } from "../../theme/typography";

type Variant = "tonal" | "solid" | "outline";

type Props = {
  label: string;
  variant?: Variant;
  color?: string;
  bg?: string;
  size?: "sm" | "md";
  style?: ViewStyle;
};

export function Pill({
  label,
  variant = "tonal",
  color,
  bg,
  size = "md",
  style,
}: Props) {
  const look = lookFor(variant, color, bg);
  const py = size === "sm" ? 4 : 6;
  const px = size === "sm" ? 10 : 14;
  const fs = size === "sm" ? 11 : 12;

  return (
    <View
      style={[
        styles.base,
        {
          paddingVertical: py,
          paddingHorizontal: px,
          backgroundColor: look.bg,
          borderColor: look.border,
          borderWidth: look.borderWidth,
        },
        style,
      ]}
    >
      <Text
        style={[
          textStyles.overline,
          { color: look.fg, fontSize: fs, letterSpacing: 0.8 },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function lookFor(v: Variant, color?: string, bg?: string) {
  switch (v) {
    case "solid":
      return { bg: bg ?? colors.primary, fg: color ?? colors.white, border: "transparent", borderWidth: 0 };
    case "tonal":
      return { bg: bg ?? colors.primarySoft, fg: color ?? colors.primaryDark, border: "transparent", borderWidth: 0 };
    case "outline":
      return { bg: bg ?? "transparent", fg: color ?? colors.text, border: colors.border, borderWidth: 1 };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    alignSelf: "flex-start",
  },
});
