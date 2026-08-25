import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ROLLEN_TITEL } from '@exam-manager/core';
import {
  AppButton,
  DataTable,
  FilePickerButton,
  ScreenContainer,
  Section,
  StatusText,
  Tile,
} from '../components';
import { downloadZip } from '../files';
import { SCREENS } from '../navigation';
import { useProjekt, vorlageAlsZip } from '../projekt';
import { useResponsiveLayout } from '../responsive';
import { useNavigation } from '../Router';
import { colors, spacing } from '../theme';

export function HomeScreen() {
  const { navigate } = useNavigation();
  const layout = useResponsiveLayout();
  const projekt = useProjekt();
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  const ordnerLaden = async (files: File[]) => {
    setStatus(null);
    try {
      await projekt.ladeOrdner(files);
    } catch (fehler) {
      setStatus({ kind: 'error', text: `Ordner konnte nicht gelesen werden: ${String(fehler)}` });
    }
  };

  const standHerunterladen = async () => {
    setStatus(null);
    try {
      downloadZip(`${projekt.ordner ?? 'klausur-projekt'}.zip`, await projekt.alsZip());
    } catch (fehler) {
      setStatus({ kind: 'error', text: `ZIP konnte nicht erzeugt werden: ${String(fehler)}` });
    }
  };

  const vorlageHerunterladen = async () => {
    setStatus(null);
    try {
      downloadZip('klausur-projekt-vorlage.zip', await vorlageAlsZip());
    } catch (fehler) {
      setStatus({ kind: 'error', text: `ZIP konnte nicht erzeugt werden: ${String(fehler)}` });
    }
  };

  const erkannt = projekt.dateien.filter((datei) => datei.rolle !== 'unbekannt');

  return (
    <ScreenContainer
      title="Exam Manager"
      intro="Klausuren lokal im Browser verwalten – alle Dateien werden nur auf diesem Rechner verarbeitet, nichts wird hochgeladen."
      testID="home-screen"
    >
      <View style={[styles.tiles, { gap: layout.gap }]}>
        {SCREENS.map((screen) => (
          <Tile
            key={screen.route}
            title={screen.titel}
            subtitle={screen.beschreibung}
            onPress={() => navigate(screen.route)}
            testID={`tile-${screen.route}`}
          />
        ))}
      </View>

      <Section title="Projektordner (optional)" testID="home-projekt">
        <Text style={styles.hinweis}>
          Liegen alle Dateien der Klausur in einem Ordner? Dann hier einmal auswählen – die vier
          Schritte holen sich ihre Dateien dann von selbst, und Ergebnisse landen wieder im
          Projektstand. Ohne Ordner funktioniert weiterhin jeder Schritt einzeln.
        </Text>
        <FilePickerButton
          label="Projektordner auswählen"
          directory
          onFiles={ordnerLaden}
          testID="home-ordner"
        />

        {projekt.ordner !== null || projekt.dateien.length > 0 ? (
          <StatusText kind="success" testID="home-projekt-status">
            {`Ordner „${projekt.ordner ?? '—'}“: ${projekt.dateien.length} Dateien gelesen, ${erkannt.length} davon zugeordnet.` +
              (projekt.uebersprungen > 0
                ? ` ${projekt.uebersprungen} Dateien übersprungen (kein CSV/Excel).`
                : '')}
          </StatusText>
        ) : null}

        {projekt.dateien.length > 0 ? (
          <DataTable
            columns={[
              { key: 'pfad', title: 'Datei' },
              { key: 'rolle', title: 'Erkannt als' },
            ]}
            rows={projekt.dateien.map((datei) => ({
              pfad: datei.pfad,
              rolle: ROLLEN_TITEL[datei.rolle],
            }))}
            testID="home-projekt-dateien"
          />
        ) : null}

        <View style={styles.buttonZeile}>
          <AppButton
            title="Aktuellen Stand als ZIP herunterladen"
            onPress={standHerunterladen}
            disabled={projekt.dateien.length === 0}
            testID="home-stand-zip"
          />
          <AppButton
            title="Projektvorlage als ZIP"
            variant="secondary"
            onPress={vorlageHerunterladen}
            testID="home-vorlage-zip"
          />
          {projekt.dateien.length > 0 ? (
            <AppButton
              title="Projekt schließen"
              variant="secondary"
              onPress={projekt.leeren}
              testID="home-projekt-leeren"
            />
          ) : null}
        </View>

        {status ? <StatusText kind={status.kind}>{status.text}</StatusText> : null}

        <Text style={styles.hinweis}>
          Der Projektstand lebt nur, solange diese Seite offen ist: Ein Neuladen leert ihn, und der
          Ordner muss neu ausgewählt werden. Gespeichert wird bewusst nichts – Personendaten haben
          im Browserspeicher nichts verloren.
        </Text>
        <Text style={styles.hinweis}>
          Der Browser darf nicht in den Ordner zurückschreiben – deshalb der Umweg über die ZIP:
          herunterladen, entpacken und den eigenen Ordner damit ersetzen. Enthalten sind alle
          gelesenen CSV- und Excel-Dateien samt der in der App erzeugten Ergebnisse; erzeugte PDFs
          bleiben außen vor. Die Vorlage-ZIP enthält einen leeren Ordner mit der erwarteten
          Struktur (siehe LIESMICH.md darin).
        </Text>
      </Section>

      <Text style={styles.footer}>
        Die Schritte folgen dem Prüfungs-Workflow (siehe WORKFLOW.md im Repository).
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Kachelraster: Anzahl der Spalten ergibt sich aus der Fensterbreite
  // (siehe responsive.ts -> tileBasis), nicht aus einer festen Kachelbreite.
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  buttonZeile: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  footer: { fontSize: 13, color: colors.textMuted, marginTop: spacing.lg },
});
