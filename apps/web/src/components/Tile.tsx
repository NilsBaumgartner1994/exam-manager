import { Pressable, StyleSheet, Text } from 'react-native';
import { useResponsiveLayout } from '../responsive';
import { colors, radius, spacing } from '../theme';

interface Props {
  title: string;
  subtitle: string;
  onPress: () => void;
  testID?: string;
}

/**
 * Kachel der Startseite. Keine feste Breite: die Kachel bekommt eine
 * prozentuale Basisbreite je Fenstergröße und füllt den Rest der Zeile über
 * `flexGrow` – bei schmalen Fenstern steht sie allein, bei breiten stehen
 * mehrere nebeneinander.
 */
export function Tile({ title, subtitle, onPress, testID }: Props) {
  const layout = useResponsiveLayout();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [
        styles.tile,
        { flexBasis: layout.tileBasis, padding: layout.isCompact ? spacing.md : spacing.lg },
        // "hovered" gibt es nur auf Web – im RN-Typ fehlt es
        (state as { hovered?: boolean }).hovered === true && styles.hovered,
        state.pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.title, layout.isCompact && styles.titleCompact]}>{title}</Text>
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
    gap: spacing.sm,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  hovered: { borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  titleCompact: { fontSize: 17 },
  subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
});
