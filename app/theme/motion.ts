import { Easing } from "react-native";

export const duration = {
  instant: 80,
  fast: 150,
  normal: 250,
  slow: 400,
  loop: 2400,
} as const;

export const easing = {
  standard: Easing.bezier(0.2, 0.8, 0.2, 1),
  emphasized: Easing.bezier(0.16, 1, 0.3, 1),
  decel: Easing.out(Easing.cubic),
  accel: Easing.in(Easing.cubic),
  linear: Easing.linear,
} as const;

export const spring = {
  soft: { tension: 80, friction: 14 },
  responsive: { tension: 130, friction: 12 },
  bouncy: { tension: 180, friction: 8 },
} as const;

export const pressScale = {
  light: 0.985,
  medium: 0.965,
  strong: 0.94,
} as const;
