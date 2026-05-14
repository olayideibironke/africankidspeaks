export const radii = {
  none: 0,
  xs: 6,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xl2: 28,
  xl3: 32,
  xxl: 36,
  pill: 999,
} as const;

export type RadiiKey = keyof typeof radii;
