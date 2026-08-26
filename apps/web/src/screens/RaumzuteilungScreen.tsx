import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  anzeigeBereich,
  Bereich,
  bereichAendern,
  bereichAus,
  bereichName,
  belegungToCsv,
  erstelleRaumzuteilung,
  erstelleZip,
  mitGroesse,
  nichtDarstellbareZeichen,
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
  setzeBeschriftungsText,
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
  trenneZellen,
  verbindeZellen,
  verschiebeBelegung,
  verschiebeBereich,
  verteileAufRaumschemata,
  Verteilmodus,
  winAnsiText,
  ZellTyp,
  Zulassung,
} from '@exam-manager/core';
import {
  AppButton,
  DataTable,
  FilePickerButton,
  LabeledNumberInput,
  LabeledTextInput,
  PaletteElement,
  ProjektDownload,
  ProjektQuelle,
  Raumplan,
  ScreenContainer,
  Section,
  StatusText,
} from '../components';
import { downloadCsv, downloadZip, readFileAsText } from '../files';
import { druckeAnsicht, SEITENUMBRUCH } from '../print';
import { useProjekt } from '../projekt';
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
  { key: 'bearbeiten', titel: 'Raum bearbeiten', hinweis: 'Element aus der Palette auf eine Zelle ziehen oder antippen und dann im Plan malen. Mit „Auswählen“ verschiebst du einen Block; am blauen Griff an der unteren Ecke ziehst du ihn über mehrere Felder auf. Mit „Text“ (oder „Zellen verbinden“) entsteht über den ausgewählten Feldern ein Feld zum Reinschreiben.' },
] as const;

type PlanModus = (typeof PLAN_MODI)[number]['key'];

/**
 * Werkzeug im Bearbeiten-Modus: auswählen/verschieben, ein Element malen oder
 * ein Textfeld über verbundenen Zellen aufziehen.
 */
type Werkzeug = 'auswahl' | 'text' | ZellTyp;

const PALETTE: { werkzeug: Werkzeug; titel: string; untertitel: string }[] = [
  { werkzeug: 'auswahl', titel: 'Auswählen', untertitel: 'wählen & schieben' },
  { werkzeug: 'tisch', titel: 'Tisch', untertitel: 'T' },
  { werkzeug: 'wand', titel: 'Wand', untertitel: 'W' },
  { werkzeug: 'tuer', titel: 'Tür', untertitel: 'D' },
  { werkzeug: 'pult', titel: 'Pult', untertitel: 'P' },
  { werkzeug: 'text', titel: 'Text', untertitel: 'Zellen verbinden' },
  { werkzeug: 'leer', titel: 'Radierer', untertitel: 'frei' },
];

/** Zoomstufen des Sitzplans: 1 = ganzer Raum im Fenster. */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 6;
const ZOOM_SCHRITT = 1.35;

/**
 * Zelle unter einem Bildschirmpunkt finden – für das Ablegen eines Elements
 * aus der Palette. Jede Zelle des Raumplans trägt ihren `platzSchluessel`
 * als `data-zelle`; der Raumname kann Sonderzeichen enthalten, deshalb wird
 * von hinten getrennt.
 */
function zelleUnterPunkt(x: number, y: number): { raum: string; zeile: number; spalte: number } | null {
  const element = document.elementFromPoint(x, y)?.closest('[data-zelle]');
  const wert = element?.getAttribute('data-zelle');
  if (!wert) return null;
  const teile = wert.split('|');
  const spalte = Number(teile.pop());
  const zeile = Number(teile.pop());
  const raum = teile.join('|');
  if (!Number.isFinite(zeile) || !Number.isFinite(spalte)) return null;
  return { raum, zeile, spalte };
}

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
  const [pdfHinweis, setPdfHinweis] = useState<string | null>(null);

  // Sitzplan im Raum.
  const [schemata, setSchemata] = useState<Raumschema[]>([]);
  const [belegung, setBelegung] = useState<Platzbelegung[]>([]);
  const [drehungen, setDrehungen] = useState<Record<string, number>>({});
  const [planModus, setPlanModus] = useState<PlanModus>('verschieben');
  const [werkzeug, setWerkzeug] = useState<Werkzeug>('tisch');
  const [auswahl, setAuswahl] = useState<{ raum: string; bereich: Bereich } | null>(null);
  const [zielZelle, setZielZelle] = useState<{ raum: string; zeile: number; spalte: number } | null>(null);
  const [ausgewaehlt, setAusgewaehlt] = useState<{ raum: string; matrikelnummer: string } | null>(null);
  const [ohnePlanPlatz, setOhnePlanPlatz] = useState<Sitzplatz[]>([]);
  // 1 = ganzer Raum im Fenster; zum Lesen der Namen zoomt man hinein.
  const [zoom, setZoom] = useState(1);

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

  const { isCompact } = useResponsiveLayout();
  const raeume = zeilen.map(zeileZuRaum);

  // Eingaben aus dem Projektordner, solange nichts eigenes geladen wurde.
  const projekt = useProjekt();
  useEffect(() => {
    if (teilnehmer.length > 0 || zeilen.length > 0) return;
    const liste = projekt.datei('teilnehmer');
    const raumDatei = projekt.datei('raeume');
    const schemaDatei = projekt.datei('raumschema');
    const belegungDatei = projekt.datei('raumbelegung');
    if (!liste?.text && !raumDatei?.text) return;
    try {
      if (liste?.text) setTeilnehmer(parseZulassungsliste(liste.text));
      if (raumDatei?.text) setZeilen(parseRaeume(raumDatei.text).map(raumZuZeile));
      if (schemaDatei?.text) uebernehmeSchemata(parseRaumschemata(schemaDatei.text));
      if (belegungDatei?.text) uebernehmeBelegung(parseBelegung(belegungDatei.text));
    } catch (e) {
      setFehler(`Projektdateien konnten nicht gelesen werden: ${String(e)}`);
    }
  }, [projekt, teilnehmer, zeilen]);

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
    uebernehmeSchemata(parseRaumschemata(BEISPIEL_RAUMSCHEMA));
    uebernehmeBelegung([]);
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
   * Schema eines Raums ändern und die Belegung nachziehen. `basisBelegung`
   * erlaubt es, die Belegung mitzubewegen (etwa beim Verschieben eines Blocks).
   */
  const schemaAendern = (
    raum: string,
    aendern: (schema: Raumschema) => Raumschema,
    basisBelegung: Platzbelegung[] = belegungRef.current,
  ) => {
    const neu = schemataRef.current.map((s) => (s.raum === raum ? aendern(s) : s));
    uebernehmeSchemata(neu);
    if (sitzplaetze) belegungAktualisieren(neu, sitzplaetze, basisBelegung);
    else uebernehmeBelegung(basisBelegung);
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
    uebernehmeSchemata(neueSchemata);
    belegungAktualisieren(neueSchemata, ergebnis.sitzplaetze, belegungRef.current, true);
  };

  const neuVerteilen = () => {
    if (!sitzplaetze) return;
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

  /** Ein Element auf eine Zelle setzen und sie auswählen (Malen und Ablegen). */
  const elementSetzen = (raum: string, zeile: number, spalte: number, typ: Werkzeug) => {
    if (typ === 'auswahl') return;
    const bereich = bereichAus({ zeile, spalte }, { zeile, spalte });
    schemaAendern(raum, (schema) =>
      typ === 'text' ? verbindeZellen(schema, bereich) : setzeZelle(schema, zeile, spalte, typ),
    );
    setAuswahl({ raum, bereich });
  };

  /** Ausgewählte Zellen zu einem Textfeld verbinden bzw. wieder trennen. */
  const zellenVerbinden = () => {
    if (!auswahl) return;
    setHinweis(null);
    schemaAendern(auswahl.raum, (schema) => verbindeZellen(schema, auswahl.bereich));
    setWerkzeug('text');
  };

  const zellenTrennen = () => {
    if (!auswahl) return;
    setHinweis(null);
    schemaAendern(auswahl.raum, (schema) => trenneZellen(schema, auswahl.bereich));
  };

  /**
   * Nur der Text eines Feldes ändert sich – am Raster und damit an der
   * Belegung ändert das nichts. Deshalb bewusst nicht über `schemaAendern`:
   * Sonst liefe bei jedem Tastendruck die Verteilung über alle Räume neu.
   */
  const beschriftungSchreiben = (raum: string, zeile: number, spalte: number, text: string) => {
    uebernehmeSchemata(
      schemataRef.current.map((schema) =>
        schema.raum === raum ? setzeBeschriftungsText(schema, zeile, spalte, text) : schema,
      ),
    );
  };

  /** Zelle im Sitzplan angetippt – was passiert, hängt vom Modus ab. */
  const zellePress = (schema: Raumschema, zeile: number, spalte: number) => {
    setHinweis(null);
    if (planModus === 'bearbeiten') {
      // „Auswählen“ und „Text“ ziehen einen Bereich auf – das erledigt onAufziehen.
      if (werkzeug !== 'auswahl' && werkzeug !== 'text') {
        elementSetzen(schema.raum, zeile, spalte, werkzeug);
      }
      return;
    }
    if (planModus === 'reserve') {
      belegungSetzen(schalteReserve(belegungRef.current, schema.raum, zeile, spalte));
      return;
    }
    if (planModus === 'vorgabe') {
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

  /**
   * Auswahl über mehrere Felder aufziehen (Griff an der unteren Ecke).
   * Gefüllt wird mit dem Element der bisherigen Auswahl – so wird aus einem
   * Tisch eine Tischreihe und aus einer Wandzelle eine ganze Wand.
   */
  const bereichAufziehen = (raum: string, neuerBereich: Bereich) => {
    const alteAuswahl = auswahl && auswahl.raum === raum ? auswahl.bereich : neuerBereich;
    const schema = schemataRef.current.find((s) => s.raum === raum);
    if (!schema) return;
    if (werkzeug === 'text') {
      // Mit dem Textwerkzeug wird aufgezogen, was verbunden werden soll.
      schemaAendern(raum, (aktuell) => verbindeZellen(aktuell, neuerBereich));
      setAuswahl({ raum, bereich: neuerBereich });
      return;
    }
    const typ =
      werkzeug !== 'auswahl'
        ? werkzeug
        : schema.zellen[alteAuswahl.zeile]?.[alteAuswahl.spalte] ?? 'leer';
    schemaAendern(raum, (aktuell) => bereichAendern(aktuell, alteAuswahl, neuerBereich, typ));
    setAuswahl({ raum, bereich: neuerBereich });
  };

  /** Ausgewählten Block verschieben – die Belegung wandert mit. */
  const bereichVerschieben = (raum: string, dZeile: number, dSpalte: number) => {
    if (!auswahl || auswahl.raum !== raum || (dZeile === 0 && dSpalte === 0)) return;
    const bereich = auswahl.bereich;
    schemaAendern(
      raum,
      (schema) => verschiebeBereich(schema, bereich, dZeile, dSpalte),
      verschiebeBelegung(belegungRef.current, raum, bereich, dZeile, dSpalte),
    );
    setAuswahl({
      raum,
      bereich: { ...bereich, zeile: bereich.zeile + dZeile, spalte: bereich.spalte + dSpalte },
    });
  };

  /** Element aus der Palette über dem Plan bewegen bzw. ablegen. */
  const paletteZiehen = (x: number, y: number) => setZielZelle(zelleUnterPunkt(x, y));

  const paletteAblegen = (typ: Werkzeug) => (x: number, y: number) => {
    setZielZelle(null);
    setWerkzeug(typ);
    const ziel = zelleUnterPunkt(x, y);
    if (!ziel || typ === 'auswahl') return;
    if (!schemataRef.current.some((schema) => schema.raum === ziel.raum)) return;
    elementSetzen(ziel.raum, ziel.zeile, ziel.spalte, typ);
  };

  const drehen = (raum: string, richtung: 1 | -1) => {
    setDrehungen({ ...drehungen, [raum]: (((drehungen[raum] ?? 0) + richtung) % 4 + 4) % 4 });
  };

  const groesseAendern = (schema: Raumschema, dZeilen: number, dSpalten: number) => {
    schemaAendern(schema.raum, (aktuell) =>
      mitGroesse(
        aktuell,
        aktuell.zellen.length + dZeilen,
        (aktuell.zellen[0]?.length ?? 1) + dSpalten,
      ),
    );
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
        <ProjektQuelle rolle="teilnehmer" testID="raum-quelle-teilnehmer" />
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

          {/* Ohne Zoom passt jeder Raum ganz ins Fenster – auch 47 × 34 Felder.
              Zum Lesen der Namen zoomt man hinein, dann scrollt der Plan. */}
          <View style={styles.buttonZeile}>
            <Text style={styles.hinweis}>Ansicht: {Math.round(zoom * 100)} %</Text>
            <AppButton
              title="−"
              variant="secondary"
              onPress={() => setZoom((wert) => Math.max(ZOOM_MIN, wert / ZOOM_SCHRITT))}
              testID="raum-zoom-kleiner"
            />
            <AppButton
              title="+"
              variant="secondary"
              onPress={() => setZoom((wert) => Math.min(ZOOM_MAX, wert * ZOOM_SCHRITT))}
              testID="raum-zoom-groesser"
            />
            <AppButton
              title="Einpassen"
              variant="secondary"
              onPress={() => setZoom(1)}
              testID="raum-zoom-einpassen"
            />
          </View>

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

          <View style={[styles.editorZeile, isCompact && styles.editorZeileGestapelt]}>
            {planModus === 'bearbeiten' ? (
              <View style={[styles.palette, isCompact && styles.paletteBreit]} testID="raum-palette">
                <Text style={styles.palettenTitel}>Elemente</Text>
                {PALETTE.map((eintrag) => (
                  <PaletteElement
                    key={eintrag.werkzeug}
                    titel={eintrag.titel}
                    untertitel={eintrag.untertitel}
                    aktiv={werkzeug === eintrag.werkzeug}
                    onTippen={() => setWerkzeug(eintrag.werkzeug)}
                    onZiehen={paletteZiehen}
                    onAblegen={paletteAblegen(eintrag.werkzeug)}
                    testID={`raum-zelle-${eintrag.werkzeug}`}
                  />
                ))}
                <Text style={styles.hinweis}>
                  Auf eine Zelle ziehen setzt das Element dort. Antippen wählt es aus, dann im Plan
                  über Zellen ziehen – praktisch für eine ganze Wand.
                </Text>
              </View>
            ) : null}

            <View style={styles.plaene}>
          {schemata.map((schema) => {
            const tische = tischzellen(schema).length;
            const belegt = belegung.filter((p) => p.raum === schema.raum && p.matrikelnummer !== '').length;
            const reserven = belegung.filter((p) => p.raum === schema.raum && p.reserviert).length;
            const eigeneAuswahl = auswahl?.raum === schema.raum ? auswahl.bereich : null;
            return (
              <View key={schema.raum} style={styles.planBlock}>
                <Text style={styles.raumUeberschrift}>
                  {schema.raum} ({belegt}/{tische} belegt
                  {reserven > 0 ? `, ${reserven} Reserve` : ''}) · Raster{' '}
                  {schema.zellen[0]?.length ?? 0} Spalten × {schema.zellen.length} Zeilen
                  {eigeneAuswahl
                    ? ` · Auswahl ${bereichName(
                        anzeigeBereich(eigeneAuswahl, schema, drehungen[schema.raum] ?? 0),
                      )}`
                    : ''}
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
                      <AppButton
                        title="Zellen verbinden"
                        variant="secondary"
                        onPress={zellenVerbinden}
                        disabled={!eigeneAuswahl}
                        testID={`raum-verbinden-${schema.raum}`}
                      />
                      <AppButton
                        title="Zellen trennen"
                        variant="secondary"
                        onPress={zellenTrennen}
                        disabled={!eigeneAuswahl}
                        testID={`raum-trennen-${schema.raum}`}
                      />
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
                  zoom={zoom}
                  bearbeiten={planModus === 'bearbeiten'}
                  werkzeug={werkzeug === 'auswahl' || werkzeug === 'text' ? 'auswahl' : 'malen'}
                  auswahl={eigeneAuswahl}
                  onAuswahl={(bereich) => setAuswahl({ raum: schema.raum, bereich })}
                  onAufziehen={(bereich) => bereichAufziehen(schema.raum, bereich)}
                  onVerschieben={(dZeile, dSpalte) => bereichVerschieben(schema.raum, dZeile, dSpalte)}
                  onBeschriftungText={(zeile, spalte, text) =>
                    beschriftungSchreiben(schema.raum, zeile, spalte, text)
                  }
                  zielZelle={zielZelle?.raum === schema.raum ? zielZelle : null}
                  testID={`raum-plan-${schema.raum}`}
                />
              </View>
            );
          })}
            </View>
          </View>

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
  // Palette und Pläne nebeneinander; auf schmalen Fenstern untereinander.
  editorZeile: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  editorZeileGestapelt: { flexDirection: 'column' },
  palette: { gap: spacing.sm, flexShrink: 0, maxWidth: 200 },
  paletteBreit: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: '100%', alignItems: 'center' },
  palettenTitel: { fontSize: 14, fontWeight: '700', color: colors.text },
  plaene: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: spacing.md },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
