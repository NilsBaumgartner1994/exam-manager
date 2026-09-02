import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import readXlsxFile from 'read-excel-file';
import {
  AnmeldungsPruefung,
  anzeigeBereich,
  BEISPIEL_WERTE,
  Bereich,
  bereichAus,
  bereichName,
  belegungToCsv,
  einsatzRaster,
  erstelleRaumzuteilung,
  erstelleZip,
  ladeZulassungsBestand,
  eindeutigeNamenspraefixe,
  entfernePerson,
  nichtDarstellbareZeichen,
  ohneFreieBelegung,
  PLAN_ANZEIGE_STANDARD,
  PlanAnzeige,
  parseBelegung,
  parseHisRows,
  parseRaeume,
  parseRaumschemaDateien,
  parseZulassungsliste,
  plaetzeJeRaum,
  PLATZHALTER_SITZPLATZ,
  Platzbelegung,
  platzSchluessel,
  pruefeAnmeldungen,
  pruefePlatzbedarf,
  Raum,
  Raumschema,
  raeumeToCsv,
  raumSchluessel,
  raumschemaDateien,
  schalteReserve,
  schalteVorgabe,
  setzePerson,
  setzeVorgabe,
  sitzplaenePdf,
  Sitzverteilung,
  Sitzplatz,
  sitzplaetzeMitBelegung,
  sitzplaetzeToCsv,
  sitzplatznummern,
  sitzplatzPdf,
  sitzplatzWerte,
  sortByNachname,
  tabellenPdf,
  tischzellen,
  verschiebeBelegung,
  verteileAufRaumschemata,
  Verteilmodus,
  VORLAGE_DATEI_SITZPLATZ,
  VORLAGE_NAME_SITZPLATZ,
  VORLAGE_SITZPLATZ,
  winAnsiText,
  Zulassung,
} from '@exam-manager/core';
import {
  AppButton,
  Arbeitsflaeche,
  BlattModal,
  DataTable,
  LabeledNumberInput,
  LabeledTextInput,
  FilePickerButton,
  Menueleiste,
  PALETTEN_HINWEIS_ZEILE,
  paletteEintraege,
  PlanFuss,
  PlatzBedarf,
  ProjektDownload,
  ProjektQuelle,
  rasterEintraege,
  rasterText,
  RaumListe,
  Raumplan,
  RaumplanBuehne,
  raumZuZeile,
  Reiterinhalt,
  Section,
  StatusText,
  StudipEinsicht,
  useProjektDownloadEintrag,
  useRaumplanEditor,
  VorlagenModal,
  werkzeugTitel,
  zeilenZuRaeumen,
  type MenuEintrag,
  type MenuGruppe,
  type RaumZeile,
  type Verschiebung,
} from '../components';
import { downloadCsv, downloadFile, downloadZip, readFileAsText } from '../files';
import { druckeAnsicht, SEITENUMBRUCH } from '../print';
import { useProjekt } from '../projekt';
import { BEISPIEL_KLAUSUR_TEILNEHMER, BEISPIEL_RAEUME, BEISPIEL_RAUMSCHEMATA } from '../sampleData';
import { colors, spacing } from '../theme';

const ANSICHTEN = [
  { key: 'aushang', titel: 'Aushang', testID: 'raum-ansicht-aushang' },
  { key: 'dozent', titel: 'Dozent', testID: 'raum-ansicht-dozent' },
  { key: 'tutor', titel: 'Tutor', testID: 'raum-ansicht-tutor' },
  { key: 'raeume', titel: 'Räume', testID: 'raum-ansicht-raeume' },
] as const;

type Ansicht = (typeof ANSICHTEN)[number]['key'];

/**
 * Was ein Tippen auf eine Zelle des Sitzplans bewirkt. Der Hinweis steht im
 * Menü „Werkzeuge“ unter dem Namen – **eine Zeile**: Die ausführliche
 * Anleitung gehört in die README, das Wichtigste zur Geste in die Fußleiste
 * (`PALETTEN_HINWEIS_ZEILE`).
 */
const PLAN_MODI = [
  {
    key: 'plaetze',
    titel: 'Plätze belegen',
    hinweis: 'wer sitzt hier – festsetzen, freihalten, räumen',
  },
  {
    key: 'bearbeiten',
    titel: 'Raum bearbeiten',
    hinweis: 'mit der Palette am Raster zeichnen',
  },
] as const;

type PlanModus = (typeof PLAN_MODI)[number]['key'];

/**
 * Die beiden Reiter, die kein Raum sind. Das Doppelkreuz hält sie von den
 * Raumschlüsseln auseinander (`01/E01`, `01/E01 (2. Durchgang)`).
 */
const REITER_EINSTELLUNGEN = '#einstellungen';
const REITER_LISTEN = '#listen';

/**
 * Ansicht "Räume" – zugleich die Druckvorlage der Aushänge: pro Raumeinsatz
 * eine Überschrift, der Sitzplan (falls ein Raster vorliegt) und die Tabelle
 * `Sitzplatz → Anfang Nachname`. Im Druck beginnt jeder Aushang auf einer
 * neuen Seite. `schemata` sind die Raster der Einsätze (`einsatzRaster`).
 */
function RaumAushaenge({
  sitzplaetze,
  raeume,
  schemata,
  belegung,
  nummern,
  drehungen,
  anzeige,
}: {
  sitzplaetze: Sitzplatz[];
  raeume: Raum[];
  schemata: Raumschema[];
  belegung: Platzbelegung[];
  nummern: Map<string, number>;
  drehungen: Record<string, number>;
  anzeige: PlanAnzeige;
}) {
  // Am Aushang sucht man seine Platznummer – die steht immer drauf, egal was
  // im Plan am Bildschirm gerade angehakt ist. Gemerkt, damit `React.memo` in
  // den Zellen greift: Ein neues Objekt je Render zeichnete alles neu.
  const anzeigeAushang = useMemo<PlanAnzeige>(
    () => ({ ...anzeige, sitzplatznummer: true }),
    [anzeige],
  );
  // Ein Aushang je Raumeinsatz: Wird derselbe Raum zweimal geprüft, hängen
  // dort zwei Listen – auf beiden steht derselbe Raumname, aber die Zeit der
  // Gruppe und ihre eigenen Sitzplatznummern.
  const einsaetze = [...new Set(sitzplaetze.map((platz) => platz.raumSchluessel))];
  const personen = new Map(sitzplaetze.map((platz) => [platz.matrikelnummer, platz]));
  return (
    <View style={styles.raumTabellen}>
      {einsaetze.map((schluessel) => {
        const plaetzeImRaum = sitzplaetze
          .filter((platz) => platz.raumSchluessel === schluessel)
          .sort((a, b) => a.sitzplatznummer - b.sitzplatznummer);
        const raum = raeume.find((r) => raumSchluessel(r) === schluessel);
        const raumName = raum?.raum ?? plaetzeImRaum[0]?.raum ?? schluessel;
        const zeit = plaetzeImRaum[0]?.reservierteZeit ?? raum?.reservierteZeit ?? '';
        const schema = schemata.find((s) => s.raum === schluessel);
        // Die Plätze des Raums sind die Tische seines Rasters – ohne Raster
        // bleibt nur, wie viele hier tatsächlich sitzen.
        const kapazitaet = schema ? tischzellen(schema).length : plaetzeImRaum.length;
        return (
          <View key={schluessel} style={styles.raumTabelle} {...SEITENUMBRUCH}>
            <Text style={styles.raumUeberschrift}>
              {raumName}
              {zeit ? ` – ${zeit}` : ''} ({plaetzeImRaum.length}/{kapazitaet} Plätze)
            </Text>
            {schema ? (
              <Raumplan
                schema={schema}
                schluessel={schluessel}
                // Gedreht wird die Ansicht des Raums – beide Durchgänge sehen
                // ihn aus derselben Richtung.
                drehungen={drehungen[raumName] ?? 0}
                belegung={belegung.filter((platz) => platz.raum === schluessel)}
                nummern={nummern}
                personen={personen}
                anzeige={anzeigeAushang}
                gitter={false}
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
 * Woher die Teilnehmerliste stammt. `anmeldungenAlle`/`anmeldungenZugelassen`
 * entstehen ohne den Export aus Schritt 3, direkt aus den Anmeldungen in
 * `0_Input_Klausuranmeldungen/`.
 */
type TeilnehmerQuelle =
  | 'liste'
  | 'anmeldungenAlle'
  | 'anmeldungenZugelassen'
  | 'datei'
  | 'beispiel';

/**
 * Schritt 4 des Prüfungs-Workflows: Klausur-Teilnehmende auf Räume verteilen,
 * Sitzplätze vergeben und Aushang-/Aufsichtslisten sowie PDFs erzeugen.
 */
export function RaumzuteilungScreen() {
  // Eingaben.
  const [teilnehmer, setTeilnehmer] = useState<Zulassung[]>([]);
  const [teilnehmerStatus, setTeilnehmerStatus] = useState<string | null>(null);
  /** Aus den Anmeldungen abgeleitet, wenn keine Teilnehmerliste vorliegt. */
  const [anmeldungen, setAnmeldungen] = useState<AnmeldungsPruefung | null>(null);
  const [quelle, setQuelle] = useState<TeilnehmerQuelle | null>(null);
  /** Die Räume, die **diese** Klausur benutzt – ein Raum darf mehrfach dabei sein. */
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
  /** Offener Reiter: Einstellungen, Listen oder ein Raumeinsatz (Schlüssel). */
  const [reiter, setReiter] = useState<string>(REITER_EINSTELLUNGEN);
  const [dateiname, setDateiname] = useState('studierendeZuRaumUndZeitZuordnung.csv');
  const [pdfLaeuft, setPdfLaeuft] = useState(false);
  const [pdfHinweis, setPdfHinweis] = useState<string | null>(null);
  /** Text der Sitzplatz-PDFs – bearbeitbar, mit dem Anfangstext als Vorgabe. */
  const [vorlage, setVorlage] = useState(VORLAGE_SITZPLATZ);
  const [vorlageOffen, setVorlageOffen] = useState(false);

  // Sitzplan im Raum.
  const [schemata, setSchemata] = useState<Raumschema[]>([]);
  const [belegung, setBelegung] = useState<Platzbelegung[]>([]);
  const [planModus, setPlanModus] = useState<PlanModus>('plaetze');
  const [ohnePlanPlatz, setOhnePlanPlatz] = useState<Sitzplatz[]>([]);
  /** Was in den Kästen steht – am Bildschirm und im PDF dasselbe. */
  const [anzeige, setAnzeige] = useState<PlanAnzeige>(PLAN_ANZEIGE_STANDARD);
  /** Wie die freien Tische eines Raums vergeben werden. */
  const [sitzverteilung, setSitzverteilung] = useState<Sitzverteilung>('lesereihenfolge');
  /** Der Platz, dessen Blatt gerade offen ist. */
  const [platzDialog, setPlatzDialog] = useState<
    { schluessel: string; raumName: string; titel: string; zeile: number; spalte: number } | null
  >(null);
  const [personSuche, setPersonSuche] = useState('');

  const aushangRef = useRef<View>(null);

  /**
   * Schema und Belegung liegen zusätzlich in Refs: Beim Ziehen kommen viele
   * Änderungen schnell hintereinander, und jede muss auf dem Ergebnis der
   * vorherigen aufsetzen – der Zustand aus dem Render wäre dafür zu alt.
   * Geschrieben wird immer über die beiden Setter unten, gelesen in
   * Ereignis-Handlern über `.current`, im Render über den Zustand.
   */
  const schemataRef = useRef<Raumschema[]>([]);
  const belegungRef = useRef<Platzbelegung[]>([]);

  const uebernehmeSchemata = (neu: Raumschema[]) => {
    schemataRef.current = neu;
    setSchemata(neu);
  };

  const uebernehmeBelegung = (neu: Platzbelegung[]) => {
    belegungRef.current = neu;
    setBelegung(neu);
  };

  const raeume = zeilenZuRaeumen(zeilen);

  /**
   * Teilnehmerliste direkt aus den Anmeldungen übernehmen – wahlweise alle
   * Angemeldeten oder nur die Zugelassenen. Damit kommt Schritt 4 ohne den
   * Export aus Schritt 3 (`3_Klausur_Teilnehmende_Export/`) aus.
   */
  const uebernimmAnmeldungen = (
    pruefung: AnmeldungsPruefung,
    gewaehlt: 'anmeldungenAlle' | 'anmeldungenZugelassen',
  ) => {
    const liste = gewaehlt === 'anmeldungenAlle' ? pruefung.alle : pruefung.zugelassen;
    setTeilnehmer(liste);
    setQuelle(gewaehlt);
    setTeilnehmerStatus(
      gewaehlt === 'anmeldungenZugelassen'
        ? `${liste.length} von ${pruefung.alle.length} Anmeldungen übernommen – nur die Zugelassenen.`
        : pruefung.alleZugelassen
          ? `${liste.length} Anmeldungen übernommen – alle sind zugelassen.`
          : `${liste.length} Anmeldungen übernommen – darunter ${pruefung.nichtZugelassen.length} ohne Zulassung.`,
    );
  };

  // Eingaben aus dem Projektordner, solange nichts eigenes geladen wurde.
  const projekt = useProjekt();
  useEffect(() => {
    if (teilnehmer.length > 0 || zeilen.length > 0 || anmeldungen !== null) return;
    const liste = projekt.datei('teilnehmer');
    // Die Räume dieser Klausur, falls sie schon einmal gespeichert wurden.
    // Der Bestand des Hauses steckt in den Rastern aus `Raeume/`.
    const klausurDatei = projekt.datei('klausurraeume');
    // Je Raum eine Datei: Gelesen werden alle, nicht nur die erste.
    const schemaTexte = projekt
      .dateienMit('raumschema')
      .map((datei) => datei.text ?? '')
      .filter((text) => text !== '');
    const belegungDatei = projekt.datei('raumbelegung');
    // Ohne Export aus Schritt 3: die Anmeldungen hier selbst prüfen.
    const hisDatei = projekt.datei('hisExport');
    const bestandTexte = projekt
      .dateienMit('zulassungsbestand')
      .map((datei) => datei.text ?? '')
      .filter((text) => text !== '');
    const ausAnmeldungen = !liste?.text && !!hisDatei?.bytes && bestandTexte.length > 0;
    if (!liste?.text && schemaTexte.length === 0 && !klausurDatei?.text && !ausAnmeldungen) return;

    const uebernehmen = async () => {
      if (liste?.text) {
        setTeilnehmer(parseZulassungsliste(liste.text));
        setQuelle('liste');
      } else if (ausAnmeldungen && hisDatei?.bytes) {
        // Kopie, damit der Excel-Reader einen eigenständigen Puffer bekommt.
        const rows = await readXlsxFile(hisDatei.bytes.slice().buffer);
        const pruefung = pruefeAnmeldungen(
          parseHisRows(rows),
          ladeZulassungsBestand(bestandTexte),
        );
        setAnmeldungen(pruefung);
        // Sind alle zugelassen, gibt es nichts zu fragen – direkt übernehmen.
        if (pruefung.alleZugelassen) uebernimmAnmeldungen(pruefung, 'anmeldungenAlle');
      }
      if (klausurDatei?.text) setZeilen(parseRaeume(klausurDatei.text).map(raumZuZeile));
      if (schemaTexte.length > 0) uebernehmeSchemata(parseRaumschemaDateien(schemaTexte));
      if (belegungDatei?.text) uebernehmeBelegung(parseBelegung(belegungDatei.text));
    };
    uebernehmen().catch((e) =>
      setFehler(`Projektdateien konnten nicht gelesen werden: ${String(e)}`),
    );
  }, [projekt, teilnehmer, zeilen, anmeldungen]);

  /**
   * Zu jedem Raumeinsatz sein Raster. Zwei Durchgänge desselben Raums zeigen
   * dasselbe Raster – es ist derselbe Raum –, laufen hier aber unter ihrem
   * eigenen Schlüssel: Belegung und Sitzplatznummern gehören je Durchgang.
   */
  const raster = useMemo(() => einsatzRaster(raeume, schemata), [raeume, schemata]);

  /**
   * Wie viele Plätze jeder Raum hat: die Tische seines Rasters. Gespeichert
   * wird die Zahl nirgends – wer im Plan einen Tisch setzt oder entfernt,
   * ändert sie damit.
   */
  const plaetze = useMemo(() => plaetzeJeRaum(schemata), [schemata]);

  /**
   * Reichen die Räume für die Teilnehmenden? Die Antwort steht über der
   * Raumliste, damit man Räume hinzufügt, **bevor** verteilt wird – vorher
   * fiel erst nach dem Verteilen auf, dass Leute übrig bleiben.
   */
  const bedarf = useMemo(
    () => pruefePlatzbedarf(teilnehmer.length, raeume, plaetze),
    [teilnehmer, raeume, plaetze],
  );

  /** Tischnummern: über alle Einsätze fortlaufend, in Lesereihenfolge des Rasters. */
  const nummern = useMemo(
    () => sitzplatznummern(raster, startnummer ?? 1001),
    [raster, startnummer],
  );

  /**
   * Die Sitzplätze, wie sie angezeigt und exportiert werden: Liegt ein
   * Raumschema vor, gilt die Nummer des Tisches, an dem die Person sitzt.
   */
  const angezeigteSitzplaetze = useMemo(() => {
    if (sitzplaetze === null) return null;
    if (raster.length === 0 || belegung.length === 0) return sitzplaetze;
    return sitzplaetzeMitBelegung(sitzplaetze, belegung, nummern);
  }, [sitzplaetze, raster, belegung, nummern]);

  /** Belegung je Einsatz – einmal gruppiert, damit `React.memo` in den Zellen greift. */
  const belegungJeRaum = useMemo(() => {
    const gruppen = new Map<string, Platzbelegung[]>();
    for (const platz of belegung) {
      const liste = gruppen.get(platz.raum);
      if (liste) liste.push(platz);
      else gruppen.set(platz.raum, [platz]);
    }
    return gruppen;
  }, [belegung]);

  /**
   * Wer hinter einer Matrikelnummer steckt. Schon **vor** der Zuteilung: Sonst
   * stünde in einem Kasten, auf den man jemanden gesetzt hat, nichts drin. Die
   * Namenskürzel sind dieselben wie am Aushang – eindeutig über alle
   * Teilnehmenden.
   */
  const personenJeMatrikel = useMemo(() => {
    const praefixe = eindeutigeNamenspraefixe(teilnehmer);
    const jeMatrikel = new Map<string, Sitzplatz>(
      teilnehmer.map((person) => [
        person.matrikelnummer,
        {
          anfangNachname: praefixe.get(person) ?? person.nachname,
          sitzplatznummer: 0,
          raum: '',
          raumSchluessel: '',
          reservierteZeit: '',
          matrikelnummer: person.matrikelnummer,
          anwesend: '',
          nachname: person.nachname,
          vorname: person.vorname,
          zeitUndRaum: '',
          email: person.email,
        },
      ]),
    );
    for (const platz of angezeigteSitzplaetze ?? []) jeMatrikel.set(platz.matrikelnummer, platz);
    return jeMatrikel;
  }, [teilnehmer, angezeigteSitzplaetze]);

  /**
   * Ohne Zuteilung steht der Plan trotzdem: leere Plätze, damit sich Reserven
   * und Vorgaben schon vorher setzen lassen. Reserven und Vorgaben, die es
   * schon gibt, bleiben dabei stehen.
   */
  useEffect(() => {
    if (sitzplaetze !== null || raster.length === 0) return;
    const ergebnis = verteileAufRaumschemata([], raster, belegungRef.current);
    uebernehmeBelegung(ergebnis.belegung);
    // `raster` ist gemerkt und ändert sich nur mit Räumen oder Rastern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raster, sitzplaetze]);

  const teilnehmerLaden = async (files: File[]) => {
    setFehler(null);
    try {
      const geladen = parseZulassungsliste(await readFileAsText(files[0]));
      setTeilnehmer(geladen);
      setQuelle('datei');
      setTeilnehmerStatus(`${geladen.length} Teilnehmende geladen.`);
    } catch (e) {
      setFehler(`Teilnehmer-CSV konnte nicht gelesen werden: ${String(e)}`);
    }
  };

  const beispielLaden = () => {
    setFehler(null);
    setTeilnehmer(parseZulassungsliste(BEISPIEL_KLAUSUR_TEILNEHMER));
    setZeilen(parseRaeume(BEISPIEL_RAEUME).map(raumZuZeile));
    uebernehmeSchemata(parseRaumschemaDateien(Object.values(BEISPIEL_RAUMSCHEMATA)));
    uebernehmeBelegung([]);
    setQuelle('beispiel');
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

  /**
   * Räume, die sich hinzufügen lassen: der Bestand des Hauses, also jeder
   * Raum, für den in `Raeume/` ein Raster liegt. Die Plätze sind die Tische
   * darin; die reservierte Zeit gehört zur Klausur und wird hier eingetragen.
   */
  const verfuegbareRaeume = useMemo(
    () =>
      schemata
        .filter((schema) => schema.raum !== '')
        .map((schema) => ({
          raum: schema.raum,
          plaetze: tischzellen(schema).length,
          reservierteZeit: '',
        })),
    [schemata],
  );

  /**
   * Einen Raum in die Liste dieser Klausur aufnehmen. Ein zweites Mal
   * derselbe Raum heißt: Er wird zweimal belegt (Gruppe 1 und Gruppe 2) – die
   * reservierte Zeit unterscheidet die beiden, deshalb steht sie zum Ändern da.
   */
  const raumHinzufuegen = (raum: Raum) => {
    setHinweis(null);
    setZeilen((alt) => [...alt, raumZuZeile(raum)]);
  };

  /**
   * Belegung neu aufbauen. `vonVorne` verwirft alles außer Reserven und
   * Vorgaben. Verteilt wird auf die Raster der **Einsätze**: Zwei Durchgänge
   * desselben Raums bekommen zwei Belegungen.
   */
  const belegungAktualisieren = (
    fuerSchemata: Raumschema[],
    fuerSitzplaetze: Sitzplatz[],
    basis: Platzbelegung[],
    vonVorne = false,
  ) => {
    const ergebnis = verteileAufRaumschemata(
      fuerSitzplaetze,
      einsatzRaster(raeume, fuerSchemata),
      vonVorne ? ohneFreieBelegung(basis) : basis,
      sitzverteilung,
    );
    uebernehmeBelegung(ergebnis.belegung);
    setOhnePlanPlatz(ergebnis.ohnePlatz);
    return ergebnis;
  };

  /**
   * Raster eines Raums ändern und die Belegung nachziehen. Wandert ein ganzer
   * Block, wandern die Personen darin mit – sonst stünden die Tische woanders
   * als ihre Belegung. Das Raster gehört zum **Raum**, die Belegung zum
   * **Durchgang**: Wird derselbe Raum zweimal geprüft, ändert sich sein Raster
   * für beide, und die Personen wandern in jedem Durchgang mit.
   */
  const schemaAendern = (
    raum: string,
    aendern: (schema: Raumschema) => Raumschema,
    verschiebung?: Verschiebung,
  ) => {
    const neu = schemataRef.current.map((s) => (s.raum === raum ? aendern(s) : s));
    uebernehmeSchemata(neu);
    let basisBelegung = belegungRef.current;
    if (verschiebung) {
      for (const einsatz of raeume.filter((r) => r.raum === raum)) {
        basisBelegung = verschiebeBelegung(
          basisBelegung,
          raumSchluessel(einsatz),
          verschiebung.bereich,
          verschiebung.dZeile,
          verschiebung.dSpalte,
        );
      }
    }
    if (sitzplaetze) belegungAktualisieren(neu, sitzplaetze, basisBelegung);
    else uebernehmeBelegung(basisBelegung);
  };

  /** Nur das Schema schreiben – für Änderungen, an denen keine Belegung hängt. */
  const nurSchemaAendern = (raum: string, aendern: (schema: Raumschema) => Raumschema) => {
    uebernehmeSchemata(schemataRef.current.map((s) => (s.raum === raum ? aendern(s) : s)));
  };

  const editor = useRaumplanEditor({
    schemata: schemataRef,
    aendere: schemaAendern,
    aendereOhneBelegung: nurSchemaAendern,
    // Raster und Belegung gehören zusammen: Wandert ein Tischblock, wandern
    // die Personen darin mit – ein Schritt zurück nimmt beides zurück.
    zustand: () => ({ schemata: schemataRef.current, belegung: belegungRef.current }),
    setzeZustand: (stand) => {
      uebernehmeSchemata(stand.schemata);
      uebernehmeBelegung(stand.belegung ?? []);
    },
  });

  const zuteilungErstellen = () => {
    setFehler(null);
    setHinweis(null);
    // Wer im Sitzplan festgesetzt wurde, bleibt in seinem Raum.
    const vorgaben = new Map(
      belegungRef.current
        .filter((platz) => platz.vorgabe && platz.matrikelnummer !== '')
        .map((platz) => [platz.matrikelnummer, platz.raum]),
    );
    const ergebnis = erstelleRaumzuteilung(teilnehmer, raeume, {
      modus,
      // Die Plätze kommen aus den Rastern: Ein Raum ohne Raster hat keine,
      // und wer dort landen würde, steht hinterher unter „Kein Platz für“.
      plaetze,
      ersteSitzplatznummer: startnummer ?? 1001,
      vorgaben,
    });
    setSitzplaetze(ergebnis.sitzplaetze);
    setOhnePlatz(ergebnis.ohnePlatz);
    setAnsicht('aushang');
    // Das Ergebnis steht in den Listen – also dorthin.
    setReiter(REITER_LISTEN);

    belegungAktualisieren(schemataRef.current, ergebnis.sitzplaetze, belegungRef.current, true);
  };

  const neuVerteilen = () => {
    if (!sitzplaetze) return;
    editor.merkeStand();
    belegungAktualisieren(schemataRef.current, sitzplaetze, belegungRef.current, true);
    setHinweis('Sitzplan neu verteilt – Reserveplätze und Vorgaben sind geblieben.');
  };

  /** Raster laden – je Raum eine Datei, deshalb ruhig mehrere auf einmal. */
  const schemaLaden = async (files: File[]) => {
    setFehler(null);
    try {
      const geladen = parseRaumschemaDateien(await Promise.all(files.map(readFileAsText)));
      uebernehmeSchemata(geladen);
      if (sitzplaetze) belegungAktualisieren(geladen, sitzplaetze, belegungRef.current);
      setHinweis(`${geladen.length} Raumraster geladen.`);
    } catch (e) {
      setFehler(`Raumschema konnte nicht gelesen werden: ${String(e)}`);
    }
  };

  const belegungLaden = async (files: File[]) => {
    setFehler(null);
    try {
      const geladen = parseBelegung(await readFileAsText(files[0]));
      if (sitzplaetze) {
        belegungAktualisieren(schemataRef.current, sitzplaetze, geladen);
      } else {
        uebernehmeBelegung(geladen);
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
    if (sitzplaetze) belegungAktualisieren(schemataRef.current, sitzplaetze, neu);
    else uebernehmeBelegung(neu);
  };

  /**
   * Zelle im Sitzplan angetippt: Das Blatt zeigt, was dort ist und was sich
   * damit tun lässt. Gemeint ist immer ein Raum**einsatz** – Reserve, Vorgabe
   * und Platzierung gehören zum Durchgang, nicht zum Raum.
   */
  const zellePress = (
    schluessel: string,
    raumName: string,
    titel: string,
    zeile: number,
    spalte: number,
  ) => {
    setHinweis(null);
    setPersonSuche('');
    setPlatzDialog({ schluessel, raumName, titel, zeile, spalte });
  };

  /** Der Platz, über den das Blatt gerade spricht. */
  const dialogPlatz = platzDialog
    ? belegung.find(
        (b) =>
          b.raum === platzDialog.schluessel &&
          b.zeile === platzDialog.zeile &&
          b.spalte === platzDialog.spalte,
      )
    : undefined;
  const dialogSchema = platzDialog
    ? raster.find((s) => s.raum === platzDialog.schluessel)
    : undefined;
  const dialogTyp = dialogSchema?.zellen[platzDialog?.zeile ?? 0]?.[platzDialog?.spalte ?? 0];
  const dialogNummer = platzDialog
    ? nummern.get(platzSchluessel(platzDialog.schluessel, platzDialog.zeile, platzDialog.spalte))
    : undefined;
  const dialogPerson = dialogPlatz?.matrikelnummer
    ? personenJeMatrikel.get(dialogPlatz.matrikelnummer)
    : undefined;

  /** Eine Person auf den Platz des offenen Blatts setzen – als feste Vorgabe. */
  const personSetzen = (matrikelnummer: string) => {
    if (!platzDialog) return;
    editor.merkeStand();
    const gesetzt = setzePerson(
      belegungRef.current,
      platzDialog.schluessel,
      platzDialog.zeile,
      platzDialog.spalte,
      matrikelnummer,
    );
    // Wer von Hand gesetzt wird, bleibt dort: sonst säße er nach dem nächsten
    // Verteilen woanders.
    belegungSetzen(
      setzeVorgabe(gesetzt, platzDialog.schluessel, platzDialog.zeile, platzDialog.spalte, true),
    );
    setPersonSuche('');
  };

  const platzRaeumen = () => {
    if (!platzDialog || !dialogPlatz?.matrikelnummer) return;
    editor.merkeStand();
    belegungSetzen(entfernePerson(belegungRef.current, dialogPlatz.matrikelnummer));
  };

  const vorgabeSchalten = () => {
    if (!platzDialog) return;
    editor.merkeStand();
    uebernehmeBelegung(
      schalteVorgabe(belegungRef.current, platzDialog.schluessel, platzDialog.zeile, platzDialog.spalte),
    );
  };

  const reserveSchalten = () => {
    if (!platzDialog) return;
    editor.merkeStand();
    belegungSetzen(
      schalteReserve(belegungRef.current, platzDialog.schluessel, platzDialog.zeile, platzDialog.spalte),
    );
  };

  /**
   * Wer sich auf diesen Platz setzen lässt: alle Teilnehmenden, gefiltert nach
   * dem, was im Suchfeld steht. Wer schon woanders sitzt, steht mit seinem
   * Platz dabei – dann wird getauscht.
   */
  const kandidaten = (() => {
    const suche = personSuche.trim().toLowerCase();
    const platzJePerson = new Map(
      belegung.filter((b) => b.matrikelnummer !== '').map((b) => [b.matrikelnummer, b]),
    );
    return teilnehmer
      .filter((person) =>
        suche === ''
          ? true
          : `${person.nachname} ${person.vorname} ${person.matrikelnummer}`.toLowerCase().includes(suche),
      )
      .slice(0, 40)
      .map((person) => ({ person, sitztAuf: platzJePerson.get(person.matrikelnummer) }));
  })();

  const aushaengeDrucken = () => {
    setFehler(null);
    setHinweis(null);
    // Gedruckt wird der sichtbare Knoten – der liegt im Reiter „Listen“.
    setReiter(REITER_LISTEN);
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

  // Eine im Projekt gespeicherte Vorlage sticht den Anfangstext: Wer den Text
  // einmal angepasst hat, findet ihn nach dem Neuladen wieder vor.
  const vorlageDatei = projekt
    .dateienMit('pdfVorlage')
    .find((datei) => datei.pfad === VORLAGE_DATEI_SITZPLATZ);
  useEffect(() => {
    if (vorlageDatei?.text) setVorlage(vorlageDatei.text);
  }, [vorlageDatei?.text]);

  const pdfsHerunterladen = async () => {
    if (!angezeigteSitzplaetze) return;
    setFehler(null);
    setPdfHinweis(null);
    setPdfLaeuft(true);
    try {
      const dateien = new Map<string, Uint8Array | string>();
      for (const platz of angezeigteSitzplaetze) {
        dateien.set(`${platz.matrikelnummer}.pdf`, await sitzplatzPdf(platz, vorlage));
      }
      downloadZip('sitzplatz_pdfs.zip', await erstelleZip(dateien));
      // Die eingebaute PDF-Schrift kennt nicht jedes Sonderzeichen; statt am
      // ersten abzubrechen, schreibt sie es um – wer betroffen ist, gehört
      // auf den Bildschirm.
      const umgeschrieben = angezeigteSitzplaetze
        .map((platz) => `${platz.vorname} ${platz.nachname}`)
        .filter((name) => nichtDarstellbareZeichen(name).length > 0)
        .map((name) => `${name} → ${winAnsiText(name)}`);
      if (umgeschrieben.length > 0) {
        setPdfHinweis(
          `Sonderzeichen, die die PDF-Schrift nicht kennt, wurden in ${umgeschrieben.length} Namen ersetzt: ${umgeschrieben.join('; ')}`,
        );
      }
    } catch (e) {
      setFehler(`PDFs konnten nicht erzeugt werden: ${String(e)}`);
    } finally {
      setPdfLaeuft(false);
    }
  };

  /**
   * Rückfrage oben im Screen: Die Teilnehmerliste stammt aus den Anmeldungen,
   * aber nicht alle Angemeldeten sind zugelassen. Sie bleibt stehen, solange
   * die Liste von dort kommt – so lässt sich die Wahl noch umstellen.
   */
  const rueckfrage =
    anmeldungen !== null &&
    !anmeldungen.alleZugelassen &&
    (quelle === null || quelle === 'anmeldungenAlle' || quelle === 'anmeldungenZugelassen')
      ? anmeldungen
      : null;
  const nichtZugelassenListe = (anmeldungen?.nichtZugelassen ?? [])
    .map((person) => `${person.nachname}, ${person.vorname} (${person.matrikelnummer})`)
    .join('; ');

  // Gezählt werden Einsätze: Wird ein Raum zweimal geprüft, sind das zwei.
  /** Adresse der angetippten Zelle in der gedrehten Ansicht, z. B. „C4“. */
  const platzAdresse =
    platzDialog && dialogSchema
      ? bereichName(
          anzeigeBereich(
            { zeile: platzDialog.zeile, spalte: platzDialog.spalte, hoehe: 1, breite: 1 },
            dialogSchema,
            editor.drehungen[platzDialog.raumName] ?? 0,
          ),
        )
      : '';

  /** Zweite Zeile im Blatt: Platznummer und Zeit, soweit vorhanden. */
  const dialogUntertitel = [
    dialogNummer !== undefined ? `Sitzplatz ${dialogNummer}` : null,
    raeume.find((raum) => raumSchluessel(raum) === platzDialog?.schluessel)?.reservierteZeit || null,
  ]
    .filter((teil): teil is string => teil !== null)
    .join(' · ');

  /** Was an dieser Stelle steht, wenn es kein Sitzplatz ist. */
  const dialogBeschreibung = {
    reserve: 'Ein Tisch, der in diesem Raum dauerhaft frei bleibt (Element „Reserve“ in Schritt 5).',
    pult: 'Ein Pult – ein Tisch ohne Sitzplatz, etwa für die Aufsicht.',
    wand: 'Eine Wand.',
    tuer: 'Eine Tür.',
    leer: 'Hier steht nichts. Im Raum bearbeiten lässt sich ein Tisch setzen.',
    tisch: '',
  }[dialogTyp ?? 'leer'];

  /** Überschrift eines Raumeinsatzes – „94/E01“ oder „94/E01 · 2. Durchgang“. */
  const einsatzTitel = (raum: Raum) =>
    (raum.durchgang ?? 1) > 1 ? `${raum.raum} · ${raum.durchgang}. Durchgang` : raum.raum;

  const mitPdfLauf = async (was: string, tun: () => Promise<void>) => {
    setFehler(null);
    setHinweis(null);
    setPdfLaeuft(true);
    try {
      await tun();
    } catch (e) {
      setFehler(`${was} konnte nicht erzeugt werden: ${String(e)}`);
    } finally {
      setPdfLaeuft(false);
    }
  };

  /**
   * Die Sitzpläne als **eine** PDF – je Raumeinsatz eine neue Seite, wie beim
   * Aushang und den Aufsichtslisten. Gezeichnet wird das Bild vom Schirm.
   */
  const sitzplaeneAlsPdf = () =>
    mitPdfLauf('Der Sitzplan', async () => {
      const plaene = raeume
        .map((raum) => ({ raum, schema: schemata.find((s) => s.raum === raum.raum) }))
        .filter((eintrag): eintrag is { raum: Raum; schema: Raumschema } => eintrag.schema !== undefined)
        .map(({ raum, schema }) => {
          const schluessel = raumSchluessel(raum);
          return {
            schema,
            schluessel,
            titel: einsatzTitel(raum),
            untertitel: raum.reservierteZeit,
            belegung: belegungJeRaum.get(schluessel) ?? [],
            nummern,
            personen: personenJeMatrikel,
            drehungen: editor.drehungen[raum.raum] ?? 0,
            anzeige,
          };
        });
      if (plaene.length === 0) return;
      downloadFile('sitzplaene.pdf', await sitzplaenePdf(plaene), 'application/pdf');
      setHinweis(`Sitzpläne als PDF: ${plaene.length} Seite${plaene.length === 1 ? '' : 'n'}.`);
    });

  /** Aushang: je Raumeinsatz eine Seite, nach Namenskürzel sortiert. */
  const aushangAlsPdf = () =>
    mitPdfLauf('Der Aushang', async () => {
      const plaetze = angezeigteSitzplaetze ?? [];
      const abschnitte = raeume
        .map((raum) => {
          const schluessel = raumSchluessel(raum);
          const imRaum = plaetze
            .filter((platz) => platz.raumSchluessel === schluessel)
            .sort((a, b) => a.anfangNachname.localeCompare(b.anfangNachname, 'de'));
          return {
            titel: einsatzTitel(raum),
            untertitel: raum.reservierteZeit,
            spalten: ['Anfang Nachname', 'Sitzplatz'],
            zeilen: imRaum.map((platz) => [platz.anfangNachname, platz.sitzplatznummer]),
          };
        })
        .filter((abschnitt) => abschnitt.zeilen.length > 0);
      downloadFile('aushang.pdf', await tabellenPdf(abschnitte), 'application/pdf');
      setHinweis(`Aushang als PDF: ${abschnitte.length} Räume.`);
    });

  /** Dozentenliste (nach Sitzplatz) und Tutorenliste (nach Nachname). */
  const listeAlsPdf = (fuer: 'dozent' | 'tutor') =>
    mitPdfLauf(fuer === 'dozent' ? 'Die Dozentenliste' : 'Die Tutorenliste', async () => {
      const plaetze = angezeigteSitzplaetze ?? [];
      const sortiert =
        fuer === 'dozent'
          ? [...plaetze].sort((a, b) => a.sitzplatznummer - b.sitzplatznummer)
          : sortByNachname(plaetze);
      const pdf = await tabellenPdf([
        {
          titel: fuer === 'dozent' ? 'Dozentenliste (nach Sitzplatz)' : 'Tutorenliste (nach Nachname)',
          untertitel: raeume.map((raum) => einsatzTitel(raum)).join(', '),
          spalten: ['Sitzplatz', 'Nachname', 'Vorname', 'Matrikelnr.', 'Raum', 'Anwesend'],
          zeilen: sortiert.map((platz) => [
            platz.sitzplatznummer,
            platz.nachname,
            platz.vorname,
            platz.matrikelnummer,
            platz.raum,
            '',
          ]),
        },
      ]);
      downloadFile(`${fuer === 'dozent' ? 'dozentenliste' : 'tutorenliste'}.pdf`, pdf, 'application/pdf');
      setHinweis(`${fuer === 'dozent' ? 'Dozentenliste' : 'Tutorenliste'} als PDF gespeichert.`);
    });
  const anzahlRaeume = angezeigteSitzplaetze
    ? new Set(angezeigteSitzplaetze.map((platz) => platz.raumSchluessel)).size
    : 0;

  /**
   * Ein Reiter je Raumeinsatz – aber nur, wo ein Raster vorliegt: Ohne Raster
   * gibt es keinen Plan zu zeigen. Zwei Durchgänge desselben Raums sind zwei
   * Reiter mit demselben Raster und je eigener Belegung.
   */
  const raumReiter = raeume
    .map((raum) => ({ raum, schema: schemata.find((s) => s.raum === raum.raum) }))
    .filter((eintrag): eintrag is { raum: Raum; schema: Raumschema } => eintrag.schema !== undefined)
    .map(({ raum, schema }) => ({
      key: raumSchluessel(raum),
      titel: einsatzTitel(raum),
      raum,
      schema,
      testID: `raum-reiter-${raumSchluessel(raum)}`,
    }));

  /**
   * Der offene Reiter. Er kann veralten (Raum entfernt, andere Räume geladen);
   * dann stehen wieder die Einstellungen da, statt dass nichts zu sehen ist.
   */
  const offenerRaum = raumReiter.find((eintrag) => eintrag.key === reiter) ?? null;
  const offenerReiter = offenerRaum
    ? offenerRaum.key
    : reiter === REITER_LISTEN
      ? REITER_LISTEN
      : REITER_EINSTELLUNGEN;

  const reiterWechseln = (ziel: string) => {
    setReiter(ziel);
    // Die Auswahl gehört zum vorherigen Plan – im neuen wäre sie geraten.
    editor.setzeAuswahl(null);
  };

  /** Belegung eines Einsatzes in Zahlen – für das Menü „Räume“ und die Fußleiste. */
  const belegungText = (schluessel: string, schema: Raumschema): string => {
    const tische = tischzellen(schema).length;
    const belegt = belegung.filter((p) => p.raum === schluessel && p.matrikelnummer !== '').length;
    const reserven = belegung.filter((p) => p.raum === schluessel && p.reserviert).length;
    return `${belegt}/${tische} belegt${reserven > 0 ? `, ${reserven} Reserve` : ''}`;
  };

  const projektEintrag = useProjektDownloadEintrag(setFehler, 'raum-projekt-download');

  /**
   * Das Menüband: „Datei“, „PDF“, „Werkzeuge“, „Anzeigen“ und „Räume“ – die
   * Menüleiste einer Tabellenkalkulation. Der Screen beschreibt nur, was es zu
   * tun gibt; ob daraus am Rechner ein herunterklappendes Menü wird oder auf
   * dem Handy eine Schublade, entscheidet `Menueleiste`.
   *
   * „Werkzeuge“ und „Anzeigen“ gibt es nur mit offenem Raum: In den Reitern
   * „Einstellungen“ und „Listen“ wäre jeder Eintrag darin grau.
   */
  const menus: MenuGruppe[] = [
    {
      titel: 'Datei',
      testID: 'raum-menue-datei',
      eintraege: [
        { art: 'trenner', titel: 'Speichern' },
        {
          art: 'aktion',
          titel: 'Sitzplan-CSV speichern',
          hinweis: `im Projekt als ${dateiname}`,
          deaktiviert: !angezeigteSitzplaetze,
          onWaehlen: () => {
            if (!angezeigteSitzplaetze) return;
            const csv = sitzplaetzeToCsv(angezeigteSitzplaetze);
            downloadCsv(dateiname, csv);
            projekt.schreibe(dateiname, csv, 'sitzplan');
            setHinweis(`Sitzplan gespeichert – im Projekt als ${dateiname}.`);
          },
          testID: 'raum-download',
        },
        {
          art: 'aktion',
          titel: 'Räume der Klausur speichern',
          hinweis: 'klausurraeume.csv – nicht der Bestand des Hauses',
          onWaehlen: () => {
            // Nicht in `Raeume/`: Dort steht der Bestand des Hauses, hier die
            // Auswahl für diese eine Klausur (mit ihren Durchgängen).
            const csv = raeumeToCsv(raeume);
            downloadCsv('klausurraeume.csv', csv);
            projekt.schreibe('klausurraeume.csv', csv, 'klausurraeume');
            setHinweis(
              'Räume der Klausur gespeichert – im Projekt unter 4_Raumzuteilung_Export/klausurraeume.csv.',
            );
          },
          testID: 'raum-speichern',
        },
        {
          art: 'aktion',
          titel: 'Raster als CSV speichern',
          hinweis: 'je Raum eine Datei in Raeume/',
          deaktiviert: schemata.length === 0,
          onWaehlen: async () => {
            // Je Raum eine Datei; im Projekt ersetzen sie den bisherigen
            // Bestand, damit kein Raster liegen bleibt, das es nicht mehr gibt.
            const dateien = raumschemaDateien(schemata);
            projekt.ersetze('raumschema', dateien);
            const namen = [...dateien.keys()];
            if (namen.length === 1) {
              downloadCsv(namen[0], dateien.get(namen[0]) ?? '');
            } else {
              const inhalte = new Map<string, Uint8Array | string>(
                [...dateien].map(([name, csv]) => [`Raeume/${name}`, csv]),
              );
              downloadZip('raumschema.zip', await erstelleZip(inhalte));
            }
            setHinweis(`Raster gespeichert – je Raum eine Datei in Raeume/: ${namen.join(', ')}.`);
          },
          testID: 'raum-schema-speichern',
        },
        {
          art: 'aktion',
          titel: 'Belegung als CSV speichern',
          hinweis: 'wer wo sitzt, samt Reserven und Vorgaben',
          deaktiviert: belegung.length === 0,
          onWaehlen: () => {
            const csv = belegungToCsv(belegung, angezeigteSitzplaetze ?? [], nummern);
            downloadCsv('raumbelegung.csv', csv);
            projekt.schreibe('raumbelegung.csv', csv, 'raumbelegung');
            setHinweis('Belegung gespeichert – im Projekt unter 4_Raumzuteilung_Export/.');
          },
          testID: 'raum-belegung-speichern',
        },
        { art: 'trenner', titel: 'Laden' },
        {
          art: 'datei',
          titel: 'Teilnehmer-CSV laden',
          accept: '.csv',
          onDateien: teilnehmerLaden,
          testID: 'raum-teilnehmer-laden',
        },
        {
          art: 'datei',
          titel: 'Räume-CSV laden',
          accept: '.csv',
          onDateien: raeumeLaden,
          testID: 'raum-raeume-laden',
        },
        {
          art: 'datei',
          titel: 'Raumschema-CSVs laden',
          hinweis: 'mehrere auf einmal – je Raum eine Datei',
          accept: '.csv',
          mehrere: true,
          onDateien: schemaLaden,
          testID: 'raum-schema-laden',
        },
        {
          art: 'datei',
          titel: 'Belegung-CSV laden',
          accept: '.csv',
          onDateien: belegungLaden,
          testID: 'raum-belegung-laden',
        },
        {
          art: 'aktion',
          titel: 'Beispieldaten laden',
          onWaehlen: beispielLaden,
          testID: 'raum-beispiel',
        },
        { art: 'trenner', titel: 'Projekt' },
        projektEintrag,
      ],
    },
    {
      titel: 'PDF',
      testID: 'raum-menue-pdf',
      eintraege: [
        { art: 'trenner', titel: pdfLaeuft ? 'PDF läuft …' : 'Für den Raum' },
        {
          art: 'aktion',
          titel: 'Sitzpläne als PDF',
          hinweis: 'alle Räume in einer Datei, je Einsatz eine Seite',
          deaktiviert: pdfLaeuft || raster.length === 0,
          onWaehlen: sitzplaeneAlsPdf,
          testID: 'raum-sitzplan-pdf',
        },
        {
          art: 'aktion',
          titel: 'Aushang als PDF',
          hinweis: 'Sitzplatz → Anfang Nachname, je Raum eine Seite',
          deaktiviert: pdfLaeuft || !angezeigteSitzplaetze,
          onWaehlen: aushangAlsPdf,
          testID: 'raum-aushang-pdf',
        },
        { art: 'trenner', titel: 'Für die Aufsicht' },
        {
          art: 'aktion',
          titel: 'Dozentenliste als PDF',
          deaktiviert: pdfLaeuft || !angezeigteSitzplaetze,
          onWaehlen: () => listeAlsPdf('dozent'),
          testID: 'raum-dozent-pdf',
        },
        {
          art: 'aktion',
          titel: 'Tutorenliste als PDF',
          deaktiviert: pdfLaeuft || !angezeigteSitzplaetze,
          onWaehlen: () => listeAlsPdf('tutor'),
          testID: 'raum-tutor-pdf',
        },
        { art: 'trenner', titel: 'Für die Studierenden' },
        {
          art: 'aktion',
          titel: 'Sitzplatz-PDFs als ZIP',
          hinweis: 'je Person ein Schreiben',
          deaktiviert: pdfLaeuft || !angezeigteSitzplaetze,
          onWaehlen: pdfsHerunterladen,
          testID: 'raum-download-pdfs',
        },
        {
          art: 'aktion',
          titel: 'Text der PDFs anpassen',
          hinweis: 'die Vorlage der Sitzplatz-Schreiben',
          onWaehlen: () => setVorlageOffen(true),
          testID: 'raum-vorlage-oeffnen',
        },
        { art: 'trenner' },
        {
          art: 'aktion',
          titel: 'Ansicht drucken',
          hinweis: 'was gerade im Reiter „Listen“ steht',
          deaktiviert: !angezeigteSitzplaetze,
          onWaehlen: aushaengeDrucken,
          testID: 'raum-aushaenge-pdf',
        },
      ],
    },
    ...(offenerRaum
      ? [
          {
            titel: 'Werkzeuge',
            // Was ein Tippen in den Plan bewirkt, steht hinter dem Namen –
            // vorher war es die hervorgehobene Kachel der Palette.
            wert: planModus === 'bearbeiten' ? werkzeugTitel(editor) : 'Plätze belegen',
            testID: 'raum-menue-werkzeuge',
            eintraege: [
              { art: 'trenner', titel: 'Was ein Tippen tut' } as MenuEintrag,
              ...PLAN_MODI.map(
                (modus): MenuEintrag => ({
                  art: 'aktion',
                  titel: modus.titel,
                  hinweis: modus.hinweis,
                  gewaehlt: planModus === modus.key,
                  onWaehlen: () => setPlanModus(modus.key),
                  testID: `raum-modus-${modus.key}`,
                }),
              ),
              ...(planModus === 'bearbeiten'
                ? [{ art: 'trenner', titel: 'Palette' } as MenuEintrag, ...paletteEintraege(editor)]
                : []),
              ...rasterEintraege(editor, offenerRaum.raum.raum, planModus === 'bearbeiten'),
              { art: 'trenner', titel: 'Zuteilung' } as MenuEintrag,
              {
                art: 'aktion',
                titel: 'Sitzplan neu verteilen',
                hinweis: 'verteilt noch einmal – Vorgaben und Reserven bleiben',
                deaktiviert: !sitzplaetze,
                onWaehlen: neuVerteilen,
                testID: 'raum-neu-verteilen',
              } as MenuEintrag,
            ],
          },
          {
            // Was in den Kästen steht – dasselbe am Bildschirm und im PDF.
            titel: 'Anzeigen',
            testID: 'raum-menue-anzeige',
            eintraege: [
              {
                art: 'schalter',
                titel: 'Namenskürzel',
                wert: anzeige.namensPraefix,
                onChange: (wert: boolean) => setAnzeige((alt) => ({ ...alt, namensPraefix: wert })),
                testID: 'raum-anzeige-name',
              } as MenuEintrag,
              {
                art: 'schalter',
                titel: 'Matrikelnummer',
                wert: anzeige.matrikelnummer,
                onChange: (wert: boolean) => setAnzeige((alt) => ({ ...alt, matrikelnummer: wert })),
                testID: 'raum-anzeige-matrikel',
              } as MenuEintrag,
              {
                art: 'schalter',
                titel: 'Sitzplatznummer',
                wert: anzeige.sitzplatznummer,
                onChange: (wert: boolean) =>
                  setAnzeige((alt) => ({ ...alt, sitzplatznummer: wert })),
                testID: 'raum-anzeige-nummer',
              } as MenuEintrag,
              {
                art: 'schalter',
                titel: 'Pult beschriften',
                wert: anzeige.pultText,
                onChange: (wert: boolean) => setAnzeige((alt) => ({ ...alt, pultText: wert })),
                testID: 'raum-anzeige-pult',
              } as MenuEintrag,
            ],
          },
        ]
      : []),
    {
      titel: 'Räume',
      wert: offenerRaum
        ? offenerRaum.titel
        : offenerReiter === REITER_LISTEN
          ? 'Listen'
          : 'Einstellungen',
      testID: 'raum-menue-raeume',
      eintraege: [
        { art: 'trenner', titel: 'Übersicht' },
        {
          art: 'aktion',
          titel: 'Einstellungen',
          hinweis: 'Räume der Klausur, Verteilung, Teilnehmende',
          gewaehlt: offenerReiter === REITER_EINSTELLUNGEN,
          onWaehlen: () => reiterWechseln(REITER_EINSTELLUNGEN),
          testID: 'raum-reiter-einstellungen',
        },
        {
          art: 'aktion',
          titel: 'Listen',
          hinweis: 'Aushang, Dozentenliste, Tutorenliste, Räume',
          gewaehlt: offenerReiter === REITER_LISTEN,
          onWaehlen: () => reiterWechseln(REITER_LISTEN),
          testID: 'raum-reiter-listen',
        },
        { art: 'trenner', titel: 'Raumeinsätze' },
        ...(raumReiter.length === 0
          ? [
              {
                art: 'aktion',
                titel: 'Noch kein Raumplan',
                hinweis: 'ohne Raster gibt es keinen Plan – Raster laden oder in Schritt 5 anlegen',
                deaktiviert: true,
                onWaehlen: () => {},
              } as MenuEintrag,
            ]
          : raumReiter.map(
              (eintrag): MenuEintrag => ({
                art: 'aktion',
                titel: eintrag.titel,
                hinweis: belegungText(eintrag.key, eintrag.schema),
                gewaehlt: eintrag.key === offenerReiter,
                onWaehlen: () => reiterWechseln(eintrag.key),
                testID: eintrag.testID,
              }),
            )),
      ],
    },
  ];

  /**
   * Links in der Fußleiste – die Statuszeile: erst die Meldung, dann der Stand
   * des offenen Reiters. Beides nebeneinander, damit eine Meldung nicht
   * dauerhaft verdeckt, wie viele Plätze gerade belegt sind.
   */
  const fussText = [
    fehler,
    fehler ? null : (hinweis ?? pdfHinweis),
    offenerRaum
      ? `${belegungText(offenerRaum.key, offenerRaum.schema)} · ${rasterText(editor, offenerRaum.schema)}` +
        (planModus === 'bearbeiten' ? ` · ${PALETTEN_HINWEIS_ZEILE}` : '')
      : angezeigteSitzplaetze
        ? `${angezeigteSitzplaetze.length} Sitzplätze in ${anzahlRaeume} Räumen vergeben`
        : `${teilnehmer.length} Teilnehmende · ${raeume.length} Raumeinsätze mit höchstens ${bedarf.plaetze} Plätzen – noch keine Zuteilung`,
  ]
    .filter((teil): teil is string => !!teil)
    .join(' · ');

  return (
    <>
      <Arbeitsflaeche
        kopf={<Menueleiste menus={menus} testID="raum-menue" />}
        fuss={
          <PlanFuss
            editor={editor}
            text={fussText}
            ansichtZeigen={offenerRaum !== null}
            testID="raum-fuss"
          />
        }
        testID="Raumzuteilung-screen"
      >
        {(hoehe) =>
          offenerRaum ? (
            <RaumplanBuehne
              key={offenerRaum.key}
              editor={editor}
              schema={offenerRaum.schema}
              schluessel={offenerRaum.key}
              titel={offenerRaum.titel}
              hoehe={hoehe}
              bearbeiten={planModus === 'bearbeiten'}
              belegung={belegungJeRaum.get(offenerRaum.key) ?? []}
              nummern={nummern}
              personen={personenJeMatrikel}
              anzeige={anzeige}
              onZellePress={(zeile, spalte) =>
                zellePress(offenerRaum.key, offenerRaum.raum.raum, offenerRaum.titel, zeile, spalte)
              }
            />
          ) : offenerReiter === REITER_LISTEN ? (
            <Reiterinhalt testID="raum-listen">
              <Section title="Ansichten" testID="raum-ansichten">
                {angezeigteSitzplaetze ? (
                  <>
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
                    {/* Die Aushänge bleiben gerendert, solange die Ansicht sie zeigt –
                        der Druck nimmt genau diesen sichtbaren Knoten. */}
                    {ansicht === 'raeume' ? (
                      <View ref={aushangRef}>
                        <RaumAushaenge
                          sitzplaetze={angezeigteSitzplaetze}
                          raeume={raeume}
                          schemata={raster}
                          belegung={belegung}
                          nummern={nummern}
                          // Gedreht wird im Editor je Raum; der Aushang zeigt ihn aus
                          // derselben Richtung – sonst stünde auf dem Papier ein
                          // anderer Raum als auf dem Bildschirm.
                          drehungen={editor.drehungen}
                          anzeige={anzeige}
                        />
                      </View>
                    ) : null}
                  </>
                ) : (
                  <StatusText kind="info">
                    Noch keine Zuteilung – unter „Einstellungen“ die Teilnehmenden und die Räume
                    prüfen und „Zuteilung erstellen“ wählen.
                  </StatusText>
                )}
              </Section>
            </Reiterinhalt>
          ) : (
            <Reiterinhalt testID="raum-einstellungen">
              {rueckfrage ? (
                <Section title="Nicht alle Angemeldeten sind zugelassen" testID="raum-rueckfrage">
                  <StatusText kind="error" testID="raum-rueckfrage-text">
                    {`${rueckfrage.nichtZugelassen.length} von ${rueckfrage.alle.length} Anmeldungen aus 0_Input_Klausuranmeldungen/ haben keine Zulassung: ${nichtZugelassenListe}`}
                  </StatusText>
                  <Text style={styles.hinweis}>
                    Womit soll weitergearbeitet werden? Der Export aus Schritt 3
                    (3_Klausur_Teilnehmende_Export/) ist dafür nicht nötig – wer eine eigene Liste
                    hat, lädt sie oben als Teilnehmer-CSV.
                  </Text>
                  <View style={styles.buttonZeile}>
                    <AppButton
                      title={`Nur die ${rueckfrage.zugelassen.length} Zugelassenen verwenden`}
                      variant={quelle === 'anmeldungenZugelassen' ? 'primary' : 'secondary'}
                      onPress={() => uebernimmAnmeldungen(rueckfrage, 'anmeldungenZugelassen')}
                      testID="raum-nur-zugelassene"
                    />
                    <AppButton
                      title={`Trotzdem alle ${rueckfrage.alle.length} Anmeldungen verwenden`}
                      variant={quelle === 'anmeldungenAlle' ? 'primary' : 'secondary'}
                      onPress={() => uebernimmAnmeldungen(rueckfrage, 'anmeldungenAlle')}
                      testID="raum-alle-anmeldungen"
                    />
                  </View>
                </Section>
              ) : null}

              <Section title="Teilnehmende">
                <Text style={styles.hinweis}>
                  Die Liste kommt aus Schritt 3 (allowedStudents.csv) oder – wenn dort nichts
                  liegt – direkt aus den geprüften Anmeldungen. Eine eigene Datei sticht beides:
                  Sie lässt sich hier auswählen, wie in den Schritten davor (und weiterhin oben
                  unter „Datei“).
                </Text>
                <FilePickerButton
                  label="allowedStudents.csv auswählen"
                  accept=".csv"
                  onFiles={teilnehmerLaden}
                  testID="raum-teilnehmer-datei"
                />
                {teilnehmerStatus ? <StatusText kind="info">{teilnehmerStatus}</StatusText> : null}
                <ProjektQuelle rolle="teilnehmer" testID="raum-quelle-teilnehmer" />
                {anmeldungen !== null ? (
                  <>
                    <ProjektQuelle rolle="hisExport" testID="raum-quelle-his" />
                    <ProjektQuelle rolle="zulassungsbestand" alle testID="raum-quelle-zulassungen" />
                  </>
                ) : null}
              </Section>

              <Section title="Räume der Klausur" testID="raum-raeume">
                <Text style={styles.hinweis}>
                  Die Räume selbst und ihre Raster gehören zu keiner einzelnen Klausur: Sie liegen
                  als Bestand in <Text style={styles.pfad}>Raeume/</Text> und werden in Schritt 5
                  gepflegt. Hier steht, welche davon <Text style={styles.pfad}>diese</Text> Klausur
                  benutzt – jeder davon bekommt oben einen eigenen Reiter.
                </Text>
                <Text style={styles.hinweis}>
                  Denselben Raum mehrfach hinzufügen heißt: Er wird mehrfach belegt – etwa Gruppe 1
                  vormittags und Gruppe 2 nachmittags. Beide Durchgänge haben dasselbe Raster, aber
                  je eigene Belegung und eigene Sitzplatznummern; auseinander hält sie die
                  reservierte Zeit.
                </Text>
                <Text style={styles.hinweis}>
                  Wie viele Plätze ein Raum hat, steht in seinem Raster (die Tische darin) und
                  wird hier nicht getippt. Räume hinzufügen, bis genug Plätze für alle
                  Teilnehmenden da sind – solange es zu wenige sind, sagt die Zeile darunter, wie
                  viele fehlen.
                </Text>
                <PlatzBedarf bedarf={bedarf} testID="raum-platzbedarf" />
                {verfuegbareRaeume.length > 0 ? (
                  <View style={styles.buttonZeile} testID="raum-verfuegbar">
                    <Text style={styles.hinweis}>Hinzufügen:</Text>
                    {verfuegbareRaeume.map((raum) => (
                      <AppButton
                        key={raum.raum}
                        title={`+ ${raum.raum} (${raum.plaetze})`}
                        variant="secondary"
                        onPress={() => raumHinzufuegen(raum)}
                        testID={`raum-hinzufuegen-${raum.raum}`}
                      />
                    ))}
                  </View>
                ) : null}
                <RaumListe
                  zeilen={zeilen}
                  plaetze={plaetze}
                  onChange={setZeilen}
                  mitDurchgang
                  hinzufuegenTitel="Leere Zeile hinzufügen"
                />
                <ProjektQuelle rolle="klausurraeume" testID="raum-quelle-klausurraeume" />
                <ProjektQuelle rolle="raumschema" alle testID="raum-quelle-schema" />
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
                <Text style={styles.hinweis}>
                  Und wie die Plätze <Text style={styles.pfad}>innerhalb</Text> eines Raums vergeben
                  werden: der Reihe nach oder so weit auseinander wie möglich. Beim Abstand zählt
                  ein Platz zur Seite doppelt (dort schaut man direkt aufs Nachbarblatt), und zwei
                  sitzen lieber hintereinander als schräg versetzt.
                </Text>
                <View style={styles.buttonZeile}>
                  <AppButton
                    title="Der Reihe nach"
                    variant={sitzverteilung === 'lesereihenfolge' ? 'primary' : 'secondary'}
                    onPress={() => setSitzverteilung('lesereihenfolge')}
                    testID="raum-sitz-reihe"
                  />
                  <AppButton
                    title="Größtmöglicher Abstand"
                    variant={sitzverteilung === 'abstand' ? 'primary' : 'secondary'}
                    onPress={() => setSitzverteilung('abstand')}
                    testID="raum-sitz-abstand"
                  />
                </View>
                <PlatzBedarf bedarf={bedarf} testID="raum-platzbedarf-zuteilung" />
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
                {ohnePlanPlatz.length > 0 ? (
                  <StatusText kind="error">
                    {`Ohne Tisch im Sitzplan: ${ohnePlanPlatz.map((p) => `${p.vorname} ${p.nachname}`).join(', ')} – im Reiter des Raums unter „Raum bearbeiten“ mehr Tische setzen.`}
                  </StatusText>
                ) : null}
                {fehler ? <StatusText kind="error">{fehler}</StatusText> : null}
                {hinweis ? <StatusText kind="info">{hinweis}</StatusText> : null}
              </Section>

              <Section title="Sitzplan im Raum" testID="raum-sitzplan">
                <Text style={styles.hinweis}>
                  Jeder Raumeinsatz hat oben einen eigenen Reiter. Der Sitzplan zeigt, wo im Raum
                  die Tische stehen – schon bevor verteilt wird. Die Sitzplatznummer gehört zum
                  Tisch: Wer den Platz wechselt, bekommt die Nummer des neuen Tisches.
                </Text>
                {PLAN_MODI.map((m) => (
                  <Text key={m.key} style={styles.hinweis}>
                    <Text style={styles.pfad}>{m.titel}</Text> · {m.hinweis}
                  </Text>
                ))}
                {raster.length === 0 ? (
                  <StatusText kind="info">
                    Noch kein Raster – Räume hinzufügen oder in Schritt 5 anlegen.
                  </StatusText>
                ) : null}
              </Section>

              <Section title="Sitzplatz-PDFs in Stud.IP bereitstellen" testID="raum-studip">
                <Text style={styles.hinweis}>
                  Unter „PDF“ entsteht je Person ein Schreiben mit ihrem Sitzplatz, benannt nach
                  ihrer Matrikelnummer. So kommt es zu den Studierenden, ohne dass jemand die
                  Plätze der anderen sieht:
                </Text>
                <StudipEinsicht art="sitzplatz" testID="raum-studip-schritte" />
              </Section>

              <Section title="Dateiname des Sitzplans">
                <LabeledTextInput
                  label="Dateiname"
                  value={dateiname}
                  onChangeText={setDateiname}
                  testID="raum-dateiname"
                />
                <Text style={styles.hinweis}>
                  Unter diesem Namen legt „Sitzplan-CSV speichern“ die Datei ab. Was in den
                  Sitzplatz-PDFs steht, lässt sich als Markdown mit Platzhaltern anpassen – der
                  Text wird im Projekt gespeichert und liegt in Vorlagen/.
                </Text>
                {vorlage !== VORLAGE_SITZPLATZ ? (
                  <StatusText kind="info" testID="raum-vorlage-geaendert">
                    Der Text weicht vom Standardtext ab.
                  </StatusText>
                ) : null}
                {pdfHinweis ? (
                  <StatusText kind="info" testID="raum-pdf-sonderzeichen">
                    {pdfHinweis}
                  </StatusText>
                ) : null}
                <ProjektDownload
                  hinweis="Enthält Räume und Raumschema in Raeume/ sowie Sitzplan und Belegung in 4_Raumzuteilung_Export/."
                  testID="raum-projekt-download-gross"
                />
              </Section>
            </Reiterinhalt>
          )
        }
      </Arbeitsflaeche>

      <VorlagenModal
        offen={vorlageOffen}
        titel="Text der Sitzplatz-PDFs"
        untertitel="Markdown mit Platzhaltern – gilt für alle erzeugten Schreiben"
        vorlage={vorlage}
        standard={VORLAGE_SITZPLATZ}
        platzhalter={PLATZHALTER_SITZPLATZ}
        werte={
          angezeigteSitzplaetze?.[0] ? sitzplatzWerte(angezeigteSitzplaetze[0]) : BEISPIEL_WERTE
        }
        onSpeichern={(neu) => {
          setVorlage(neu);
          projekt.schreibe(VORLAGE_NAME_SITZPLATZ, neu, 'pdfVorlage');
        }}
        onSchliessen={() => setVorlageOffen(false)}
        testID="raum-vorlage"
      />

      {/* Was an einem Platz zu tun ist, steht im Blatt – nicht in einem Modus,
          den man vorher wählen muss. */}
      <BlattModal
        offen={platzDialog !== null}
        titel={platzDialog ? `${platzDialog.titel} · ${platzAdresse}` : ''}
        untertitel={dialogUntertitel}
        onSchliessen={() => setPlatzDialog(null)}
        testID="raum-platz-blatt"
      >
        {platzDialog && dialogTyp === 'tisch' ? (
          <>
            {dialogPerson ? (
              <View style={styles.blattBlock}>
                <Text style={styles.blattTitel} testID="raum-platz-person">
                  {`${dialogPerson.nachname}, ${dialogPerson.vorname}`}
                </Text>
                <Text style={styles.hinweis}>
                  {`Matrikelnummer ${dialogPerson.matrikelnummer}${dialogPlatz?.vorgabe ? ' · fest gesetzt' : ''}`}
                </Text>
                <View style={styles.buttonZeile}>
                  <AppButton
                    title={dialogPlatz?.vorgabe ? 'Vorgabe lösen' : 'Hier festsetzen'}
                    variant="secondary"
                    onPress={vorgabeSchalten}
                    testID="raum-platz-vorgabe"
                  />
                  <AppButton
                    title="Platz räumen"
                    variant="secondary"
                    onPress={platzRaeumen}
                    testID="raum-platz-raeumen"
                  />
                </View>
              </View>
            ) : (
              <Text style={styles.hinweis}>
                {dialogPlatz?.reserviert
                  ? 'Dieser Platz wird für diese Klausur freigehalten.'
                  : 'Hier sitzt noch niemand.'}
              </Text>
            )}

            <View style={styles.buttonZeile}>
              <AppButton
                title={dialogPlatz?.reserviert ? 'Reserve aufheben' : 'Platz freihalten (Reserve)'}
                variant="secondary"
                onPress={reserveSchalten}
                testID="raum-platz-reserve"
              />
            </View>
            <Text style={styles.hinweis}>
              Eine Reserve gilt nur für diese Klausur – sie steht in der Belegung, nicht im Raster
              des Raums. Dauerhaft freie Tische bekommen in Schritt 5 das Element „Reserve“.
            </Text>

            {!dialogPlatz?.reserviert ? (
              <View style={styles.blattBlock}>
                <Text style={styles.blattTitel}>Jemanden hierher setzen</Text>
                <Text style={styles.hinweis}>
                  Wer hier gesetzt wird, bleibt hier – auch beim nächsten Verteilen. Sitzt die
                  Person schon woanders, tauschen die beiden Plätze.
                </Text>
                <LabeledTextInput
                  label="Suchen"
                  value={personSuche}
                  onChangeText={setPersonSuche}
                  placeholder="Nachname, Vorname oder Matrikelnummer"
                  testID="raum-platz-suche"
                />
                {teilnehmer.length === 0 ? (
                  <StatusText kind="info">Noch keine Teilnehmenden geladen.</StatusText>
                ) : (
                  kandidaten.map(({ person, sitztAuf }) => (
                    <AppButton
                      key={person.matrikelnummer}
                      title={`${person.nachname}, ${person.vorname} (${person.matrikelnummer})${
                        sitztAuf ? ` – sitzt auf ${sitztAuf.raum}` : ''
                      }`}
                      variant="secondary"
                      onPress={() => personSetzen(person.matrikelnummer)}
                      testID={`raum-platz-person-${person.matrikelnummer}`}
                    />
                  ))
                )}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.hinweis}>{dialogBeschreibung}</Text>
        )}
      </BlattModal>
    </>
  );
}

const styles = StyleSheet.create({
  buttonZeile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  blattBlock: { gap: spacing.sm },
  blattTitel: { fontSize: 16, fontWeight: '700', color: colors.text },
  raumTabellen: { gap: spacing.md },
  raumTabelle: { gap: spacing.xs },
  raumUeberschrift: { fontSize: 15, fontWeight: '600', color: colors.text },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  pfad: { fontWeight: '600', color: colors.text },
});
