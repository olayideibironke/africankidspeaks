import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";
import { radii } from "../../theme/radii";
import { duration, easing } from "../../theme/motion";

type Props = {
  value: number;
  max?: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  animated?: boolean;
};

export function ProgressBar({
  value,
  max = 100,
  height = 12,
  trackColor = colors.surfaceMuted,
  fillColor = colors.primary,
  animated = true,
}: Props) {
  const pct = Math.max(0, Math.min(1, value / max));
  const anim = useRef(new Animated.Value(pct)).current;

  useEffect(() => {
    if (!animated) {
      anim.setValue(pct);
      return;
    }
    Animated.timing(anim, {
      toValue: pct,
      duration: duration.slow,
      easing: easing.emphasized,
      useNativeDriver: false,
    }).start();
  }, [pct, animated, anim]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor, borderRadius: height / 2 }]}>
      <Animated.View
        style={{
          height,
          width,
          backgroundColor: fillColor,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    overflow: "hidden",
  },
});
