import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { downloadZip } from '../files';
import { useProjekt } from '../projekt';
import { colors, spacing } from '../theme';
import { AppButton } from './AppButton';
import type { MenuEintrag } from './Menueband';
import { StatusText } from './StatusText';

interface Props {
  /** Zusätzlicher Satz, was dieser Screen dem Projekt hinzugefügt hat. */
  hinweis?: string;
  testID?: string;
}

/**
 * „Aktuelles Projekt herunterladen“ – steht auf jedem Screen.
 *
 * Der Browser darf nicht in den gewählten Ordner zurückschreiben; die ZIP ist
 * der einzige Weg zurück auf die Platte. Sie enthält den kompletten
 * Projektstand: die eingelesenen Dateien und alles, was die Schritte seitdem
 * hineingeschrieben haben.
 */
export function ProjektDownload({ hinweis, testID }: Props) {
  const projekt = useProjekt();
  const [fehler, setFehler] = useState<string | null>(null);

  const herunterladen = async () => {
    setFehler(null);
    try {
      downloadZip(`${projekt.ordner ?? 'klausur-projekt'}.zip`, await projekt.alsZip());
    } catch (e) {
      setFehler(`ZIP konnte nicht erzeugt werden: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const leer = projekt.dateien.length === 0;

  return (
    <View style={styles.box}>
      <AppButton
        title="Aktuelles Projekt herunterladen"
        variant="secondary"
        onPress={herunterladen}
        disabled={leer}
        testID={testID ?? 'projekt-download'}
      />
      <Text style={styles.hinweis}>
        {leer
          ? 'Noch kein Projektordner geladen – oben auswählen, dann sammelt jeder Schritt seine Ergebnisse darin.'
          : (hinweis ? `${hinweis} ` : '') +
            'Die ZIP enthält den kompletten Projektordner. Entpacken und den eigenen Ordner damit ersetzen – der Browser darf nicht direkt hineinschreiben.'}
      </Text>
      {fehler ? <StatusText kind="error">{fehler}</StatusText> : null}
    </View>
  );
}

/**
 * Derselbe Download als Menüeintrag: In den Arbeitsflächen (Schritt 4 und 5)
 * steht er im Menü „Datei“ und nicht als Knopf – der Erklärabsatz daneben
 * hätte dort keinen Platz, und er steht ohnehin auf der Startseite.
 *
 * Was schiefgeht, meldet der Screen in seiner Fußleiste (`melde`): Ein Menü
 * ist beim Lesen der Meldung längst wieder zu.
 */
export function useProjektDownloadEintrag(
  melde: (fehler: string) => void,
  testID?: string,
): MenuEintrag {
  const projekt = useProjekt();
  return {
    art: 'aktion',
    titel: 'Projekt herunterladen',
    hinweis: 'der ganze Projektordner als ZIP',
    deaktiviert: projekt.dateien.length === 0,
    testID: testID ?? 'projekt-download',
    onWaehlen: async () => {
      try {
        downloadZip(`${projekt.ordner ?? 'klausur-projekt'}.zip`, await projekt.alsZip());
      } catch (e) {
        melde(`ZIP konnte nicht erzeugt werden: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  };
}

const styles = StyleSheet.create({
  box: { gap: spacing.xs, marginTop: spacing.md },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
