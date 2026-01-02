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
} from "react-native";
import { colors } from "../theme";

type Props = {
  visible: boolean;

  // support both naming styles (settings + games may use different prop names)
  onClose?: () => void;
  onCancel?: () => void;

  onSuccess?: () => void;
  onPassed?: () => void;

  title?: string;
  subtitle?: string;

  // optional: control difficulty if you want later
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

  // regenerate challenge whenever modal opens
  useEffect(() => {
    if (!visible) return;
    resetChallenge();
    // small delay helps on iOS to avoid focus/keyboard weirdness
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
    }, 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onConfirm = () => {
    Keyboard.dismiss();
    setTouched(true);
    if (!isCorrect) return;
    pass();
    close();
  };

  const onChange = (text: string) => {
    // keep only digits (prevents " " / "." / "-" issues)
    const cleaned = text.replace(/[^\d]/g, "");
    setAnswer(cleaned);
  };

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
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* ✅ FIX: make the math question big + high contrast */}
          <View style={styles.questionWrap}>
            <Text style={styles.questionText}>
              {a} + {b} = ?
            </Text>
          </View>

          <TextInput
            value={answer}
            onChangeText={onChange}
            onFocus={() => setTouched(false)}
            placeholder="type the answer"
            placeholderTextColor="rgba(0,0,0,0.35)"
            keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
            returnKeyType="done"
            onSubmitEditing={onConfirm}
            style={styles.input}
          />

          {/* feedback */}
          {touched && !isCorrect ? (
            <Text style={styles.error}>not quite — try again</Text>
          ) : (
            <Text style={styles.helper}>
              hint: add the two numbers above
            </Text>
          )}

          <View style={styles.row}>
            <Pressable onPress={close} style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>cancel</Text>
            </Pressable>

            {/* ✅ FIX: confirm button always visible; disabled style is clear */}
            <Pressable
              onPress={onConfirm}
              disabled={!isCorrect}
              style={[
                styles.btnPrimary,
                !isCorrect && styles.btnPrimaryDisabled,
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

          <Pressable onPress={resetChallenge} style={styles.refresh}>
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
    backgroundColor: "rgba(0,0,0,0.55)",
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
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
    textTransform: "lowercase",
  },
  subtitle: {
    marginTop: 4,
    color: "rgba(0,0,0,0.60)",
    textTransform: "lowercase",
  },

  questionWrap: {
    marginTop: 14,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  questionText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111",
  },

  input: {
    marginTop: 12,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,1)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.18)",
    color: "#111",
    fontSize: 18,
    fontWeight: "800",
  },

  helper: {
    marginTop: 8,
    color: "rgba(0,0,0,0.55)",
    fontWeight: "700",
    textTransform: "lowercase",
  },
  error: {
    marginTop: 8,
    color: "#b00020",
    fontWeight: "900",
    textTransform: "lowercase",
  },

  row: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },

  btnGhost: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  btnGhostText: {
    color: "#111",
    fontWeight: "900",
    textTransform: "lowercase",
  },

  btnPrimary: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.20)",
  },
  btnPrimaryDisabled: {
    backgroundColor: "rgba(0,0,0,0.18)",
    borderColor: "rgba(0,0,0,0.10)",
  },
  btnPrimaryText: {
    color: "#fff",
    fontWeight: "900",
    textTransform: "lowercase",
  },
  btnPrimaryTextDisabled: {
    color: "rgba(255,255,255,0.90)",
  },

  refresh: {
    marginTop: 12,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  refreshText: {
    color: "rgba(0,0,0,0.60)",
    fontWeight: "900",
    textTransform: "lowercase",
  },
});
