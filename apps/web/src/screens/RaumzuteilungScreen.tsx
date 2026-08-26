import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import readXlsxFile from 'read-excel-file';
import {
  AnmeldungsPruefung,
  Bereich,
  bereichAus,
  belegungToCsv,
  erstelleRaumzuteilung,
  erstelleZip,
  ladeZulassungsBestand,
  nichtDarstellbareZeichen,
  ohneFreieBelegung,
  parseBelegung,
  parseHisRows,
  parseRaeume,
  parseRaumschemata,
  parseZulassungsliste,
  Platzbelegung,
  pruefeAnmeldungen,
  Raum,
  Raumschema,
  raeumeToCsv,
  raumschemataToCsv,
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
  zeileZuRaum,
  type RaumZeile,
  type Verschiebung,
} from '../components';
import { downloadCsv, downloadZip, readFileAsText } from '../files';
import { druckeAnsicht, SEITENUMBRUCH } from '../print';
import { useProjekt } from '../projekt';
import { BEISPIEL_KLAUSUR_TEILNEHMER, BEISPIEL_RAEUME, BEISPIEL_RAUMSCHEMA } from '../sampleData';
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
  const [pdfHinweis, setPdfHinweis] = useState<string | null>(null);

  // Sitzplan im Raum.
  const [schemata, setSchemata] = useState<Raumschema[]>([]);
  const [belegung, setBelegung] = useState<Platzbelegung[]>([]);
  const [drehungen, setDrehungen] = useState<Record<string, number>>({});
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

  const raeume = zeilen.map(zeileZuRaum);

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
    const raumDatei = projekt.datei('raeume');
    const schemaDatei = projekt.datei('raumschema');
    const belegungDatei = projekt.datei('raumbelegung');
    // Ohne Export aus Schritt 3: die Anmeldungen hier selbst prüfen.
    const hisDatei = projekt.datei('hisExport');
    const bestandTexte = projekt
      .dateienMit('zulassungsbestand')
      .map((datei) => datei.text ?? '')
      .filter((text) => text !== '');
    const ausAnmeldungen = !liste?.text && !!hisDatei?.bytes && bestandTexte.length > 0;
    if (!liste?.text && !raumDatei?.text && !ausAnmeldungen) return;

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
      if (raumDatei?.text) setZeilen(parseRaeume(raumDatei.text).map(raumZuZeile));
      if (schemaDatei?.text) uebernehmeSchemata(parseRaumschemata(schemaDatei.text));
      if (belegungDatei?.text) uebernehmeBelegung(parseBelegung(belegungDatei.text));
    };
    uebernehmen().catch((e) =>
      setFehler(`Projektdateien konnten nicht gelesen werden: ${String(e)}`),
    );
  }, [projekt, teilnehmer, zeilen, anmeldungen]);

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

  /** Belegung je Raum – einmal gruppiert, damit `React.memo` in den Zellen greift. */
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
    setZeilen(parseRaeume(BEISPIEL_RAEUME).map(raumZuZeile));
    uebernehmeSchemata(parseRaumschemata(BEISPIEL_RAUMSCHEMA));
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

  /** Schemata für alle Räume sicherstellen – fehlende werden vorgeschlagen. */
  const schemataFuer = (fuerRaeume: Raum[]): Raumschema[] =>
    fuerRaeume.map(
      (raum) =>
        schemataRef.current.find((s) => s.raum === raum.raum) ??
        standardRaumschema(raum.raum, raum.plaetze),
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
    uebernehmeBelegung(ergebnis.belegung);
    setOhnePlanPlatz(ergebnis.ohnePlatz);
    return ergebnis;
  };

  /**
   * Schema eines Raums ändern und die Belegung nachziehen. Wandert ein ganzer
   * Block, wandern die Personen darin mit – sonst stünden die Tische woanders
   * als ihre Belegung.
   */
  const schemaAendern = (
    raum: string,
    aendern: (schema: Raumschema) => Raumschema,
    verschiebung?: Verschiebung,
  ) => {
    const neu = schemataRef.current.map((s) => (s.raum === raum ? aendern(s) : s));
    uebernehmeSchemata(neu);
    const basisBelegung = verschiebung
      ? verschiebeBelegung(
          belegungRef.current,
          raum,
          verschiebung.bereich,
          verschiebung.dZeile,
          verschiebung.dSpalte,
        )
      : belegungRef.current;
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

    const neueSchemata = schemataFuer(raeume);
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

  const schemaLaden = async (files: File[]) => {
    setFehler(null);
    try {
      const geladen = parseRaumschemata(await readFileAsText(files[0]));
      uebernehmeSchemata(geladen);
      if (sitzplaetze) belegungAktualisieren(geladen, sitzplaetze, belegungRef.current);
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

  /** Zelle im Sitzplan angetippt – was passiert, hängt vom Modus ab. */
  const zellePress = (schema: Raumschema, zeile: number, spalte: number) => {
    setHinweis(null);
    if (planModus === 'reserve') {
      editor.merkeStand();
      belegungSetzen(schalteReserve(belegungRef.current, schema.raum, zeile, spalte));
      return;
    }
    if (planModus === 'vorgabe') {
      editor.merkeStand();
      uebernehmeBelegung(schalteVorgabe(belegungRef.current, schema.raum, zeile, spalte));
      return;
    }

    // Platzieren: erst Person wählen, dann Zieltisch.
    const platz = belegungRef.current.find(
      (b) => b.raum === schema.raum && b.zeile === zeile && b.spalte === spalte,
    );
    if (!platz) return;
    if (ausgewaehlt && ausgewaehlt.raum === schema.raum) {
      if (platz.matrikelnummer === ausgewaehlt.matrikelnummer) {
        setAusgewaehlt(null);
        return;
      }
      editor.merkeStand();
      belegungSetzen(
        setzePerson(belegungRef.current, schema.raum, zeile, spalte, ausgewaehlt.matrikelnummer),
      );
      setAusgewaehlt(null);
      return;
    }
    if (platz.matrikelnummer !== '') {
      setAusgewaehlt({ raum: schema.raum, matrikelnummer: platz.matrikelnummer });
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

  const anzahlRaeume = angezeigteSitzplaetze
    ? new Set(angezeigteSitzplaetze.map((platz) => platz.raum)).size
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

      <Section title="Räume">
        <Text style={styles.hinweis}>
          Die Räume selbst und ihre leeren Raster gehören zu keiner einzelnen Klausur – bearbeitet
          werden sie in Schritt 5, hier stehen sie zum Nachbessern.
        </Text>
        <RaumListe zeilen={zeilen} onChange={setZeilen} />
        <FilePickerButton label="Räume-CSV laden" accept=".csv" onFiles={raeumeLaden} />
        <ProjektQuelle rolle="raeume" testID="raum-quelle-raeume" />
        <ProjektQuelle rolle="raumschema" testID="raum-quelle-schema" />
        <AppButton
          title="Räume als CSV speichern"
          variant="secondary"
          onPress={() => {
            const csv = raeumeToCsv(raeume);
            downloadCsv('raeume.csv', csv);
            projekt.schreibe('raeume.csv', csv, 'raeume');
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
            {schemata.map((schema) => {
              const tische = tischzellen(schema).length;
              const belegt = belegung.filter(
                (p) => p.raum === schema.raum && p.matrikelnummer !== '',
              ).length;
              const reserven = belegung.filter((p) => p.raum === schema.raum && p.reserviert).length;
              return (
                <RaumplanKarte
                  key={schema.raum}
                  editor={editor}
                  schema={schema}
                  bearbeiten={planModus === 'bearbeiten'}
                  kopfZusatz={`${belegt}/${tische} belegt${reserven > 0 ? `, ${reserven} Reserve` : ''}`}
                  belegung={belegungJeRaum.get(schema.raum) ?? []}
                  nummern={nummern}
                  personen={personenJeMatrikel}
                  ausgewaehlt={ausgewaehlt?.raum === schema.raum ? ausgewaehlt.matrikelnummer : null}
                  onZellePress={(zeile, spalte) => zellePress(schema, zeile, spalte)}
                />
              );
            })}
          </RaumplanFlaeche>

          <View style={styles.buttonZeile}>
            <AppButton title="Sitzplan neu verteilen" variant="secondary" onPress={neuVerteilen} testID="raum-neu-verteilen" />
            <AppButton
              title="Raumschema als CSV speichern"
              variant="secondary"
              onPress={() => {
                const csv = raumschemataToCsv(schemata);
                downloadCsv('raumschema.csv', csv);
                projekt.schreibe('raumschema.csv', csv, 'raumschema');
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
});
