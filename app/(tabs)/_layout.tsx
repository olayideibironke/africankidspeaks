import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View } from "react-native";

type TabIconProps = {
  color: string;
  size: number;
  focused: boolean;
};

function KidTabIcon({
  icon,
  color,
  size,
  focused,
}: {
  icon: keyof typeof Ionicons.glyphMap;
} & TabIconProps) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={icon} color={color} size={size} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: "#4f7cff",
        tabBarInactiveTintColor: "#8f97ad",
        tabBarShowLabel: true,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarBackground: () => (
          <View style={styles.tabBarBackground}>
            <View style={styles.tabBubbleLeft} />
            <View style={styles.tabBubbleRight} />
            <View style={styles.tabBubbleCenter} />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "home",
          tabBarIcon: ({ color, size, focused }) => (
            <KidTabIcon
              icon="home"
              color={color}
              size={size}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="learn"
        options={{
          title: "learn",
          tabBarIcon: ({ color, size, focused }) => (
            <KidTabIcon
              icon="book"
              color={color}
              size={size}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="games"
        options={{
          title: "games",
          tabBarIcon: ({ color, size, focused }) => (
            <KidTabIcon
              icon="game-controller"
              color={color}
              size={size}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "settings",
          tabBarIcon: ({ color, size, focused }) => (
            <KidTabIcon
              icon="settings"
              color={color}
              size={size}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: Platform.OS === "ios" ? 18 : 12,
    height: 78,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    elevation: 0,
  },

  tabBarBackground: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: "#fff7ef",
    borderWidth: 2,
    borderColor: "#eadfff",
    overflow: "hidden",
    shadowColor: "#6f5cff",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  tabBubbleLeft: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 999,
    left: -18,
    bottom: -22,
    backgroundColor: "#ffd86f",
    opacity: 0.22,
  },

  tabBubbleRight: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 999,
    right: -14,
    top: -24,
    backgroundColor: "#99dcff",
    opacity: 0.2,
  },

  tabBubbleCenter: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 999,
    left: "42%",
    top: -42,
    backgroundColor: "#ffadd2",
    opacity: 0.14,
  },

  tabBarItem: {
    paddingTop: 4,
  },

  tabBarLabel: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "lowercase",
    marginTop: 2,
  },

  iconWrap: {
    minWidth: 38,
    height: 30,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  iconWrapActive: {
    backgroundColor: "rgba(79,124,255,0.12)",
  },
});
