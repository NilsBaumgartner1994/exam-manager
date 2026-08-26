import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  defaultZulassungsDateiname,
  neueZulassungen,
  parseNotenliste,
  parseStudipExport,
  Zulassung,
  zulassungenToCsv,
} from '@exam-manager/core';
import {
  AppButton,
  DataTable,
  FilePickerButton,
  LabeledNumberInput,
  LabeledTextInput,
  ProjektDownload,
  ScreenContainer,
  Section,
  StatusText,
} from '../components';
import { downloadCsv, readFileAsText } from '../files';
import { useProjekt } from '../projekt';
import { useNavigation } from '../Router';
import { BEISPIEL_NOTENLISTE, BEISPIEL_TEILNEHMENDENEXPORT } from '../sampleData';
import { colors, spacing } from '../theme';

/**
 * Schritt 1 des Prüfungs-Workflows: VIPS-Notenliste des aktuellen Semesters
 * auswerten und ermitteln, wer die Klausurzulassung neu erworben hat.
 */
export function VipsScreen() {
  // Eingabedaten (CSV-Inhalte als Text).
  const [notenlisteCsv, setNotenlisteCsv] = useState<string | null>(null);
  const [teilnehmerCsv, setTeilnehmerCsv] = useState<string | null>(null);
  const [beispielGeladen, setBeispielGeladen] = useState(false);
  const [ausProjekt, setAusProjekt] = useState<string | null>(null);

  // Liegt ein Projektordner vor, kommen die Eingaben von dort – solange noch
  // nichts eigenes geladen wurde.
  const projekt = useProjekt();
  useEffect(() => {
    if (notenlisteCsv !== null || teilnehmerCsv !== null) return;
    const noten = projekt.datei('notenliste');
    const studip = projekt.datei('studipExport');
    if (!noten?.text && !studip?.text) return;
    if (noten?.text) setNotenlisteCsv(noten.text);
    if (studip?.text) setTeilnehmerCsv(studip.text);
    setAusProjekt(
      `Aus dem Projektordner: ${[noten?.pfad, studip?.pfad].filter(Boolean).join(', ')}`,
    );
  }, [projekt, notenlisteCsv, teilnehmerCsv]);

  // Kriterien.
  const [minPunkte, setMinPunkte] = useState<number | null>(30);
  const [minBlaetter, setMinBlaetter] = useState<number | null>(3);
  const [veranstaltung, setVeranstaltung] = useState('Beispielveranstaltung');

  // Ergebnis & Download.
  const [ergebnis, setErgebnis] = useState<Zulassung[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [dateiname, setDateiname] = useState('');
  const [abgelegt, setAbgelegt] = useState<string | null>(null);
  const { navigate } = useNavigation();

  const beispielLaden = () => {
    setNotenlisteCsv(BEISPIEL_NOTENLISTE);
    setTeilnehmerCsv(BEISPIEL_TEILNEHMENDENEXPORT);
    setBeispielGeladen(true);
  };

  const auswerten = () => {
    setErgebnis(null);
    setFehler(null);
    if (notenlisteCsv === null || teilnehmerCsv === null) return;
    if (minPunkte === null || minBlaetter === null) {
      setFehler('Bitte beide Kriterien als Zahl angeben.');
      return;
    }
    try {
      const notenliste = parseNotenliste(notenlisteCsv);
      const teilnehmer = parseStudipExport(teilnehmerCsv);
      const zulassungen = neueZulassungen(notenliste, teilnehmer, {
        minPunkteProBlatt: minPunkte,
        minBlaetterBestehen: minBlaetter,
      });
      setErgebnis(zulassungen);
      setDateiname(defaultZulassungsDateiname(veranstaltung, new Date().getFullYear()));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScreenContainer
      title="1. VIPS-Punkte auswerten"
      intro="Wertet die VIPS-Notenliste des aktuellen Semesters aus und zeigt, wer die Klausurzulassung neu erworben hat – alle Dateien werden nur lokal im Browser verarbeitet, nichts wird hochgeladen."
      testID="Vips-screen"
    >
      <Section title="Eingabedaten">
        <View style={styles.spalte}>
          <FilePickerButton
            label="Notenliste.csv auswählen"
            accept=".csv"
            onFiles={async (files) => setNotenlisteCsv(await readFileAsText(files[0]))}
            testID="vips-notenliste"
          />
          <FilePickerButton
            label="Teilnehmendenexport.csv auswählen"
            accept=".csv"
            onFiles={async (files) => setTeilnehmerCsv(await readFileAsText(files[0]))}
            testID="vips-teilnehmer"
          />
          <AppButton
            title="Beispieldaten laden"
            variant="secondary"
            onPress={beispielLaden}
            testID="vips-beispiel"
          />
          {beispielGeladen ? <StatusText kind="info">Beispieldaten geladen.</StatusText> : null}
          {ausProjekt ? <StatusText kind="info" testID="vips-projekt">{ausProjekt}</StatusText> : null}
          <Text style={styles.hinweis}>
            Aus dem Projektordner kommen die Notenliste aus{' '}
            <Text style={styles.pfad}>0_Input_Vips_Notenliste/</Text> und der Stud.IP-Export aus{' '}
            <Text style={styles.pfad}>0_Input_Kurs_Teilnehmer_Studip_Liste/</Text>. Nur Dateien in
            diesen Ordnern werden gelesen.
          </Text>
        </View>
      </Section>

      <Section title="Kriterien">
        <View style={styles.spalte}>
          <LabeledNumberInput
            label="Min. Punkte pro Aufgabenblatt"
            value={minPunkte}
            onChange={setMinPunkte}
            testID="vips-min-punkte"
          />
          <LabeledNumberInput
            label="Anzahl zu bestehender Aufgabenblätter"
            value={minBlaetter}
            onChange={setMinBlaetter}
            testID="vips-min-blaetter"
          />
          <LabeledTextInput
            label="Name der Veranstaltung"
            value={veranstaltung}
            onChangeText={setVeranstaltung}
            testID="vips-veranstaltung"
          />
        </View>
      </Section>

      <AppButton
        title="Auswerten"
        onPress={auswerten}
        disabled={notenlisteCsv === null || teilnehmerCsv === null}
        testID="vips-auswerten"
      />

      {fehler !== null ? <StatusText kind="error">{fehler}</StatusText> : null}

      {ergebnis !== null ? (
        <Section title="Ergebnis">
          <View style={styles.spalte}>
            <StatusText kind="success" testID="vips-ergebnis">
              {`${ergebnis.length} Studierende haben die Zulassung neu erworben.`}
            </StatusText>
            <DataTable
              columns={[
                { key: 'nachname', title: 'Nachname' },
                { key: 'vorname', title: 'Vorname' },
                { key: 'matrikelnummer', title: 'Matrikelnummer' },
                { key: 'email', title: 'E-Mail' },
              ]}
              rows={ergebnis.map((z) => ({
                nachname: z.nachname,
                vorname: z.vorname,
                matrikelnummer: z.matrikelnummer,
                email: z.email,
              }))}
              emptyText="Niemand erfüllt die Kriterien."
              testID="vips-tabelle"
            />
          </View>
        </Section>
      ) : null}

      {ergebnis !== null ? (
        <Section title="Ergebnis sichern">
          <View style={styles.spalte}>
            <LabeledTextInput
              label="Dateiname"
              value={dateiname}
              onChangeText={setDateiname}
              testID="vips-dateiname"
            />
            <AppButton
              title="CSV herunterladen"
              onPress={() => downloadCsv(dateiname, zulassungenToCsv(ergebnis))}
              testID="vips-download"
            />
            <AppButton
              title="Zugelassene Studierende in den Zulassungen-Ordner ablegen"
              onPress={() => {
                const csv = zulassungenToCsv(ergebnis);
                // In den Projektstand (Zulassungen/) und zusätzlich als
                // Download: Der Browser darf nicht auf die Platte schreiben,
                // der Ordner wird über die Projekt-ZIP ersetzt.
                projekt.schreibe(dateiname, csv, 'zulassungsbestand');
                downloadCsv(dateiname, csv);
                setAbgelegt(`Zulassungen/${dateiname}`);
              }}
              testID="vips-ablegen"
            />
            {abgelegt !== null ? (
              <StatusText kind="success" testID="vips-abgelegt">
                {`Im Projekt abgelegt als ${abgelegt} – und als Datei heruntergeladen. Zum Speichern auf der Platte unten das aktualisierte Projekt herunterladen.`}
              </StatusText>
            ) : null}
            <Text style={styles.hinweis}>
              Diese Datei ist die neue Jahresliste im Ordner{' '}
              <Text style={styles.pfad}>Zulassungen/</Text> – die folgenden Schritte lesen sie von
              dort.
            </Text>
          </View>
        </Section>
      ) : null}

      <Section title="Weiter">
        <View style={styles.spalte}>
          <AppButton
            title="Weiter zu 2. Zulassungs-PDFs generieren"
            onPress={() => navigate('ZulassungsPdfs')}
            testID="vips-weiter"
          />
          <ProjektDownload
            hinweis="Enthält die hier abgelegte Zulassungsliste."
            testID="vips-projekt-download"
          />
        </View>
      </Section>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  spalte: { gap: spacing.md },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  pfad: { fontWeight: '600', color: colors.text },
});
