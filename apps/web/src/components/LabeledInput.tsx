import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface TextProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  testID?: string;
}

export function LabeledTextInput({ label, value, onChangeText, placeholder, testID }: TextProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        testID={testID}
      />
    </View>
  );
}

interface NumberProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  testID?: string;
}

/** Zahleneingabe; leeres Feld ergibt `null`. */
export function LabeledNumberInput({ label, value, onChange, testID }: NumberProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value === null ? '' : String(value)}
        inputMode="decimal"
        onChangeText={(text) => {
          const trimmed = text.trim().replace(',', '.');
          if (trimmed === '') return onChange(null);
          const parsed = Number(trimmed);
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs, maxWidth: 420 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
