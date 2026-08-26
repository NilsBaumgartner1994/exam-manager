import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  /**
   * Schmaler und kleiner beschriftet – für Werkzeugleisten mit vielen Knöpfen
   * (Raumplan) auf einem Handy: In voller Größe füllen acht Knöpfe dort den
   * halben Bildschirm, und vom Plan bleibt nichts übrig.
   */
  kompakt?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function AppButton({ title, onPress, variant = 'primary', kompakt, disabled, testID }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        kompakt && styles.buttonKompakt,
        primary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.text,
          kompakt && styles.textKompakt,
          primary ? styles.textPrimary : styles.textSecondary,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  buttonKompakt: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.sm },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  text: { fontSize: 15, fontWeight: '600' },
  textKompakt: { fontSize: 13 },
  textPrimary: { color: colors.primaryText },
  textSecondary: { color: colors.primary },
});
