import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  erstelleZip,
  istZulassungsDatei,
  ladeZulassungsBestand,
  ladeZulassungsFunde,
  nichtDarstellbareZeichen,
  parseStudipExport,
  sucheImBestand,
  teilnehmerMitZulassung,
  winAnsiText,
  Zulassung,
  ZulassungsQuelle,
  zulassungsPdf,
} from '@exam-manager/core';
import {
  AppButton,
  DataTable,
  FilePickerButton,
  LabeledTextInput,
  ProjektDownload,
  ProjektQuelle,
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
  /** Namen, die im PDF ohne ihre Sonderzeichen stehen (siehe unten). */
  umgeschrieben: string[];
}

/**
 * Namen, die eine Standard-PDF-Schrift nicht buchstabengetreu setzen kann.
 *
 * Statt am ersten „ź“ abzubrechen, schreibt die PDF-Erzeugung solche Zeichen um
 * (`ź` → `z`). Wer betroffen ist, gehört auf den Bildschirm – im PDF steht dann
 * eben nicht ganz der Name aus der Liste.
 */
function umgeschriebeneNamen(zulassungen: Zulassung[]): string[] {
  return zulassungen
    .map((zulassung) => `${zulassung.vorname} ${zulassung.nachname}`)
    .filter((name) => nichtDarstellbareZeichen(name).length > 0)
    .map((name) => `${name} → ${winAnsiText(name)}`);
}

/**
 * Schritt 2 des Prüfungs-Workflows: Der Zulassungsbestand lässt sich nach
 * einzelnen Personen durchsuchen, und für alle Veranstaltungsteilnehmenden mit
 * Zulassung (neu oder aus Vorjahren) wird je ein PDF `<Matrikelnummer>.pdf`
 * erzeugt und gesammelt als ZIP heruntergeladen – alles lokal im Browser.
 */
export function ZulassungsPdfsScreen() {
  /**
   * Alle erkannten Zulassungslisten mit ihrem Dateinamen. Der Name ist nicht
   * nur Zierde: Die Suche unten beantwortet das „wann“ einer Zulassung über
   * die Datei, in der die Person steht (`pv2025_zulassungen.csv`).
   */
  const [quellen, setQuellen] = useState<ZulassungsQuelle[]>([]);
  /** Inhalt des Stud.IP-Teilnehmendenexports. */
  const [teilnehmerCsv, setTeilnehmerCsv] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [dateiname, setDateiname] = useState('zulassungs_pdfs.zip');
  /** Eingabe des Suchfelds „Zulassung einer Person prüfen“. */
  const [suche, setSuche] = useState('');

  // Eingaben aus dem Projektordner, solange nichts eigenes geladen wurde.
  const projekt = useProjekt();
  useEffect(() => {
    if (quellen.length > 0 || teilnehmerCsv !== null) return;
    const listen = projekt.dateienMit('zulassungsbestand').filter((datei) => !!datei.text);
    const studip = projekt.datei('studipExport');
    if (listen.length === 0 && !studip?.text) return;
    if (listen.length > 0) {
      setQuellen(listen.map((datei) => ({ datei: datei.pfad, text: datei.text ?? '' })));
    }
    if (studip?.text) setTeilnehmerCsv(studip.text);
  }, [projekt, quellen, teilnehmerCsv]);

  // Der Bestand mit Herkunft je Eintrag – Grundlage der Suche unten. Er hängt
  // nur an den Listen, nicht am Suchbegriff: Beim Tippen wird nicht neu
  // geparst, nur gefiltert.
  const funde = useMemo(() => ladeZulassungsFunde(quellen), [quellen]);
  const treffer = useMemo(() => sucheImBestand(funde, suche), [funde, suche]);
  const wirdGesucht = suche.trim() !== '';

  const ladeZulassungsOrdner = async (files: File[]) => {
    try {
      const listen = files.filter((file) => istZulassungsDatei(file.name));
      const inhalte = await Promise.all(
        listen.map(async (file) => ({ datei: file.name, text: await readFileAsText(file) })),
      );
      setQuellen(inhalte);
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
    setQuellen(
      Object.entries(BEISPIEL_ZULASSUNGS_BESTAND).map(([datei, text]) => ({ datei, text })),
    );
    setTeilnehmerCsv(BEISPIEL_TEILNEHMENDENEXPORT);
    setStatus({ kind: 'info', text: 'Beispieldaten geladen.' });
  };

  const erzeugePdfs = async () => {
    if (quellen.length === 0 || !teilnehmerCsv) return;
    setLaeuft(true);
    setErgebnis(null);
    setStatus({ kind: 'info', text: 'PDFs werden erzeugt …' });
    try {
      const teilnehmer = parseStudipExport(teilnehmerCsv);
      const bestand = ladeZulassungsBestand(quellen.map((quelle) => quelle.text));
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
      setErgebnis({ zulassungen, zip, ersetzt, umgeschrieben: umgeschriebeneNamen(zulassungen) });
      setStatus(null);
    } catch (fehler) {
      setStatus({ kind: 'error', text: fehler instanceof Error ? fehler.message : String(fehler) });
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <ScreenContainer
      title="2. Zulassung prüfen & PDF generieren"
      intro="Nachschlagen, ob eine einzelne Person zugelassen ist, und für alle Teilnehmenden mit Zulassung je ein PDF erzeugen. Alles läuft lokal im Browser – nichts wird hochgeladen."
      testID="ZulassungsPdfs-screen"
    >
      <Section title="Eingabedaten">
        <FilePickerButton
          label="Zulassungsordner auswählen"
          directory
          onFiles={ladeZulassungsOrdner}
          testID="zulassungspdfs-ordner"
        />
        <ProjektQuelle rolle="zulassungsbestand" alle testID="pdfs-quelle-zulassungen" />
        <FilePickerButton
          label="Teilnehmendenexport.csv auswählen"
          accept=".csv"
          onFiles={ladeTeilnehmerExport}
          testID="zulassungspdfs-teilnehmer"
        />
        <ProjektQuelle rolle="studipExport" testID="pdfs-quelle-studip" />
        <AppButton
          title="Beispieldaten laden"
          variant="secondary"
          onPress={ladeBeispieldaten}
          testID="zulassungspdfs-beispiel"
        />
        {status ? <StatusText kind={status.kind}>{status.text}</StatusText> : null}
        <Text style={styles.hinweis}>
          Aus dem Projektordner kommen die Zulassungslisten aus Zulassungen/ (inklusive der in
          Schritt 1 abgelegten) und der Stud.IP-Export aus
          0_Input_Kurs_Teilnehmer_Studip_Liste/. Ohne Projektordner lassen sich beide hier von Hand
          auswählen.
        </Text>
      </Section>

      {quellen.length > 0 ? (
        <Section title="Zulassung einer Person prüfen">
          <Text style={styles.hinweis}>
            Sucht in allen geladenen Zulassungslisten ({funde.length} Einträge aus{' '}
            {quellen.length} Datei(en)). Groß-/Kleinschreibung, Reihenfolge der Namen und Umlaute
            sind egal; die Matrikelnummer führt genauso zum Treffer.
          </Text>
          <LabeledTextInput
            label="Name oder Matrikelnummer"
            value={suche}
            onChangeText={setSuche}
            placeholder="z. B. Schrödinger oder 1000005"
            testID="zulassungspdfs-suche"
          />
          {wirdGesucht && treffer.length === 0 ? (
            <StatusText kind="error" testID="zulassungspdfs-suche-ergebnis">
              {`„${suche.trim()}“ steht in keiner der geladenen Zulassungslisten – keine Zulassung gefunden.`}
            </StatusText>
          ) : null}
          {wirdGesucht && treffer.length > 0 ? (
            <>
              <StatusText kind="success" testID="zulassungspdfs-suche-ergebnis">
                {`Zulassung vorhanden – ${
                  treffer.length === 1 ? 'ein Eintrag' : `${treffer.length} Einträge`
                } im Bestand:`}
              </StatusText>
              <DataTable
                columns={[
                  { key: 'nachname', title: 'Nachname' },
                  { key: 'vorname', title: 'Vorname' },
                  { key: 'matrikelnummer', title: 'Matrikelnummer' },
                  { key: 'datei', title: 'Zulassung aus Datei' },
                ]}
                rows={treffer.map((fund) => ({
                  nachname: fund.zulassung.nachname,
                  vorname: fund.zulassung.vorname,
                  matrikelnummer: fund.zulassung.matrikelnummer,
                  datei: fund.datei,
                }))}
                testID="zulassungspdfs-suche-tabelle"
              />
            </>
          ) : null}
          <Text style={styles.hinweis}>
            Ein Datum der Zulassung wird nirgends gespeichert – die Datei ist die einzige
            Zeitangabe: Sie trägt das Jahr im Namen (pv2025_zulassungen.csv). Steht jemand in
            mehreren Listen, wurde die Zulassung in mehreren Jahren erworben.
          </Text>
        </Section>
      ) : null}

      <AppButton
        title="PDFs erzeugen"
        onPress={erzeugePdfs}
        disabled={laeuft || quellen.length === 0 || !teilnehmerCsv}
        testID="zulassungspdfs-erzeugen"
      />

      {ergebnis ? (
        <Section title="Ergebnis">
          <StatusText kind="success" testID="zulassungspdfs-ergebnis">
            {`${ergebnis.zulassungen.length} Zulassungs-PDFs erzeugt.`}
          </StatusText>
          {ergebnis.umgeschrieben.length > 0 ? (
            <StatusText kind="info" testID="zulassungspdfs-sonderzeichen">
              {`Die eingebaute PDF-Schrift kennt nicht jedes Sonderzeichen; in ${ergebnis.umgeschrieben.length} Namen wurde es ersetzt: ${ergebnis.umgeschrieben.join('; ')}`}
            </StatusText>
          ) : null}
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
