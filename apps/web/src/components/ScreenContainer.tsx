import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

interface Props {
  title: string;
  intro?: string;
  children: ReactNode;
  testID?: string;
}

/**
 * Einheitlicher Rahmen aller Unterseiten: Titel, Einleitung, begrenzte Breite.
 * Bewusst kein ScrollView – die Seite scrollt nativ im Browser.
 */
export function ScreenContainer({ title, intro, children, testID }: Props) {
  return (
    <View style={styles.outer} testID={testID}>
      <View style={styles.inner}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {intro ? <Text style={styles.intro}>{intro}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { backgroundColor: colors.background, padding: spacing.lg, alignItems: 'center' },
  inner: { width: '100%', maxWidth: 900, gap: spacing.md },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  intro: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
});
