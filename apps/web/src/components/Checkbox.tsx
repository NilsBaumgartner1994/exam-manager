import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface Props {
  label: string;
  wert: boolean;
  onChange: (wert: boolean) => void;
  testID?: string;
}

/**
 * Ein Häkchen mit Beschriftung – React Native bringt keines mit, und das
 * `<input type="checkbox">` des Browsers ließe sich nicht wie der Rest der App
 * gestalten. Die ganze Zeile ist die Schaltfläche, damit sie auch mit dem
 * Finger zu treffen ist.
 */
export function Checkbox({ label, wert, onChange, testID }: Props) {
  return (
    <Pressable
      style={styles.zeile}
      onPress={() => onChange(!wert)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: wert }}
      testID={testID}
    >
      <View style={[styles.kasten, wert && styles.kastenAktiv]}>
        {wert ? <Text style={styles.haken}>✓</Text> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zeile: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kasten: {
    width: 20,
    height: 20,
    borderRadius: radius.md - 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kastenAktiv: { backgroundColor: colors.primary, borderColor: colors.primary },
  haken: { color: colors.primaryText, fontSize: 13, fontWeight: '700', lineHeight: 16 },
  label: { fontSize: 14, color: colors.text },
});
