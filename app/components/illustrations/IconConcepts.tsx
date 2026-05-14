import React from "react";
import Svg, {
  Circle,
  Path,
  Rect,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  G,
  Ellipse,
} from "react-native-svg";
import { palette } from "../../theme/palette";

type Props = { size?: number };

export function IconConceptA({ size = 120 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="aBg" x1="0" y1="0" x2="200" y2="200">
          <Stop offset="0" stopColor={palette.sunlit} />
          <Stop offset="0.55" stopColor={palette.clay} />
          <Stop offset="1" stopColor={palette.plum} />
        </LinearGradient>
      </Defs>
      <Rect width="200" height="200" rx="44" fill="url(#aBg)" />
      <Circle cx="160" cy="48" r="14" fill={palette.sunlitSoft} opacity={0.9} />
      <Circle cx="178" cy="68" r="6" fill={palette.sunlitSoft} opacity={0.7} />

      <Path
        d="M50 146 L82 60 L114 146 M62 122 H102"
        stroke={palette.white}
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M132 60 V146 M132 100 L166 60 M132 100 L168 146"
        stroke={palette.white}
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function IconConceptB({ size = 120 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id="bBg" cx="50%" cy="40%" r="80%">
          <Stop offset="0" stopColor={palette.sunlit} />
          <Stop offset="1" stopColor={palette.clayDeep} />
        </RadialGradient>
      </Defs>
      <Rect width="200" height="200" rx="44" fill="url(#bBg)" />

      <Path
        d="M40 60 Q40 36 64 36 H136 Q160 36 160 60 V108 Q160 132 136 132 H92 L60 158 V132 H64 Q40 132 40 108 Z"
        fill={palette.white}
      />

      <Path
        d="M68 80 Q68 76 72 76 H100 Q104 76 104 80 Q104 84 100 84 H72 Q68 84 68 80 Z"
        fill={palette.clay}
      />
      <Path
        d="M68 100 Q68 96 72 96 H128 Q132 96 132 100 Q132 104 128 104 H72 Q68 104 68 100 Z"
        fill={palette.indigo}
      />

      <Circle cx="148" cy="48" r="10" fill={palette.mint} />
    </Svg>
  );
}

export function IconConceptC({ size = 120 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="cBg" x1="0" y1="0" x2="0" y2="200">
          <Stop offset="0" stopColor={palette.indigoDeep} />
          <Stop offset="1" stopColor={palette.plumDeep} />
        </LinearGradient>
      </Defs>
      <Rect width="200" height="200" rx="44" fill="url(#cBg)" />

      <Circle cx="100" cy="78" r="32" fill={palette.sunlit} />
      <Path
        d="M40 168 Q40 110 100 110 Q160 110 160 168 Z"
        fill={palette.clay}
      />
      <Path
        d="M82 76 Q82 70 88 70 Q94 70 94 76 Q94 82 88 82 Q82 82 82 76 Z"
        fill={palette.indigoDeep}
      />
      <Path
        d="M106 76 Q106 70 112 70 Q118 70 118 76 Q118 82 112 82 Q106 82 106 76 Z"
        fill={palette.indigoDeep}
      />
      <Path
        d="M86 92 Q100 102 114 92"
        stroke={palette.indigoDeep}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />

      <G opacity={0.85}>
        <Ellipse cx="44" cy="40" rx="5" ry="3" fill={palette.mint} />
        <Ellipse cx="58" cy="32" rx="4" ry="2" fill={palette.mint} />
        <Ellipse cx="156" cy="40" rx="5" ry="3" fill={palette.sunlitSoft} />
        <Ellipse cx="142" cy="32" rx="4" ry="2" fill={palette.sunlitSoft} />
      </G>
    </Svg>
  );
}
