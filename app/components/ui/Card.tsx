import React from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";
import { radii } from "../../theme/radii";
import { shadows, type ShadowKey } from "../../theme/shadows";
import { spacing } from "../../theme/spacing";

type Variant = "elevated" | "soft" | "outlined" | "tinted";

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  tint?: string;
  padding?: keyof typeof spacing;
  radius?: keyof typeof radii;
  shadow?: ShadowKey;
  style?: ViewStyle;
};

export function Card({
  children,
  variant = "elevated",
  tint,
  padding = "xl",
  radius = "xl2",
  shadow,
  style,
}: Props) {
  const base: ViewStyle = {
    borderRadius: radii[radius],
    padding: spacing[padding],
  };

  let look: ViewStyle = {};

  switch (variant) {
    case "elevated":
      look = {
        backgroundColor: colors.surface,
        ...(shadows[shadow ?? "md"]),
      };
      break;
    case "soft":
      look = {
        backgroundColor: tint ?? colors.surfaceMuted,
      };
      break;
    case "tinted":
      look = {
        backgroundColor: tint ?? colors.surfaceWarm,
        ...(shadows[shadow ?? "sm"]),
      };
      break;
    case "outlined":
      look = {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      };
      break;
  }

  return <View style={[base, look, style]}>{children}</View>;
}
