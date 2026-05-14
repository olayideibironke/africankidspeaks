import React from "react";
import { Text as RNText, TextProps as RNTextProps, TextStyle } from "react-native";
import { textStyles, type TextRole } from "../../theme/typography";
import { colors } from "../../theme/colors";

type Tone = "default" | "soft" | "muted" | "inverse" | "accent" | "danger";

const toneMap: Record<Tone, string> = {
  default: colors.text,
  soft: colors.textSoft,
  muted: colors.muted,
  inverse: colors.white,
  accent: colors.primary,
  danger: colors.danger,
};

type Props = Omit<RNTextProps, "role"> & {
  variant?: TextRole;
  tone?: Tone;
  align?: TextStyle["textAlign"];
};

export function Text({
  variant = "body",
  tone = "default",
  align,
  style,
  children,
  ...rest
}: Props) {
  return (
    <RNText
      style={[textStyles[variant], { color: toneMap[tone], textAlign: align }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
