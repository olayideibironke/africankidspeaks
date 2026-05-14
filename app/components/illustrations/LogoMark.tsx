import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Path, Rect, G, Defs, LinearGradient, Stop } from "react-native-svg";
import { palette } from "../../theme/palette";
import { fontFamily } from "../../theme/typography";

type Props = {
  size?: number;
  variant?: "icon" | "lockup" | "lockup-stacked";
  tone?: "light" | "dark";
};

export function LogoMark({ size = 88, variant = "icon", tone = "dark" }: Props) {
  const ratio = size / 88;
  const labelColor = tone === "light" ? palette.white : palette.ink;

  const icon = (
    <Svg width={size} height={size} viewBox="0 0 88 88" fill="none">
      <Defs>
        <LinearGradient id="logoGrad" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={palette.sunlit} />
          <Stop offset="0.55" stopColor={palette.clay} />
          <Stop offset="1" stopColor={palette.plum} />
        </LinearGradient>
      </Defs>

      <Rect x="0" y="0" width="88" height="88" rx="22" fill="url(#logoGrad)" />

      <Circle cx="68" cy="22" r="6.5" fill={palette.sunlitSoft} opacity={0.85} />
      <Circle cx="76" cy="32" r="3" fill={palette.sunlitSoft} opacity={0.65} />

      <Path
        d="M22 64 L36 26 L50 64 M27.5 52 H44.5"
        stroke={palette.white}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      <Path
        d="M58 26 V64 M58 44 L72 26 M58 44 L73 64"
        stroke={palette.white}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      <Path
        d="M22 76 Q44 84 66 76"
        stroke={palette.indigoDeep}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
      />
    </Svg>
  );

  if (variant === "icon") return icon;

  const labelStyle =
    variant === "lockup"
      ? [styles.label, { color: labelColor, fontSize: 22 * ratio }]
      : [styles.labelStacked, { color: labelColor, fontSize: 18 * ratio }];

  const subStyle =
    variant === "lockup"
      ? [styles.sub, { color: tone === "light" ? palette.linen : palette.slate }]
      : [styles.subStacked, { color: tone === "light" ? palette.linen : palette.slate }];

  return (
    <View
      style={[
        variant === "lockup" ? styles.row : styles.stack,
        { gap: 12 * ratio },
      ]}
    >
      {icon}
      <View>
        <Text style={labelStyle} numberOfLines={1}>
          AfricanKidSpeaks
        </Text>
        <Text style={subStyle} numberOfLines={1}>
          Yoruba · Igbo · Pidgin
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  stack: { alignItems: "center" },
  label: {
    fontFamily: fontFamily.displayBold,
    letterSpacing: -0.4,
  },
  labelStacked: {
    fontFamily: fontFamily.displayBold,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  sub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  subStacked: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.6,
    textAlign: "center",
  },
});
