// app/audio-report.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "./theme";
import { flashcards } from "./data/flashcards";
import { hasNativeAudio, type AudioLang } from "./utils/nativeAudio";
import {
  clearRecordedDone,
  toggleRecordedDone,
  pruneRecordedDoneToMissing,
} from "./utils/audioChecklist";

const BTN_DARK = "#000";
const BTN_DARK_TEXT = "#fff";

function normEn(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildMissingFileSet(lang: AudioLang) {
  const set = new Set<string>();
  for (const c of flashcards as readonly any[]) {
    const en = normEn(c.en);
    const id = c.id;
    if (!hasNativeAudio({ lang, en, id })) set.add(`${lang}/${en}.mp3`);
  }
  return set;
}

export default function AudioReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ lang?: string }>();
  const initialLang = (params.lang as AudioLang) || "yo";

  const [lang, setLang] = useState<AudioLang>(initialLang);
  const [q, setQ] = useState("");
  const [recordMode, setRecordMode] = useState(true);
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set());

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const missingFiles = buildMissingFileSet(lang);
        const pruned = await pruneRecordedDoneToMissing(lang, missingFiles);
        setDoneSet(new Set(pruned));
      })();
      return () => {};
    }, [lang])
  );

  const report = useMemo(() => {
    const query = q.trim().toLowerCase();
    const missingAll: Array<{ id: number; en: string; tr: string; file: string }> = [];

    for (const c of flashcards as readonly any[]) {
      const en = normEn(c.en);
      const id = c.id;
      const tr = String(c?.[lang] ?? "");

      if (!hasNativeAudio({ lang, en, id })) {
        const file = `${lang}/${en}.mp3`;
        if (
          !query ||
          en.includes(query) ||
          tr.toLowerCase().includes(query) ||
          file.includes(query)
        ) {
          missingAll.push({ id, en, tr, file });
        }
      }
    }

    const total = flashcards.length;
    const covered = total - missingAll.length;
    const pct = total > 0 ? Math.round((covered / total) * 100) : 0;

    const doneCountAll = missingAll.filter((m) => doneSet.has(m.file)).length;
    const remainingCountAll = Math.max(0, missingAll.length - doneCountAll);

    const missingVisible = recordMode ? missingAll.filter((m) => !doneSet.has(m.file)) : missingAll;

    // ✅ Next 25 to record (from remaining list)
    const next25 = missingAll.filter((m) => !doneSet.has(m.file)).slice(0, 25);

    return {
      missingAll,
      missingVisible,
      total,
      covered,
      pct,
      doneCountAll,
      remainingCountAll,
      next25,
    };
  }, [lang, q, recordMode, doneSet]);

  const copyAll = async () => {
    const text = report.missingVisible.map((m) => m.file).join("\n");
    try {
      await Clipboard.setStringAsync(text || "");
      Alert.alert(
        "Copied",
        text ? `${report.missingVisible.length} filenames copied.` : "Nothing to copy."
      );
    } catch {
      Alert.alert("Copy failed", "Clipboard not available.");
    }
  };

  const copyOne = async (file: string) => {
    try {
      await Clipboard.setStringAsync(file);
      Alert.alert("Copied", file);
    } catch {
      Alert.alert("Copy failed", "Clipboard not available.");
    }
  };

  const copyNext25 = async () => {
    const text = report.next25.map((m) => m.file).join("\n");
    try {
      await Clipboard.setStringAsync(text || "");
      Alert.alert(
        "Copied",
        text ? `${report.next25.length} next filenames copied.` : "Nothing to copy."
      );
    } catch {
      Alert.alert("Copy failed", "Clipboard not available.");
    }
  };

  const openMissingInWords = () => {
    router.push({ pathname: "/words", params: { lang, onlyMissing: "1" } });
  };

  const onToggleDone = async (file: string) => {
    const set = await toggleRecordedDone(lang, file);
    setDoneSet(new Set(set));
  };

  const onResetChecklist = async () => {
    await clearRecordedDone(lang);
    setDoneSet(new Set());
    Alert.alert("Reset", "Record checklist cleared for this language.");
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: 14 + insets.top, paddingBottom: 40 + insets.bottom },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Audio Report</Text>
            <Text style={styles.sub}>
              Missing audio • Lang: {lang.toUpperCase()} • Coverage: {report.pct}%
            </Text>
          </View>
        </View>

        <View style={styles.langRow}>
          {(["yo", "ig", "pg"] as AudioLang[]).map((k) => {
            const selected = k === lang;
            return (
              <Pressable
                key={k}
                onPress={() => setLang(k)}
                style={[styles.pill, selected && styles.pillOn]}
              >
                <Text style={[styles.pillText, selected && styles.pillTextOn]}>
                  {k.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ✅ Recording progress */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Recording Progress</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressBox}>
              <Text style={styles.progressVal}>{report.doneCountAll}</Text>
              <Text style={styles.progressLbl}>Marked Done</Text>
            </View>
            <View style={styles.progressBox}>
              <Text style={styles.progressVal}>{report.remainingCountAll}</Text>
              <Text style={styles.progressLbl}>Remaining</Text>
            </View>
            <View style={styles.progressBox}>
              <Text style={styles.progressVal}>{report.missingAll.length}</Text>
              <Text style={styles.progressLbl}>Total Missing</Text>
            </View>
          </View>

          <Text style={styles.progressHint}>
            Auto-clear is ON: once an mp3 exists, it disappears from missing and “Done” is pruned automatically.
          </Text>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Filter (English / translation / filename)"
            placeholderTextColor={colors.muted}
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable onPress={() => setQ("")} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{report.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{report.covered}</Text>
            <Text style={styles.statLabel}>Covered</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{report.missingAll.length}</Text>
            <Text style={styles.statLabel}>Missing</Text>
          </View>
        </View>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setRecordMode((v) => !v)}
            style={[styles.modeBtn, recordMode && styles.modeBtnOn]}
          >
            <Text style={[styles.modeText, recordMode && styles.modeTextOn]}>
              Record Mode: {recordMode ? "ON" : "OFF"}
            </Text>
            <Text style={[styles.modeSub, recordMode && styles.modeSubOn]}>
              {recordMode ? "Hides items you marked done" : "Shows all missing (including done)"}
            </Text>
          </Pressable>

          <Pressable onPress={onResetChecklist} style={styles.resetBtn}>
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        </View>

        {/* ✅ Next 25 IDs */}
        <View style={styles.nextCard}>
          <View style={styles.nextTop}>
            <Text style={styles.nextTitle}>Next 25 to record</Text>
            <Pressable onPress={copyNext25} style={styles.nextCopyBtn}>
              <Text style={styles.nextCopyText}>Copy</Text>
            </Pressable>
          </View>

          {report.next25.length === 0 ? (
            <Text style={styles.nextEmpty}>Nothing left 🎉</Text>
          ) : (
            <View style={styles.nextList}>
              {report.next25.map((m) => (
                <Pressable
                  key={m.file}
                  onPress={() => copyOne(m.file)}
                  style={({ pressed }) => [styles.nextItem, pressed && { opacity: 0.9 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextEn}>{m.en}</Text>
                    <Text style={styles.nextFile}>{m.file}</Text>
                  </View>

                  <Pressable
                    onPress={() => onToggleDone(m.file)}
                    style={styles.nextDoneBtn}
                  >
                    <Text style={styles.nextDoneText}>Done</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}
          <Text style={styles.nextHint}>Tap an item to copy filename. Hit Done after recording.</Text>
        </View>

        <Pressable onPress={copyAll} style={styles.darkBtn}>
          <Text style={styles.darkText}>Copy Visible Filenames</Text>
          <Text style={styles.darkSub}>Copies what you still need to record</Text>
        </Pressable>

        <Pressable onPress={openMissingInWords} style={styles.darkBtn}>
          <Text style={styles.darkText}>Open Missing in Words List</Text>
          <Text style={styles.darkSub}>Tap words to test audio</Text>
        </Pressable>

        <View style={{ height: 12 }} />

        {report.missingAll.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.goodTitle}>All set ✅</Text>
            <Text style={styles.goodSub}>No missing audio for this language.</Text>
          </View>
        ) : report.missingVisible.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.goodTitle}>Nice ✅</Text>
            <Text style={styles.goodSub}>
              Everything missing is marked done (Record Mode ON).
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {report.missingVisible.map((m) => {
              const done = doneSet.has(m.file);
              return (
                <View key={m.id} style={styles.item}>
                  <Text style={styles.en}>{m.en}</Text>
                  <Text style={styles.tr}>{m.tr}</Text>

                  <View style={styles.itemBtns}>
                    <Pressable onPress={() => copyOne(m.file)} style={styles.copyOneBtn}>
                      <Text style={styles.copyOneText}>{m.file}</Text>
                      <Text style={styles.copyOneHint}>Tap to copy</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => onToggleDone(m.file)}
                      style={[styles.doneBtn, done && styles.doneBtnOn]}
                    >
                      <Text style={[styles.doneBtnText, done && styles.doneBtnTextOn]}>
                        {done ? "✓ Done" : "Mark Done"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  watermarkWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 0 },
  container: { padding: 20, zIndex: 1 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 as any },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: colors.text, fontSize: 20, fontWeight: "900" },

  h1: { fontSize: 26, fontWeight: "900", color: colors.text },
  sub: { marginTop: 4, color: colors.muted },

  langRow: { marginTop: 12, flexDirection: "row", gap: 10 as any },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillOn: { borderColor: colors.primary, backgroundColor: colors.background },
  pillText: { color: colors.muted, fontWeight: "900" },
  pillTextOn: { color: colors.primary },

  progressCard: {
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
  progressRow: { marginTop: 10, flexDirection: "row", gap: 10 as any },
  progressBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressVal: { color: colors.text, fontWeight: "900", fontSize: 18 },
  progressLbl: { marginTop: 4, color: colors.muted, fontWeight: "800", fontSize: 12 },
  progressHint: { marginTop: 10, color: colors.muted, fontWeight: "800", fontSize: 12 },

  searchWrap: { marginTop: 12, flexDirection: "row", gap: 10 as any, alignItems: "center" },
  search: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontWeight: "700",
  },
  clearBtn: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  clearText: { color: colors.text, fontWeight: "900" },

  summaryRow: { marginTop: 14, flexDirection: "row", gap: 10 as any },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { color: colors.text, fontWeight: "900", fontSize: 20 },
  statLabel: { marginTop: 2, color: colors.muted, fontSize: 12, fontWeight: "800" },

  modeRow: { marginTop: 12, flexDirection: "row", gap: 10 as any },
  modeBtn: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeBtnOn: { borderColor: colors.primary },
  modeText: { color: colors.text, fontWeight: "900", fontSize: 15 },
  modeTextOn: { color: colors.primary },
  modeSub: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: "800" },
  modeSubOn: { color: colors.text, opacity: 0.8 },

  resetBtn: {
    width: 90,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  resetText: { color: colors.text, fontWeight: "900" },

  nextCard: {
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextTop: { flexDirection: "row", alignItems: "center", gap: 10 as any },
  nextTitle: { flex: 1, color: colors.text, fontWeight: "900", fontSize: 16 },
  nextCopyBtn: {
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  nextCopyText: { color: colors.text, fontWeight: "900" },
  nextEmpty: { marginTop: 10, color: colors.muted, fontWeight: "800" },
  nextList: { marginTop: 10, gap: 10 as any },
  nextItem: {
    flexDirection: "row",
    gap: 10 as any,
    alignItems: "center",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  nextEn: { color: colors.text, fontWeight: "900" },
  nextFile: { marginTop: 2, color: colors.muted, fontWeight: "800", fontSize: 12 },
  nextDoneBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: BTN_DARK,
    borderWidth: 1,
    borderColor: BTN_DARK,
  },
  nextDoneText: { color: BTN_DARK_TEXT, fontWeight: "900" },
  nextHint: { marginTop: 10, color: colors.muted, fontWeight: "800", fontSize: 12 },

  darkBtn: {
    marginTop: 10,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: BTN_DARK,
    borderWidth: 1,
    borderColor: BTN_DARK,
  },
  darkText: { color: BTN_DARK_TEXT, fontWeight: "900", fontSize: 15 },
  darkSub: { marginTop: 3, color: BTN_DARK_TEXT, opacity: 0.85, fontSize: 12, fontWeight: "800" },

  card: { backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border },
  goodTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
  goodSub: { marginTop: 6, color: colors.muted },

  list: { gap: 10 as any, marginTop: 10 },
  item: { padding: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  en: { color: colors.text, fontWeight: "900", fontSize: 16 },
  tr: { marginTop: 2, color: colors.muted, fontWeight: "800" },

  itemBtns: { marginTop: 10, gap: 10 as any },
  copyOneBtn: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: BTN_DARK },
  copyOneText: { color: BTN_DARK_TEXT, fontWeight: "900" },
  copyOneHint: { marginTop: 3, color: BTN_DARK_TEXT, opacity: 0.75, fontSize: 12, fontWeight: "700" },

  doneBtn: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
    alignItems: "center",
  },
  doneBtnOn: { borderColor: colors.primary, backgroundColor: colors.background },
  doneBtnText: { color: colors.text, fontWeight: "900" },
  doneBtnTextOn: { color: colors.primary },
});
