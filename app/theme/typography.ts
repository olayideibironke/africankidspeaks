import { Platform, TextStyle } from "react-native";

const SYSTEM_BODY = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "System",
});

const SYSTEM_DISPLAY = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

export const fontFamily = {
  bodyRegular: "PlusJakartaSans_400Regular",
  bodyMedium: "PlusJakartaSans_500Medium",
  bodySemibold: "PlusJakartaSans_600SemiBold",
  bodyBold: "PlusJakartaSans_700Bold",
  bodyExtraBold: "PlusJakartaSans_800ExtraBold",

  displayRegular: "Fraunces_400Regular",
  displayMedium: "Fraunces_500Medium",
  displaySemibold: "Fraunces_600SemiBold",
  displayBold: "Fraunces_700Bold",
  displayBlack: "Fraunces_900Black",

  systemBody: SYSTEM_BODY,
  systemDisplay: SYSTEM_DISPLAY,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xl2: 24,
  xl3: 30,
  xl4: 36,
  xl5: 44,
  xl6: 56,
} as const;

export const lineHeight = {
  tight: 1.15,
  snug: 1.3,
  normal: 1.45,
  relaxed: 1.6,
} as const;

export const letterSpacing = {
  tight: -0.4,
  normal: 0,
  wide: 0.4,
  wider: 1.2,
} as const;

type TextRole =
  | "display1"
  | "display2"
  | "display3"
  | "title"
  | "subtitle"
  | "body"
  | "bodyStrong"
  | "caption"
  | "overline"
  | "button";

export const textStyles: Record<TextRole, TextStyle> = {
  display1: {
    fontFamily: fontFamily.displayBlack,
    fontSize: fontSize.xl6,
    lineHeight: fontSize.xl6 * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  display2: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.xl5,
    lineHeight: fontSize.xl5 * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  display3: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.xl4,
    lineHeight: fontSize.xl4 * lineHeight.snug,
    letterSpacing: letterSpacing.tight,
  },
  title: {
    fontFamily: fontFamily.bodyExtraBold,
    fontSize: fontSize.xl2,
    lineHeight: fontSize.xl2 * lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },
  subtitle: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.normal,
  },
  body: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * lineHeight.normal,
  },
  bodyStrong: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * lineHeight.normal,
  },
  caption: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    letterSpacing: letterSpacing.wide,
  },
  overline: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.normal,
    letterSpacing: letterSpacing.wider,
    textTransform: "uppercase",
  },
  button: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * lineHeight.snug,
    letterSpacing: letterSpacing.wide,
  },
};

export type { TextRole };
