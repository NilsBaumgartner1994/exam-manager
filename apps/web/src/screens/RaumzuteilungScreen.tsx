import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import readXlsxFile from 'read-excel-file';
import {
  AnmeldungsPruefung,
  Bereich,
  bereichAus,
  belegungToCsv,
  einsatzRaster,
  erstelleRaumzuteilung,
  erstelleZip,
  ladeZulassungsBestand,
  nichtDarstellbareZeichen,
  ohneFreieBelegung,
  parseBelegung,
  parseHisRows,
  parseRaeume,
  parseRaumschemaDateien,
  parseZulassungsliste,
  Platzbelegung,
  pruefeAnmeldungen,
  Raum,
  Raumschema,
  raeumeToCsv,
  raumSchluessel,
  raumschemaDateien,
  schalteReserve,
  schalteVorgabe,
  setzePerson,
  Sitzplatz,
  sitzplaetzeMitBelegung,
  sitzplaetzeToCsv,
  sitzplatznummern,
  sitzplatzPdf,
  sortByNachname,
  standardRaumschema,
  tischzellen,
  verschiebeBelegung,
  verteileAufRaumschemata,
  Verteilmodus,
  winAnsiText,
  Zulassung,
} from '@exam-manager/core';
import {
  AppButton,
  DataTable,
  FilePickerButton,
  LabeledNumberInput,
  LabeledTextInput,
  PlanLeiste,
  ProjektDownload,
  ProjektQuelle,
  RaumListe,
  RaumPalette,
  Raumplan,
  RaumplanFlaeche,
  RaumplanKarte,
  raumZuZeile,
  ScreenContainer,
  Section,
  StatusText,
  useRaumplanEditor,
  zeilenZuRaeumen,
  type RaumZeile,
  type Verschiebung,
} from '../components';
import { downloadCsv, downloadZip, readFileAsText } from '../files';
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

/** Was ein Tippen auf eine Zelle des Sitzplans bewirkt. */
const PLAN_MODI = [
  { key: 'verschieben', titel: 'Platzieren', hinweis: 'Person antippen, dann den Zieltisch antippen. Sitzt dort jemand, tauschen die beiden.' },
  { key: 'reserve', titel: 'Reserve', hinweis: 'Tisch antippen, um ihn als Reserveplatz frei zu halten (nochmal antippen hebt es auf).' },
  { key: 'vorgabe', titel: 'Vorgabe', hinweis: 'Besetzten Tisch antippen: Die Person bleibt dort, auch wenn neu verteilt wird.' },
  { key: 'bearbeiten', titel: 'Raum bearbeiten', hinweis: 'Element aus der Palette auf eine Zelle ziehen oder antippen und dann im Plan malen. Mit „Auswählen“ verschiebst du einen Block; am blauen Griff an der unteren Ecke ziehst du ihn über mehrere Felder auf. Mit „Text“ (oder „Zellen verbinden“) entsteht über den ausgewählten Feldern ein Feld zum Reinschreiben – es beschriftet auch Tür, Pult oder eine Tischreihe, ohne sie zu ersetzen. Rückgängig geht mit Strg/⌘ + Z.' },
] as const;

type PlanModus = (typeof PLAN_MODI)[number]['key'];

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
}: {
  sitzplaetze: Sitzplatz[];
  raeume: Raum[];
  schemata: Raumschema[];
  belegung: Platzbelegung[];
  nummern: Map<string, number>;
  drehungen: Record<string, number>;
}) {
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
        const kapazitaet = raum ? raum.plaetze : plaetzeImRaum.length;
        const zeit = plaetzeImRaum[0]?.reservierteZeit ?? raum?.reservierteZeit ?? '';
        const schema = schemata.find((s) => s.raum === schluessel);
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
  /** Bestand des Hauses (aus `Raeume/`): daraus werden Räume hinzugefügt. */
  const [katalog, setKatalog] = useState<Raum[]>([]);
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
  const [pdfHinweis, setPdfHinweis] = useState<string | null>(null);

  // Sitzplan im Raum.
  const [schemata, setSchemata] = useState<Raumschema[]>([]);
  const [belegung, setBelegung] = useState<Platzbelegung[]>([]);
  const [planModus, setPlanModus] = useState<PlanModus>('verschieben');
  const [ausgewaehlt, setAusgewaehlt] = useState<{ raum: string; matrikelnummer: string } | null>(null);
  const [ohnePlanPlatz, setOhnePlanPlatz] = useState<Sitzplatz[]>([]);

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
    // Bestand des Hauses und – falls schon einmal gespeichert – die Räume
    // dieser Klausur. Ohne die zweite Datei dient der Bestand als Vorschlag.
    const raumDatei = projekt.datei('raeume');
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
    if (!liste?.text && !raumDatei?.text && !klausurDatei?.text && !ausAnmeldungen) return;

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
      if (raumDatei?.text) setKatalog(parseRaeume(raumDatei.text));
      // Die Räume dieser Klausur, falls schon einmal gespeichert – sonst
      // dient der Bestand des Hauses als Vorschlag.
      const gewaehlt = klausurDatei?.text ?? raumDatei?.text;
      if (gewaehlt) setZeilen(parseRaeume(gewaehlt).map(raumZuZeile));
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

  const personenJeMatrikel = useMemo(
    () => new Map((angezeigteSitzplaetze ?? []).map((platz) => [platz.matrikelnummer, platz])),
    [angezeigteSitzplaetze],
  );

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
    const bestand = parseRaeume(BEISPIEL_RAEUME);
    setKatalog(bestand);
    setZeilen(bestand.map(raumZuZeile));
    uebernehmeSchemata(parseRaumschemaDateien(Object.values(BEISPIEL_RAUMSCHEMATA)));
    uebernehmeBelegung([]);
    setQuelle('beispiel');
    setTeilnehmerStatus('Beispieldaten geladen.');
  };

  const raeumeLaden = async (files: File[]) => {
    setFehler(null);
    try {
      const geladen = parseRaeume(await readFileAsText(files[0]));
      setKatalog((alt) => (alt.length === 0 ? geladen : alt));
      setZeilen(geladen.map(raumZuZeile));
    } catch (e) {
      setFehler(`Räume-CSV konnte nicht gelesen werden: ${String(e)}`);
    }
  };

  /**
   * Räume, die sich hinzufügen lassen: der Bestand aus `Raeume/` plus jeder
   * Raum, für den ein Raster vorliegt. Die Plätze kommen aus dem Raster (die
   * Tische darin), sonst aus dem Bestand.
   */
  const verfuegbareRaeume = useMemo(() => {
    const namen = [
      ...new Set([...katalog.map((raum) => raum.raum), ...schemata.map((schema) => schema.raum)]),
    ].filter((name) => name !== '');
    return namen.map((name) => {
      const schema = schemata.find((s) => s.raum === name);
      const bestand = katalog.find((raum) => raum.raum === name);
      return {
        raum: name,
        plaetze: schema ? tischzellen(schema).length : (bestand?.plaetze ?? 0),
        reservierteZeit: bestand?.reservierteZeit ?? '',
      };
    });
  }, [katalog, schemata]);

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
   * Für jeden benutzten Raum ein Raster sicherstellen – fehlende werden
   * vorgeschlagen. Die Raster der übrigen Räume bleiben liegen: Sie gehören
   * zum Bestand und dürfen beim Speichern nicht verschwinden.
   */
  const schemataErgaenzen = (fuerRaeume: Raum[]): Raumschema[] => {
    const fehlende: Raumschema[] = [];
    for (const raum of fuerRaeume) {
      if (raum.raum === '') continue;
      const bekannt = [...schemataRef.current, ...fehlende].some((s) => s.raum === raum.raum);
      if (!bekannt) fehlende.push(standardRaumschema(raum.raum, raum.plaetze));
    }
    return [...schemataRef.current, ...fehlende];
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
      setAusgewaehlt(null);
    },
  });

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

    const neueSchemata = schemataErgaenzen(raeume);
    uebernehmeSchemata(neueSchemata);
    belegungAktualisieren(neueSchemata, ergebnis.sitzplaetze, belegungRef.current, true);
  };

  const neuVerteilen = () => {
    if (!sitzplaetze) return;
    editor.merkeStand();
    setAusgewaehlt(null);
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
   * Zelle im Sitzplan angetippt – was passiert, hängt vom Modus ab. Gemeint
   * ist immer ein Raum**einsatz**: Reserve, Vorgabe und Platzierung gehören
   * zum Durchgang, nicht zum Raum.
   */
  const zellePress = (schluessel: string, zeile: number, spalte: number) => {
    setHinweis(null);
    if (planModus === 'reserve') {
      editor.merkeStand();
      belegungSetzen(schalteReserve(belegungRef.current, schluessel, zeile, spalte));
      return;
    }
    if (planModus === 'vorgabe') {
      editor.merkeStand();
      uebernehmeBelegung(schalteVorgabe(belegungRef.current, schluessel, zeile, spalte));
      return;
    }

    // Platzieren: erst Person wählen, dann Zieltisch.
    const platz = belegungRef.current.find(
      (b) => b.raum === schluessel && b.zeile === zeile && b.spalte === spalte,
    );
    if (!platz) return;
    if (ausgewaehlt && ausgewaehlt.raum === schluessel) {
      if (platz.matrikelnummer === ausgewaehlt.matrikelnummer) {
        setAusgewaehlt(null);
        return;
      }
      editor.merkeStand();
      belegungSetzen(
        setzePerson(belegungRef.current, schluessel, zeile, spalte, ausgewaehlt.matrikelnummer),
      );
      setAusgewaehlt(null);
      return;
    }
    if (platz.matrikelnummer !== '') {
      setAusgewaehlt({ raum: schluessel, matrikelnummer: platz.matrikelnummer });
    }
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
    setPdfHinweis(null);
    setPdfLaeuft(true);
    try {
      const dateien = new Map<string, Uint8Array | string>();
      for (const platz of angezeigteSitzplaetze) {
        dateien.set(`${platz.matrikelnummer}.pdf`, await sitzplatzPdf(platz));
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
  const anzahlRaeume = angezeigteSitzplaetze
    ? new Set(angezeigteSitzplaetze.map((platz) => platz.raumSchluessel)).size
    : 0;
  const modusHinweis = PLAN_MODI.find((m) => m.key === planModus)?.hinweis ?? '';

  return (
    <ScreenContainer
      title="4. Raumzuteilung & Sitzplan"
      intro="Die Teilnehmenden der Klausur auf Räume verteilen: Sitzplätze vergeben, Sitzplan im Raum anordnen, Aushang- und Aufsichtslisten anzeigen und alles herunterladen – alles lokal im Browser. Die Liste kommt aus Schritt 3 oder, wenn dort nichts liegt, direkt aus den geprüften Anmeldungen."
      testID="Raumzuteilung-screen"
    >
      {rueckfrage ? (
        <Section title="Nicht alle Angemeldeten sind zugelassen" testID="raum-rueckfrage">
          <StatusText kind="error" testID="raum-rueckfrage-text">
            {`${rueckfrage.nichtZugelassen.length} von ${rueckfrage.alle.length} Anmeldungen aus 0_Input_Klausuranmeldungen/ haben keine Zulassung: ${nichtZugelassenListe}`}
          </StatusText>
          <Text style={styles.hinweis}>
            Womit soll weitergearbeitet werden? Der Export aus Schritt 3
            (3_Klausur_Teilnehmende_Export/) ist dafür nicht nötig – wer eine eigene Liste hat,
            wählt sie unten als Teilnehmer-CSV aus.
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
        <ProjektQuelle rolle="teilnehmer" testID="raum-quelle-teilnehmer" />
        {anmeldungen !== null ? (
          <>
            <Text style={styles.hinweis}>
              Ohne Teilnehmerliste aus Schritt 3 prüft dieser Schritt die Anmeldungen des
              Prüfungsamts selbst gegen den Zulassungsbestand.
            </Text>
            <ProjektQuelle rolle="hisExport" testID="raum-quelle-his" />
            <ProjektQuelle rolle="zulassungsbestand" alle testID="raum-quelle-zulassungen" />
          </>
        ) : null}
      </Section>

      <Section title="Räume der Klausur" testID="raum-raeume">
        <Text style={styles.hinweis}>
          Die Räume selbst und ihre Raster gehören zu keiner einzelnen Klausur: Sie liegen als
          Bestand in <Text style={styles.pfad}>Raeume/</Text> und werden in Schritt 5 gepflegt.
          Hier steht, welche davon <Text style={styles.pfad}>diese</Text> Klausur benutzt.
        </Text>
        <Text style={styles.hinweis}>
          Denselben Raum mehrfach hinzufügen heißt: Er wird mehrfach belegt – etwa Gruppe 1
          vormittags und Gruppe 2 nachmittags. Beide Durchgänge haben dasselbe Raster, aber je
          eigene Belegung und eigene Sitzplatznummern; auseinander hält sie die reservierte Zeit.
        </Text>
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
          onChange={setZeilen}
          mitDurchgang
          hinzufuegenTitel="Leere Zeile hinzufügen"
        />
        <FilePickerButton label="Räume-CSV laden" accept=".csv" onFiles={raeumeLaden} />
        <ProjektQuelle rolle="klausurraeume" testID="raum-quelle-klausurraeume" />
        <ProjektQuelle rolle="raeume" testID="raum-quelle-raeume" />
        <ProjektQuelle rolle="raumschema" alle testID="raum-quelle-schema" />
        <AppButton
          title="Räume der Klausur speichern"
          variant="secondary"
          onPress={() => {
            // Nicht in `Raeume/`: Dort steht der Bestand des Hauses, hier die
            // Auswahl für diese eine Klausur (mit ihren Durchgängen).
            const csv = raeumeToCsv(raeume);
            downloadCsv('klausurraeume.csv', csv);
            projekt.schreibe('klausurraeume.csv', csv, 'klausurraeume');
            setHinweis(
              'Räume der Klausur gespeichert – im Projekt unter 4_Raumzuteilung_Export/klausurraeume.csv.',
            );
          }}
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

      {angezeigteSitzplaetze && raster.length > 0 ? (
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

          <PlanLeiste editor={editor} />

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

          <RaumplanFlaeche
            palette={
              planModus === 'bearbeiten' ? (
                <RaumPalette editor={editor} testID="raum-palette" />
              ) : null
            }
          >
            {/* Ein Plan je Raumeinsatz: Zwei Durchgänge desselben Raums zeigen
                dasselbe Raster, aber jeder seine eigene Belegung. */}
            {raeume.map((raum) => {
              const schema = schemata.find((s) => s.raum === raum.raum);
              if (!schema) return null;
              const schluessel = raumSchluessel(raum);
              const tische = tischzellen(schema).length;
              const belegt = belegung.filter(
                (p) => p.raum === schluessel && p.matrikelnummer !== '',
              ).length;
              const reserven = belegung.filter((p) => p.raum === schluessel && p.reserviert).length;
              return (
                <RaumplanKarte
                  key={schluessel}
                  editor={editor}
                  schema={schema}
                  schluessel={schluessel}
                  titel={
                    (raum.durchgang ?? 1) > 1
                      ? `${raum.raum} · ${raum.durchgang}. Durchgang`
                      : raum.raum
                  }
                  bearbeiten={planModus === 'bearbeiten'}
                  kopfZusatz={`${belegt}/${tische} belegt${reserven > 0 ? `, ${reserven} Reserve` : ''}`}
                  belegung={belegungJeRaum.get(schluessel) ?? []}
                  nummern={nummern}
                  personen={personenJeMatrikel}
                  ausgewaehlt={ausgewaehlt?.raum === schluessel ? ausgewaehlt.matrikelnummer : null}
                  onZellePress={(zeile, spalte) => zellePress(schluessel, zeile, spalte)}
                />
              );
            })}
          </RaumplanFlaeche>

          <View style={styles.buttonZeile}>
            <AppButton title="Sitzplan neu verteilen" variant="secondary" onPress={neuVerteilen} testID="raum-neu-verteilen" />
            <AppButton
              title="Raumschema als CSV speichern"
              variant="secondary"
              onPress={async () => {
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
              }}
              testID="raum-schema-speichern"
            />
            <AppButton
              title="Belegung als CSV speichern"
              variant="secondary"
              onPress={() => {
                const csv = belegungToCsv(belegung, angezeigteSitzplaetze, nummern);
                downloadCsv('raumbelegung.csv', csv);
                projekt.schreibe('raumbelegung.csv', csv, 'raumbelegung');
              }}
              testID="raum-belegung-speichern"
            />
          </View>
          <FilePickerButton label="Raumschema-CSVs laden" accept=".csv" multiple onFiles={schemaLaden} />
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
                schemata={raster}
                belegung={belegung}
                nummern={nummern}
                // Gedreht wird im Editor je Raum; der Aushang zeigt ihn aus
                // derselben Richtung – sonst stünde auf dem Papier ein anderer
                // Raum als auf dem Bildschirm.
                drehungen={editor.drehungen}
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
            onPress={() => {
              const csv = sitzplaetzeToCsv(angezeigteSitzplaetze);
              downloadCsv(dateiname, csv);
              projekt.schreibe(dateiname, csv, 'sitzplan');
            }}
            testID="raum-download"
          />
          <AppButton
            title="Sitzplatz-PDFs als ZIP"
            variant="secondary"
            onPress={pdfsHerunterladen}
            disabled={pdfLaeuft}
            testID="raum-download-pdfs"
          />
          {pdfHinweis ? (
            <StatusText kind="info" testID="raum-pdf-sonderzeichen">{pdfHinweis}</StatusText>
          ) : null}
        </Section>
      ) : null}

      <Section title="Projekt">
        <ProjektDownload
          hinweis="Enthält Räume und Raumschema in Raeume/ sowie Sitzplan und Belegung in 4_Raumzuteilung_Export/."
          testID="raum-projekt-download"
        />
      </Section>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  buttonZeile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  raumTabellen: { gap: spacing.md },
  raumTabelle: { gap: spacing.xs },
  raumUeberschrift: { fontSize: 15, fontWeight: '600', color: colors.text },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  pfad: { fontWeight: '600', color: colors.text },
});
