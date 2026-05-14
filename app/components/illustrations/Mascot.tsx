import React from "react";
import Svg, {
  Circle,
  Ellipse,
  Path,
  Defs,
  LinearGradient,
  Stop,
  G,
} from "react-native-svg";
import { palette } from "../../theme/palette";
import type { LangKey } from "../../theme/colors";

type Expression = "happy" | "wave" | "wow" | "listening";

type Props = {
  size?: number;
  expression?: Expression;
  accent?: LangKey;
};

const accentMap: Record<LangKey, { body: string; bodyDeep: string; belly: string }> = {
  yo: { body: palette.clay, bodyDeep: palette.clayDeep, belly: palette.sunlit },
  ig: { body: palette.indigo, bodyDeep: palette.indigoDeep, belly: palette.sunlit },
  pg: { body: palette.sunlit, bodyDeep: palette.sunlitDeep, belly: palette.clay },
};

export function Mascot({ size = 140, expression = "happy", accent = "yo" }: Props) {
  const c = accentMap[accent];

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Defs>
        <LinearGradient id="bodyGrad" x1="60" y1="40" x2="160" y2="180" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.body} />
          <Stop offset="1" stopColor={c.bodyDeep} />
        </LinearGradient>
        <LinearGradient id="bellyGrad" x1="90" y1="100" x2="120" y2="170" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.belly} />
          <Stop offset="1" stopColor={palette.sunlitSoft} />
        </LinearGradient>
      </Defs>

      <Ellipse cx="100" cy="178" rx="44" ry="6" fill={palette.ink} opacity={0.08} />

      <Path
        d="M58 92 Q50 70 70 56 Q78 50 88 52 L96 60 Q94 72 84 80 Z"
        fill={c.bodyDeep}
        opacity={0.92}
      />

      <Path
        d="M65 110 Q50 90 70 60 Q90 38 130 50 Q172 64 168 110 Q164 158 130 168 Q90 175 70 152 Q55 132 65 110 Z"
        fill="url(#bodyGrad)"
      />

      <Path
        d="M84 116 Q78 142 100 162 Q124 162 130 138 Q132 122 124 110 Q108 102 84 116 Z"
        fill="url(#bellyGrad)"
      />

      <Path
        d="M138 78 Q160 76 168 92 L156 100 Q146 98 138 90 Z"
        fill={palette.sunlitDeep}
      />
      <Path
        d="M148 86 Q158 86 160 94 L152 96 Q146 92 148 86 Z"
        fill={palette.clayDeep}
      />

      <Circle cx="118" cy="84" r="14" fill={palette.white} />
      <Circle cx="120" cy="86" r="7" fill={palette.ink} />
      <Circle cx="122" cy="84" r="2.4" fill={palette.white} />

      {renderExpression(expression)}

      <Path
        d="M82 56 Q86 44 96 46 Q92 56 88 58 Z"
        fill={palette.mint}
        opacity={0.85}
      />
      <Path
        d="M72 50 Q78 38 88 42 Q82 52 76 54 Z"
        fill={palette.mintDeep}
        opacity={0.7}
      />
    </Svg>
  );
}

function renderExpression(e: Expression) {
  switch (e) {
    case "happy":
      return (
        <Path
          d="M126 102 Q138 116 152 104"
          stroke={palette.clayDeep}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      );
    case "wave":
      return (
        <G>
          <Path
            d="M126 102 Q140 118 156 102"
            stroke={palette.clayDeep}
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M52 96 Q40 80 48 60 Q58 64 56 80 Q62 88 54 100 Z"
            fill={palette.sunlit}
          />
        </G>
      );
    case "wow":
      return (
        <Ellipse
          cx="140"
          cy="110"
          rx="6"
          ry="9"
          fill={palette.clayDeep}
        />
      );
    case "listening":
      return (
        <G>
          <Path
            d="M128 108 Q140 110 150 108"
            stroke={palette.clayDeep}
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M168 70 Q176 64 184 70 M170 80 Q182 76 192 84 M166 56 Q172 50 178 54"
            stroke={palette.mintDeep}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </G>
      );
  }
}
