import { ReactNode, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useResponsiveLayout } from '../responsive';
import { colors, spacing } from '../theme';
import { AppButton } from './AppButton';

/**
 * Arbeitsfläche eines Screens – der Aufbau einer Tabellenkalkulation.
 *
 * Oben das Menüband (Aktionsleisten, Reiter, Werkzeuge), unten die Fußleiste
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
 * Eine Zeile des Menübands: links die Beschriftung („Datei“, „PDF“), daneben
 * die Knöpfe.
 *
 * Im breiten Fenster bricht sie um. Auf dem Handy **nicht**: Dort scrollt sie
 * waagerecht, wie die Werkzeugleisten der Tabellenkalkulationen auf dem
 * Telefon. Umgebrochen füllten zehn Knöpfe sonst den halben Bildschirm, und
 * vom Plan bliebe nichts übrig.
 */
export function Aktionsleiste({
  titel,
  children,
  testID,
}: {
  titel?: string;
  children: ReactNode;
  testID?: string;
}) {
  const { isCompact } = useResponsiveLayout();
  if (isCompact) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.leisteScroll}
        contentContainerStyle={styles.leisteEng}
        testID={testID}
      >
        {titel ? <Text style={styles.leistenTitel}>{titel}</Text> : null}
        {children}
      </ScrollView>
    );
  }
  return (
    <View style={styles.leiste} testID={testID}>
      {titel ? <Text style={styles.leistenTitel}>{titel}</Text> : null}
      {children}
    </View>
  );
}

/**
 * Die Reiter über dem Arbeitsbereich – wie die Blattregister einer
 * Tabellenkalkulation: ein Reiter je Raum, dazu die Reiter für Einstellungen
 * und Listen. Sie liegen in einer eigenen, waagerecht scrollenden Zeile:
 * Bei zwölf Räumen soll das Menüband nicht den halben Bildschirm füllen.
 */
export function Reiterleiste<T extends string>({
  reiter,
  aktiv,
  onWaehlen,
  testID,
}: {
  reiter: { key: T; titel: string; testID?: string }[];
  aktiv: T;
  onWaehlen: (key: T) => void;
  testID?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.reiterScroll}
      contentContainerStyle={styles.reiterZeile}
      testID={testID}
    >
      {reiter.map((eintrag) => (
        <AppButton
          key={eintrag.key}
          title={eintrag.titel}
          variant={eintrag.key === aktiv ? 'primary' : 'secondary'}
          kompakt
          onPress={() => onWaehlen(eintrag.key)}
          testID={eintrag.testID}
        />
      ))}
    </ScrollView>
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
  leiste: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
  },
  leisteScroll: { flexGrow: 0, maxWidth: '100%' },
  /** Waagerecht scrollend: alles in einer Zeile, nichts bricht um. */
  leisteEng: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  leistenTitel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    paddingRight: spacing.xs,
  },
  reiterScroll: { flexGrow: 0, maxWidth: '100%' },
  reiterZeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  /** Der Scroller des Reiters: `flex: 1` füllt den Körper, `minHeight: 0` lässt ihn scrollen. */
  inhaltScroll: { flex: 1, minHeight: 0, backgroundColor: colors.background },
  inhalt: { alignItems: 'stretch' },
});
