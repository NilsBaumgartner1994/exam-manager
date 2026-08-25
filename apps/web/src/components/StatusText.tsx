import { StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface Props {
  kind: 'success' | 'error' | 'info';
  children: string;
  testID?: string;
}

/** Ergebnis- oder Fehlermeldung. */
export function StatusText({ kind, children, testID }: Props) {
  return (
    <Text
      style={[
        styles.base,
        kind === 'success' && styles.success,
        kind === 'error' && styles.error,
        kind === 'info' && styles.info,
      ]}
      testID={testID}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 14,
    lineHeight: 20,
    padding: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  success: { backgroundColor: colors.successBg, color: colors.success },
  error: { backgroundColor: colors.dangerBg, color: colors.danger },
  info: { backgroundColor: colors.background, color: colors.textMuted },
});
