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
  erstelleZip,
  ladeZulassungsBestand,
  eindeutigeNamenspraefixe,
  entfernePerson,
  nichtDarstellbareZeichen,
  Nummerierung,
  ohneReserven,
  ohneSitzplatz,
  ohneVorgaben,
  PLAN_ANZEIGE_STANDARD,
  PlanAnzeige,
  parseBelegung,
  parseHisRows,
  parseRaeume,
  parseRaumschemaDateien,
  parseZulassungsliste,
  plaetzeJeRaum,
  planeSitzplan,
  platzNummern,
  PLATZHALTER_SITZPLATZ,
  Platzbelegung,
  platzSchluessel,
  pruefeAnmeldungen,
  pruefePlatzbedarf,
  Raum,
  Raumfuellung,
  Raumschema,
  raeumeToCsv,
  raumSchluessel,
  raumschemaDateien,
  schalteReserve,
  schalteVorgabe,
  setzeNotiz,
  setzePerson,
  setzeVorgabe,
  sitzplaenePdf,
  Sitzverteilung,
  Sitzplatz,
  sitzplaetzeAusBelegung,
  sitzplaetzeToCsv,
  SitzplanFeld,
  sitzplanRasterCsv,
  SitzplanOptionen,
  sitzplatzPdf,
  sitzplatzWerte,
  sortByNachname,
  tabellenPdf,
  tischzellen,
  verschiebeBelegung,
  verteileAufRaumschemata,
  VORLAGE_DATEI_SITZPLATZ,
  VORLAGE_NAME_SITZPLATZ,
  VORLAGE_SITZPLATZ,
  winAnsiText,
  Zulassung,
  zulassungenToCsv,
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
  PlanFuss,
  PlatzBedarf,
  ProjektDownload,
  ProjektQuelle,
  rasterEintraege,
  rasterText,
  RaumListe,
  RaumplanBuehne,
  raumZuZeile,
  Reiterinhalt,
  Section,
  StatusText,
  StudipEinsicht,
  useProjektDownloadEintrag,
  useRaumplanEditor,
  VorlagenModal,
  zeilenZuRaeumen,
  type MenuEintrag,
  type MenuGruppe,
  type RaumZeile,
  type Verschiebung,
} from '../components';
import { downloadCsv, downloadFile, downloadZip, readFileAsText } from '../files';
import { druckeAnsicht } from '../print';
import { useProjekt } from '../projekt';
import { BEISPIEL_KLAUSUR_TEILNEHMER, BEISPIEL_RAEUME, BEISPIEL_RAUMSCHEMATA } from '../sampleData';
import { colors, spacing } from '../theme';

/**
 * Die Ansichten der Verteilung. Eine zur Zeit, umgeschaltet im Menü
 * „Ansicht“: der Plan eines Raums oder eine der drei Listen. Die frühere
 * Alles-auf-einmal-Seite (Plan und Tabelle je Raum untereinander) gibt es
 * nicht mehr – wer einen Raum ansieht, sieht den Raum.
 */
const ANSICHTEN = [
  {
    key: 'raum',
    titel: 'Raumplan',
    hinweis: 'der Sitzplan des gewählten Raums',
    testID: 'raum-ansicht-raum',
  },
  {
    key: 'aushang',
    titel: 'Aushang',
    hinweis: 'Namenskürzel → Sitzplatz, wie er am Raum hängt',
    testID: 'raum-ansicht-aushang',
  },
  {
    key: 'alphabetisch',
    titel: 'Liste nach Nachname',
    hinweis: 'für den Einlass',
    testID: 'raum-ansicht-alphabetisch',
  },
  {
    key: 'nummern',
    titel: 'Liste nach Sitzplatznummer',
    hinweis: 'für die Aufsicht in den Reihen',
    testID: 'raum-ansicht-nummern',
  },
] as const;

type Ansicht = (typeof ANSICHTEN)[number]['key'];

/**
 * Was ein Tippen auf einen Platz bewirkt. Das Raster selbst wird hier **nicht**
 * bearbeitet – dafür ist Schritt 5 da; hier geht es nur darum, wer sitzt und
 * welcher Platz frei bleibt.
 */
const PLATZ_WERKZEUGE = [
  {
    key: 'blatt',
    titel: 'Platz öffnen',
    hinweis: 'wer sitzt hier – setzen, räumen, festhalten, freihalten',
  },
  {
    key: 'freihalten',
    titel: 'Platz freihalten',
    hinweis: 'ein Tippen hält den Platz frei; wer dort saß, fällt heraus',
  },
  {
    key: 'freigeben',
    titel: 'Freihalten aufheben',
    hinweis: 'ein Tippen gibt den Platz wieder frei',
  },
] as const;

type PlatzWerkzeug = (typeof PLATZ_WERKZEUGE)[number]['key'];

/**
 * Woher die Teilnehmerliste stammt. `anmeldungenAlle`/`anmeldungenZugelassen`
 * entstehen ohne den Export aus Schritt 3, direkt aus den Anmeldungen in
 * `0_Input_Klausuranmeldungen/`.
 */
/** Ein Sitzplatz ohne Angaben – Grundlage für abgeleitete Einträge. */
const LEERER_SITZPLATZ: Sitzplatz = {
  anfangNachname: '',
  sitzplatznummer: 0,
  raum: '',
  raumSchluessel: '',
  reservierteZeit: '',
  matrikelnummer: '',
  anwesend: '',
  nachname: '',
  vorname: '',
  zeitUndRaum: '',
  email: '',
};

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

  // Zuteilungs-Optionen. Voreingestellt ist, was eine Klausur meistens will:
  // die Plätze so weit auseinander wie möglich und einen Raum nach dem
  // anderen füllen (wer zwei Räume hat und einen braucht, stellt sonst
  // zweimal Aufsicht).
  const [startnummer, setStartnummer] = useState<number | null>(1001);
  const [fuellung, setFuellung] = useState<Raumfuellung>('nacheinander');

  /**
   * Wo im Schritt wir stehen: erst die **Vorbereitung** (Dateien und Räume als
   * Formular), dann die **Verteilung** als Arbeitsfläche wie in Schritt 5.
   * Zwei Dinge, zwei Bilder: Vorher wählt man aus, nachher arbeitet man am
   * Plan – beides auf einer scrollenden Seite war keins von beidem.
   */
  const [phase, setPhase] = useState<'vorbereitung' | 'verteilung'>('vorbereitung');

  // Ergebnis & Ausgabe. Wer wo sitzt, steht **allein in der Belegung**: Die
  // Sitzplatzliste wird daraus abgeleitet (`sitzplaetze` weiter unten), statt
  // sie als zweiten Stand mitzuführen, der auseinanderlaufen kann.
  const [ansicht, setAnsicht] = useState<Ansicht>('raum');
  /** Der Raumeinsatz, dessen Plan gezeigt wird (`raumSchluessel`). */
  const [offenerRaumSchluessel, setOffenenRaum] = useState<string | null>(null);
  const [dateiname, setDateiname] = useState('studierendeZuRaumUndZeitZuordnung.csv');
  const [pdfLaeuft, setPdfLaeuft] = useState(false);
  const [pdfHinweis, setPdfHinweis] = useState<string | null>(null);
  /** Text der Sitzplatz-PDFs – bearbeitbar, mit dem Anfangstext als Vorgabe. */
  const [vorlage, setVorlage] = useState(VORLAGE_SITZPLATZ);
  const [vorlageOffen, setVorlageOffen] = useState(false);

  // Sitzplan im Raum.
  const [schemata, setSchemata] = useState<Raumschema[]>([]);
  const [belegung, setBelegung] = useState<Platzbelegung[]>([]);
  /** Was ein Tippen auf einen Platz tut (Menü „Werkzeuge“). */
  const [platzWerkzeug, setPlatzWerkzeug] = useState<PlatzWerkzeug>('blatt');
  /** Was in den Kästen steht – am Bildschirm und im PDF dasselbe. */
  const [anzeige, setAnzeige] = useState<PlanAnzeige>(PLAN_ANZEIGE_STANDARD);
  /** Wie die freien Tische eines Raums vergeben werden. */
  const [sitzverteilung, setSitzverteilung] = useState<Sitzverteilung>('abstand');
  /** Wer eine Sitzplatznummer bekommt: nur die belegten Tische oder alle. */
  const [nummerierung, setNummerierung] = useState<Nummerierung>('belegte');
  /** Der Platz, dessen Blatt gerade offen ist. */
  const [platzDialog, setPlatzDialog] = useState<
    { schluessel: string; raumName: string; titel: string; zeile: number; spalte: number } | null
  >(null);
  const [personSuche, setPersonSuche] = useState('');
  /** Nachricht des offenen Platzes – warum er freigehalten wird. */
  const [platzNotiz, setPlatzNotiz] = useState('');

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

  /**
   * Die Räume dieser Klausur, mit durchgezählten Durchgängen.
   *
   * Gemerkt, und das ist keine Kosmetik: An `raeume` hängt das Raster jedes
   * Einsatzes (`einsatzRaster`), und daran hängt der Effekt, der die leere
   * Belegung aufbaut. Eine bei jedem Rendern neu erzeugte Liste ließe ihn bei
   * jedem Rendern erneut laufen – React bricht das irgendwann mit „Maximum
   * update depth exceeded“ ab.
   */
  const raeume = useMemo(() => zeilenZuRaeumen(zeilen), [zeilen]);

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
   * Auswahl und Belegung wandern von selbst in den Projektstand – und damit
   * in den Browserspeicher. Wer den Screen wechselt und zurückkommt, findet
   * seine Räume und seinen Sitzplan wieder vor; vorher war beides weg, solange
   * niemand „speichern“ gedrückt hatte. Gebündelt (400 ms), sonst schriebe
   * jeder Tastendruck in der Raumliste die Datei neu.
   *
   * Erst schreiben, wenn hier je etwas stand: Sonst legte der erste Besuch
   * eine leere `klausurraeume.csv` an.
   */
  const { schreibe: projektSchreibe } = projekt;
  const raeumeGeschrieben = useRef(false);
  useEffect(() => {
    if (zeilen.length === 0 && !raeumeGeschrieben.current) return;
    const gleich = setTimeout(() => {
      projektSchreibe('klausurraeume.csv', raeumeToCsv(zeilenZuRaeumen(zeilen)), 'klausurraeume');
      raeumeGeschrieben.current = true;
    }, 400);
    return () => clearTimeout(gleich);
  }, [zeilen, projektSchreibe]);

  /**
   * Die Teilnehmerliste wandert mit in den Projektstand, sobald sie nicht von
   * dort stammt (eigene Datei, Anmeldungen, Beispieldaten). Sonst stünde nach
   * einem Wechsel des Screens ein Sitzplan da, zu dem die Namen fehlen.
   */
  useEffect(() => {
    if (teilnehmer.length === 0 || quelle === null || quelle === 'liste') return;
    projektSchreibe('allowedStudents.csv', zulassungenToCsv(teilnehmer), 'teilnehmer');
  }, [teilnehmer, quelle, projektSchreibe]);

  const belegungGeschrieben = useRef(false);
  useEffect(() => {
    if (belegung.length === 0 && !belegungGeschrieben.current) return;
    const gleich = setTimeout(() => {
      projektSchreibe(
        'raumbelegung.csv',
        belegungToCsv(belegung, sitzplaetzeRef.current, nummernRef.current),
        'raumbelegung',
      );
      belegungGeschrieben.current = true;
    }, 400);
    return () => clearTimeout(gleich);
  }, [belegung, projektSchreibe]);

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

  /**
   * Die Sitzplatznummern. Sie hängen an der **Belegung**: Voreingestellt
   * bekommt nur ein Tisch eine Nummer, auf dem jemand sitzt – am Aushang soll
   * keine Nummer stehen, die niemandem gehört. Unter „Einstellungen“ lässt
   * sich das auf „jeder Tisch“ umstellen.
   */
  const nummern = useMemo(
    () => platzNummern(raster, belegung, startnummer ?? 1001, nummerierung),
    [raster, belegung, startnummer, nummerierung],
  );

  /**
   * Wer wo sitzt – **abgeleitet aus der Belegung**, nicht daneben geführt.
   * Der Plan ist die Quelle: Wer jemanden umsetzt, ändert damit Sitzplan,
   * Aushang und Listen, ohne dass irgendwo ein zweiter Stand nachgezogen
   * werden müsste.
   */
  const sitzplaetze = useMemo(
    () => sitzplaetzeAusBelegung(teilnehmer, raeume, belegung, nummern),
    [teilnehmer, raeume, belegung, nummern],
  );
  /** Für Ereignis-Handler und Effekte: der Stand aus dem letzten Render. */
  const sitzplaetzeRef = useRef<Sitzplatz[]>(sitzplaetze);
  sitzplaetzeRef.current = sitzplaetze;
  const nummernRef = useRef(nummern);
  nummernRef.current = nummern;

  /** Ist schon verteilt worden? Dann sitzt in der Belegung jemand. */
  const verteilt = sitzplaetze.length > 0;

  /**
   * Wer keinen Platz hat. Das kann auch nachträglich passieren: Wird ein
   * besetzter Platz freigehalten, fällt die Person heraus – im Menüband steht
   * dann rot, wie viele es sind, und ein Eintrag darin verteilt neu.
   */
  const ohnePlatz = useMemo(
    // Vor der ersten Verteilung sitzt niemand – das ist kein Problem, sondern
    // der Anfang. Gemeldet wird erst, wer nach einer Verteilung übrig bleibt.
    () => (verteilt ? ohneSitzplatz(teilnehmer, belegung) : []),
    [teilnehmer, belegung, verteilt],
  );

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
          ...LEERER_SITZPLATZ,
          anfangNachname: praefixe.get(person) ?? person.nachname,
          matrikelnummer: person.matrikelnummer,
          nachname: person.nachname,
          vorname: person.vorname,
          email: person.email,
        },
      ]),
    );
    for (const platz of sitzplaetze) jeMatrikel.set(platz.matrikelnummer, platz);
    return jeMatrikel;
  }, [teilnehmer, sitzplaetze]);

  /**
   * Die Belegung deckt immer **jeden Tisch** der gewählten Räume ab – auch
   * bevor verteilt wurde. Sonst ließe sich in einem gerade hinzugefügten Raum
   * kein Platz freihalten: Zu einem Tisch ohne Eintrag gibt es nichts zu
   * ändern. Wer schon sitzt, bleibt sitzen; wer durch einen Umbau seinen Tisch
   * verloren hat, rückt nach.
   */
  useEffect(() => {
    if (raster.length === 0) return;
    // Wer schon sitzt, steht in der Belegung – **nicht** in der
    // Teilnehmerliste: Sonst verlöre ein Umbau alle, deren Liste gerade nicht
    // geladen ist (etwa direkt nach dem Öffnen des Projekts).
    const imPlan = belegungRef.current
      .filter((platz) => platz.matrikelnummer !== '')
      .map((platz) => ({
        ...LEERER_SITZPLATZ,
        matrikelnummer: platz.matrikelnummer,
        raum: platz.raum,
        raumSchluessel: platz.raum,
      }));
    const ergebnis = verteileAufRaumschemata(imPlan, raster, belegungRef.current, sitzverteilung);
    uebernehmeBelegung(ergebnis.belegung);
    // Läuft, wenn sich Räume oder Raster ändern – `raster` ist gemerkt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raster]);

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
    schemataUebernehmenUndSichern(parseRaumschemaDateien(Object.values(BEISPIEL_RAUMSCHEMATA)));
    uebernehmeBelegung([]);
    setQuelle('beispiel');
    setTeilnehmerStatus('Beispieldaten geladen.');
  };

  /**
   * Geladene Raster übernehmen **und** in den Bestand des Projekts schreiben
   * (`Raeume/`, je Raum eine Datei). Sie gehören dorthin und nicht in den
   * Screen: Sonst stünden die Räume nach einem Wechsel des Screens ohne
   * Raster da – und damit ohne Plätze.
   */
  const schemataUebernehmenUndSichern = (geladen: Raumschema[]) => {
    uebernehmeSchemata(geladen);
    if (geladen.length > 0) projekt.ersetze('raumschema', raumschemaDateien(geladen));
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
   * Raster eines Raums ändern und die Belegung nachziehen. Wandert ein ganzer
   * Block, wandern die Personen darin mit – sonst stünden die Tische woanders
   * als ihre Belegung. Das Raster gehört zum **Raum**, die Belegung zum
   * **Durchgang**: Wird derselbe Raum zweimal geprüft, ändert sich sein Raster
   * für beide, und die Personen wandern in jedem Durchgang mit.
   *
   * Gebaut wird das Raster in Schritt 5; hier hängt der Rückruf nur noch am
   * Editor (Rückgängig, geladene Raster) – deshalb ist er kurz.
   */
  const schemaAendern = (
    raum: string,
    aendern: (schema: Raumschema) => Raumschema,
    verschiebung?: Verschiebung,
  ) => {
    uebernehmeSchemata(schemataRef.current.map((s) => (s.raum === raum ? aendern(s) : s)));
    if (!verschiebung) return;
    let basisBelegung = belegungRef.current;
    for (const einsatz of raeume.filter((r) => r.raum === raum)) {
      basisBelegung = verschiebeBelegung(
        basisBelegung,
        raumSchluessel(einsatz),
        verschiebung.bereich,
        verschiebung.dZeile,
        verschiebung.dSpalte,
      );
    }
    uebernehmeBelegung(basisBelegung);
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

  /**
   * Verteilen: die Plätze wählen und die Personen daraufsetzen
   * (`planeSitzplan`). Freigehaltene Plätze und Vorgaben bleiben liegen, alles
   * andere entsteht neu – gerechnet wird über die Belegung, und der Sitzplan
   * fällt daraus ab.
   *
   * `abweichung` erlaubt, mit einer gerade umgestellten Einstellung zu
   * rechnen, bevor der Zustand angekommen ist: Wer im Menü „gleichmäßig“
   * wählt, soll das Ergebnis sofort sehen.
   */
  const verteilen = (
    abweichung: Partial<SitzplanOptionen> = {},
    /** Womit gerechnet wird – ohne Angabe die bestehende Belegung. */
    basis: Platzbelegung[] = belegungRef.current,
  ) => {
    setFehler(null);
    editor.merkeStand();
    const ergebnis = planeSitzplan(teilnehmer, raeume, schemataRef.current, basis, {
      sitzverteilung,
      fuellung,
      nummerierung,
      ersteSitzplatznummer: startnummer ?? 1001,
      ...abweichung,
    });
    uebernehmeBelegung(ergebnis.belegung);
    return ergebnis;
  };

  /**
   * Weiter zur Verteilung: Die Auswahl steht, ab hier wird am Plan gearbeitet.
   * Verteilt wird dabei gleich mit – ein leerer Plan wäre keine Antwort auf
   * „weiter“.
   */
  const zurVerteilung = () => {
    const ergebnis = verteilt ? null : verteilen();
    setPhase('verteilung');
    setAnsicht('raum');
    setHinweis(
      ergebnis
        ? `${ergebnis.sitzplaetze.length} Plätze verteilt.`
        : 'Bestehende Verteilung – im Menü „Verteilung“ lässt sie sich neu rechnen.',
    );
  };

  /**
   * Der Sitzplan als Tabelle – je Feld des Raums eine Zelle.
   *
   * Zweimal, weil zwei Leute damit arbeiten: Am Aushang hängt der Plan mit den
   * **Nummern** (mehr braucht dort niemand zu sehen), die Aufsicht geht mit dem
   * Plan **mit Namen** durch die Reihen. Anders als das PDF lässt sich die
   * Tabelle weiterverarbeiten – ausdrucken, einfärben, in eine eigene Vorlage
   * kopieren.
   */
  const rasterCsvSpeichern = (feld: SitzplanFeld) => {
    const dateiname = feld === 'nummer' ? 'sitzplan_nummern.csv' : 'sitzplan_namen.csv';
    // Gedreht wird die Ansicht je **Raum**, das Raster gehört zum **Einsatz**:
    // Beide Durchgänge sehen den Raum aus derselben Richtung.
    const einsaetze = raeume
      .map((raum) => ({
        schema: raster.find((eintrag) => eintrag.raum === raumSchluessel(raum)),
        drehungen: editor.drehungen[raum.raum] ?? 0,
      }))
      .filter((eintrag): eintrag is { schema: Raumschema; drehungen: number } => !!eintrag.schema);
    const csv = sitzplanRasterCsv(einsaetze, belegung, sitzplaetze, nummern, feld);
    downloadCsv(dateiname, csv);
    projekt.schreibe(dateiname, csv, 'sitzplanRaster');
    setHinweis(
      feld === 'nummer'
        ? `Sitzplan als Raster gespeichert (${dateiname}) – je Feld die Sitzplatznummer.`
        : `Sitzplan als Raster gespeichert (${dateiname}) – je Feld Nummer, Matrikelnummer und Name.`,
    );
  };

  /**
   * Noch einmal verteilen – nach einer Vorgabe, einem freigehaltenen Platz
   * oder einer geänderten Einstellung. Was fest ist, bleibt liegen.
   */
  const neuVerteilen = () => {
    const ergebnis = verteilen();
    setHinweis(
      `Neu verteilt: ${ergebnis.sitzplaetze.length} Plätze` +
        (ergebnis.ohnePlatz.length > 0 ? `, ${ergebnis.ohnePlatz.length} ohne Platz` : '') +
        ' – freigehaltene Plätze und Vorgaben sind geblieben.',
    );
  };

  /**
   * Von vorne: alles verwerfen, was von Hand am Plan geschah – Vorgaben und
   * umgesetzte Personen –, und neu rechnen. Wer sich beim Umsetzen verrannt
   * hat, kommt so zurück zum gerechneten Plan. Freigehaltene Plätze bleiben:
   * Ein defekter Tisch ist keine Vorgabe, und für sie gibt es den Eintrag
   * darunter.
   */
  const vonVorneVerteilen = () => {
    const vorgaben = belegungRef.current.filter((platz) => platz.vorgabe).length;
    const ergebnis = verteilen({}, ohneVorgaben(belegungRef.current));
    setHinweis(
      `Von vorne verteilt: ${ergebnis.sitzplaetze.length} Plätze` +
        (vorgaben > 0 ? `, ${vorgaben} Vorgabe${vorgaben === 1 ? '' : 'n'} verworfen` : '') +
        ' – freigehaltene Plätze sind geblieben.',
    );
  };

  /** Raster laden – je Raum eine Datei, deshalb ruhig mehrere auf einmal. */
  const schemaLaden = async (files: File[]) => {
    setFehler(null);
    try {
      const geladen = parseRaumschemaDateien(await Promise.all(files.map(readFileAsText)));
      schemataUebernehmenUndSichern(geladen);
      setHinweis(`${geladen.length} Raumraster geladen – auch im Projekt unter Raeume/.`);
    } catch (e) {
      setFehler(`Raumschema konnte nicht gelesen werden: ${String(e)}`);
    }
  };

  const belegungLaden = async (files: File[]) => {
    setFehler(null);
    try {
      uebernehmeBelegung(parseBelegung(await readFileAsText(files[0])));
      setHinweis('Belegung geladen.');
    } catch (e) {
      setFehler(`Belegung konnte nicht gelesen werden: ${String(e)}`);
    }
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
    // Die beiden anderen Werkzeuge halten Plätze frei bzw. geben sie wieder
    // frei – ein Tippen je Platz, ohne den Umweg über das Blatt.
    if (platzWerkzeug !== 'blatt') {
      const platz = belegungRef.current.find(
        (eintrag) =>
          eintrag.raum === schluessel && eintrag.zeile === zeile && eintrag.spalte === spalte,
      );
      if (!platz || platz.reserviert === (platzWerkzeug === 'freihalten')) return;
      editor.merkeStand();
      uebernehmeBelegung(schalteReserve(belegungRef.current, schluessel, zeile, spalte));
      return;
    }
    setHinweis(null);
    setPersonSuche('');
    setPlatzNotiz(
      belegungRef.current.find(
        (platz) => platz.raum === schluessel && platz.zeile === zeile && platz.spalte === spalte,
      )?.notiz ?? '',
    );
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
    uebernehmeBelegung(
      setzeVorgabe(gesetzt, platzDialog.schluessel, platzDialog.zeile, platzDialog.spalte, true),
    );
    setPersonSuche('');
  };

  const platzRaeumen = () => {
    if (!platzDialog || !dialogPlatz?.matrikelnummer) return;
    editor.merkeStand();
    uebernehmeBelegung(entfernePerson(belegungRef.current, dialogPlatz.matrikelnummer));
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
    if (dialogPlatz?.reserviert) setPlatzNotiz('');
    // Wer dort saß, fällt heraus und wird **nicht** stillschweigend
    // nachgesetzt: Im Menüband steht danach rot, dass jemand ohne Platz ist,
    // und ein Eintrag darin verteilt neu.
    uebernehmeBelegung(
      schalteReserve(belegungRef.current, platzDialog.schluessel, platzDialog.zeile, platzDialog.spalte),
    );
  };

  /**
   * Die Nachricht am freigehaltenen Platz – „warum bleibt der hier frei?“.
   * Sie steht im Kasten des Plans, in der Belegungs-CSV und im Sitzplan als
   * Tabelle: Wer den Plan in die Hand bekommt, soll die Lücke nicht für einen
   * Fehler halten. Verteilt wird dabei nicht neu – der Platz war schon vorher
   * gesperrt.
   */
  const notizSchreiben = (text: string) => {
    if (!platzDialog) return;
    setPlatzNotiz(text);
    uebernehmeBelegung(
      setzeNotiz(
        belegungRef.current,
        platzDialog.schluessel,
        platzDialog.zeile,
        platzDialog.spalte,
        text,
      ),
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

  /**
   * Die sichtbare Liste drucken. Gedruckt wird genau der Knoten, der am
   * Bildschirm steht – kein zweites Layout, das mitgepflegt werden müsste.
   */
  const listeDrucken = () => {
    setFehler(null);
    setHinweis(null);
    const knoten = aushangRef.current as unknown as HTMLElement | null;
    if (druckeAnsicht(knoten, 'Liste')) {
      setHinweis('Druckdialog geöffnet – dort „Als PDF sichern“ wählen.');
    } else {
      setFehler('Das Druckfenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.');
    }
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
    if (!verteilt) return;
    setFehler(null);
    setPdfHinweis(null);
    setPdfLaeuft(true);
    try {
      const dateien = new Map<string, Uint8Array | string>();
      for (const platz of sitzplaetze) {
        dateien.set(`${platz.matrikelnummer}.pdf`, await sitzplatzPdf(platz, vorlage));
      }
      downloadZip('sitzplatz_pdfs.zip', await erstelleZip(dateien));
      // Die eingebaute PDF-Schrift kennt nicht jedes Sonderzeichen; statt am
      // ersten abzubrechen, schreibt sie es um – wer betroffen ist, gehört
      // auf den Bildschirm.
      const umgeschrieben = sitzplaetze
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
      const plaetze = sitzplaetze;
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
      const plaetze = sitzplaetze;
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
  const anzahlRaeume = new Set(sitzplaetze.map((platz) => platz.raumSchluessel)).size;
  /**
   * „in einem Raum“ statt „in 1 Räumen“: Seit die Räume nacheinander gefüllt
   * werden, ist ein einzelner Raum der Normalfall und nicht die Ausnahme.
   */
  const raeumeText = anzahlRaeume === 1 ? 'einem Raum' : `${anzahlRaeume} Räumen`;

  /**
   * Ein Eintrag je Raumeinsatz – aber nur, wo ein Raster vorliegt: Ohne Raster
   * gibt es keinen Plan zu zeigen. Zwei Durchgänge desselben Raums sind zwei
   * Einträge mit demselben Raster und je eigener Belegung.
   */
  const raumEintraege = raeume
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
   * Der gezeigte Raum. Die Wahl kann veralten (Raum entfernt, andere Räume
   * geladen); dann gilt der erste – ein leerer Arbeitsbereich wäre die
   * schlechtere Antwort.
   */
  const offenerRaum =
    raumEintraege.find((eintrag) => eintrag.key === offenerRaumSchluessel) ?? raumEintraege[0] ?? null;
  /**
   * Der Raumplan ist nur zu sehen, wenn verteilt wird, die Ansicht ihn zeigt
   * und es einen Raum dazu gibt. Daran hängt auch die Fußleiste: Ohne Plan
   * gibt es nichts zu zoomen.
   */
  const zeigtRaum = phase === 'verteilung' && ansicht === 'raum' && offenerRaum !== null;

  const raumWechseln = (schluessel: string) => {
    setOffenenRaum(schluessel);
    setAnsicht('raum');
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
   * Das Menüband: „Datei“, „Verteilung“, „Raum“, „Ansicht“, „Werkzeuge“ und
   * „Einstellungen“ – die Menüleiste einer Tabellenkalkulation. Der Screen
   * beschreibt nur, was es zu tun gibt; ob daraus am Rechner ein
   * herunterklappendes Menü wird oder auf dem Handy eine Schublade,
   * entscheidet `Menueleiste`.
   *
   * In der Vorbereitung steht dort nur „Datei“: Solange ausgewählt wird, gibt
   * es weder einen Plan noch eine Ansicht, und graue Menüs sind Ballast.
   */
  const dateiMenu: MenuGruppe = {
    titel: 'Datei',
    testID: 'raum-menue-datei',
    eintraege: [
      { art: 'trenner', titel: 'Speichern' },
      {
        art: 'aktion',
        titel: 'Sitzplan-CSV speichern',
        hinweis: `im Projekt als ${dateiname}`,
        deaktiviert: !verteilt,
        onWaehlen: () => {
          if (!verteilt) return;
          const csv = sitzplaetzeToCsv(sitzplaetze);
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
          setHinweis('Räume der Klausur heruntergeladen (klausurraeume.csv).');
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
        titel: 'Sitzplan als Raster-CSV (Nummern)',
        hinweis: 'sitzplan_nummern.csv – der Raumplan als Tabelle, je Feld die Sitzplatznummer',
        deaktiviert: raster.length === 0,
        onWaehlen: () => rasterCsvSpeichern('nummer'),
        testID: 'raum-raster-nummern',
      },
      {
        art: 'aktion',
        titel: 'Sitzplan als Raster-CSV (mit Namen)',
        hinweis: 'sitzplan_namen.csv – je Feld Sitzplatznummer, Matrikelnummer und Name',
        deaktiviert: raster.length === 0,
        onWaehlen: () => rasterCsvSpeichern('person'),
        testID: 'raum-raster-namen',
      },
      {
        art: 'aktion',
        titel: 'Belegung als CSV herunterladen',
        hinweis: 'wer wo sitzt, samt freigehaltener Plätze und Vorgaben',
        deaktiviert: belegung.length === 0,
        onWaehlen: () => {
          downloadCsv('raumbelegung.csv', belegungToCsv(belegung, sitzplaetze, nummern));
          setHinweis('Belegung heruntergeladen – im Projekt steht sie ohnehin.');
        },
        testID: 'raum-belegung-speichern',
      },
      { art: 'trenner', titel: pdfLaeuft ? 'PDF läuft …' : 'PDF' },
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
        deaktiviert: pdfLaeuft || !verteilt,
        onWaehlen: aushangAlsPdf,
        testID: 'raum-aushang-pdf',
      },
      {
        art: 'aktion',
        titel: 'Liste nach Sitzplatznummer als PDF',
        hinweis: 'für die Aufsicht in den Reihen (Dozentenliste)',
        deaktiviert: pdfLaeuft || !verteilt,
        onWaehlen: () => listeAlsPdf('dozent'),
        testID: 'raum-dozent-pdf',
      },
      {
        art: 'aktion',
        titel: 'Liste nach Nachname als PDF',
        hinweis: 'für den Einlass (Tutorenliste)',
        deaktiviert: pdfLaeuft || !verteilt,
        onWaehlen: () => listeAlsPdf('tutor'),
        testID: 'raum-tutor-pdf',
      },
      {
        art: 'aktion',
        titel: 'Sitzplatz-PDFs als ZIP',
        hinweis: 'je Person ein Schreiben, benannt nach der Matrikelnummer',
        deaktiviert: pdfLaeuft || !verteilt,
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
      {
        art: 'aktion',
        titel: 'Liste drucken',
        hinweis: 'die Liste, die gerade zu sehen ist',
        deaktiviert: !verteilt || zeigtRaum,
        onWaehlen: listeDrucken,
        testID: 'raum-aushaenge-pdf',
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
  };

  /** Was mit der Verteilung als Ganzes geschieht. */
  const verteilungMenu: MenuGruppe = {
    titel: 'Verteilung',
    wert: verteilt ? `${sitzplaetze.length}/${teilnehmer.length}` : 'noch nicht verteilt',
    testID: 'raum-menue-verteilung',
    eintraege: [
      { art: 'trenner', titel: 'Rechnen' },
      {
        art: 'aktion',
        titel: 'Neu verteilen',
        hinweis: 'wählt die Plätze neu – Vorgaben und freigehaltene Plätze bleiben',
        deaktiviert: teilnehmer.length === 0 || raster.length === 0,
        onWaehlen: neuVerteilen,
        testID: 'raum-neu-verteilen',
      },
      {
        art: 'aktion',
        titel: 'Von vorne verteilen',
        hinweis: 'verwirft Vorgaben und alles von Hand Umgesetzte',
        deaktiviert: teilnehmer.length === 0 || raster.length === 0,
        onWaehlen: vonVorneVerteilen,
        testID: 'raum-von-vorne',
      },
      { art: 'trenner', titel: 'Von Hand Gesetztes' },
      {
        art: 'aktion',
        titel: 'Alle Vorgaben lösen',
        hinweis: 'niemand sitzt danach mehr fest, bleibt aber, wo er ist',
        deaktiviert: !belegung.some((platz) => platz.vorgabe),
        onWaehlen: () => {
          editor.merkeStand();
          uebernehmeBelegung(belegungRef.current.map((platz) => ({ ...platz, vorgabe: false })));
          setHinweis('Alle Vorgaben gelöst – das nächste Verteilen setzt alle neu.');
        },
        testID: 'raum-vorgaben-loesen',
      },
      {
        art: 'aktion',
        titel: 'Alle freigehaltenen Plätze aufheben',
        hinweis: 'auch die Nachrichten daran',
        deaktiviert: !belegung.some((platz) => platz.reserviert),
        onWaehlen: () => {
          editor.merkeStand();
          uebernehmeBelegung(ohneReserven(belegungRef.current));
          setHinweis('Alle freigehaltenen Plätze sind wieder frei – neu verteilen füllt sie.');
        },
        testID: 'raum-reserven-aufheben',
      },
      { art: 'trenner', titel: 'Auswahl' },
      {
        art: 'aktion',
        titel: '‹ Zurück zur Auswahl',
        hinweis: 'Teilnehmende und Räume – die Verteilung bleibt stehen',
        onWaehlen: () => setPhase('vorbereitung'),
        testID: 'raum-zurueck-auswahl',
      },
    ],
  };

  /** Zwischen den Räumen dieser Klausur wechseln. */
  const raumMenu: MenuGruppe = {
    titel: 'Raum',
    wert: zeigtRaum ? (offenerRaum?.titel ?? '') : undefined,
    testID: 'raum-menue-raum',
    eintraege:
      raumEintraege.length === 0
        ? [
            {
              art: 'aktion',
              titel: 'Noch kein Raumplan',
              hinweis: 'ohne Raster gibt es keinen Plan – Raster laden oder in Schritt 5 anlegen',
              deaktiviert: true,
              onWaehlen: () => {},
            },
          ]
        : raumEintraege.map(
            (eintrag): MenuEintrag => ({
              art: 'aktion',
              titel: eintrag.titel,
              hinweis: belegungText(eintrag.key, eintrag.schema),
              gewaehlt: zeigtRaum && eintrag.key === offenerRaum?.key,
              onWaehlen: () => raumWechseln(eintrag.key),
              testID: eintrag.testID,
            }),
          ),
  };

  /** Raumplan oder eine der drei Listen. */
  const ansichtMenu: MenuGruppe = {
    titel: 'Ansicht',
    wert: ANSICHTEN.find((eintrag) => eintrag.key === ansicht)?.titel,
    testID: 'raum-menue-ansicht',
    eintraege: ANSICHTEN.map(
      (eintrag): MenuEintrag => ({
        art: 'aktion',
        titel: eintrag.titel,
        hinweis: eintrag.hinweis,
        gewaehlt: ansicht === eintrag.key,
        deaktiviert: eintrag.key === 'raum' ? raumEintraege.length === 0 : !verteilt,
        onWaehlen: () => setAnsicht(eintrag.key),
        testID: eintrag.testID,
      }),
    ),
  };

  /**
   * Was ein Tippen im Plan tut, dazu Drehen und der Verlauf. Nur im Raumplan
   * zu gebrauchen – in einer Liste gibt es nichts anzutippen, deshalb steht
   * das Menü dort grau da, statt zu verschwinden.
   */
  const werkzeugeMenu: MenuGruppe = {
    titel: 'Werkzeuge',
    wert: zeigtRaum
      ? PLATZ_WERKZEUGE.find((werkzeug) => werkzeug.key === platzWerkzeug)?.titel
      : undefined,
    testID: 'raum-menue-werkzeuge',
    eintraege: zeigtRaum
      ? [
          { art: 'trenner', titel: 'Was ein Tippen tut' },
          ...PLATZ_WERKZEUGE.map(
            (werkzeug): MenuEintrag => ({
              art: 'aktion',
              titel: werkzeug.titel,
              hinweis: werkzeug.hinweis,
              gewaehlt: platzWerkzeug === werkzeug.key,
              onWaehlen: () => setPlatzWerkzeug(werkzeug.key),
              testID: `raum-werkzeug-${werkzeug.key}`,
            }),
          ),
          // Das Raster selbst wird in Schritt 5 gebaut: Hier bleiben Drehen
          // und der Verlauf, nicht die Palette.
          ...rasterEintraege(editor, offenerRaum?.raum.raum ?? '', false),
        ]
      : [
          {
            art: 'aktion',
            titel: 'Nur im Raumplan',
            hinweis: 'unter „Ansicht“ den Raumplan wählen',
            deaktiviert: true,
            onWaehlen: () => {},
          },
        ],
  };

  /** Wie verteilt und nummeriert wird – und was in den Kästen steht. */
  const einstellungenMenu: MenuGruppe = {
    titel: 'Einstellungen',
    testID: 'raum-menue-einstellungen',
    eintraege: [
      { art: 'trenner', titel: 'Sitzplatznummern' },
      {
        art: 'schalter',
        titel: 'Nur belegte Plätze nummerieren',
        hinweis: 'sonst bekommt jeder Tisch des Raums eine Nummer',
        wert: nummerierung === 'belegte',
        onChange: (wert: boolean) => setNummerierung(wert ? 'belegte' : 'alle'),
        testID: 'raum-einstellung-nummern',
      },
      { art: 'trenner', titel: 'Räume füllen' },
      {
        art: 'aktion',
        titel: 'Nacheinander',
        hinweis: 'ein Raum wird voll, dann der nächste',
        gewaehlt: fuellung === 'nacheinander',
        onWaehlen: () => {
          setFuellung('nacheinander');
          verteilen({ fuellung: 'nacheinander' });
        },
        testID: 'raum-fuellung-nacheinander',
      },
      {
        art: 'aktion',
        titel: 'Gleichmäßig',
        hinweis: 'jeder Platz dorthin, wo prozentual am meisten frei ist',
        gewaehlt: fuellung === 'gleichmaessig',
        onWaehlen: () => {
          setFuellung('gleichmaessig');
          verteilen({ fuellung: 'gleichmaessig' });
        },
        testID: 'raum-fuellung-gleichmaessig',
      },
      { art: 'trenner', titel: 'Plätze im Raum' },
      {
        art: 'aktion',
        titel: 'So weit auseinander wie möglich',
        hinweis: 'jeder nächste Platz hat den größten Abstand zu den gewählten',
        gewaehlt: sitzverteilung === 'abstand',
        onWaehlen: () => {
          setSitzverteilung('abstand');
          verteilen({ sitzverteilung: 'abstand' });
        },
        testID: 'raum-sitz-abstand',
      },
      {
        art: 'aktion',
        titel: 'Der Reihe nach',
        hinweis: 'von vorne links, wie im Raster',
        gewaehlt: sitzverteilung === 'lesereihenfolge',
        onWaehlen: () => {
          setSitzverteilung('lesereihenfolge');
          verteilen({ sitzverteilung: 'lesereihenfolge' });
        },
        testID: 'raum-sitz-reihe',
      },
      { art: 'trenner', titel: 'Was in den Kästen steht' },
      {
        art: 'schalter',
        titel: 'Namenskürzel',
        wert: anzeige.namensPraefix,
        onChange: (wert: boolean) => setAnzeige((alt) => ({ ...alt, namensPraefix: wert })),
        testID: 'raum-anzeige-name',
      },
      {
        art: 'schalter',
        titel: 'Matrikelnummer',
        wert: anzeige.matrikelnummer,
        onChange: (wert: boolean) => setAnzeige((alt) => ({ ...alt, matrikelnummer: wert })),
        testID: 'raum-anzeige-matrikel',
      },
      {
        art: 'schalter',
        titel: 'Sitzplatznummer',
        wert: anzeige.sitzplatznummer,
        onChange: (wert: boolean) => setAnzeige((alt) => ({ ...alt, sitzplatznummer: wert })),
        testID: 'raum-anzeige-nummer',
      },
      {
        art: 'schalter',
        titel: 'Pult beschriften',
        wert: anzeige.pultText,
        onChange: (wert: boolean) => setAnzeige((alt) => ({ ...alt, pultText: wert })),
        testID: 'raum-anzeige-pult',
      },
    ],
  };

  /**
   * Der rote Eintrag: Es sitzt jemand nicht. Er steht im Menüband und nicht in
   * einer Meldung, die man wegscrollt – wer einen besetzten Platz freihält,
   * soll die Folge sehen, bis sie behoben ist.
   */
  const warnungMenu: MenuGruppe = {
    titel: `⚠ ${ohnePlatz.length} ohne Platz`,
    warnung: true,
    testID: 'raum-menue-warnung',
    eintraege: [
      { art: 'trenner', titel: 'Ohne Platz' },
      ...ohnePlatz.slice(0, 12).map(
        (person): MenuEintrag => ({
          art: 'aktion',
          titel: `${person.nachname}, ${person.vorname}`,
          hinweis: person.matrikelnummer,
          deaktiviert: true,
          onWaehlen: () => {},
        }),
      ),
      ...(ohnePlatz.length > 12
        ? [{ art: 'trenner', titel: `… und ${ohnePlatz.length - 12} weitere` } as MenuEintrag]
        : []),
      { art: 'trenner' },
      {
        art: 'aktion',
        titel: 'Neu verteilen',
        hinweis: 'Vorgaben und freigehaltene Plätze bleiben',
        onWaehlen: neuVerteilen,
        testID: 'raum-warnung-neu-verteilen',
      },
    ],
  };

  const menus: MenuGruppe[] =
    phase === 'vorbereitung'
      ? [dateiMenu]
      : [
          dateiMenu,
          verteilungMenu,
          raumMenu,
          ansichtMenu,
          werkzeugeMenu,
          einstellungenMenu,
          ...(ohnePlatz.length > 0 ? [warnungMenu] : []),
        ];

  /**
   * Links in der Fußleiste – die Statuszeile: erst die Meldung, dann der Stand
   * dessen, was gerade zu sehen ist. Beides nebeneinander, damit eine Meldung
   * nicht dauerhaft verdeckt, wie viele Plätze belegt sind.
   */
  const fussText = [
    fehler,
    fehler ? null : (hinweis ?? pdfHinweis),
    phase === 'vorbereitung'
      ? `${teilnehmer.length} Teilnehmende · ${raeume.length} Raumeinsätze mit höchstens ${bedarf.plaetze} Plätzen`
      : zeigtRaum && offenerRaum
        ? `${belegungText(offenerRaum.key, offenerRaum.schema)} · ${rasterText(editor, offenerRaum.schema)}`
        : `${sitzplaetze.length} Sitzplätze in ${raeumeText} vergeben`,
  ]
    .filter((teil): teil is string => !!teil)
    .join(' · ');

  /** Die Liste, die gerade gezeigt wird – für Tabelle und Druck. */
  const listenZeilen = () => {
    if (ansicht === 'aushang') {
      return [...sitzplaetze].sort((a, b) => a.anfangNachname.localeCompare(b.anfangNachname, 'de'));
    }
    if (ansicht === 'alphabetisch') return sortByNachname(sitzplaetze);
    return [...sitzplaetze].sort((a, b) => a.sitzplatznummer - b.sitzplatznummer);
  };

  return (
    <>
      <Arbeitsflaeche
        kopf={<Menueleiste menus={menus} testID="raum-menue" />}
        fuss={
          <PlanFuss
            editor={editor}
            text={fussText}
            ansichtZeigen={zeigtRaum}
            testID="raum-fuss"
          />
        }
        testID="Raumzuteilung-screen"
      >
        {(hoehe) =>
          phase === 'vorbereitung' ? (
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

              <Section title="1. Teilnehmende">
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

              <Section title="2. Räume der Klausur" testID="raum-raeume">
                <Text style={styles.hinweis}>
                  Die Räume selbst und ihre Raster gehören zu keiner einzelnen Klausur: Sie liegen
                  als Bestand in <Text style={styles.pfad}>Raeume/</Text> und werden in Schritt 5
                  gepflegt. Hier steht, welche davon <Text style={styles.pfad}>diese</Text> Klausur
                  benutzt. Die Auswahl wandert in den Projektstand – sie steht auch nach einem
                  Wechsel des Screens wieder da.
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

              <Section title="3. Verteilung" testID="raum-weiter">
                <Text style={styles.hinweis}>
                  Verteilt wird in zwei Schritten: Erst werden die{' '}
                  <Text style={styles.pfad}>Plätze</Text> gewählt – so weit auseinander wie
                  möglich –, dann kommen die <Text style={styles.pfad}>Personen</Text> darauf, der
                  Reihe nach, Raum für Raum und darin Reihe für Reihe. Wie gefüllt und nummeriert
                  wird, steht danach im Menü „Einstellungen“ und lässt sich dort jederzeit
                  umstellen; der Plan rechnet sofort neu.
                </Text>
                <LabeledNumberInput
                  label="Erste Sitzplatznummer"
                  value={startnummer}
                  onChange={setStartnummer}
                  testID="raum-startnummer"
                />
                <AppButton
                  title={verteilt ? 'Weiter zur Verteilung' : 'Verteilen und weiter'}
                  onPress={zurVerteilung}
                  disabled={teilnehmer.length === 0 || raster.length === 0}
                  testID="raum-erstellen"
                />
                {verteilt ? (
                  <StatusText kind="success" testID="raum-ergebnis">
                    {`${sitzplaetze.length} Sitzplätze in ${raeumeText} vergeben.`}
                  </StatusText>
                ) : null}
                {ohnePlatz.length > 0 ? (
                  <StatusText kind="error">
                    {`Ohne Platz: ${ohnePlatz.map((p) => `${p.vorname} ${p.nachname}`).join(', ')}`}
                  </StatusText>
                ) : null}
                {fehler ? <StatusText kind="error">{fehler}</StatusText> : null}
                {hinweis ? <StatusText kind="info">{hinweis}</StatusText> : null}
              </Section>

              <Section title="Ausgaben" testID="raum-ausgaben">
                <LabeledTextInput
                  label="Dateiname des Sitzplans"
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
                <StudipEinsicht art="sitzplatz" testID="raum-studip-schritte" />
                <ProjektDownload
                  hinweis="Enthält Räume und Raumschema in Raeume/ sowie Sitzplan und Belegung in 4_Raumzuteilung_Export/."
                  testID="raum-projekt-download-gross"
                />
              </Section>
            </Reiterinhalt>
          ) : zeigtRaum && offenerRaum ? (
            <RaumplanBuehne
              key={offenerRaum.key}
              editor={editor}
              schema={offenerRaum.schema}
              schluessel={offenerRaum.key}
              titel={offenerRaum.titel}
              hoehe={hoehe}
              bearbeiten={false}
              belegung={belegungJeRaum.get(offenerRaum.key) ?? []}
              nummern={nummern}
              personen={personenJeMatrikel}
              anzeige={anzeige}
              onZellePress={(zeile, spalte) =>
                zellePress(offenerRaum.key, offenerRaum.raum.raum, offenerRaum.titel, zeile, spalte)
              }
            />
          ) : (
            <Reiterinhalt testID="raum-listen">
              <Section
                title={ANSICHTEN.find((eintrag) => eintrag.key === ansicht)?.titel ?? 'Liste'}
                testID="raum-ansichten"
              >
                {verteilt ? (
                  <View ref={aushangRef}>
                    {ansicht === 'aushang' ? (
                      <DataTable
                        columns={[
                          { key: 'anfangNachname', title: 'Anfang Nachname' },
                          { key: 'sitzplatznummer', title: 'Sitzplatznummer' },
                          { key: 'raum', title: 'Raum' },
                        ]}
                        rows={listenZeilen().map((platz) => ({
                          anfangNachname: platz.anfangNachname,
                          sitzplatznummer: platz.sitzplatznummer,
                          raum: platz.raum,
                        }))}
                      />
                    ) : (
                      <DataTable
                        columns={[
                          { key: 'sitzplatz', title: 'Sitzplatz' },
                          { key: 'nachname', title: 'Nachname' },
                          { key: 'vorname', title: 'Vorname' },
                          { key: 'raum', title: 'Raum' },
                          { key: 'anwesend', title: 'Anwesend' },
                        ]}
                        rows={listenZeilen().map((platz) => ({
                          sitzplatz: platz.sitzplatznummer,
                          nachname: platz.nachname,
                          vorname: platz.vorname,
                          raum: platz.raum,
                          anwesend: platz.anwesend,
                        }))}
                      />
                    )}
                  </View>
                ) : (
                  <StatusText kind="info">
                    Noch keine Verteilung – im Menü „Verteilung“ auf „Neu verteilen“ gehen oder
                    über „Zurück zur Auswahl“ Teilnehmende und Räume prüfen.
                  </StatusText>
                )}
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
          sitzplaetze[0] ? sitzplatzWerte(sitzplaetze[0]) : BEISPIEL_WERTE
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
                  ? `Dieser Platz wird für diese Klausur freigehalten${dialogPlatz.notiz ? `: ${dialogPlatz.notiz}` : '.'}`
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

            {dialogPlatz?.reserviert ? (
              <View style={styles.blattBlock}>
                <LabeledTextInput
                  label="Nachricht am Platz"
                  value={platzNotiz}
                  onChangeText={notizSchreiben}
                  placeholder="z. B. Tisch wackelt, Nachteilsausgleich"
                  testID="raum-platz-notiz"
                />
                <Text style={styles.hinweis}>
                  Sie steht im Kasten des Plans und in den Ausgaben (Belegungs-CSV, Sitzplan als
                  Tabelle) – damit niemand die Lücke für einen Fehler hält. Ohne Nachricht steht
                  dort schlicht „Reserve“.
                </Text>
              </View>
            ) : null}

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
