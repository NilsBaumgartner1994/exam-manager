import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DateiRolle, ROLLEN_TITEL } from '@exam-manager/core';
import {
  AppButton,
  DataTable,
  FilePickerButton,
  ProjektDownload,
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

/**
 * Markdown im Ordner ist erklärender Text (LIESMICH.md) – keine Datei, die
 * jemand am falschen Platz abgelegt hat. Beide werden mitgeführt, aber nur die
 * zweite Sorte ist einen Hinweis wert.
 */
const rolleTitel = (datei: { pfad: string; rolle: DateiRolle }) =>
  datei.rolle === 'unbekannt' && datei.pfad.toLowerCase().endsWith('.md')
    ? 'Hinweistext (bleibt erhalten)'
    : ROLLEN_TITEL[datei.rolle];

/**
 * Startseite: oben das Projekt, darunter die fünf Schritte.
 *
 * Das Projekt steht **zuerst**, weil alles Weitere daran hängt: Welcher Kurs
 * ist das, welcher Ordner liegt gerade in der App, und wie kommt der Stand
 * wieder auf die Platte. Wer stattdessen mit dem nächsten Schritt weitermacht,
 * scrollt an drei Zeilen vorbei – wer sich vertan hat, sieht es sofort.
 *
 * Der Kursname steht in keiner Datei: Stud.IP legt ihn nur in den Namen des
 * Teilnehmendenexports (`Teilnehmendenexport_Software_Engineering.csv`), und
 * genau von dort holt ihn `projekt.kurs`.
 */
export function HomeScreen() {
  const { navigate } = useNavigation();
  const layout = useResponsiveLayout();
  const projekt = useProjekt();
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  /** Die Dateiliste ist Diagnose, kein Alltag – deshalb zugeklappt. */
  const [dateienOffen, setDateienOffen] = useState(false);

  const ordnerLaden = async (files: File[]) => {
    setStatus(null);
    try {
      await projekt.ladeOrdner(files);
    } catch (fehler) {
      setStatus({ kind: 'error', text: `Ordner konnte nicht gelesen werden: ${String(fehler)}` });
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

  const geladen = projekt.ordner !== null || projekt.dateien.length > 0;
  const erkannt = projekt.dateien.filter((datei) => datei.rolle !== 'unbekannt');

  return (
    <ScreenContainer
      title="Exam Manager"
      intro="Klausuren lokal im Browser verwalten – alle Dateien werden nur auf diesem Rechner verarbeitet, nichts wird hochgeladen."
      testID="home-screen"
    >
      <Section title="Projekt" testID="home-projekt">
        <View style={styles.zeile}>
          <Text style={styles.feldName}>Kurs</Text>
          <Text style={styles.feldWert} testID="home-kurs">
            {projekt.kurs ?? '—'}
          </Text>
          {projekt.kurs === null ? (
            <Text style={styles.feldHinweis}>
              Der Name steht im Dateinamen des Stud.IP-Exports
              (0_Input_Kurs_Teilnehmer_Studip_Liste/Teilnehmendenexport_&lt;Kurs&gt;.csv).
            </Text>
          ) : null}
        </View>
        <View style={styles.zeile}>
          <Text style={styles.feldName}>Projekt</Text>
          <Text style={styles.feldWert} testID="home-projekt-stand">
            {geladen
              ? `${projekt.ordner ?? '—'} · ${projekt.dateien.length} Dateien, ${erkannt.length} zugeordnet`
              : 'kein Ordner geladen – jeder Schritt funktioniert auch einzeln'}
          </Text>
        </View>

        <View style={styles.buttonZeile}>
          <FilePickerButton
            label={geladen ? 'Anderes Projekt öffnen' : 'Projektordner öffnen'}
            directory
            onFiles={ordnerLaden}
            testID="home-ordner"
          />
          {geladen ? (
            <AppButton
              title="Projekt schließen"
              variant="secondary"
              onPress={projekt.leeren}
              testID="home-projekt-leeren"
            />
          ) : null}
          <AppButton
            title="Projektvorlage als ZIP"
            variant="secondary"
            onPress={vorlageHerunterladen}
            testID="home-vorlage-zip"
          />
        </View>

        <ProjektDownload testID="home-stand-zip" />

        {status ? <StatusText kind={status.kind}>{status.text}</StatusText> : null}
        {projekt.speicher.art === 'ohneBinaer' ? (
          <StatusText kind="info" testID="home-speicher-hinweis">
            {`Für ${projekt.speicher.ausgelassen} Datei(en) reicht der Browserspeicher nicht – PDFs und Excel-Dateien sind nach einem Neuladen weg. Vorher die ZIP herunterladen.`}
          </StatusText>
        ) : null}
        {projekt.speicher.art === 'nichts' ? (
          <StatusText kind="info" testID="home-speicher-hinweis">
            Dieser Browser speichert nichts (privates Fenster?) – nach einem Neuladen ist der Stand
            weg. Vorher die ZIP herunterladen.
          </StatusText>
        ) : null}

        {projekt.dateien.length > 0 ? (
          <>
            <AppButton
              title={dateienOffen ? 'Dateien verbergen' : `Dateien anzeigen (${projekt.dateien.length})`}
              variant="secondary"
              kompakt
              onPress={() => setDateienOffen((offen) => !offen)}
              testID="home-dateien-schalter"
            />
            {dateienOffen ? (
              <DataTable
                columns={[
                  { key: 'pfad', title: 'Datei' },
                  { key: 'rolle', title: 'Erkannt als' },
                ]}
                rows={projekt.dateien.map((datei) => ({
                  pfad: datei.pfad,
                  rolle: rolleTitel(datei),
                }))}
                testID="home-projekt-dateien"
              />
            ) : null}
          </>
        ) : null}

        <Text style={styles.hinweis}>
          Der Stand bleibt in diesem Browser – auch nach einem Neuladen, samt aller Änderungen.
          Ein neues Projekt ersetzt ihn vollständig. Das sind Personendaten: Sie liegen im Profil
          dieses Geräts, bis „Projekt schließen“ sie entfernt. Am fremden Rechner: unbedingt
          schließen.
        </Text>
      </Section>

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
  zeile: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'baseline' },
  feldName: { fontSize: 13, fontWeight: '700', color: colors.textMuted, minWidth: 64 },
  feldWert: { fontSize: 16, fontWeight: '600', color: colors.text, flexShrink: 1 },
  feldHinweis: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  buttonZeile: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  footer: { fontSize: 13, color: colors.textMuted, marginTop: spacing.lg },
});
