import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import readXlsxFile from 'read-excel-file';
import {
  Anmeldung,
  anmeldungenToCsv,
  istZulassungsDatei,
  ladeZulassungsBestand,
  parseHisRows,
  pruefeZulassungen,
} from '@exam-manager/core';
import {
  AppButton,
  DataTable,
  FilePickerButton,
  LabeledTextInput,
  ProjektDownload,
  ScreenContainer,
  Section,
  StatusText,
} from '../components';
import { downloadCsv, readFileAsArrayBuffer, readFileAsText } from '../files';
import { useProjekt } from '../projekt';
import {
  BEISPIEL_HIS_EXPORT_XLSX_BASE64,
  BEISPIEL_ZULASSUNGS_BESTAND,
  base64ToArrayBuffer,
} from '../sampleData';
import { colors, spacing } from '../theme';

const SPALTEN = [
  { key: 'nachname', title: 'Nachname' },
  { key: 'vorname', title: 'Vorname' },
  { key: 'matrikelnummer', title: 'Matrikelnummer' },
];

interface Ergebnis {
  zugelassen: Anmeldung[];
  nichtZugelassen: Anmeldung[];
}

/**
 * Schritt 3 des Prüfungs-Workflows: Der Excel-Export des Prüfungsamts
 * (check.xlsx, HIS-Format) wird gegen den Zulassungsbestand (Ordner mit den
 * Zulassungs-CSVs aller Jahre) geprüft – wer ist zugelassen, wer nicht?
 */
export function KlausurTeilnehmerScreen() {
  // Eingabedaten.
  const [anmeldungen, setAnmeldungen] = useState<Anmeldung[] | null>(null);
  const [bestandCsvs, setBestandCsvs] = useState<string[] | null>(null);
  const [anzahlListen, setAnzahlListen] = useState<number | null>(null);
  const [beispielGeladen, setBeispielGeladen] = useState(false);
  const [eingabeFehler, setEingabeFehler] = useState<string | null>(null);

  // Ergebnis & Download.
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [pruefFehler, setPruefFehler] = useState<string | null>(null);
  const [dateinameZugelassen, setDateinameZugelassen] = useState('allowedStudents.csv');
  const [dateinameNichtZugelassen, setDateinameNichtZugelassen] =
    useState('notAllowedStudents.csv');
  const [ausProjekt, setAusProjekt] = useState<string | null>(null);

  // Eingaben aus dem Projektordner, solange nichts eigenes geladen wurde.
  const projekt = useProjekt();
  useEffect(() => {
    if (anmeldungen !== null || bestandCsvs !== null) return;
    const his = projekt.datei('hisExport');
    const listen = projekt.dateienMit('zulassungsbestand').filter((datei) => !!datei.text);
    if (!his?.bytes && listen.length === 0) return;
    const uebernehmen = async () => {
      if (his?.bytes) {
        // Kopie, damit der Excel-Reader einen eigenständigen Puffer bekommt.
        const rows = await readXlsxFile(his.bytes.slice().buffer);
        setAnmeldungen(parseHisRows(rows));
      }
      if (listen.length > 0) {
        setBestandCsvs(listen.map((datei) => datei.text ?? ''));
        setAnzahlListen(listen.length);
      }
      setAusProjekt(
        `Aus dem Projektordner: ${[his?.pfad, listen.length > 0 ? `${listen.length} Zulassungslisten` : null]
          .filter(Boolean)
          .join(', ')}`,
      );
    };
    uebernehmen().catch((e) => setEingabeFehler(e instanceof Error ? e.message : String(e)));
  }, [projekt, anmeldungen, bestandCsvs]);

  const hisExportLaden = async (files: File[]) => {
    setEingabeFehler(null);
    setBeispielGeladen(false);
    setErgebnis(null);
    try {
      const buffer = await readFileAsArrayBuffer(files[0]);
      const rows = await readXlsxFile(buffer);
      setAnmeldungen(parseHisRows(rows));
    } catch (e) {
      setAnmeldungen(null);
      setEingabeFehler(e instanceof Error ? e.message : String(e));
    }
  };

  const ordnerLaden = async (files: File[]) => {
    setEingabeFehler(null);
    setBeispielGeladen(false);
    setErgebnis(null);
    try {
      const listen = files.filter((file) => istZulassungsDatei(file.name));
      const texte = await Promise.all(listen.map((file) => readFileAsText(file)));
      setBestandCsvs(texte);
      setAnzahlListen(listen.length);
    } catch (e) {
      setBestandCsvs(null);
      setAnzahlListen(null);
      setEingabeFehler(e instanceof Error ? e.message : String(e));
    }
  };

  const beispielLaden = async () => {
    setEingabeFehler(null);
    setErgebnis(null);
    try {
      const buffer = base64ToArrayBuffer(BEISPIEL_HIS_EXPORT_XLSX_BASE64);
      const rows = await readXlsxFile(buffer);
      setAnmeldungen(parseHisRows(rows));
      setBestandCsvs(Object.values(BEISPIEL_ZULASSUNGS_BESTAND));
      setAnzahlListen(null);
      setBeispielGeladen(true);
    } catch (e) {
      setEingabeFehler(e instanceof Error ? e.message : String(e));
    }
  };

  const pruefen = () => {
    setErgebnis(null);
    setPruefFehler(null);
    if (anmeldungen === null || bestandCsvs === null) return;
    try {
      const bestand = ladeZulassungsBestand(bestandCsvs);
      const { zugelassen, nichtZugelassen } = pruefeZulassungen(anmeldungen, bestand);
      setErgebnis({ zugelassen, nichtZugelassen });
    } catch (e) {
      setPruefFehler(e instanceof Error ? e.message : String(e));
    }
  };

  const nichtZugelassenListe =
    ergebnis === null
      ? ''
      : ergebnis.nichtZugelassen
          .map((a) => `${a.nachname}, ${a.vorname} (${a.matrikelnummer})`)
          .join('; ');

  return (
    <ScreenContainer
      title="3. Klausur-Anmeldungen prüfen"
      intro="Prüft den Excel-Export des Prüfungsamts (check.xlsx) gegen den Zulassungsbestand aller Jahre: Wer ist zugelassen, wer nicht? Alle Dateien werden nur lokal im Browser verarbeitet, nichts wird hochgeladen."
      testID="KlausurTeilnehmer-screen"
    >
      <Section title="Eingabedaten">
        <View style={styles.spalte}>
          <FilePickerButton
            label="HIS-Export (check.xlsx) auswählen"
            accept=".xlsx"
            onFiles={hisExportLaden}
            testID="klausur-xlsx"
          />
          <FilePickerButton
            label="Zulassungsordner auswählen"
            directory
            onFiles={ordnerLaden}
            testID="klausur-ordner"
          />
          <AppButton
            title="Beispieldaten laden"
            variant="secondary"
            onPress={beispielLaden}
            testID="klausur-beispiel"
          />
          {beispielGeladen ? <StatusText kind="info">Beispieldaten geladen.</StatusText> : null}
          {ausProjekt ? (
            <StatusText kind="info" testID="klausur-projekt">{ausProjekt}</StatusText>
          ) : null}
          <Text style={styles.hinweis}>
            Aus dem Projektordner kommen die Anmeldungen aus 0_Input_Klausuranmeldungen/ (Excel)
            und die Zulassungslisten aus Zulassungen/.
          </Text>
          {anmeldungen !== null && !beispielGeladen ? (
            <StatusText kind="info">{`${anmeldungen.length} Anmeldungen eingelesen.`}</StatusText>
          ) : null}
          {anzahlListen !== null ? (
            <StatusText kind="info">{`${anzahlListen} Zulassungslisten im Ordner erkannt.`}</StatusText>
          ) : null}
          {eingabeFehler !== null ? <StatusText kind="error">{eingabeFehler}</StatusText> : null}
        </View>
      </Section>

      <AppButton
        title="Zulassungen prüfen"
        onPress={pruefen}
        disabled={anmeldungen === null || bestandCsvs === null}
        testID="klausur-pruefen"
      />

      {pruefFehler !== null ? <StatusText kind="error">{pruefFehler}</StatusText> : null}

      {ergebnis !== null ? (
        <Section title="Ergebnis">
          <View style={styles.spalte}>
            <StatusText kind="success" testID="klausur-ergebnis">
              {`${ergebnis.zugelassen.length} von ${ergebnis.zugelassen.length + ergebnis.nichtZugelassen.length} Angemeldeten sind zugelassen.`}
            </StatusText>
            <DataTable
              columns={SPALTEN}
              rows={ergebnis.zugelassen.map((a) => ({
                nachname: a.nachname,
                vorname: a.vorname,
                matrikelnummer: a.matrikelnummer,
              }))}
              emptyText="Keine der Anmeldungen ist zugelassen."
              testID="klausur-tabelle-zugelassen"
            />
            {ergebnis.nichtZugelassen.length > 0 ? (
              <>
                <StatusText kind="error" testID="klausur-nicht-zugelassen">
                  {`Nicht zugelassen: ${nichtZugelassenListe}`}
                </StatusText>
                <DataTable
                  columns={SPALTEN}
                  rows={ergebnis.nichtZugelassen.map((a) => ({
                    nachname: a.nachname,
                    vorname: a.vorname,
                    matrikelnummer: a.matrikelnummer,
                  }))}
                  testID="klausur-tabelle-nicht-zugelassen"
                />
              </>
            ) : (
              <StatusText kind="success">Alle Angemeldeten sind zugelassen.</StatusText>
            )}
          </View>
        </Section>
      ) : null}

      {ergebnis !== null ? (
        <Section title="Download">
          <View style={styles.spalte}>
            <LabeledTextInput
              label="Dateiname Zugelassene"
              value={dateinameZugelassen}
              onChangeText={setDateinameZugelassen}
              testID="klausur-dateiname"
            />
            <AppButton
              title="Zugelassene herunterladen"
              onPress={() => {
                const csv = anmeldungenToCsv(ergebnis.zugelassen);
                downloadCsv(dateinameZugelassen, csv);
                projekt.schreibe(dateinameZugelassen, csv, 'teilnehmer');
              }}
              testID="klausur-download"
            />
            <LabeledTextInput
              label="Dateiname Nicht-Zugelassene"
              value={dateinameNichtZugelassen}
              onChangeText={setDateinameNichtZugelassen}
              testID="klausur-dateiname-nicht-zugelassen"
            />
            <AppButton
              title="Nicht-Zugelassene herunterladen"
              onPress={() => {
                const csv = anmeldungenToCsv(ergebnis.nichtZugelassen);
                downloadCsv(dateinameNichtZugelassen, csv);
                projekt.schreibe(dateinameNichtZugelassen, csv, 'teilnehmer');
              }}
              testID="klausur-download-nicht-zugelassen"
            />
            <Text style={styles.hinweis}>
              Hinweis: Die Datei mit den Zugelassenen ist die Eingabe für Schritt 4 (Raumzuteilung)
              und den Klausurdruck. Im Projekt liegt sie in 3_Klausur_Teilnehmende_Export/.
            </Text>
          </View>
        </Section>
      ) : null}

      <Section title="Projekt">
        <ProjektDownload
          hinweis="Enthält die Liste der Zugelassenen in 3_Klausur_Teilnehmende_Export/."
          testID="klausur-projekt-download"
        />
      </Section>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  spalte: { gap: spacing.md },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
