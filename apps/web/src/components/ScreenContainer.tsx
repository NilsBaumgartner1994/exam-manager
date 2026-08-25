import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useResponsiveLayout } from '../responsive';
import { colors } from '../theme';

interface Props {
  title: string;
  intro?: string;
  children: ReactNode;
  testID?: string;
}

/**
 * Einheitlicher Rahmen aller Unterseiten: Titel, Einleitung, responsive Breite.
 *
 * Keine feste Fensterbreite – Ränder, Abstände und Schriftgrößen kommen aus
 * `useResponsiveLayout()` und wachsen mit dem Fenster.
 *
 * Der Inhalt steckt in einem ScrollView, damit lange Seiten immer scrollbar
 * sind. Im Web bleibt die Höhe des Containers ungebunden (`#root` ist auf
 * `height: auto` gesetzt, siehe App.tsx) – dort scrollt weiterhin die Seite
 * selbst, was normales Browser-Verhalten und Maestros `scrollUntilVisible`
 * erhält. Wird die Höhe begrenzt (kleines Fenster, mobiler Browser, native
 * Plattform), übernimmt der ScrollView.
 */
export function ScreenContainer({ title, intro, children, testID }: Props) {
  const layout = useResponsiveLayout();
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: layout.gutter, paddingVertical: layout.gutterY },
      ]}
      keyboardShouldPersistTaps="handled"
      testID={testID}
    >
      <View style={[styles.inner, { width: layout.contentWidth, gap: layout.gap }]}>
        <Text style={[styles.title, { fontSize: layout.titleFontSize }]} accessibilityRole="header">
          {title}
        </Text>
        {intro ? (
          <Text
            style={[
              styles.intro,
              { fontSize: layout.introFontSize, lineHeight: layout.introFontSize * 1.45 },
            ]}
          >
            {intro}
          </Text>
        ) : null}
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.background },
  content: { flexGrow: 1, alignItems: 'center' },
  inner: { alignSelf: 'stretch', alignItems: 'stretch' },
  title: { fontWeight: '700', color: colors.text },
  intro: { color: colors.textMuted },
});
