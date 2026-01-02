import React, { useCallback, useEffect, useState } from "react";
import { View, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { colors } from "../theme";

const score_key = "games_soundquiz_score_v1";
const streak_key = "games_soundquiz_streak_v1";

function getbadges(streak: number) {
  if (streak >= 20) return "⭐⭐⭐";
  if (streak >= 10) return "⭐⭐";
  if (streak >= 5) return "⭐";
  return "";
}

function getdifficulty(streak: number) {
  if (streak >= 8) return "hard";
  if (streak >= 3) return "normal";
  return "easy";
}

export default function GamesProgressCard() {
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  const load = useCallback(async () => {
    try {
      const [sc, st] = await Promise.all([
        AsyncStorage.getItem(score_key),
        AsyncStorage.getItem(streak_key),
      ]);

      const scNum = Number(sc ?? "0");
      const stNum = Number(st ?? "0");

      setScore(Number.isFinite(scNum) ? scNum : 0);
      setStreak(Number.isFinite(stNum) ? stNum : 0);
    } catch {
      setScore(0);
      setStreak(0);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const badges = getbadges(streak);
  const difficulty = getdifficulty(streak);

  return (
    <View
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 16,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#eee",
      }}
    >
      <Text style={{ fontWeight: "900", color: colors.text }}>
        games progress
      </Text>

      <Text style={{ marginTop: 8, color: colors.muted }}>
        score: <Text style={{ fontWeight: "900", color: colors.text }}>{score}</Text>{" "}
        • streak:{" "}
        <Text style={{ fontWeight: "900", color: colors.text }}>{streak}</Text>
        {badges ? ` • ${badges}` : ""} • {difficulty}
      </Text>

      <Text style={{ marginTop: 6, color: colors.muted }}>
        (updates when you return to home)
      </Text>
    </View>
  );
}
