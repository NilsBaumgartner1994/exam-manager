import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useResponsiveLayout } from '../responsive';
import { colors, radius, spacing } from '../theme';

interface Props {
  title: string;
  children: ReactNode;
  testID?: string;
}

/** Karte für einen Arbeitsschritt innerhalb eines Screens (volle Breite). */
export function Section({ title, children, testID }: Props) {
  const { isCompact } = useResponsiveLayout();
  return (
    <View style={[styles.card, { padding: isCompact ? spacing.md - 4 : spacing.md }]} testID={testID}>
      <Text style={[styles.title, isCompact && styles.titleCompact]}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  titleCompact: { fontSize: 16 },
  body: { gap: spacing.sm, width: '100%' },
});
