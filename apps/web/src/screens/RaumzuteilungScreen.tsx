import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  belegungToCsv,
  erstelleRaumzuteilung,
  erstelleZip,
  mitGroesse,
  ohneFreieBelegung,
  parseBelegung,
  parseRaeume,
  parseRaumschemata,
  parseZulassungsliste,
  Platzbelegung,
  Raum,
  Raumschema,
  raeumeToCsv,
  raumschemataToCsv,
  schalteReserve,
  schalteVorgabe,
  setzePerson,
  setzeZelle,
  Sitzplatz,
  sitzplaetzeMitBelegung,
  sitzplaetzeToCsv,
  sitzplatznummern,
  sitzplatzPdf,
  sortByNachname,
  standardRaumschema,
  tischzellen,
  verteileAufRaumschemata,
  Verteilmodus,
  ZellTyp,
  Zulassung,
} from '@exam-manager/core';
import {
  AppButton,
  DataTable,
  FilePickerButton,
  LabeledNumberInput,
  LabeledTextInput,
  Raumplan,
  ScreenContainer,
  Section,
  StatusText,
} from '../components';
import { downloadCsv, downloadZip, readFileAsText } from '../files';
import { druckeAnsicht, SEITENUMBRUCH } from '../print';
import { useResponsiveLayout } from '../responsive';
import { BEISPIEL_KLAUSUR_TEILNEHMER, BEISPIEL_RAEUME, BEISPIEL_RAUMSCHEMA } from '../sampleData';
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

/** Was ein Tippen auf eine Zelle des Sitzplans bewirkt. */
const PLAN_MODI = [
  { key: 'verschieben', titel: 'Platzieren', hinweis: 'Person antippen, dann den Zieltisch antippen. Sitzt dort jemand, tauschen die beiden.' },
  { key: 'reserve', titel: 'Reserve', hinweis: 'Tisch antippen, um ihn als Reserveplatz frei zu halten (nochmal antippen hebt es auf).' },
  { key: 'vorgabe', titel: 'Vorgabe', hinweis: 'Besetzten Tisch antippen: Die Person bleibt dort, auch wenn neu verteilt wird.' },
  { key: 'bearbeiten', titel: 'Raum bearbeiten', hinweis: 'Zellenart wählen und Zellen antippen, um Tische, Tür, Wand und Pult zu setzen.' },
] as const;

type PlanModus = (typeof PLAN_MODI)[number]['key'];

const ZELL_PALETTE: { typ: ZellTyp; titel: string }[] = [
  { typ: 'tisch', titel: 'Tisch' },
  { typ: 'leer', titel: 'Frei' },
  { typ: 'tuer', titel: 'Tür' },
  { typ: 'wand', titel: 'Wand' },
  { typ: 'pult', titel: 'Pult' },
];

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
  const { isCompact } = useResponsiveLayout();
  // Gestapelt wäre flexBasis die Höhe – dort bekommen die Felder volle Breite.
  const voll = styles.raumInputVoll;
  return (
    <View style={[styles.raumZeile, isCompact && styles.raumZeileGestapelt]}>
      <TextInput
        style={[styles.raumInput, isCompact ? voll : styles.raumInputName]}
        value={zeile.raum}
        onChangeText={(raum) => onChange({ ...zeile, raum })}
        placeholder="Raum-Name"
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        style={[styles.raumInput, isCompact ? voll : styles.raumInputPlaetze]}
        value={zeile.plaetzeText}
        inputMode="numeric"
        onChangeText={(plaetzeText) => onChange({ ...zeile, plaetzeText })}
        placeholder="Plätze"
        placeholderTextColor={colors.textMuted}
      />
      <TextInput
        style={[styles.raumInput, isCompact ? voll : styles.raumInputZeit]}
        value={zeile.reservierteZeit}
        onChangeText={(reservierteZeit) => onChange({ ...zeile, reservierteZeit })}
        placeholder="Reservierte Zeit"
        placeholderTextColor={colors.textMuted}
      />
      <AppButton title="Entfernen" variant="secondary" onPress={onRemove} />
    </View>
  );
}

/**
 * Ansicht "Räume" – zugleich die Druckvorlage der Aushänge: pro Raum eine
 * Überschrift, der Sitzplan (falls ein Raumschema vorliegt) und die Tabelle
 * `Sitzplatz → Anfang Nachname`. Im Druck beginnt jeder Raum auf einer neuen
 * Seite.
 */
function RaumAushaenge({
  sitzplaetze,
  raeume,
  schemata,
  belegung,
  nummern,
  drehungen,
}: {
  sitzplaetze: Sitzplatz[];
  raeume: Raum[];
  schemata: Raumschema[];
  belegung: Platzbelegung[];
  nummern: Map<string, number>;
  drehungen: Record<string, number>;
}) {
  const raumNamen = [...new Set(sitzplaetze.map((platz) => platz.raum))];
  const personen = new Map(sitzplaetze.map((platz) => [platz.matrikelnummer, platz]));
  return (
    <View style={styles.raumTabellen}>
      {raumNamen.map((raumName) => {
        const plaetzeImRaum = sitzplaetze
          .filter((platz) => platz.raum === raumName)
          .sort((a, b) => a.sitzplatznummer - b.sitzplatznummer);
        const raum = raeume.find((r) => r.raum === raumName);
        const kapazitaet = raum ? raum.plaetze : plaetzeImRaum.length;
        const zeit = plaetzeImRaum[0]?.reservierteZeit ?? raum?.reservierteZeit ?? '';
        const schema = schemata.find((s) => s.raum === raumName);
        return (
          <View key={raumName} style={styles.raumTabelle} {...SEITENUMBRUCH}>
            <Text style={styles.raumUeberschrift}>
              {raumName}
              {zeit ? ` – ${zeit}` : ''} ({plaetzeImRaum.length}/{kapazitaet} Plätze)
            </Text>
            {schema ? (
              <Raumplan
                schema={schema}
                drehungen={drehungen[raumName] ?? 0}
                belegung={belegung.filter((platz) => platz.raum === raumName)}
                nummern={nummern}
                personen={personen}
                anonym
              />
            ) : null}
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
  const [hinweis, setHinweis] = useState<string | null>(null);

  // Zuteilungs-Optionen.
  const [startnummer, setStartnummer] = useState<number | null>(1001);
  const [modus, setModus] = useState<Verteilmodus>('balanced');

  // Ergebnis & Ausgabe.
  const [sitzplaetze, setSitzplaetze] = useState<Sitzplatz[] | null>(null);
  const [ohnePlatz, setOhnePlatz] = useState<Zulassung[]>([]);
  const [ansicht, setAnsicht] = useState<Ansicht>('aushang');
  const [dateiname, setDateiname] = useState('studierendeZuRaumUndZeitZuordnung.csv');
  const [pdfLaeuft, setPdfLaeuft] = useState(false);

  // Sitzplan im Raum.
  const [schemata, setSchemata] = useState<Raumschema[]>([]);
  const [belegung, setBelegung] = useState<Platzbelegung[]>([]);
  const [drehungen, setDrehungen] = useState<Record<string, number>>({});
  const [planModus, setPlanModus] = useState<PlanModus>('verschieben');
  const [pinsel, setPinsel] = useState<ZellTyp>('tisch');
  const [ausgewaehlt, setAusgewaehlt] = useState<{ raum: string; matrikelnummer: string } | null>(null);
  const [ohnePlanPlatz, setOhnePlanPlatz] = useState<Sitzplatz[]>([]);

  const aushangRef = useRef<View>(null);

  const raeume = zeilen.map(zeileZuRaum);

  /** Tischnummern: über alle Räume fortlaufend, in Lesereihenfolge des Rasters. */
  const nummern = useMemo(
    () => sitzplatznummern(schemata, startnummer ?? 1001),
    [schemata, startnummer],
  );

  /**
   * Die Sitzplätze, wie sie angezeigt und exportiert werden: Liegt ein
   * Raumschema vor, gilt die Nummer des Tisches, an dem die Person sitzt.
   */
  const angezeigteSitzplaetze = useMemo(() => {
    if (sitzplaetze === null) return null;
    if (schemata.length === 0 || belegung.length === 0) return sitzplaetze;
    return sitzplaetzeMitBelegung(sitzplaetze, belegung, nummern);
  }, [sitzplaetze, schemata, belegung, nummern]);

  const personenJeMatrikel = useMemo(
    () => new Map((angezeigteSitzplaetze ?? []).map((platz) => [platz.matrikelnummer, platz])),
    [angezeigteSitzplaetze],
  );

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
    setSchemata(parseRaumschemata(BEISPIEL_RAUMSCHEMA));
    setBelegung([]);
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

  /** Schemata für alle Räume sicherstellen – fehlende werden vorgeschlagen. */
  const schemataFuer = (fuerRaeume: Raum[]): Raumschema[] =>
    fuerRaeume.map(
      (raum) => schemata.find((s) => s.raum === raum.raum) ?? standardRaumschema(raum.raum, raum.plaetze),
    );

  /** Belegung neu aufbauen. `vonVorne` verwirft alles außer Reserven und Vorgaben. */
  const belegungAktualisieren = (
    fuerSchemata: Raumschema[],
    fuerSitzplaetze: Sitzplatz[],
    basis: Platzbelegung[],
    vonVorne = false,
  ) => {
    const ergebnis = verteileAufRaumschemata(
      fuerSitzplaetze,
      fuerSchemata,
      vonVorne ? ohneFreieBelegung(basis) : basis,
    );
    setBelegung(ergebnis.belegung);
    setOhnePlanPlatz(ergebnis.ohnePlatz);
    return ergebnis;
  };

  const zuteilungErstellen = () => {
    setFehler(null);
    setHinweis(null);
    const ergebnis = erstelleRaumzuteilung(teilnehmer, raeume, {
      modus,
      ersteSitzplatznummer: startnummer ?? 1001,
    });
    setSitzplaetze(ergebnis.sitzplaetze);
    setOhnePlatz(ergebnis.ohnePlatz);
    setAnsicht('aushang');
    setAusgewaehlt(null);

    const neueSchemata = schemataFuer(raeume);
    setSchemata(neueSchemata);
    belegungAktualisieren(neueSchemata, ergebnis.sitzplaetze, belegung, true);
  };

  const neuVerteilen = () => {
    if (!sitzplaetze) return;
    setAusgewaehlt(null);
    belegungAktualisieren(schemata, sitzplaetze, belegung, true);
    setHinweis('Sitzplan neu verteilt – Reserveplätze und Vorgaben sind geblieben.');
  };

  const schemaLaden = async (files: File[]) => {
    setFehler(null);
    try {
      const geladen = parseRaumschemata(await readFileAsText(files[0]));
      setSchemata(geladen);
      if (sitzplaetze) belegungAktualisieren(geladen, sitzplaetze, belegung);
      setHinweis(`${geladen.length} Raumschemata geladen.`);
    } catch (e) {
      setFehler(`Raumschema konnte nicht gelesen werden: ${String(e)}`);
    }
  };

  const belegungLaden = async (files: File[]) => {
    setFehler(null);
    try {
      const geladen = parseBelegung(await readFileAsText(files[0]));
      if (sitzplaetze) {
        belegungAktualisieren(schemata, sitzplaetze, geladen);
      } else {
        setBelegung(geladen);
      }
      setHinweis('Belegung geladen.');
    } catch (e) {
      setFehler(`Belegung konnte nicht gelesen werden: ${String(e)}`);
    }
  };

  /**
   * Belegung übernehmen und dabei alle nachziehen, die (noch) keinen Tisch
   * haben – etwa wer gerade von einem Reserveplatz verdrängt wurde.
   */
  const belegungSetzen = (neu: Platzbelegung[]) => {
    if (sitzplaetze) belegungAktualisieren(schemata, sitzplaetze, neu);
    else setBelegung(neu);
  };

  /** Zelle im Sitzplan angetippt – was passiert, hängt vom Modus ab. */
  const zellePress = (schema: Raumschema, zeile: number, spalte: number) => {
    setHinweis(null);
    if (planModus === 'bearbeiten') {
      const neueSchemata = schemata.map((s) =>
        s.raum === schema.raum ? setzeZelle(s, zeile, spalte, pinsel) : s,
      );
      setSchemata(neueSchemata);
      if (sitzplaetze) belegungAktualisieren(neueSchemata, sitzplaetze, belegung);
      return;
    }
    if (planModus === 'reserve') {
      belegungSetzen(schalteReserve(belegung, schema.raum, zeile, spalte));
      return;
    }
    if (planModus === 'vorgabe') {
      setBelegung(schalteVorgabe(belegung, schema.raum, zeile, spalte));
      return;
    }

    // Platzieren: erst Person wählen, dann Zieltisch.
    const platz = belegung.find(
      (b) => b.raum === schema.raum && b.zeile === zeile && b.spalte === spalte,
    );
    if (!platz) return;
    if (ausgewaehlt && ausgewaehlt.raum === schema.raum) {
      if (platz.matrikelnummer === ausgewaehlt.matrikelnummer) {
        setAusgewaehlt(null);
        return;
      }
      belegungSetzen(setzePerson(belegung, schema.raum, zeile, spalte, ausgewaehlt.matrikelnummer));
      setAusgewaehlt(null);
      return;
    }
    if (platz.matrikelnummer !== '') {
      setAusgewaehlt({ raum: schema.raum, matrikelnummer: platz.matrikelnummer });
    }
  };

  const drehen = (raum: string, richtung: 1 | -1) => {
    setDrehungen({ ...drehungen, [raum]: (((drehungen[raum] ?? 0) + richtung) % 4 + 4) % 4 });
  };

  const groesseAendern = (schema: Raumschema, dZeilen: number, dSpalten: number) => {
    const neu = mitGroesse(schema, schema.zellen.length + dZeilen, (schema.zellen[0]?.length ?? 1) + dSpalten);
    const neueSchemata = schemata.map((s) => (s.raum === schema.raum ? neu : s));
    setSchemata(neueSchemata);
    if (sitzplaetze) belegungAktualisieren(neueSchemata, sitzplaetze, belegung);
  };

  const aushaengeDrucken = () => {
    setFehler(null);
    setHinweis(null);
    setAnsicht('raeume');
    // Erst rendern lassen, dann den sichtbaren Knoten drucken.
    setTimeout(() => {
      const knoten = aushangRef.current as unknown as HTMLElement | null;
      if (druckeAnsicht(knoten, 'Aushänge')) {
        setHinweis('Druckdialog geöffnet – dort „Als PDF sichern“ wählen.');
      } else {
        setFehler('Das Druckfenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.');
      }
    }, 100);
  };

  const pdfsHerunterladen = async () => {
    if (!angezeigteSitzplaetze) return;
    setFehler(null);
    setPdfLaeuft(true);
    try {
      const dateien = new Map<string, Uint8Array | string>();
      for (const platz of angezeigteSitzplaetze) {
        dateien.set(`${platz.matrikelnummer}.pdf`, await sitzplatzPdf(platz));
      }
      downloadZip('sitzplatz_pdfs.zip', await erstelleZip(dateien));
    } catch (e) {
      setFehler(`PDFs konnten nicht erzeugt werden: ${String(e)}`);
    } finally {
      setPdfLaeuft(false);
    }
  };

  const anzahlRaeume = angezeigteSitzplaetze
    ? new Set(angezeigteSitzplaetze.map((platz) => platz.raum)).size
    : 0;
  const modusHinweis = PLAN_MODI.find((m) => m.key === planModus)?.hinweis ?? '';

  return (
    <ScreenContainer
      title="4. Raumzuteilung & Sitzplan"
      intro="Die Teilnehmerliste aus Schritt 3 auf Räume verteilen: Sitzplätze vergeben, Sitzplan im Raum anordnen, Aushang- und Aufsichtslisten anzeigen und alles herunterladen – alles lokal im Browser."
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
        {angezeigteSitzplaetze ? (
          <StatusText kind="success" testID="raum-ergebnis">
            {`${angezeigteSitzplaetze.length} Sitzplätze in ${anzahlRaeume} Räumen vergeben.`}
          </StatusText>
        ) : null}
        {ohnePlatz.length > 0 ? (
          <StatusText kind="error">
            {`Kein Platz für: ${ohnePlatz.map((p) => `${p.vorname} ${p.nachname}`).join(', ')}`}
          </StatusText>
        ) : null}
        {fehler ? <StatusText kind="error">{fehler}</StatusText> : null}
        {hinweis ? <StatusText kind="info">{hinweis}</StatusText> : null}
      </Section>

      {angezeigteSitzplaetze && schemata.length > 0 ? (
        <Section title="Sitzplan im Raum" testID="raum-sitzplan">
          <Text style={styles.hinweis}>
            Der Sitzplan zeigt, wo im Raum die Tische stehen. Die Sitzplatznummer gehört zum Tisch –
            wer den Platz wechselt, bekommt die Nummer des neuen Tisches.
          </Text>

          <View style={styles.buttonZeile}>
            {PLAN_MODI.map((m) => (
              <AppButton
                key={m.key}
                title={m.titel}
                variant={planModus === m.key ? 'primary' : 'secondary'}
                onPress={() => {
                  setPlanModus(m.key);
                  setAusgewaehlt(null);
                }}
                testID={`raum-modus-${m.key}`}
              />
            ))}
          </View>
          <Text style={styles.hinweis}>{modusHinweis}</Text>

          {planModus === 'bearbeiten' ? (
            <View style={styles.buttonZeile}>
              {ZELL_PALETTE.map((eintrag) => (
                <AppButton
                  key={eintrag.typ}
                  title={eintrag.titel}
                  variant={pinsel === eintrag.typ ? 'primary' : 'secondary'}
                  onPress={() => setPinsel(eintrag.typ)}
                  testID={`raum-zelle-${eintrag.typ}`}
                />
              ))}
            </View>
          ) : null}

          {ausgewaehlt ? (
            <StatusText kind="info">
              {`Ausgewählt: ${personenJeMatrikel.get(ausgewaehlt.matrikelnummer)?.nachname ?? ausgewaehlt.matrikelnummer} – jetzt den Zieltisch antippen.`}
            </StatusText>
          ) : null}

          {ohnePlanPlatz.length > 0 ? (
            <StatusText kind="error">
              {`Ohne Tisch im Sitzplan: ${ohnePlanPlatz.map((p) => `${p.vorname} ${p.nachname}`).join(', ')} – im Raum bearbeiten mehr Tische setzen.`}
            </StatusText>
          ) : null}

          {schemata.map((schema) => {
            const tische = tischzellen(schema).length;
            const belegt = belegung.filter((p) => p.raum === schema.raum && p.matrikelnummer !== '').length;
            const reserven = belegung.filter((p) => p.raum === schema.raum && p.reserviert).length;
            return (
              <View key={schema.raum} style={styles.planBlock}>
                <Text style={styles.raumUeberschrift}>
                  {schema.raum} ({belegt}/{tische} belegt{reserven > 0 ? `, ${reserven} Reserve` : ''})
                </Text>
                <View style={styles.buttonZeile}>
                  <AppButton
                    title="↺ 90°"
                    variant="secondary"
                    onPress={() => drehen(schema.raum, -1)}
                    testID={`raum-drehen-links-${schema.raum}`}
                  />
                  <AppButton
                    title="↻ 90°"
                    variant="secondary"
                    onPress={() => drehen(schema.raum, 1)}
                    testID={`raum-drehen-rechts-${schema.raum}`}
                  />
                  {planModus === 'bearbeiten' ? (
                    <>
                      <AppButton title="+ Zeile" variant="secondary" onPress={() => groesseAendern(schema, 1, 0)} />
                      <AppButton title="− Zeile" variant="secondary" onPress={() => groesseAendern(schema, -1, 0)} />
                      <AppButton title="+ Spalte" variant="secondary" onPress={() => groesseAendern(schema, 0, 1)} />
                      <AppButton title="− Spalte" variant="secondary" onPress={() => groesseAendern(schema, 0, -1)} />
                    </>
                  ) : null}
                </View>
                <Raumplan
                  schema={schema}
                  drehungen={drehungen[schema.raum] ?? 0}
                  belegung={belegung.filter((platz) => platz.raum === schema.raum)}
                  nummern={nummern}
                  personen={personenJeMatrikel}
                  ausgewaehlt={ausgewaehlt?.raum === schema.raum ? ausgewaehlt.matrikelnummer : null}
                  onZellePress={(zeile, spalte) => zellePress(schema, zeile, spalte)}
                  testID={`raum-plan-${schema.raum}`}
                />
              </View>
            );
          })}

          <View style={styles.buttonZeile}>
            <AppButton title="Sitzplan neu verteilen" variant="secondary" onPress={neuVerteilen} testID="raum-neu-verteilen" />
            <AppButton
              title="Raumschema als CSV speichern"
              variant="secondary"
              onPress={() => downloadCsv('raumschema.csv', raumschemataToCsv(schemata))}
              testID="raum-schema-speichern"
            />
            <AppButton
              title="Belegung als CSV speichern"
              variant="secondary"
              onPress={() =>
                downloadCsv('raumbelegung.csv', belegungToCsv(belegung, angezeigteSitzplaetze, nummern))
              }
              testID="raum-belegung-speichern"
            />
          </View>
          <FilePickerButton label="Raumschema-CSV laden" accept=".csv" onFiles={schemaLaden} />
          <FilePickerButton label="Belegung-CSV laden" accept=".csv" onFiles={belegungLaden} />
        </Section>
      ) : null}

      {angezeigteSitzplaetze ? (
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
          <AppButton
            title="Alle Aushänge als PDF"
            onPress={aushaengeDrucken}
            testID="raum-aushaenge-pdf"
          />
          {ansicht === 'aushang' ? (
            <DataTable
              columns={[
                { key: 'anfangNachname', title: 'Anfang Nachname' },
                { key: 'sitzplatznummer', title: 'Sitzplatznummer' },
                { key: 'raum', title: 'Raum' },
              ]}
              rows={[...angezeigteSitzplaetze]
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
              rows={[...angezeigteSitzplaetze]
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
              rows={sortByNachname(angezeigteSitzplaetze).map((platz) => ({
                sitzplatz: platz.sitzplatznummer,
                vorname: platz.vorname,
                nachname: platz.nachname,
                raum: platz.raum,
                anwesend: platz.anwesend,
              }))}
            />
          ) : null}
          {/* Die Aushänge bleiben gerendert, solange die Ansicht sie zeigt – der
              Druck nimmt genau diesen sichtbaren Knoten. */}
          {ansicht === 'raeume' ? (
            <View ref={aushangRef}>
              <RaumAushaenge
                sitzplaetze={angezeigteSitzplaetze}
                raeume={raeume}
                schemata={schemata}
                belegung={belegung}
                nummern={nummern}
                drehungen={drehungen}
              />
            </View>
          ) : null}
        </Section>
      ) : null}

      {angezeigteSitzplaetze ? (
        <Section title="Download">
          <LabeledTextInput
            label="Dateiname"
            value={dateiname}
            onChangeText={setDateiname}
            testID="raum-dateiname"
          />
          <AppButton
            title="Sitzplan-CSV herunterladen"
            onPress={() => downloadCsv(dateiname, sitzplaetzeToCsv(angezeigteSitzplaetze))}
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
  raumZeileGestapelt: { flexDirection: 'column', alignItems: 'stretch' },
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
  // Keine festen Breiten: flexBasis ist nur die Umbruchgrenze, die Felder
  // teilen sich die tatsächliche Breite über flexGrow.
  raumInputName: { flexGrow: 2, flexShrink: 1, flexBasis: 120, minWidth: 0 },
  raumInputPlaetze: { flexGrow: 1, flexShrink: 1, flexBasis: 80, minWidth: 0 },
  raumInputZeit: { flexGrow: 3, flexShrink: 1, flexBasis: 180, minWidth: 0 },
  raumInputVoll: { width: '100%' },
  raumTabellen: { gap: spacing.md },
  raumTabelle: { gap: spacing.xs },
  raumUeberschrift: { fontSize: 15, fontWeight: '600', color: colors.text },
  planBlock: { gap: spacing.sm },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
