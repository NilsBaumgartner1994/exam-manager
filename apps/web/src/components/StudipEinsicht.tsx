import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

/** Wofür die PDFs gedacht sind – davon hängt nur der Name des Reiters ab. */
export type EinsichtArt = 'zulassung' | 'sitzplatz';

const REITER: Record<EinsichtArt, string> = {
  zulassung: 'Klausur Zulassung',
  sitzplatz: 'Klausur Sitzplatz',
};

const WAS: Record<EinsichtArt, string> = {
  zulassung: 'ihre eigene Zulassung',
  sitzplatz: 'ihren eigenen Sitzplatz',
};

/**
 * Wie die erzeugten PDFs zu den Studierenden kommen: über das Stud.IP-Werkzeug
 * „Klausureinsicht“.
 *
 * Die Schritte stehen hier und nicht nur in der README, weil sie genau dort
 * gebraucht werden, wo die ZIP entsteht – und weil einer davon leicht
 * übersehen wird: **Der Dateiordner muss unsichtbar sein.** Ein sichtbarer
 * Ordner zeigt jeder Person alle Schreiben, also die Matrikelnummern des
 * ganzen Kurses. Die Zuordnung macht Stud.IP selbst: Es gibt jeder Person nur
 * die Datei frei, deren Name ihrer Matrikelnummer entspricht – deshalb heißt
 * jedes PDF `<Matrikelnummer>.pdf`.
 */
export function StudipEinsicht({ art, testID }: { art: EinsichtArt; testID?: string }) {
  const schritte = [
    'Im Kurs einen Dateiordner anlegen, ihn auf unsichtbar stellen und den Zugriff auf „Zugriff auf Dateien per Link“ setzen – sichtbar zeigte er jeder Person die Schreiben aller anderen.',
    'Die PDFs aus der ZIP in diesen Ordner hochladen – je Person eine Datei, benannt nach ihrer Matrikelnummer (1000001.pdf).',
    `In der Verwaltung des Kurses das Werkzeug „Klausureinsicht“ aktivieren und seinen Reiter umbenennen: „${REITER[art]}“.`,
    'Im Werkzeug den Ordner auswählen, in dem die PDFs liegen.',
    `Fertig: Stud.IP zeigt jeder Person nur die Datei, deren Dateiname ihrer Matrikelnummer entspricht – sie sieht also ${WAS[art]} und sonst nichts. Zum Schluss eine Rundmail, dass es dort einzusehen ist.`,
  ];
  return (
    <View style={styles.block} testID={testID}>
      {schritte.map((schritt, i) => (
        <Text key={i} style={styles.schritt}>
          <Text style={styles.nummer}>{`${i + 1}. `}</Text>
          {schritt}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
  schritt: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  nummer: { fontWeight: '700', color: colors.text },
});
