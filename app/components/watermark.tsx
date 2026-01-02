import { Image, StyleSheet, View } from "react-native";

export default function Watermark() {
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Image
        // ✅ REAL path based on your screenshot
        source={require("../../assets/icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.18, // watermark strength (we can tune later)
  },
  logo: {
    width: "85%",
    height: "85%",
  },
});
