import { palette } from "./palette";

export type LangKey = "yo" | "ig" | "pg";

export const lang: Record<
  LangKey,
  {
    primary: string;
    primaryDeep: string;
    surface: string;
    surfaceDeep: string;
    onSurface: string;
    chip: string;
    chipText: string;
  }
> = {
  yo: {
    primary: palette.clay,
    primaryDeep: palette.clayDeep,
    surface: palette.claySoft,
    surfaceDeep: "#EFC8B1",
    onSurface: palette.clayDeep,
    chip: palette.clay,
    chipText: palette.white,
  },
  ig: {
    primary: palette.indigo,
    primaryDeep: palette.indigoDeep,
    surface: palette.indigoSoft,
    surfaceDeep: "#CFC4E8",
    onSurface: palette.indigoDeep,
    chip: palette.indigo,
    chipText: palette.white,
  },
  pg: {
    primary: palette.sunlit,
    primaryDeep: palette.sunlitDeep,
    surface: palette.sunlitSoft,
    surfaceDeep: "#F5D49E",
    onSurface: palette.sunlitDeep,
    chip: palette.sunlit,
    chipText: palette.indigoDeep,
  },
};

export const colors = {
  primary: palette.clay,
  primaryDark: palette.clayDeep,
  primarySoft: palette.claySoft,

  accent: palette.sunlit,
  accentDark: palette.sunlitDeep,
  accentSoft: palette.sunlitSoft,

  secondary: palette.mint,
  secondaryDark: palette.mintDeep,
  secondarySoft: palette.mintSoft,

  highlight: palette.plum,
  highlightDark: palette.plumDeep,
  highlightSoft: palette.plumSoft,

  contrast: palette.indigo,
  contrastDark: palette.indigoDeep,
  contrastSoft: palette.indigoSoft,

  background: palette.linen,
  backgroundAlt: palette.parchment,

  surface: palette.white,
  surfaceMuted: palette.bone,
  surfaceWarm: palette.claySoft,
  surfaceMint: palette.mintSoft,
  surfacePeach: palette.sunlitSoft,
  surfaceSoft: palette.indigoSoft,

  text: palette.ink,
  textSoft: palette.slate,
  muted: palette.smoke,
  mutedSoft: palette.mist,

  border: palette.hairline,
  borderStrong: palette.mist,
  borderWarm: "#E9D2BC",
  borderMint: "#BFE0CF",
  borderPeach: "#F3DCB6",

  success: palette.mint,
  warning: palette.sunlitDeep,
  danger: "#D14B3F",

  dark: palette.ink,
  white: palette.white,

  coral: "#E07A5F",
  coralSoft: "#F5D9CC",
  sky: "#9DBEB9",
  skySoft: "#DBEAE6",
  pink: palette.plumSoft,
  pinkSoft: "#F8E7F2",
  yellow: palette.sunlit,
  yellowSoft: palette.sunlitSoft,

  homeBg: palette.linen,
  homeBgSoft: palette.parchment,
  learnBg: palette.indigoSoft,
  learnBgSoft: "#F1ECF9",
  gamesBg: palette.claySoft,
  gamesBgSoft: "#FCE6D9",
  settingsBg: palette.mintSoft,
  settingsBgSoft: "#EAF6F0",

  card: palette.white,
} as const;

export type Colors = typeof colors;
