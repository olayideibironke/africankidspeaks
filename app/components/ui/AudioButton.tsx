import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
import { shadows } from "../../theme/shadows";
import { duration, easing, pressScale } from "../../theme/motion";

type Props = {
  onPress: () => void;
  size?: number;
  tint?: string;
  iconColor?: string;
  playing?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function AudioButton({
  onPress,
  size = 72,
  tint = colors.primary,
  iconColor = colors.white,
  playing,
  disabled,
  accessibilityLabel = "Play audio",
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!playing) {
      ring.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ring, {
          toValue: 1,
          duration: 1100,
          easing: easing.decel,
          useNativeDriver: true,
        }),
        Animated.timing(ring, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [playing, ring]);

  const animateTo = (to: number) => {
    Animated.timing(scale, {
      toValue: to,
      duration: duration.fast,
      easing: easing.standard,
      useNativeDriver: true,
    }).start();
  };

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.6, 0.25, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {playing ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: tint,
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
        />
      ) : null}

      <Animated.View
        style={{
          transform: [{ scale }],
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: disabled ? colors.surfaceMuted : tint,
          alignItems: "center",
          justifyContent: "center",
          ...shadows.md,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled: !!disabled }}
          onPressIn={() => !disabled && animateTo(pressScale.medium)}
          onPressOut={() => animateTo(1)}
          onPress={() => !disabled && onPress()}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={playing ? "volume-high" : "play"}
            color={disabled ? colors.muted : iconColor}
            size={size * 0.42}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    borderWidth: 3,
  },
});
