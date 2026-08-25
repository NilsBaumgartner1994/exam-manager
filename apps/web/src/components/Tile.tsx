import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface Props {
  title: string;
  subtitle: string;
  onPress: () => void;
  testID?: string;
}

/** Große Kachel der Startseite. */
export function Tile({ title, subtitle, onPress, testID }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [
        styles.tile,
        // "hovered" gibt es nur auf Web – im RN-Typ fehlt es
        (state as { hovered?: boolean }).hovered === true && styles.hovered,
        state.pressed && styles.pressed,
      ]}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    width: 380,
    maxWidth: '100%',
    minHeight: 140,
  },
  hovered: { borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
});
