import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: "home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: "learn",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: "games",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="game-controller-outline" color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          )
        }}
      />
    </Tabs>
  );
}
