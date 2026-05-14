import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { palette } from "../theme/palette";
import { spacing } from "../theme/spacing";
import { radii } from "../theme/radii";
import { shadows } from "../theme/shadows";
import { pressScale } from "../theme/motion";
import { Text } from "./ui/Text";
import { Button } from "./ui/Button";

type Props = {
  visible: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onSuccess?: () => void;
  onPassed?: () => void;
  title?: string;
  subtitle?: string;
  min?: number;
  max?: number;
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function ParentGateModal({
  visible,
  onClose,
  onCancel,
  onSuccess,
  onPassed,
  title = "Parent gate",
  subtitle = "Solve the math to continue.",
  min = 2,
  max = 9,
}: Props) {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [answer, setAnswer] = useState("");
  const [touched, setTouched] = useState(false);

  const mounted = useRef(true);
  const shake = useRef(new Animated.Value(0)).current;

  const expected = useMemo(() => a + b, [a, b]);
  const isCorrect = useMemo(() => {
    const n = Number((answer || "").trim());
    return Number.isFinite(n) && n === expected;
  }, [answer, expected]);

  const resetChallenge = () => {
    const x = randomInt(min, max);
    let y = randomInt(min, max);
    if (x + y < 5) y = Math.max(y, 4);
    setA(x);
    setB(y);
    setAnswer("");
    setTouched(false);
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (visible) resetChallenge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = () => {
    Keyboard.dismiss();
    if (onCancel) onCancel();
    if (onClose) onClose();
  };

  const triggerShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.7, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const onConfirm = () => {
    setTouched(true);
    if (!isCorrect) {
      triggerShake();
      return;
    }
    Keyboard.dismiss();
    if (onSuccess) onSuccess();
    if (onPassed) onPassed();
  };

  const onChange = (text: string) => {
    setAnswer(text.replace(/[^\d]/g, ""));
  };

  const shakeX = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: [-10, 10],
  });

  const borderColor = touched && !isCorrect
    ? palette.clay
    : isCorrect
    ? palette.mint
    : palette.hairline;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.center}
        >
          <Animated.View
            style={[
              styles.card,
              shadows.xl,
              { transform: [{ translateX: shakeX }] },
            ]}
          >
            <View style={styles.headerRow}>
              <View style={styles.lockBadge}>
                <Text variant="display3" style={{ color: palette.indigoDeep }}>
                  ✦
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="overline" tone="muted">
                  For parents
                </Text>
                <Text variant="title">{title}</Text>
              </View>
            </View>

            <Text variant="body" tone="soft" style={{ marginTop: spacing.sm }}>
              {subtitle}
            </Text>

            <View style={styles.questionShell}>
              <Text variant="overline" tone="muted">
                Math challenge
              </Text>
              <View style={styles.questionRow}>
                <Text variant="display2" style={{ color: palette.ink }}>
                  {a}
                </Text>
                <Text
                  variant="display3"
                  tone="soft"
                  style={{ marginHorizontal: spacing.md }}
                >
                  +
                </Text>
                <Text variant="display2" style={{ color: palette.ink }}>
                  {b}
                </Text>
                <Text
                  variant="display3"
                  tone="soft"
                  style={{ marginHorizontal: spacing.md }}
                >
                  =
                </Text>
                <Text variant="display2" tone="muted">
                  ?
                </Text>
              </View>
            </View>

            <TextInput
              value={answer}
              onChangeText={onChange}
              onFocus={() => setTouched(false)}
              placeholder="Type the answer"
              placeholderTextColor={palette.mist}
              keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
              returnKeyType="done"
              onSubmitEditing={onConfirm}
              style={[styles.input, { borderColor }]}
            />

            {touched && !isCorrect ? (
              <Text
                variant="caption"
                style={{ color: palette.clay, marginTop: spacing.sm }}
              >
                Not quite — try again.
              </Text>
            ) : isCorrect ? (
              <Text
                variant="caption"
                style={{ color: palette.mintDeep, marginTop: spacing.sm }}
              >
                Great — tap Continue.
              </Text>
            ) : (
              <Text
                variant="caption"
                tone="muted"
                style={{ marginTop: spacing.sm }}
              >
                Hint: add the two numbers above.
              </Text>
            )}

            <View style={styles.row}>
              <Pressable
                onPress={close}
                style={({ pressed }) => [
                  styles.cancel,
                  pressed && { transform: [{ scale: pressScale.medium }] },
                ]}
              >
                <Text variant="button" tone="soft">
                  Cancel
                </Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Button
                  label="Continue"
                  onPress={onConfirm}
                  fullWidth
                  size="md"
                  disabled={!isCorrect && touched}
                />
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(27, 20, 40, 0.55)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: palette.white,
    borderRadius: radii.xl3,
    padding: spacing.xl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  lockBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.indigoSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  questionShell: {
    marginTop: spacing.lg,
    backgroundColor: palette.bone,
    borderRadius: radii.xl2,
    padding: spacing.lg,
    alignItems: "center",
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  input: {
    marginTop: spacing.lg,
    height: 56,
    borderRadius: radii.lg,
    borderWidth: 2,
    paddingHorizontal: spacing.lg,
    backgroundColor: palette.parchment,
    fontSize: 22,
    fontWeight: "700",
    color: palette.ink,
    textAlign: "center",
    letterSpacing: 1,
  },
  row: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cancel: {
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
});
