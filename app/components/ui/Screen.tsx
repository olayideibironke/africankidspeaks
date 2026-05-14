import React from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  background?: string;
  edges?: { top?: boolean; bottom?: boolean };
  padded?: boolean;
  statusStyle?: "light" | "dark";
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  topInsetExtra?: number;
  bottomInsetExtra?: number;
};

export function Screen({
  children,
  scroll = true,
  background = colors.background,
  edges = { top: true, bottom: true },
  padded = true,
  statusStyle = "dark",
  style,
  contentStyle,
  topInsetExtra = 0,
  bottomInsetExtra = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const paddingTop = (edges.top ? insets.top : 0) + topInsetExtra;
  const paddingBottom = (edges.bottom ? insets.bottom : 0) + bottomInsetExtra;
  const px = padded ? spacing.xl : 0;

  const inner = (
    <View
      style={[
        {
          paddingTop,
          paddingBottom,
          paddingHorizontal: px,
          flexGrow: 1,
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: background }, style]}>
      <StatusBar
        barStyle={statusStyle === "light" ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
