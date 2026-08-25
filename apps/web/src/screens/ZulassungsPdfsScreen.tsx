import { useState } from 'react';
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
  ScreenContainer,
  Section,
  StatusText,
} from '../components';
import { downloadZip, readFileAsText } from '../files';
import { BEISPIEL_TEILNEHMENDENEXPORT, BEISPIEL_ZULASSUNGS_BESTAND } from '../sampleData';
import { colors, spacing } from '../theme';

/** Ergebnis der PDF-Erzeugung: Personen mit Zulassung plus fertiges ZIP. */
interface Ergebnis {
  zulassungen: Zulassung[];
  zip: Uint8Array;
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
      setErgebnis({ zulassungen, zip });
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
        {status ? <StatusText kind={status.kind}>{status.text}</StatusText> : null}
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
