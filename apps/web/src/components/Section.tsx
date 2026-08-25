import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface Props {
  title: string;
  children: ReactNode;
  testID?: string;
}

/** Karte für einen Arbeitsschritt innerhalb eines Screens. */
export function Section({ title, children, testID }: Props) {
  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  body: { gap: spacing.sm },
});
