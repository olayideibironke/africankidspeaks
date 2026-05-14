import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";

import { palette } from "./theme/palette";
import { colors, lang } from "./theme/colors";
import { spacing } from "./theme/spacing";
import { radii } from "./theme/radii";
import { shadows } from "./theme/shadows";
import { textStyles, fontFamily } from "./theme/typography";

import {
  Screen,
  Card,
  Button,
  Pill,
  Badge,
  ProgressBar,
  AudioButton,
  Text,
} from "./components/ui";
import { LogoMark } from "./components/illustrations/LogoMark";
import { Mascot } from "./components/illustrations/Mascot";
import { PatternBackdrop } from "./components/illustrations/PatternBackdrop";
import {
  IconConceptA,
  IconConceptB,
  IconConceptC,
} from "./components/illustrations/IconConcepts";

const PALETTE_TOKENS: Array<{ name: string; value: string; onDark?: boolean }> = [
  { name: "clay", value: palette.clay },
  { name: "clayDeep", value: palette.clayDeep },
  { name: "claySoft", value: palette.claySoft, onDark: true },
  { name: "sunlit", value: palette.sunlit },
  { name: "sunlitDeep", value: palette.sunlitDeep },
  { name: "sunlitSoft", value: palette.sunlitSoft, onDark: true },
  { name: "indigo", value: palette.indigo },
  { name: "indigoDeep", value: palette.indigoDeep },
  { name: "indigoSoft", value: palette.indigoSoft, onDark: true },
  { name: "mint", value: palette.mint },
  { name: "mintDeep", value: palette.mintDeep },
  { name: "mintSoft", value: palette.mintSoft, onDark: true },
  { name: "plum", value: palette.plum },
  { name: "plumDeep", value: palette.plumDeep },
  { name: "plumSoft", value: palette.plumSoft, onDark: true },
  { name: "linen", value: palette.linen, onDark: true },
  { name: "bone", value: palette.bone, onDark: true },
  { name: "ink", value: palette.ink },
  { name: "slate", value: palette.slate },
];

export default function DesignPreview() {
  const router = useRouter();
  const [audioPlaying, setAudioPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState(38);

  const toggleAudio = (key: string) => {
    setAudioPlaying((cur) => (cur === key ? null : key));
    setTimeout(() => setAudioPlaying(null), 2400);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen background={colors.background} topInsetExtra={spacing.md} bottomInsetExtra={spacing.xl3}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text variant="bodyStrong" tone="accent">‹ Back</Text>
          </Pressable>
          <Text variant="overline" tone="muted">Design Preview · v1</Text>
        </View>

        <View style={styles.heroBlock}>
          <LogoMark size={96} variant="lockup" />
          <View style={{ height: spacing.md }} />
          <Text variant="display3" align="left">
            Premium African Dawn
          </Text>
          <Text variant="subtitle" tone="soft" style={{ marginTop: spacing.xs }}>
            New design system foundation. Tap anything below to feel the motion.
          </Text>
        </View>

        <Section title="Logo & lockups">
          <View style={[styles.row, { gap: spacing.xl }]}>
            <Card variant="elevated" padding="xl" radius="xl2">
              <Text variant="overline" tone="muted">Icon</Text>
              <View style={{ height: spacing.md }} />
              <LogoMark size={88} variant="icon" />
            </Card>
            <Card variant="elevated" padding="xl" radius="xl2" style={{ flex: 1 }}>
              <Text variant="overline" tone="muted">Stacked lockup</Text>
              <View style={{ height: spacing.md }} />
              <LogoMark size={72} variant="lockup-stacked" />
            </Card>
          </View>
        </Section>

        <Section title="App icon — pick one">
          <Text variant="body" tone="soft" style={{ marginBottom: spacing.lg }}>
            Three directions. Tell me A, B, or C and I'll rasterize it to 1024×1024 for iOS.
          </Text>
          <View style={[styles.row, { gap: spacing.lg }]}>
            <IconChoice label="A · Wordmark" hint="Bold AK initials">
              <IconConceptA size={104} />
            </IconChoice>
            <IconChoice label="B · Speech bubble" hint="Conversational">
              <IconConceptB size={104} />
            </IconChoice>
            <IconChoice label="C · Mascot face" hint="Friendly companion">
              <IconConceptC size={104} />
            </IconChoice>
          </View>
        </Section>

        <Section title="Palette">
          <View style={styles.swatchGrid}>
            {PALETTE_TOKENS.map((s) => (
              <View key={s.name} style={[styles.swatch, { backgroundColor: s.value }]}>
                <Text
                  variant="overline"
                  style={{ color: s.onDark ? palette.ink : palette.white, fontSize: 9 }}
                >
                  {s.name}
                </Text>
                <Text
                  variant="caption"
                  style={{ color: s.onDark ? palette.slate : palette.linen, fontSize: 10 }}
                >
                  {s.value}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Typography">
          <Card variant="elevated" padding="xl" radius="xl2">
            <Text variant="display1">Display 1</Text>
            <Text variant="display2" style={{ marginTop: spacing.sm }}>Display 2</Text>
            <Text variant="display3" style={{ marginTop: spacing.sm }}>Display 3</Text>
            <Text variant="title" style={{ marginTop: spacing.md }}>Title — Plus Jakarta ExtraBold</Text>
            <Text variant="subtitle" style={{ marginTop: spacing.xs }}>
              Subtitle — Plus Jakarta SemiBold
            </Text>
            <Text variant="body" style={{ marginTop: spacing.sm }}>
              Body. Kids learn fastest when text is generous and easy on the eye. Plus Jakarta Sans
              keeps it readable at small sizes.
            </Text>
            <Text variant="bodyStrong" style={{ marginTop: spacing.xs }}>
              Body strong — emphasis without shouting.
            </Text>
            <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
              CAPTION · for small metadata
            </Text>
            <Text variant="overline" tone="muted" style={{ marginTop: spacing.xs }}>
              Overline
            </Text>
          </Card>
        </Section>

        <Section title="Buttons">
          <View style={{ gap: spacing.md }}>
            <View style={[styles.row, { gap: spacing.sm, flexWrap: "wrap" }]}>
              <Button label="Primary" onPress={() => {}} />
              <Button label="Secondary" variant="secondary" onPress={() => {}} />
              <Button label="Ghost" variant="ghost" onPress={() => {}} />
            </View>
            <View style={[styles.row, { gap: spacing.sm, flexWrap: "wrap" }]}>
              <Button label="Inverse" variant="inverse" onPress={() => {}} />
              <Button label="Danger" variant="danger" onPress={() => {}} />
              <Button label="Disabled" disabled onPress={() => {}} />
            </View>
            <View style={[styles.row, { gap: spacing.sm, flexWrap: "wrap" }]}>
              <Button label="Small" size="sm" onPress={() => {}} />
              <Button label="Medium" size="md" onPress={() => {}} />
              <Button label="Large" size="lg" onPress={() => {}} />
            </View>
            <Button label="Full width primary" fullWidth onPress={() => {}} />
          </View>
        </Section>

        <Section title="Pills & badges">
          <View style={[styles.row, { gap: spacing.sm, flexWrap: "wrap" }]}>
            <Pill label="Yoruba" variant="solid" bg={lang.yo.primary} color={colors.white} />
            <Pill label="Igbo" variant="solid" bg={lang.ig.primary} color={colors.white} />
            <Pill label="Pidgin" variant="solid" bg={lang.pg.primary} color={lang.pg.primaryDeep} />
            <Pill label="Tonal" variant="tonal" />
            <Pill label="Outline" variant="outline" />
            <Badge value={3} />
            <Badge value="NEW" bg={palette.mint} />
          </View>
        </Section>

        <Section title="Progress">
          <View style={{ gap: spacing.md }}>
            <View style={[styles.row, { gap: spacing.md, alignItems: "center" }]}>
              <Text variant="bodyStrong" style={{ width: 64 }}>{progress}%</Text>
              <View style={{ flex: 1 }}>
                <ProgressBar value={progress} fillColor={lang.yo.primary} />
              </View>
            </View>
            <View style={[styles.row, { gap: spacing.sm }]}>
              <Button label="−10" size="sm" variant="ghost" onPress={() => setProgress((v) => Math.max(0, v - 10))} />
              <Button label="+10" size="sm" variant="secondary" onPress={() => setProgress((v) => Math.min(100, v + 10))} />
              <Button label="Reset" size="sm" variant="ghost" onPress={() => setProgress(0)} />
            </View>
          </View>
        </Section>

        <Section title="Audio button">
          <View style={[styles.row, { gap: spacing.xl, alignItems: "center" }]}>
            <AudioButton
              onPress={() => toggleAudio("yo")}
              playing={audioPlaying === "yo"}
              tint={lang.yo.primary}
              size={72}
            />
            <AudioButton
              onPress={() => toggleAudio("ig")}
              playing={audioPlaying === "ig"}
              tint={lang.ig.primary}
              size={64}
            />
            <AudioButton
              onPress={() => toggleAudio("pg")}
              playing={audioPlaying === "pg"}
              tint={lang.pg.primary}
              size={56}
            />
          </View>
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
            Tap to see the ring pulse. Auto-stops after 2.4s.
          </Text>
        </Section>

        <Section title="Mascot — Speaks">
          <Text variant="body" tone="soft" style={{ marginBottom: spacing.lg }}>
            Parametric SVG. Accent flexes per language; four expressions: happy, wave, wow, listening.
          </Text>
          <View style={[styles.row, { gap: spacing.md, flexWrap: "wrap" }]}>
            <MascotCard label="Happy · YO" expression="happy" accent="yo" />
            <MascotCard label="Wave · IG" expression="wave" accent="ig" />
            <MascotCard label="Wow · PG" expression="wow" accent="pg" />
            <MascotCard label="Listening · YO" expression="listening" accent="yo" />
          </View>
        </Section>

        <Section title="Pattern backdrops">
          <Text variant="body" tone="soft" style={{ marginBottom: spacing.lg }}>
            Subtle SVG patterns — used as background texture on hero cards. Geometric, not literal.
          </Text>
          <View style={{ gap: spacing.md }}>
            <PatternCard variant="kente-weave" label="Kente weave" color={palette.clay} bg={palette.linen} />
            <PatternCard variant="adire-dots" label="Adire dots" color={palette.indigo} bg={palette.indigoSoft} />
            <PatternCard variant="sun-rays" label="Sun rays" color={palette.sunlitDeep} bg={palette.sunlitSoft} />
            <PatternCard variant="soft-stripes" label="Soft stripes" color={palette.plum} bg={palette.plumSoft} />
          </View>
        </Section>

        <Section title="Cards in context">
          <View style={{ gap: spacing.md }}>
            <Card variant="elevated" padding="xl" radius="xl2">
              <Pill label="Yoruba · YO" variant="solid" bg={lang.yo.primary} color={colors.white} />
              <Text variant="display3" style={{ marginTop: spacing.md }}>báwo</Text>
              <Text variant="subtitle" tone="soft">Hello · greeting</Text>
              <View style={{ marginTop: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
                <AudioButton onPress={() => toggleAudio("card-yo")} playing={audioPlaying === "card-yo"} tint={lang.yo.primary} size={56} />
                <View style={{ flex: 1 }}>
                  <Text variant="caption" tone="muted">Native audio</Text>
                  <ProgressBar value={68} fillColor={lang.yo.primary} height={8} />
                </View>
              </View>
            </Card>

            <Card variant="tinted" tint={lang.ig.surface} padding="xl" radius="xl2">
              <Pill label="Igbo · IG" variant="solid" bg={lang.ig.primary} color={colors.white} />
              <Text variant="display3" style={{ marginTop: spacing.md, color: lang.ig.onSurface }}>ndewo</Text>
              <Text variant="subtitle" style={{ color: lang.ig.primaryDeep, opacity: 0.8 }}>Hello · greeting</Text>
            </Card>

            <Card variant="soft" tint={lang.pg.surface} padding="xl" radius="xl2">
              <Pill label="Pidgin · PG" variant="solid" bg={lang.pg.primary} color={lang.pg.primaryDeep} />
              <Text variant="display3" style={{ marginTop: spacing.md, color: lang.pg.onSurface }}>how far</Text>
              <Text variant="subtitle" style={{ color: lang.pg.primaryDeep, opacity: 0.8 }}>Hello · greeting</Text>
            </Card>
          </View>
        </Section>

        <Section title="Shadows & elevation">
          <View style={[styles.row, { gap: spacing.md, flexWrap: "wrap" }]}>
            {(["xs", "sm", "md", "lg", "xl"] as const).map((s) => (
              <View key={s} style={[styles.shadowChip, shadows[s], { backgroundColor: colors.surface }]}>
                <Text variant="overline">{s}</Text>
              </View>
            ))}
          </View>
        </Section>

        <View style={{ height: spacing.xl4 }} />
        <Text variant="caption" tone="muted" align="center">
          AfricanKidSpeaks · Design system foundation · iOS production target
        </Text>
      </Screen>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" tone="muted" style={{ marginBottom: spacing.md }}>{title}</Text>
      {children}
    </View>
  );
}

function IconChoice({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <View style={[styles.iconChoiceWrap, shadows.md]}>{children}</View>
      <Text variant="bodyStrong" align="center" style={{ marginTop: spacing.sm }}>{label}</Text>
      <Text variant="caption" tone="muted" align="center">{hint}</Text>
    </View>
  );
}

function MascotCard({
  label,
  expression,
  accent,
}: {
  label: string;
  expression: "happy" | "wave" | "wow" | "listening";
  accent: "yo" | "ig" | "pg";
}) {
  return (
    <Card variant="elevated" padding="lg" radius="xl2" style={{ width: "47%", alignItems: "center" }}>
      <Mascot size={120} expression={expression} accent={accent} />
      <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>{label}</Text>
    </Card>
  );
}

function PatternCard({
  variant,
  label,
  color,
  bg,
}: {
  variant: "kente-weave" | "adire-dots" | "sun-rays" | "soft-stripes";
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.patternCard, { backgroundColor: bg }]}>
      <PatternBackdrop variant={variant} color={color} width={520} height={140} opacity={0.22} />
      <View style={styles.patternLabel}>
        <Text variant="bodyStrong">{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  heroBlock: {
    marginBottom: spacing.xl2,
  },
  section: {
    marginBottom: spacing.xl3,
  },
  row: {
    flexDirection: "row",
  },
  swatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  swatch: {
    width: "31%",
    aspectRatio: 1.6,
    borderRadius: radii.md,
    padding: spacing.sm,
    justifyContent: "space-between",
  },
  iconChoiceWrap: {
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  shadowChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
  },
  patternCard: {
    height: 140,
    borderRadius: radii.xl2,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  patternLabel: {
    padding: spacing.lg,
  },
});
