import { ReactNode, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { AppButton } from './AppButton';
import { useModalEbene } from './ModalHost';

interface Props {
  offen: boolean;
  titel: string;
  /** Zweite Zeile unter dem Titel, z. B. die Adresse der Zelle. */
  untertitel?: string;
  onSchliessen: () => void;
  children: ReactNode;
  testID?: string;
}

/**
 * Ein Blatt, das von unten hereinfährt und die volle Breite einnimmt.
 *
 * Für Entscheidungen an einer Stelle des Plans: Der Plan darüber bleibt
 * sichtbar, damit klar ist, worum es geht, und alles Weitere steht groß genug
 * darunter – auch auf einem Tablet, wo ein kleines Menü neben dem Finger nicht
 * zu treffen wäre.
 *
 * **Es ist kein `Modal` von React Native.** Gezeichnet wird in die Modal-Ebene
 * der App-Shell (`ModalHost`, Vorbild rocket-meals): Ein Modal ist eine Ebene
 * über der App, kein eigenes `div` am `body`. Das ist der Unterschied, den man
 * merkt – vorher fing der Browser an, die Seite zu scrollen, sobald ein Blatt
 * auftauchte, weil das Blatt außerhalb der Shell lag.
 *
 * Das Blatt ist **so hoch wie sein Inhalt**, höchstens vier Fünftel des
 * Bildschirms. Ein Blatt mit drei Zeilen darin verdeckt sonst den halben Raum,
 * den man gerade ansieht.
 *
 * Ein Tippen daneben schließt – die Geste, die man von einem solchen Blatt
 * erwartet, und auf dem Touchgerät leichter zu treffen als ein kleines Kreuz
 * in der Ecke (das es trotzdem gibt). Escape tut dasselbe.
 */
export function BlattModal({ offen, titel, untertitel, onSchliessen, children, testID }: Props) {
  // Escape schließt – am Rechner die Taste, die man dafür drückt.
  useEffect(() => {
    if (!offen) return;
    const aufTaste = (ereignis: KeyboardEvent) => {
      if (ereignis.key === 'Escape') onSchliessen();
    };
    window.addEventListener('keydown', aufTaste);
    return () => window.removeEventListener('keydown', aufTaste);
  }, [offen, onSchliessen]);

  return useModalEbene(
    offen ? (
      <View style={styles.hintergrund}>
        <Pressable
          style={styles.freiflaeche}
          onPress={onSchliessen}
          testID={testID ? `${testID}-hintergrund` : undefined}
        />
        <View style={styles.blatt} testID={testID}>
          <View style={styles.griff} />
          <View style={styles.kopf}>
            <View style={styles.kopfText}>
              <Text style={styles.titel} testID={testID ? `${testID}-titel` : undefined}>
                {titel}
              </Text>
              {untertitel ? <Text style={styles.untertitel}>{untertitel}</Text> : null}
            </View>
            <AppButton
              title="Schließen"
              variant="secondary"
              onPress={onSchliessen}
              testID={testID ? `${testID}-schliessen` : undefined}
            />
          </View>
          <ScrollView style={styles.scroller} contentContainerStyle={styles.inhalt}>
            {children}
          </ScrollView>
        </View>
      </View>
    ) : null,
  );
}

const styles = StyleSheet.create({
  hintergrund: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    // Über dem Vollbild des Raumplans: Beide zeichnen in dieselbe Ebene, und
    // ein Blatt gehört immer nach vorn.
    zIndex: 10,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  freiflaeche: { flex: 1 },
  blatt: {
    // So hoch wie der Inhalt, aber nie höher als vier Fünftel: Ein kurzer
    // Hinweis nimmt zwei Zeilen ein, eine Namensliste scrollt im Blatt.
    maxHeight: '80%',
    width: '100%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  griff: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  kopf: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  kopfText: { flexShrink: 1, gap: 2 },
  titel: { fontSize: 18, fontWeight: '700', color: colors.text },
  untertitel: { fontSize: 13, color: colors.textMuted },
  /**
   * Wächst mit dem Inhalt (`flexGrow: 0`) und gibt nach, sobald das Blatt an
   * seine vier Fünftel stößt – dann scrollt es darin. Mit `flex: 1` wäre jedes
   * Blatt so hoch wie erlaubt, auch mit drei Zeilen darin.
   */
  scroller: { flexGrow: 0, flexShrink: 1 },
  inhalt: { gap: spacing.sm, paddingBottom: spacing.lg },
});
