import React from "react";
import Svg, { Circle, Path, Pattern, Rect, Defs, G } from "react-native-svg";
import { palette } from "../../theme/palette";

type Variant = "kente-weave" | "adire-dots" | "sun-rays" | "soft-stripes";

type Props = {
  variant?: Variant;
  color?: string;
  width?: number;
  height?: number;
  opacity?: number;
};

export function PatternBackdrop({
  variant = "kente-weave",
  color = palette.clayDeep,
  width = 320,
  height = 200,
  opacity = 0.12,
}: Props) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ opacity }}
      pointerEvents="none"
    >
      <Defs>
        <Pattern id={`pat-${variant}`} patternUnits="userSpaceOnUse" width={getTileSize(variant)} height={getTileSize(variant)}>
          {renderTile(variant, color)}
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill={`url(#pat-${variant})`} />
    </Svg>
  );
}

function getTileSize(v: Variant) {
  switch (v) {
    case "kente-weave":
      return 56;
    case "adire-dots":
      return 36;
    case "sun-rays":
      return 80;
    case "soft-stripes":
      return 28;
  }
}

function renderTile(v: Variant, c: string) {
  switch (v) {
    case "kente-weave":
      return (
        <G>
          <Rect x="0" y="0" width="56" height="6" fill={c} />
          <Rect x="0" y="28" width="56" height="2" fill={c} />
          <Rect x="0" y="0" width="6" height="56" fill={c} opacity={0.6} />
          <Rect x="28" y="0" width="2" height="56" fill={c} opacity={0.6} />
          <Circle cx="42" cy="14" r="2.5" fill={c} />
          <Circle cx="14" cy="42" r="2.5" fill={c} />
        </G>
      );
    case "adire-dots":
      return (
        <G>
          <Circle cx="9" cy="9" r="3" fill={c} />
          <Circle cx="27" cy="9" r="1.5" fill={c} />
          <Circle cx="9" cy="27" r="1.5" fill={c} />
          <Circle cx="27" cy="27" r="3" fill={c} />
          <Circle cx="18" cy="18" r="2" fill={c} opacity={0.6} />
        </G>
      );
    case "sun-rays":
      return (
        <G>
          <Circle cx="40" cy="40" r="8" fill={c} />
          <Path
            d="M40 18 V8 M40 72 V62 M18 40 H8 M72 40 H62 M24 24 L18 18 M56 56 L62 62 M24 56 L18 62 M56 24 L62 18"
            stroke={c}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </G>
      );
    case "soft-stripes":
      return (
        <G>
          <Rect x="0" y="0" width="28" height="3" fill={c} />
          <Rect x="0" y="10" width="28" height="2" fill={c} opacity={0.6} />
          <Rect x="0" y="18" width="28" height="3" fill={c} />
        </G>
      );
  }
}
