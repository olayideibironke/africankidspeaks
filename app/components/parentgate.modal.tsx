import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Keyboard,
  Platform,
  Animated,
} from "react-native";
import { colors, radii, shadows } from "../theme";

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

function randInt(min: number, max: number) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

export default function ParentGateModal({
  visible,
  onClose,
  onCancel,
  onSuccess,
  onPassed,
  title = "parent gate",
  subtitle = "solve the math to continue",
  min = 1,
  max = 9,
}: Props) {
  const mountedRef = useRef(true);

  const [a, setA] = useState(0);
  const [b, setB] = useState(0);

  const [answer, setAnswer] = useState("");
  const [touched, setTouched] = useState(false);

  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const expected = useMemo(() => a + b, [a, b]);

  const isCorrect = useMemo(() => {
    const raw = answer.trim();
    if (!raw) return false;
    const n = Number(raw);
    if (!Number.isFinite(n)) return false;
    return n === expected;
  }, [answer, expected]);

  const close = () => {
    onClose?.();
    onCancel?.();
  };

  const pass = () => {
    onSuccess?.();
    onPassed?.();
  };

  const resetChallenge = () => {
    const na = randInt(min, max);
    const nb = randInt(min, max);
    setA(na);
    setB(nb);
    setAnswer("");
    setTouched(false);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2200,
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [floatAnim, pulseAnim]);

  useEffect(() => {
    if (!visible) return;
    resetChallenge();
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
    }, 30);
    return () => clearTimeout(t);
  }, [visible]);

  const onConfirm = () => {
    Keyboard.dismiss();
    setTouched(true);
    if (!isCorrect) return;
    pass();
    close();
  };

  const onChange = (text: string) => {
    const cleaned = text.replace(/[^\d]/g, "");
    setAnswer(cleaned);
  };

  const bubbleFloat = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const mascotScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close} />

      <View style={styles.center}>
        <View style={styles.card}>
          <View style={styles.orbTopLeft} />
          <View style={styles.orbTopRight} />
          <View style={styles.orbBottom} />

          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>for parents</Text>
              </View>

              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            <Animated.View
              style={[
                styles.mascotWrap,
                {
                  transform: [{ translateY: bubbleFloat }, { scale: mascotScale }],
                },
              ]}
            >
              <Text style={styles.mascotText}>🔐</Text>
            </Animated.View>
          </View>

          <View style={styles.questionShell}>
            <Text style={styles.questionLabel}>math challenge</Text>

            <View style={styles.questionWrap}>
              <Text style={styles.questionEmoji}>🧠</Text>
              <Text style={styles.questionText}>
                {a} + {b} = ?
              </Text>
            </View>
          </View>

          <TextInput
            value={answer}
            onChangeText={onChange}
            onFocus={() => setTouched(false)}
            placeholder="type the answer"
            placeholderTextColor={colors.muted}
            keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
            returnKeyType="done"
            onSubmitEditing={onConfirm}
            style={[
              styles.input,
              touched && !isCorrect && styles.inputError,
              isCorrect && styles.inputCorrect,
            ]}
          />

          {touched && !isCorrect ? (
            <Text style={styles.error}>not quite — try again</Text>
          ) : isCorrect ? (
            <Text style={styles.success}>great job — ready to confirm</Text>
          ) : (
            <Text style={styles.helper}>hint: add the two numbers above</Text>
          )}

          <View style={styles.row}>
            <Pressable style={({ pressed }) => [styles.btnGhost, pressed && styles.pressDown]} onPress={close}>
              <Text style={styles.btnGhostText}>cancel</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              disabled={!isCorrect}
              style={({ pressed }) => [
                styles.btnPrimary,
                !isCorrect && styles.btnPrimaryDisabled,
                pressed && isCorrect && styles.pressDown,
              ]}
            >
              <Text
                style={[
                  styles.btnPrimaryText,
                  !isCorrect && styles.btnPrimaryTextDisabled,
                ]}
              >
                confirm
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={resetChallenge}
            style={({ pressed }) => [styles.refresh, pressed && styles.pressDown]}
          >
            <Text style={styles.refreshEmoji}>🔄</Text>
            <Text style={styles.refreshText}>new question</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(45,35,85,0.55)",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },

  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radii.xl,
    padding: 18,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    overflow: "hidden",
    ...shadows.card,
  },

  orbTopLeft: {
    position: "absolute",
    top: -24,
    left: -18,
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: colors.yellow,
    opacity: 0.22,
  },

  orbTopRight: {
    position: "absolute",
    top: -10,
    right: -14,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: colors.sky,
    opacity: 0.2,
  },

  orbBottom: {
    position: "absolute",
    bottom: -28,
    left: 28,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: colors.pink,
    opacity: 0.16,
  },

  headerRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },

  headerTextWrap: {
    flex: 1,
  },

  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    marginBottom: 12,
  },

  badgeText: {
    color: colors.primaryDark,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "lowercase",
  },

  title: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
    color: colors.text,
    textTransform: "lowercase",
  },

  subtitle: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    textTransform: "lowercase",
  },

  mascotWrap: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.borderWarm,
  },

  mascotText: {
    fontSize: 32,
  },

  questionShell: {
    marginTop: 16,
  },

  questionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 8,
  },

  questionWrap: {
    borderRadius: radii.lg,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 2,
    borderColor: colors.borderWarm,
    alignItems: "center",
    justifyContent: "center",
  },

  questionEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },

  questionText: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.text,
  },

  input: {
    marginTop: 14,
    height: 52,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },

  inputError: {
    borderColor: colors.danger,
    backgroundColor: "#fff5f4",
  },

  inputCorrect: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondarySoft,
  },

  helper: {
    marginTop: 10,
    color: colors.muted,
    fontWeight: "700",
    textTransform: "lowercase",
  },

  success: {
    marginTop: 10,
    color: colors.secondary,
    fontWeight: "900",
    textTransform: "lowercase",
  },

  error: {
    marginTop: 10,
    color: colors.danger,
    fontWeight: "900",
    textTransform: "lowercase",
  },

  row: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },

  btnGhost: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
  },

  btnGhostText: {
    color: colors.text,
    fontWeight: "900",
    textTransform: "lowercase",
  },

  btnPrimary: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primaryDark,
  },

  btnPrimaryDisabled: {
    backgroundColor: colors.mutedSoft,
    borderColor: colors.mutedSoft,
  },

  btnPrimaryText: {
    color: colors.white,
    fontWeight: "900",
    textTransform: "lowercase",
  },

  btnPrimaryTextDisabled: {
    color: "rgba(255,255,255,0.92)",
  },

  refresh: {
    marginTop: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.pinkSoft,
  },

  refreshEmoji: {
    fontSize: 14,
  },

  refreshText: {
    color: colors.textSoft,
    fontWeight: "900",
    textTransform: "lowercase",
  },

  pressDown: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});
