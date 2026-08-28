import { ReactNode, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import { useResponsiveLayout } from '../responsive';
import { colors, spacing } from '../theme';

/**
 * Arbeitsfläche eines Screens – der Aufbau einer Tabellenkalkulation.
 *
 * Oben das Menüband (`Menueleiste`), unten die Fußleiste
 * (Zoom, Ansicht, Status), dazwischen nichts als der Arbeitsbereich in voller
 * Breite. Beide Leisten bleiben stehen; gescrollt wird **innerhalb** des
 * Körpers, damit sie nicht aus dem Bild wandern.
 *
 * Der Körper bekommt seine gemessene Höhe (`children(hoehe)`): Ein Raumplan
 * braucht die Zahl, um „Ganzer Raum“ ausrechnen zu können – ohne sie könnte
 * er nur raten, wie viel Platz übrig ist. Vor der ersten Messung ist sie `0`;
 * wer sie weitergibt, behandelt das wie „noch unbekannt“.
 *
 * Die Kopfzeile der App (Zurück und Titel) steht darüber im `Router` – die
 * Arbeitsfläche füllt genau den Rest des Fensters.
 */
export function Arbeitsflaeche({
  kopf,
  fuss,
  children,
  testID,
}: {
  kopf: ReactNode;
  fuss?: ReactNode;
  children: (hoehe: number) => ReactNode;
  testID?: string;
}) {
  const [hoehe, setzeHoehe] = useState(0);

  const gemessen = (ereignis: LayoutChangeEvent) => {
    const gemessene = Math.round(ereignis.nativeEvent.layout.height);
    if (gemessene > 0 && gemessene !== hoehe) setzeHoehe(gemessene);
  };

  return (
    <View style={styles.flaeche} testID={testID}>
      <View style={styles.kopf}>{kopf}</View>
      {/* `minHeight: 0` ist Pflicht: Sonst wächst der Körper über den
          Bildschirm hinaus und die Fußleiste steht außerhalb des Fensters. */}
      <View style={styles.koerper} onLayout={gemessen}>
        {children(hoehe)}
      </View>
      {fuss ? <View style={styles.fuss}>{fuss}</View> : null}
    </View>
  );
}

/**
 * Ein Reiter, dessen Inhalt ein Formular ist (Einstellungen, Listen): Er
 * scrollt für sich, damit die Leisten oben und unten stehen bleiben.
 */
export function Reiterinhalt({
  children,
  testID,
}: {
  children: ReactNode;
  testID?: string;
}) {
  const layout = useResponsiveLayout();
  return (
    <ScrollView
      style={styles.inhaltScroll}
      contentContainerStyle={[
        styles.inhalt,
        { paddingHorizontal: layout.gutter, paddingVertical: layout.gutterY, gap: layout.gap },
      ]}
      keyboardShouldPersistTaps="handled"
      testID={testID}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flaeche: { flex: 1, minHeight: 0, backgroundColor: colors.background },
  kopf: {
    flexShrink: 0,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  koerper: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
  fuss: {
    flexShrink: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  /** Der Scroller des Reiters: `flex: 1` füllt den Körper, `minHeight: 0` lässt ihn scrollen. */
  inhaltScroll: { flex: 1, minHeight: 0, backgroundColor: colors.background },
  inhalt: { alignItems: 'stretch' },
});
