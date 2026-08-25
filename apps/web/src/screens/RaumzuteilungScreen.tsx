import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  erstelleRaumzuteilung,
  erstelleZip,
  parseRaeume,
  parseZulassungsliste,
  Raum,
  raeumeToCsv,
  Sitzplatz,
  sitzplaetzeToCsv,
  sitzplatzPdf,
  sortByNachname,
  Verteilmodus,
  Zulassung,
} from '@exam-manager/core';
import {
  AppButton,
  DataTable,
  FilePickerButton,
  LabeledNumberInput,
  LabeledTextInput,
  ScreenContainer,
  Section,
  StatusText,
} from '../components';
import { downloadCsv, downloadZip, readFileAsText } from '../files';
import { BEISPIEL_KLAUSUR_TEILNEHMER, BEISPIEL_RAEUME } from '../sampleData';
import { colors, radius, spacing } from '../theme';

/** Editierbare Raum-Zeile – Plätze als Text, damit das Feld frei tippbar bleibt. */
interface RaumZeile {
  raum: string;
  plaetzeText: string;
  reservierteZeit: string;
}

function raumZuZeile(raum: Raum): RaumZeile {
  return { raum: raum.raum, plaetzeText: String(raum.plaetze), reservierteZeit: raum.reservierteZeit };
}

function zeileZuRaum(zeile: RaumZeile): Raum {
  const plaetze = Number(zeile.plaetzeText.trim().replace(',', '.'));
  return {
    raum: zeile.raum.trim(),
    plaetze: Number.isFinite(plaetze) ? plaetze : 0,
    reservierteZeit: zeile.reservierteZeit.trim(),
  };
}

const ANSICHTEN = [
  { key: 'aushang', titel: 'Aushang', testID: 'raum-ansicht-aushang' },
  { key: 'dozent', titel: 'Dozent', testID: 'raum-ansicht-dozent' },
  { key: 'tutor', titel: 'Tutor', testID: 'raum-ansicht-tutor' },
  { key: 'raeume', titel: 'Räume', testID: 'raum-ansicht-raeume' },
] as const;

type Ansicht = (typeof ANSICHTEN)[number]['key'];

/** Eine Eingabezeile des Raum-Editors. */
function RaumEditorZeile({
  zeile,
  onChange,
  onRemove,
}: {
  zeile: RaumZeile;
  onChange: (zeile: RaumZeile) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.raumZeile}>
      <TextInput
        style={[styles.raumInput, styles.raumInputName]}
        value={zeile.raum}
        onChangeText={(raum) => onChange({ ...zeile, raum })}
        placeholder="Raum-Name"
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        style={[styles.raumInput, styles.raumInputPlaetze]}
        value={zeile.plaetzeText}
        inputMode="numeric"
        onChangeText={(plaetzeText) => onChange({ ...zeile, plaetzeText })}
        placeholder="Plätze"
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        style={[styles.raumInput, styles.raumInputZeit]}
        value={zeile.reservierteZeit}
        onChangeText={(reservierteZeit) => onChange({ ...zeile, reservierteZeit })}
        placeholder="Reservierte Zeit"
        placeholderTextColor={colors.textMuted}
      />
      <AppButton title="Entfernen" variant="secondary" onPress={onRemove} />
    </View>
  );
}

/** Ansicht "Räume": pro Raum eine Überschrift mit Belegung und eine Tabelle. */
function RaumTabellen({ sitzplaetze, raeume }: { sitzplaetze: Sitzplatz[]; raeume: Raum[] }) {
  const raumNamen = [...new Set(sitzplaetze.map((platz) => platz.raum))];
  return (
    <View style={styles.raumTabellen}>
      {raumNamen.map((raumName) => {
        const plaetzeImRaum = sitzplaetze
          .filter((platz) => platz.raum === raumName)
          .sort((a, b) => a.sitzplatznummer - b.sitzplatznummer);
        const raum = raeume.find((r) => r.raum === raumName);
        const kapazitaet = raum ? raum.plaetze : plaetzeImRaum.length;
        const zeit = plaetzeImRaum[0]?.reservierteZeit ?? raum?.reservierteZeit ?? '';
        return (
          <View key={raumName} style={styles.raumTabelle}>
            <Text style={styles.raumUeberschrift}>
              {raumName}
              {zeit ? ` – ${zeit}` : ''} ({plaetzeImRaum.length}/{kapazitaet} Plätze)
            </Text>
            <DataTable
              columns={[
                { key: 'sitzplatz', title: 'Sitzplatz' },
                { key: 'anfangNachname', title: 'Anfang Nachname' },
              ]}
              rows={plaetzeImRaum.map((platz) => ({
                sitzplatz: platz.sitzplatznummer,
                anfangNachname: platz.anfangNachname,
              }))}
            />
          </View>
        );
      })}
    </View>
  );
}

/**
 * Schritt 4 des Prüfungs-Workflows: Klausur-Teilnehmende auf Räume verteilen,
 * Sitzplätze vergeben und Aushang-/Aufsichtslisten sowie PDFs erzeugen.
 */
export function RaumzuteilungScreen() {
  // Eingaben.
  const [teilnehmer, setTeilnehmer] = useState<Zulassung[]>([]);
  const [teilnehmerStatus, setTeilnehmerStatus] = useState<string | null>(null);
  const [zeilen, setZeilen] = useState<RaumZeile[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  // Zuteilungs-Optionen.
  const [startnummer, setStartnummer] = useState<number | null>(1001);
  const [modus, setModus] = useState<Verteilmodus>('balanced');

  // Ergebnis & Ausgabe.
  const [sitzplaetze, setSitzplaetze] = useState<Sitzplatz[] | null>(null);
  const [ohnePlatz, setOhnePlatz] = useState<Zulassung[]>([]);
  const [ansicht, setAnsicht] = useState<Ansicht>('aushang');
  const [dateiname, setDateiname] = useState('studierendeZuRaumUndZeitZuordnung.csv');
  const [pdfLaeuft, setPdfLaeuft] = useState(false);

  const raeume = zeilen.map(zeileZuRaum);

  const teilnehmerLaden = async (files: File[]) => {
    setFehler(null);
    try {
      const geladen = parseZulassungsliste(await readFileAsText(files[0]));
      setTeilnehmer(geladen);
      setTeilnehmerStatus(`${geladen.length} Teilnehmende geladen.`);
    } catch (e) {
      setFehler(`Teilnehmer-CSV konnte nicht gelesen werden: ${String(e)}`);
    }
  };

  const beispielLaden = () => {
    setFehler(null);
    setTeilnehmer(parseZulassungsliste(BEISPIEL_KLAUSUR_TEILNEHMER));
    setZeilen(parseRaeume(BEISPIEL_RAEUME).map(raumZuZeile));
    setTeilnehmerStatus('Beispieldaten geladen.');
  };

  const raeumeLaden = async (files: File[]) => {
    setFehler(null);
    try {
      setZeilen(parseRaeume(await readFileAsText(files[0])).map(raumZuZeile));
    } catch (e) {
      setFehler(`Räume-CSV konnte nicht gelesen werden: ${String(e)}`);
    }
  };

  const zuteilungErstellen = () => {
    setFehler(null);
    const ergebnis = erstelleRaumzuteilung(teilnehmer, raeume, {
      modus,
      ersteSitzplatznummer: startnummer ?? 1001,
    });
    setSitzplaetze(ergebnis.sitzplaetze);
    setOhnePlatz(ergebnis.ohnePlatz);
    setAnsicht('aushang');
  };

  const pdfsHerunterladen = async () => {
    if (!sitzplaetze) return;
    setFehler(null);
    setPdfLaeuft(true);
    try {
      const dateien = new Map<string, Uint8Array | string>();
      for (const platz of sitzplaetze) {
        dateien.set(`${platz.matrikelnummer}.pdf`, await sitzplatzPdf(platz));
      }
      downloadZip('sitzplatz_pdfs.zip', await erstelleZip(dateien));
    } catch (e) {
      setFehler(`PDFs konnten nicht erzeugt werden: ${String(e)}`);
    } finally {
      setPdfLaeuft(false);
    }
  };

  const anzahlRaeume = sitzplaetze ? new Set(sitzplaetze.map((platz) => platz.raum)).size : 0;

  return (
    <ScreenContainer
      title="4. Raumzuteilung & Sitzplan"
      intro="Die Teilnehmerliste aus Schritt 3 auf Räume verteilen: Sitzplätze vergeben, Aushang- und Aufsichtslisten anzeigen und Sitzplan samt PDFs herunterladen – alles lokal im Browser."
      testID="Raumzuteilung-screen"
    >
      <Section title="Teilnehmende">
        <FilePickerButton
          label="Teilnehmer-CSV auswählen (aus Schritt 3)"
          accept=".csv"
          onFiles={teilnehmerLaden}
        />
        <AppButton
          title="Beispieldaten laden"
          variant="secondary"
          onPress={beispielLaden}
          testID="raum-beispiel"
        />
        {teilnehmerStatus ? <StatusText kind="info">{teilnehmerStatus}</StatusText> : null}
      </Section>

      <Section title="Räume">
        {zeilen.map((zeile, i) => (
          <RaumEditorZeile
            key={i}
            zeile={zeile}
            onChange={(neu) => setZeilen(zeilen.map((alt, j) => (j === i ? neu : alt)))}
            onRemove={() => setZeilen(zeilen.filter((_, j) => j !== i))}
          />
        ))}
        <AppButton
          title="Raum hinzufügen"
          onPress={() => setZeilen([...zeilen, { raum: '', plaetzeText: '', reservierteZeit: '' }])}
          testID="raum-hinzufuegen"
        />
        <FilePickerButton label="Räume-CSV laden" accept=".csv" onFiles={raeumeLaden} />
        <AppButton
          title="Räume als CSV speichern"
          variant="secondary"
          onPress={() => downloadCsv('raeume.csv', raeumeToCsv(raeume))}
          testID="raum-speichern"
        />
      </Section>

      <Section title="Zuteilung">
        <LabeledNumberInput
          label="Erste Sitzplatznummer"
          value={startnummer}
          onChange={setStartnummer}
          testID="raum-startnummer"
        />
        <View style={styles.buttonZeile}>
          <AppButton
            title="Gleichmäßig verteilen"
            variant={modus === 'balanced' ? 'primary' : 'secondary'}
            onPress={() => setModus('balanced')}
          />
          <AppButton
            title="Räume nacheinander füllen"
            variant={modus === 'sequential' ? 'primary' : 'secondary'}
            onPress={() => setModus('sequential')}
          />
        </View>
        <AppButton
          title="Zuteilung erstellen"
          onPress={zuteilungErstellen}
          disabled={teilnehmer.length === 0 || raeume.length === 0}
          testID="raum-erstellen"
        />
        {sitzplaetze ? (
          <StatusText kind="success" testID="raum-ergebnis">
            {`${sitzplaetze.length} Sitzplätze in ${anzahlRaeume} Räumen vergeben.`}
          </StatusText>
        ) : null}
        {ohnePlatz.length > 0 ? (
          <StatusText kind="error">
            {`Kein Platz für: ${ohnePlatz.map((p) => `${p.vorname} ${p.nachname}`).join(', ')}`}
          </StatusText>
        ) : null}
        {fehler ? <StatusText kind="error">{fehler}</StatusText> : null}
      </Section>

      {sitzplaetze ? (
        <Section title="Ansichten" testID="raum-ansichten">
          <View style={styles.buttonZeile}>
            {ANSICHTEN.map((a) => (
              <AppButton
                key={a.key}
                title={a.titel}
                variant={ansicht === a.key ? 'primary' : 'secondary'}
                onPress={() => setAnsicht(a.key)}
                testID={a.testID}
              />
            ))}
          </View>
          {ansicht === 'aushang' ? (
            <DataTable
              columns={[
                { key: 'anfangNachname', title: 'Anfang Nachname' },
                { key: 'sitzplatznummer', title: 'Sitzplatznummer' },
                { key: 'raum', title: 'Raum' },
              ]}
              rows={[...sitzplaetze]
                .sort((a, b) => a.anfangNachname.localeCompare(b.anfangNachname, 'de'))
                .map((platz) => ({
                  anfangNachname: platz.anfangNachname,
                  sitzplatznummer: platz.sitzplatznummer,
                  raum: platz.raum,
                }))}
            />
          ) : null}
          {ansicht === 'dozent' ? (
            <DataTable
              columns={[
                { key: 'sitzplatz', title: 'Sitzplatz' },
                { key: 'vorname', title: 'Vorname' },
                { key: 'nachname', title: 'Nachname' },
                { key: 'raum', title: 'Raum' },
                { key: 'anwesend', title: 'Anwesend' },
              ]}
              rows={[...sitzplaetze]
                .sort((a, b) => a.sitzplatznummer - b.sitzplatznummer)
                .map((platz) => ({
                  sitzplatz: platz.sitzplatznummer,
                  vorname: platz.vorname,
                  nachname: platz.nachname,
                  raum: platz.raum,
                  anwesend: platz.anwesend,
                }))}
            />
          ) : null}
          {ansicht === 'tutor' ? (
            <DataTable
              columns={[
                { key: 'sitzplatz', title: 'Sitzplatz' },
                { key: 'vorname', title: 'Vorname' },
                { key: 'nachname', title: 'Nachname' },
                { key: 'raum', title: 'Raum' },
                { key: 'anwesend', title: 'Anwesend' },
              ]}
              rows={sortByNachname(sitzplaetze).map((platz) => ({
                sitzplatz: platz.sitzplatznummer,
                vorname: platz.vorname,
                nachname: platz.nachname,
                raum: platz.raum,
                anwesend: platz.anwesend,
              }))}
            />
          ) : null}
          {ansicht === 'raeume' ? <RaumTabellen sitzplaetze={sitzplaetze} raeume={raeume} /> : null}
        </Section>
      ) : null}

      {sitzplaetze ? (
        <Section title="Download">
          <LabeledTextInput
            label="Dateiname"
            value={dateiname}
            onChangeText={setDateiname}
            testID="raum-dateiname"
          />
          <AppButton
            title="Sitzplan-CSV herunterladen"
            onPress={() => downloadCsv(dateiname, sitzplaetzeToCsv(sitzplaetze))}
            testID="raum-download"
          />
          <AppButton
            title="Sitzplatz-PDFs als ZIP"
            variant="secondary"
            onPress={pdfsHerunterladen}
            disabled={pdfLaeuft}
            testID="raum-download-pdfs"
          />
        </Section>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  buttonZeile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  raumZeile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  raumInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  raumInputName: { flexGrow: 1, minWidth: 120 },
  raumInputPlaetze: { width: 90 },
  raumInputZeit: { flexGrow: 3, minWidth: 220 },
  raumTabellen: { gap: spacing.md },
  raumTabelle: { gap: spacing.xs },
  raumUeberschrift: { fontSize: 15, fontWeight: '600', color: colors.text },
});
