export const palette = {
  clay: "#C2521E",
  claySoft: "#F6DCCB",
  clayDeep: "#9A3F12",

  sunlit: "#E8A33D",
  sunlitSoft: "#FCEACC",
  sunlitDeep: "#B7791F",

  indigo: "#2A1B5E",
  indigoSoft: "#E6E1F4",
  indigoDeep: "#1A0F40",

  mint: "#5BAF8F",
  mintSoft: "#DDF1E7",
  mintDeep: "#3F8770",

  plum: "#7A2E5C",
  plumSoft: "#F3DEEB",
  plumDeep: "#561F40",

  linen: "#FAF3E7",
  bone: "#F4EBDA",
  parchment: "#FDF8EF",

  ink: "#1B1428",
  slate: "#5C5269",
  smoke: "#8C8295",
  mist: "#C8C2D0",
  hairline: "#E6E0EC",

  white: "#FFFFFF",
  black: "#000000",
} as const;

export type PaletteKey = keyof typeof palette;
