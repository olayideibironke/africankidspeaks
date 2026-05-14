import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";

import { useOnboardingState } from "./hooks/useOnboarding";
import { colors } from "./theme/colors";

export default function Index() {
  const { loaded, completed } = useOnboardingState();

  if (!loaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return completed ? (
    <Redirect href="/(tabs)" />
  ) : (
    <Redirect href="/(onboarding)/welcome" />
  );
}
