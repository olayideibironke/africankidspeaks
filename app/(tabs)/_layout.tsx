import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";

import { palette } from "../theme/palette";
import { shadows } from "../theme/shadows";

type TabIconProps = { color: string; size: number; focused: boolean };

function TabIcon({
  icon,
  iconFocused,
  color,
  focused,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
} & TabIconProps) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={focused ? iconFocused : icon} color={color} size={focused ? 22 : 20} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: palette.clay,
        tabBarInactiveTintColor: palette.slate,
        tabBarShowLabel: true,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarBackground: () => <View style={styles.tabBarBackground} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: (props) => (
            <TabIcon icon="home-outline" iconFocused="home" {...props} />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: "Learn",
          tabBarIcon: (props) => (
            <TabIcon icon="book-outline" iconFocused="book" {...props} />
          ),
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: "Games",
          tabBarIcon: (props) => (
            <TabIcon icon="game-controller-outline" iconFocused="game-controller" {...props} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: (props) => (
            <TabIcon icon="person-outline" iconFocused="person" {...props} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: Platform.OS === "ios" ? 20 : 14,
    height: 72,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 12 : 8,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    elevation: 0,
  },
  tabBarBackground: {
    flex: 1,
    borderRadius: 36,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.hairline,
    ...shadows.lg,
  },
  tabBarItem: { paddingTop: 4 },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  iconWrap: {
    minWidth: 36,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  iconWrapActive: {
    backgroundColor: "rgba(194, 82, 30, 0.10)",
  },
});
