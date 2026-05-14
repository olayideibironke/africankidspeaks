import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";
import { radii } from "../../theme/radii";
import { textStyles } from "../../theme/typography";

type Props = {
  value: string | number;
  color?: string;
  bg?: string;
};

export function Badge({ value, color = colors.white, bg = colors.primary }: Props) {
  const isNumber = typeof value === "number";

  return (
    <View style={[styles.base, { backgroundColor: bg, minWidth: isNumber ? 22 : 28 }]}>
      <Text style={[textStyles.overline, { color, fontSize: 11 }]} numberOfLines={1}>
        {String(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
