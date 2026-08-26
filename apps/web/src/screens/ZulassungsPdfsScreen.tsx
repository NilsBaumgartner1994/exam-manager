import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  erstelleZip,
  istZulassungsDatei,
  ladeZulassungsBestand,
  parseStudipExport,
  teilnehmerMitZulassung,
  Zulassung,
  zulassungsPdf,
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
import { downloadZip, readFileAsText } from '../files';
import { useProjekt } from '../projekt';
import { BEISPIEL_TEILNEHMENDENEXPORT, BEISPIEL_ZULASSUNGS_BESTAND } from '../sampleData';
import { colors, spacing } from '../theme';

/** Ergebnis der PDF-Erzeugung: Personen mit Zulassung plus fertiges ZIP. */
interface Ergebnis {
  zulassungen: Zulassung[];
  zip: Uint8Array;
  /** Wie viele PDFs vorher im Projektordner lagen und ersetzt wurden. */
  ersetzt: number;
}

/**
 * Schritt 2 des Prüfungs-Workflows: Für alle Veranstaltungsteilnehmenden mit
 * Zulassung (neu oder aus Vorjahren) wird je ein PDF `<Matrikelnummer>.pdf`
 * erzeugt und gesammelt als ZIP heruntergeladen – alles lokal im Browser.
 */
export function ZulassungsPdfsScreen() {
  /** Inhalte aller erkannten Zulassungslisten (CSV-Texte). */
  const [zulassungsListen, setZulassungsListen] = useState<string[]>([]);
  /** Inhalt des Stud.IP-Teilnehmendenexports. */
  const [teilnehmerCsv, setTeilnehmerCsv] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [dateiname, setDateiname] = useState('zulassungs_pdfs.zip');
  const [ausProjekt, setAusProjekt] = useState<string | null>(null);

  // Eingaben aus dem Projektordner, solange nichts eigenes geladen wurde.
  const projekt = useProjekt();
  useEffect(() => {
    if (zulassungsListen.length > 0 || teilnehmerCsv !== null) return;
    const listen = projekt.dateienMit('zulassungsbestand').filter((datei) => !!datei.text);
    const studip = projekt.datei('studipExport');
    if (listen.length === 0 && !studip?.text) return;
    if (listen.length > 0) setZulassungsListen(listen.map((datei) => datei.text ?? ''));
    if (studip?.text) setTeilnehmerCsv(studip.text);
    setAusProjekt(
      `Aus dem Projektordner: ${listen.length} Zulassungslisten` +
        (studip ? `, ${studip.pfad}` : ''),
    );
  }, [projekt, zulassungsListen, teilnehmerCsv]);

  const ladeZulassungsOrdner = async (files: File[]) => {
    try {
      const listen = files.filter((file) => istZulassungsDatei(file.name));
      const inhalte = await Promise.all(listen.map((file) => readFileAsText(file)));
      setZulassungsListen(inhalte);
      setStatus({ kind: 'info', text: `${inhalte.length} Zulassungslisten erkannt.` });
    } catch (fehler) {
      setStatus({ kind: 'error', text: fehler instanceof Error ? fehler.message : String(fehler) });
    }
  };

  const ladeTeilnehmerExport = async (files: File[]) => {
    try {
      setTeilnehmerCsv(await readFileAsText(files[0]));
    } catch (fehler) {
      setStatus({ kind: 'error', text: fehler instanceof Error ? fehler.message : String(fehler) });
    }
  };

  const ladeBeispieldaten = () => {
    setZulassungsListen(Object.values(BEISPIEL_ZULASSUNGS_BESTAND));
    setTeilnehmerCsv(BEISPIEL_TEILNEHMENDENEXPORT);
    setStatus({ kind: 'info', text: 'Beispieldaten geladen.' });
  };

  const erzeugePdfs = async () => {
    if (zulassungsListen.length === 0 || !teilnehmerCsv) return;
    setLaeuft(true);
    setErgebnis(null);
    setStatus({ kind: 'info', text: 'PDFs werden erzeugt …' });
    try {
      const teilnehmer = parseStudipExport(teilnehmerCsv);
      const bestand = ladeZulassungsBestand(zulassungsListen);
      const zulassungen = teilnehmerMitZulassung(teilnehmer, bestand);
      const dateien = new Map<string, Uint8Array | string>();
      for (const zulassung of zulassungen) {
        dateien.set(`${zulassung.matrikelnummer}.pdf`, await zulassungsPdf(zulassung));
      }
      const zip = await erstelleZip(dateien);
      // Der PDF-Ordner des Projekts wird komplett ersetzt: Ein PDF aus einem
      // früheren Lauf gehört zu einem Stand, den es nicht mehr gibt – wer die
      // Zulassung verloren hat, behielte sonst sein altes Schreiben.
      const ersetzt = projekt.dateienMit('zulassungsPdf').length;
      projekt.ersetze('zulassungsPdf', dateien);
      setErgebnis({ zulassungen, zip, ersetzt });
      setStatus(null);
    } catch (fehler) {
      setStatus({ kind: 'error', text: fehler instanceof Error ? fehler.message : String(fehler) });
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <ScreenContainer
      title="2. Zulassungs-PDFs generieren"
      intro="Für alle Teilnehmenden mit Zulassung wird je ein PDF erzeugt und als ZIP gebündelt. Alles läuft lokal im Browser – nichts wird hochgeladen."
      testID="ZulassungsPdfs-screen"
    >
      <Section title="Eingabedaten">
        <FilePickerButton
          label="Zulassungsordner auswählen"
          directory
          onFiles={ladeZulassungsOrdner}
          testID="zulassungspdfs-ordner"
        />
        <FilePickerButton
          label="Teilnehmendenexport.csv auswählen"
          accept=".csv"
          onFiles={ladeTeilnehmerExport}
          testID="zulassungspdfs-teilnehmer"
        />
        <AppButton
          title="Beispieldaten laden"
          variant="secondary"
          onPress={ladeBeispieldaten}
          testID="zulassungspdfs-beispiel"
        />
        {ausProjekt ? (
          <StatusText kind="info" testID="pdfs-projekt">{ausProjekt}</StatusText>
        ) : null}
        {status ? <StatusText kind={status.kind}>{status.text}</StatusText> : null}
        <Text style={styles.hinweis}>
          Aus dem Projektordner kommen die Zulassungslisten aus Zulassungen/ (inklusive der in
          Schritt 1 abgelegten) und der Stud.IP-Export aus
          0_Input_Kurs_Teilnehmer_Studip_Liste/. Ohne Projektordner lassen sich beide hier von Hand
          auswählen.
        </Text>
      </Section>

      <AppButton
        title="PDFs erzeugen"
        onPress={erzeugePdfs}
        disabled={laeuft || zulassungsListen.length === 0 || !teilnehmerCsv}
        testID="zulassungspdfs-erzeugen"
      />

      {ergebnis ? (
        <Section title="Ergebnis">
          <StatusText kind="success" testID="zulassungspdfs-ergebnis">
            {`${ergebnis.zulassungen.length} Zulassungs-PDFs erzeugt.`}
          </StatusText>
          <StatusText kind="info" testID="zulassungspdfs-projekt-ordner">
            {`Im Projekt liegen sie in 2_Zulassungs_PDFs_Export/` +
              (ergebnis.ersetzt > 0
                ? ` – ${ergebnis.ersetzt} PDFs aus einem früheren Lauf wurden dabei entfernt.`
                : '.')}
          </StatusText>
          <DataTable
            columns={[
              { key: 'nachname', title: 'Nachname' },
              { key: 'vorname', title: 'Vorname' },
              { key: 'matrikelnummer', title: 'Matrikelnummer' },
              { key: 'email', title: 'E-Mail' },
            ]}
            rows={ergebnis.zulassungen.map((zulassung) => ({
              nachname: zulassung.nachname,
              vorname: zulassung.vorname,
              matrikelnummer: zulassung.matrikelnummer,
              email: zulassung.email,
            }))}
            emptyText="Keine Teilnehmenden mit Zulassung gefunden."
            testID="zulassungspdfs-tabelle"
          />
        </Section>
      ) : null}

      {ergebnis ? (
        <Section title="Download">
          <LabeledTextInput
            label="Dateiname"
            value={dateiname}
            onChangeText={setDateiname}
            testID="zulassungspdfs-dateiname"
          />
          <AppButton
            title="ZIP herunterladen"
            onPress={() => downloadZip(dateiname, ergebnis.zip)}
            testID="zulassungspdfs-download"
          />
          <Text style={styles.hinweis}>
            Die PDFs sind für den unsichtbaren Stud.IP-Ordner der „Klausureinsicht“ gedacht –
            eine Datei je Matrikelnummer.
          </Text>
        </Section>
      ) : null}

      <Section title="Projekt">
        <ProjektDownload
          hinweis="Enthält die neu erzeugten Zulassungs-PDFs in 2_Zulassungs_PDFs_Export/."
          testID="pdfs-projekt-download"
        />
      </Section>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hinweis: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
