import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  AnzeigeZelle,
  anzeigeBereich,
  PLAN_ANZEIGE_STANDARD,
  PlanAnzeige,
  anzeigeRaster,
  Bereich,
  bereichAus,
  Beschriftung,
  imBereich,
  Platzbelegung,
  platzSchluessel,
  Raumschema,
  Sitzplatz,
  spaltenName,
  zeilenName,
} from '@exam-manager/core';
import { datenAttribute } from '../domProps';
import { colors, radius, spacing } from '../theme';

/**
 * Werkzeug im Bearbeiten-Modus:
 *
 * - `auswahl` – ziehen wählt Zellen aus (ändert nichts); wer in der Auswahl
 *   gedrückt hält und zieht, verschiebt den ganzen Block,
 * - `aufziehen` – ziehen zieht einen Bereich auf und legt etwas darüber
 *   (Textfeld),
 * - `malen` – ziehen setzt das gewählte Element in jede überstrichene Zelle,
 * - `schieben` – ziehen bewegt den Ausschnitt (die Hand), ohne etwas zu ändern,
 * - `zeiger` – ändert nichts: Tippen meldet die Zelle (Infos), Ziehen schiebt
 *   den Ausschnitt. Das ist die Voreinstellung, damit ein Klick nie
 *   versehentlich etwas überschreibt.
 */
export type PlanWerkzeug = 'auswahl' | 'aufziehen' | 'malen' | 'schieben' | 'zeiger';

interface Props {
  schema: Raumschema;
  /**
   * Schlüssel des Raumeinsatzes für Belegung und Sitzplatznummern
   * (`raumSchluessel`) – ohne Angabe der Raumname. Zwei Durchgänge desselben
   * Raums zeigen dasselbe Raster, haben aber je eigene Belegung: Das Raster
   * gehört zum Raum, die Belegung zum Durchgang.
   */
  schluessel?: string;
  /** Anzahl der 90°-Drehungen der Ansicht (0–3). Dreht nur die Darstellung. */
  drehungen: number;
  /** Belegung dieses Raums. */
  belegung: Platzbelegung[];
  /** Sitzplatznummern je Platz (`platzSchluessel`). */
  nummern: Map<string, number>;
  /** Personen je Matrikelnummer. */
  personen: Map<string, Sitzplatz>;
  /** Aktuell ausgewählte Person (wird hervorgehoben). */
  ausgewaehlt?: string | null;
  /** Zelle angetippt bzw. beim Malen überstrichen (kanonische Position). */
  onZellePress?: (zeile: number, spalte: number) => void;

  /**
   * Wie groß gezeichnet wird: eingepasst, auf die volle Breite oder frei in
   * Pixeln. Große Räume (47 × 34 Felder) passen eingepasst auch auf einen
   * 1920×1080-Schirm, schmale Räume nutzen auf Breite den Platz daneben.
   */
  ansicht?: PlanAnsicht;
  /**
   * Meldet die tatsächlich gezeichnete Zellgröße. Der Zoom in Pixeln setzt
   * darauf auf: Wer aus einer eingepassten Ansicht heraus vergrößert, will es
   * ab dem, was er gerade sieht.
   */
  onZellGroesse?: (groesse: number) => void;
  /**
   * Der Plan sitzt in einem eigenen Fenster, das sich schieben und zoomen
   * lässt (Finger, Rad, Zwei-Finger-Geste). Ohne das wächst er wie bisher in
   * die Höhe und scrollt nur waagerecht – so gehört er auf Aushang und Druck,
   * denn Papier hat keinen Ausschnitt.
   */
  beweglich?: boolean;
  /**
   * Feste Höhe des Planfensters (nur mit `beweglich`). Die Arbeitsfläche gibt
   * hier an, was zwischen Menüband und Fußleiste übrig ist – ohne Angabe
   * richtet sich das Fenster nach der Fensterhöhe (`planFensterHoehe`).
   */
  hoehe?: number;
  /**
   * Neue Zellgröße aus einer Zoom-Geste (Zwei-Finger-Zoom, Strg + Mausrad).
   * Ohne diesen Rückruf zoomt die Geste nicht – die Ansicht gehört dem, der
   * den Plan einbindet.
   */
  onZoomGeste?: (zellGroesse: number) => void;

  // --- nur im Bearbeiten-Modus ---
  /** Zeigt Auswahl und Ziehgriff und schaltet das Ziehen frei. */
  bearbeiten?: boolean;
  werkzeug?: PlanWerkzeug;
  /** Ausgewählter Bereich (kanonisch). */
  auswahl?: Bereich | null;
  onAuswahl?: (bereich: Bereich) => void;
  /** Auswahl verschieben (kanonische Verschiebung). */
  onVerschieben?: (dZeile: number, dSpalte: number) => void;
  /** Auswahl über mehrere Felder aufziehen (neuer kanonischer Bereich). */
  onAufziehen?: (bereich: Bereich) => void;
  /** Text eines verbundenen Feldes geändert (obere linke Zelle des Feldes). */
  onBeschriftungText?: (zeile: number, spalte: number, text: string) => void;
  /** Zelle, über der gerade ein Element aus der Palette schwebt. */
  zielZelle?: { zeile: number; spalte: number } | null;
  /**
   * Ein Zug ist zu Ende (losgelassen). Der Verlauf fasst daran einen Malzug
   * über viele Zellen zu einem Schritt zusammen.
   */
  onZugEnde?: () => void;

  /**
   * Was in den Kästen steht (Kürzel, Matrikelnummer, Platznummer, „Pult“).
   * Dasselbe Objekt geht ins PDF – gedruckt wird, was man sieht.
   */
  anzeige?: PlanAnzeige;
  /**
   * Zeilen- und Spaltenköpfe wie in einer Tabellenkalkulation. Am Aushang
   * stören sie nur; beim Bearbeiten zeigen sie, wie groß der Raum ist.
   */
  gitter?: boolean;
  testID?: string;
}

/** Laufender Zug auf dem Raster (alles in Anzeige-Koordinaten). */
interface Zug {
  /**
   * `auswaehlen` markiert nur, `verschieben` schiebt die Auswahl, `groesse`
   * zieht einen Bereich auf (Griff oder Textwerkzeug), `malen` setzt Zellen.
   */
  art: 'malen' | 'auswaehlen' | 'verschieben' | 'groesse';
  start: { zeile: number; spalte: number };
  aktuell: { zeile: number; spalte: number };
  /** Beim Aufziehen der feste Eckpunkt (Anzeige oben links der Auswahl). */
  anker?: { zeile: number; spalte: number };
}

/**
 * Was die Finger gerade mit dem Ausschnitt tun: einer schiebt ihn, zwei
 * schieben und zoomen zugleich (der Abstand zwischen ihnen ist der Maßstab).
 */
type Geste =
  | {
      art: 'schieben';
      /** Wo der Finger aufgesetzt hat und wie der Ausschnitt dabei stand. */
      start: { x: number; y: number; links: number; oben: number };
      /** Ab `TIPP_TOLERANZ` gilt es als Wischen – davor als Tippen. */
      bewegt: boolean;
    }
  | {
      art: 'zwei';
      bewegt: true;
      /** Fingerabstand und Zellgröße zu Beginn – daraus wird der Maßstab. */
      distanz: number;
      groesse: number;
    };

/** Ein Punkt des Plans (in Zellen), der beim Zoomen unter den Fingern bleibt. */
interface Anker {
  spalte: number;
  zeile: number;
  /** Der Bildschirmpunkt, an dem er liegen soll. */
  x: number;
  y: number;
  /** Bleibt über mehrere Schritte stehen (Zwei-Finger-Geste) oder gilt einmal (Rad). */
  dauerhaft: boolean;
}

/**
 * Zellen sind halb so hoch wie breit. Ein Sitzplatz ist ein Tisch, und Tische
 * stehen quer: So passen doppelt so viele Reihen ins Bild, ohne dass die
 * Kästen schmaler und die Namen darin unleserlich werden.
 */
const ZELL_HOEHE_ANTEIL = 0.5;

/** Grenzen der Zellgröße beim Einpassen: für große Räume klein, zum Lesen groß. */
const ZELLE_MIN = 14;
const ZELLE_MAX = 120;
/** Grenzen der frei eingestellten Zellgröße (Zoom in Pixeln). */
export const ZELLE_FREI_MIN = 8;
export const ZELLE_FREI_MAX = 240;
/** Höhe, die neben dem Plan für Kopfzeile, Schaltflächen und Listen bleibt. */
const HOEHE_FUER_DEN_REST = 340;
/** So hoch ist das Planfenster mindestens – darunter sieht man nichts mehr. */
const HOEHE_MINDESTENS = 280;
/**
 * Bis hierhin gilt ein Druck als Tippen und nicht als Wischen (in Pixeln).
 * Ein Finger trifft nie genau denselben Punkt, an dem er aufgesetzt hat.
 */
const TIPP_TOLERANZ = 8;
/** Ein Rasten am Mausrad (mit Strg) vergrößert bzw. verkleinert um so viel. */
const RAD_SCHRITT = 1.12;
/**
 * Polster rings um den Plan und Abstand zwischen Kopfzeile und Raster – beides
 * steht so in `styles.aussen` und zählt beim Einpassen mit.
 */
const PLAN_POLSTER = spacing.xs;
const KOPF_ABSTAND = 4;

/**
 * Höhe des Fensters, in dem ein beweglicher Plan liegt. Dieselbe Höhe rechnet
 * `rastermasse` für „Ganzer Raum“ aus – so passt der eingepasste Plan genau
 * hinein, statt knapp daneben.
 */
export function planFensterHoehe(fensterHoehe: number): number {
  return Math.max(HOEHE_MINDESTENS, fensterHoehe - HOEHE_FUER_DEN_REST);
}

/**
 * Wie groß die Zellen gezeichnet werden:
 *
 * - `einpassen` – der ganze Raum passt ins Fenster (nichts zu scrollen),
 * - `breite` – die volle Breite wird genutzt, in die Höhe wird gescrollt,
 * - `frei` – feste Zellgröße in Pixeln, wie das Zoomen in ein Bild.
 */
export type Ansichtsmodus = 'einpassen' | 'breite' | 'frei';

export interface PlanAnsicht {
  modus: Ansichtsmodus;
  /** Zellgröße in Pixeln – zählt nur im Modus `frei`. */
  zellGroesse: number;
}

/**
 * Voreinstellung eines eingebetteten Plans (Aushang, Druck): der ganze Raum
 * am Stück – auf Papier gibt es kein Scrollen.
 */
export const PLAN_ANSICHT: PlanAnsicht = { modus: 'einpassen', zellGroesse: 32 };

/**
 * Voreinstellung im Editor: der ganze Raum am Stück.
 *
 * Der Plan füllt dort die Arbeitsfläche zwischen Menüband und Fußleiste – bei
 * dieser Höhe passt auch ein Hörsaal mit 44 × 32 Feldern hinein, und man sieht
 * den Raum, ohne ihn erst zusammenscrollen zu müssen. Wer es größer braucht,
 * schaltet in der Fußleiste auf „Auf Breite“ oder zoomt.
 */
export const PLAN_ANSICHT_EDITOR: PlanAnsicht = { modus: 'einpassen', zellGroesse: 32 };

function begrenze(wert: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(wert, min), max));
}

/** Fuge zwischen zwei Zellen – bei kleinen Zellen wäre mehr Fuge als Zelle. */
function fugenbreite(zellGroesse: number): number {
  return zellGroesse >= 40 ? 4 : zellGroesse >= 24 ? 2 : 1;
}

/**
 * Was eine Zellgröße nach sich zieht: Fuge, Zeilenhöhe und die Größe der
 * Köpfe. Alles hängt an der Zellgröße – sonst wäre bei 47 Spalten mehr Fuge
 * als Zelle zu sehen.
 */
function zellMasse(groesse: number) {
  return {
    abstand: fugenbreite(groesse),
    zellHoehe: Math.max(7, Math.round(groesse * ZELL_HOEHE_ANTEIL)),
    kopfGroesse: begrenze(groesse * 0.34, 11, 22),
  };
}

/**
 * Wie viel Platz der Plan bei dieser Zellgröße wirklich einnimmt – gerechnet
 * wie er gezeichnet wird: Polster außen (`styles.aussen`), die Köpfe, der
 * Abstand zwischen Kopfzeile und Raster und die Fuge zwischen je zwei Zellen.
 *
 * Die Zugaben sind der Grund, warum „Ganzer Raum“ vorher nicht aufging: Bei
 * 31 Zeilen sind allein die Fugen und die Kopfzeile rund 80 px, und genau die
 * lagen dann unter dem unteren Rand.
 */
function planMasse(groesse: number, zeilen: number, spalten: number) {
  const { abstand, zellHoehe, kopfGroesse } = zellMasse(groesse);
  return {
    breite: 2 * PLAN_POLSTER + kopfGroesse + spalten * (groesse + abstand),
    hoehe:
      2 * PLAN_POLSTER +
      kopfGroesse +
      KOPF_ABSTAND +
      zeilen * zellHoehe +
      (zeilen - 1) * abstand,
  };
}

/**
 * Die größte Zellgröße, mit der der Plan noch in den Platz passt. Gesucht wird
 * sie, statt sie auszurechnen: Fuge und Kopfgröße springen in Stufen, eine
 * geschlossene Formel träfe daneben. Die Maße wachsen mit der Zellgröße, also
 * genügt eine Halbierungssuche (rund sieben Schritte).
 *
 * `mitHoehe` = „Ganzer Raum“: Dann muss auch die Höhe reichen. „Auf Breite“
 * scrollt in die Höhe, dort zählt nur die Breite.
 */
function passendeZellGroesse(
  zeilen: number,
  spalten: number,
  breite: number,
  hoehe: number,
  mitHoehe: boolean,
): number {
  const passt = (groesse: number) => {
    const masse = planMasse(groesse, zeilen, spalten);
    return masse.breite <= breite && (!mitHoehe || masse.hoehe <= hoehe);
  };
  // Passt selbst die kleinste Zelle nicht, bleibt es bei ihr – dann wird
  // gescrollt, statt den Plan bis zur Unlesbarkeit zu schrumpfen.
  if (!passt(ZELLE_MIN)) return ZELLE_MIN;
  let klein = ZELLE_MIN;
  let gross = ZELLE_MAX;
  while (klein < gross) {
    const mitte = Math.ceil((klein + gross) / 2);
    if (passt(mitte)) klein = mitte;
    else gross = mitte - 1;
  }
  return klein;
}

/**
 * Maße des Rasters zu einer Raumgröße. Wie groß eine Zelle wird, sagt die
 * Ansicht: eingepasst (ganzer Raum sichtbar), auf Breite (volle Breite, in
 * die Höhe wird gescrollt) oder frei in Pixeln.
 */
export function rastermasse(
  anzahlZeilen: number,
  anzahlSpalten: number,
  breite: number,
  hoehe: number,
  ansicht: PlanAnsicht = PLAN_ANSICHT,
) {
  const zeilen = Math.max(1, anzahlZeilen);
  const spalten = Math.max(1, anzahlSpalten);
  const groesse =
    ansicht.modus === 'frei'
      ? begrenze(ansicht.zellGroesse, ZELLE_FREI_MIN, ZELLE_FREI_MAX)
      : passendeZellGroesse(zeilen, spalten, breite, hoehe, ansicht.modus === 'einpassen');
  const { abstand, zellHoehe, kopfGroesse } = zellMasse(groesse);
  return {
    groesse,
    zellHoehe,
    abstand,
    kopfGroesse,
    kopfSchrift: begrenze(groesse * 0.22, 8, 11),
    /** Ab hier passen zwei Zeilen Text in den Kasten, darunter nur eine. */
    zeigeDetails: zellHoehe >= 24,
    zeigeNamen: zellHoehe >= 11,
    namenSchrift: begrenze(zellHoehe * 0.52, 7, 13),
    kleinSchrift: begrenze(zellHoehe * 0.44, 6, 11),
  };
}

type Rastermasse = ReturnType<typeof rastermasse>;

/**
 * Sitzplan eines Raums als Raster.
 *
 * Die Ansicht lässt sich um jeweils 90° drehen, damit sie zur eigenen
 * Blickrichtung im Raum passt. Gedreht wird nur die Darstellung – jede Zelle
 * behält ihre gespeicherte Position, Sitzplatznummern bleiben also gleich.
 *
 * Das Raster hat Köpfe wie eine Tabellenkalkulation: Spalten A, B, C …,
 * Zeilen 1, 2, 3 … So ist zu sehen, wie groß der Raum ist und wo sich klicken
 * lässt – auch dort, wo (noch) nichts steht. Der Aushang (`gitter={false}`)
 * verzichtet darauf. Beschriftet wird immer das, was man sieht: Nach einer Drehung
 * benennen die Köpfe die gedrehte Ansicht.
 *
 * Die Zellgröße richtet sich nach der Ansicht: eingepasst passt der ganze Raum
 * ins Fenster (auch ein Hörsaal mit 47 × 34 Feldern), auf Breite nutzt er die
 * volle Breite, und frei gezoomt gibt man die Zellgröße in Pixeln vor wie bei
 * einem Bild. Was nicht mehr hineinpasst, wird gescrollt.
 *
 * Im Bearbeiten-Modus wird gezogen wie in einer Tabellenkalkulation: Mit
 * einem Element aus der Palette malt das Ziehen (praktisch für Wände), mit
 * „Auswählen“ markiert es nur – und wer danach *in* der Auswahl gedrückt hält
 * und zieht, verschiebt den ganzen Block. Am Griff an der unteren Ecke zieht
 * man die Auswahl über mehrere Felder auf und füllt sie dabei.
 *
 * Welche Zelle unter dem Finger liegt, wird aus den Koordinaten gerechnet
 * (nicht aus Hover-Ereignissen): Beim Ziehen mit dem Finger bleiben alle
 * Ereignisse beim Startelement. Bewegung und Loslassen hört deshalb das
 * Fenster mit, solange ein Zug läuft.
 */
export function Raumplan({
  schema,
  schluessel,
  drehungen,
  belegung,
  nummern,
  personen,
  ausgewaehlt,
  onZellePress,
  ansicht = PLAN_ANSICHT,
  onZellGroesse,
  beweglich,
  hoehe,
  onZoomGeste,
  bearbeiten,
  werkzeug = 'auswahl',
  auswahl,
  onAuswahl,
  onVerschieben,
  onAufziehen,
  onBeschriftungText,
  zielZelle,
  onZugEnde,
  anzeige = PLAN_ANZEIGE_STANDARD,
  gitter = true,
  testID,
}: Props) {
  const fenster = useWindowDimensions();
  const [breite, setBreite] = useState(0);
  const gitterRef = useRef<View>(null);
  /** Das Fenster, in dem der Plan liegt – es wird geschoben und gezoomt. */
  const flaecheRef = useRef<View>(null);
  const [zug, setZug] = useState<Zug | null>(null);
  /**
   * Der laufende Zug zusätzlich im Ref: Die Ereignisse kommen schneller, als
   * React neu rendert, und das Ende eines Zuges meldet sowohl das Raster als
   * auch das Fenster (losgelassen wird oft außerhalb). Wer den Zug beendet,
   * räumt hier auf – so wird er nur einmal ausgewertet.
   */
  const zugRef = useRef<Zug | null>(null);
  const setzeZug = (neu: Zug | null) => {
    zugRef.current = neu;
    setZug(neu);
  };

  /** Woran Belegung und Nummern hängen (Durchgang), nicht am Raster (Raum). */
  const belegSchluessel = schluessel ?? schema.raum;

  const raster = useMemo(() => anzeigeRaster(schema, drehungen), [schema, drehungen]);
  const spaltenAnzahl = raster[0]?.length ?? 0;
  const mitGitter = gitter;

  // Auf der Arbeitsfläche zählt der Platz zwischen den Leisten, sonst die Fensterhöhe.
  const fensterHoehe = hoehe && hoehe > 0 ? hoehe : planFensterHoehe(fenster.height);
  const masse = rastermasse(
    raster.length,
    spaltenAnzahl,
    (breite > 0 ? breite : fenster.width) - spacing.md,
    fensterHoehe,
    ansicht,
  );
  const { groesse, zellHoehe, abstand, kopfGroesse } = masse;
  const schritt = groesse + abstand;
  const schrittZeile = zellHoehe + abstand;

  useEffect(() => {
    onZellGroesse?.(groesse);
  }, [groesse, onZellGroesse]);

  const belegungJePlatz = useMemo(
    () =>
      new Map(belegung.map((platz) => [platzSchluessel(platz.raum, platz.zeile, platz.spalte), platz])),
    [belegung],
  );

  /**
   * Anzeige-Position einer Zelle aus den Bildschirmkoordinaten.
   *
   * `begrenzen` fängt ab, was neben dem Raster liegt: Beim Auswählen und
   * Verschieben zieht man leicht über den Rand hinaus, und dort soll die
   * Auswahl an der letzten Zelle stehenbleiben statt einzufrieren. Beim Malen
   * bleibt es bei `null` – gemalt wird nur, wo der Zeiger wirklich war.
   */
  const zelleBeiPunkt = (
    x: number,
    y: number,
    begrenzen = false,
  ): { zeile: number; spalte: number } | null => {
    const knoten = gitterRef.current as unknown as HTMLElement | null;
    if (!knoten || raster.length === 0 || spaltenAnzahl === 0) return null;
    // Der gemessene Knoten ist genau das Zellraster (die Köpfe liegen außerhalb),
    // die erste Zelle beginnt also an seiner Ecke.
    const rect = knoten.getBoundingClientRect();
    const zeile = Math.floor((y - rect.top) / schrittZeile);
    const spalte = Math.floor((x - rect.left) / schritt);
    if (zeile < 0 || spalte < 0 || zeile >= raster.length || spalte >= spaltenAnzahl) {
      if (!begrenzen) return null;
      return {
        zeile: Math.min(Math.max(zeile, 0), raster.length - 1),
        spalte: Math.min(Math.max(spalte, 0), spaltenAnzahl - 1),
      };
    }
    return { zeile, spalte };
  };

  const kanonisch = (position: { zeile: number; spalte: number }) =>
    raster[position.zeile][position.spalte];

  /** Anzeige-Rechteck der Auswahl – für Griff und Vorschau. */
  const auswahlAnzeige = auswahl ? anzeigeBereich(auswahl, schema, drehungen) : null;

  /** Vorschau während eines Zugs (Anzeige-Koordinaten). */
  const vorschau = (() => {
    if (!zug) return null;
    if (zug.art === 'auswaehlen') return bereichAus(zug.start, zug.aktuell);
    if (zug.art === 'groesse' && zug.anker) return bereichAus(zug.anker, zug.aktuell);
    if (zug.art === 'verschieben' && auswahlAnzeige) {
      return {
        ...auswahlAnzeige,
        zeile: auswahlAnzeige.zeile + (zug.aktuell.zeile - zug.start.zeile),
        spalte: auswahlAnzeige.spalte + (zug.aktuell.spalte - zug.start.spalte),
      };
    }
    return null;
  })();

  const zellePointerDown = (anzeige: { zeile: number; spalte: number }) => {
    const zelle = kanonisch(anzeige);
    if (!bearbeiten) {
      // Im beweglichen Plan entscheidet erst das Loslassen, ob das ein Tippen
      // war oder ein Wischen (`gesteEnde`) – sonst öffnete jeder Wischer einen
      // Platz, statt den Ausschnitt zu schieben.
      if (!beweglich) onZellePress?.(zelle.zeile, zelle.spalte);
      return;
    }
    // Hand und Zeiger ändern nichts: Die Hand schiebt nur den Ausschnitt, der
    // Zeiger meldet die Zelle erst beim Loslassen (siehe `gesteEnde`).
    if (werkzeug === 'schieben' || werkzeug === 'zeiger') return;
    // In der Auswahl gedrückt: gedrückt halten und ziehen verschiebt den
    // ganzen Block – wie ein Kasten in einer Tabellenkalkulation.
    if (werkzeug === 'auswahl' && auswahl && imBereich(auswahl, zelle.zeile, zelle.spalte)) {
      setzeZug({ art: 'verschieben', start: anzeige, aktuell: anzeige });
      return;
    }
    if (werkzeug === 'malen') {
      onZellePress?.(zelle.zeile, zelle.spalte);
      setzeZug({ art: 'malen', start: anzeige, aktuell: anzeige });
      return;
    }
    if (werkzeug === 'auswahl') {
      // Auswählen verändert nichts: Es markiert die Zelle, und wer zieht,
      // markiert das Rechteck bis dorthin. Gefüllt wird erst am Griff.
      onAuswahl?.(bereichAus(zelle, zelle));
      setzeZug({ art: 'auswaehlen', start: anzeige, aktuell: anzeige });
      return;
    }
    // Aufziehen (Textwerkzeug): der Bereich entsteht beim Loslassen.
    onAuswahl?.(bereichAus(zelle, zelle));
    setzeZug({ art: 'groesse', start: anzeige, aktuell: anzeige, anker: anzeige });
  };

  // Die Zellen bekommen stabile Rückrufe, damit `React.memo` greift: Bei
  // 47 × 34 Feldern würde sonst jeder Zug das ganze Raster neu rendern.
  const aktuelleHandler = useRef({ zellePointerDown, auswahlAnzeige });
  aktuelleHandler.current = { zellePointerDown, auswahlAnzeige };

  const zellDown = useCallback((zeile: number, spalte: number) => {
    aktuelleHandler.current.zellePointerDown({ zeile, spalte });
  }, []);

  const griffDown = useCallback(() => {
    const bereich = aktuelleHandler.current.auswahlAnzeige;
    if (!bereich) return;
    const ecke = { zeile: bereich.zeile + bereich.hoehe - 1, spalte: bereich.spalte + bereich.breite - 1 };
    setzeZug({ art: 'groesse', start: ecke, aktuell: ecke, anker: { zeile: bereich.zeile, spalte: bereich.spalte } });
  }, []);

  const pointerMove = (x: number, y: number) => {
    const laufend = zugRef.current;
    if (!laufend) return;
    const position = zelleBeiPunkt(x, y, laufend.art !== 'malen');
    if (!position) return;
    if (position.zeile === laufend.aktuell.zeile && position.spalte === laufend.aktuell.spalte) {
      return;
    }
    if (laufend.art === 'malen') {
      const zelle = kanonisch(position);
      onZellePress?.(zelle.zeile, zelle.spalte);
    }
    if (laufend.art === 'auswaehlen') {
      // Die Auswahl wächst schon während des Ziehens mit – sonst sähe man
      // erst beim Loslassen, was man erwischt hat.
      onAuswahl?.(bereichAus(kanonisch(laufend.start), kanonisch(position)));
    }
    setzeZug({ ...laufend, aktuell: position });
  };

  const pointerUp = () => {
    const laufend = zugRef.current;
    if (!laufend) return;
    zugRef.current = null;
    if (laufend.art === 'groesse' && laufend.anker) {
      onAufziehen?.(bereichAus(kanonisch(laufend.anker), kanonisch(laufend.aktuell)));
    } else if (laufend.art === 'verschieben') {
      const von = kanonisch(laufend.start);
      const bis = kanonisch(laufend.aktuell);
      if (von.zeile === bis.zeile && von.spalte === bis.spalte) {
        // Nur angetippt, nicht gezogen: Das war kein Verschieben, sondern die
        // Auswahl auf diese eine Zelle – sonst käme man aus einer großen
        // Auswahl nicht mehr heraus.
        onAuswahl?.(bereichAus(bis, bis));
      } else {
        onVerschieben?.(bis.zeile - von.zeile, bis.spalte - von.spalte);
      }
    }
    // Beim Auswählen steht die Auswahl schon – hier ist nichts mehr zu tun.
    setZug(null);
    onZugEnde?.();
  };

  /**
   * Solange gezogen wird, hört das Fenster mit: Losgelassen wird oft neben
   * dem Raster (beim Verschieben über den Rand hinaus, oder wenn der Zeiger
   * das Fenster verlässt). Ohne das bliebe der Zug hängen und die nächste
   * Berührung würde ihn fortsetzen.
   */
  const zeigerHandler = useRef({ pointerMove, pointerUp });
  zeigerHandler.current = { pointerMove, pointerUp };
  const zieht = zug !== null;
  useEffect(() => {
    if (!zieht) return;
    const bewegt = (ereignis: globalThis.PointerEvent) =>
      zeigerHandler.current.pointerMove(ereignis.clientX, ereignis.clientY);
    const beendet = () => zeigerHandler.current.pointerUp();
    window.addEventListener('pointermove', bewegt);
    window.addEventListener('pointerup', beendet);
    window.addEventListener('pointercancel', beendet);
    return () => {
      window.removeEventListener('pointermove', bewegt);
      window.removeEventListener('pointerup', beendet);
      window.removeEventListener('pointercancel', beendet);
    };
  }, [zieht]);

  // --- Schieben und Zoomen im Planfenster ---------------------------------
  //
  // Auf dem Planfenster steht `touch-action: none`: Was mit dem Finger
  // geschieht, entscheidet der Plan selbst. Zwei Finger schieben und zoomen
  // immer (auch mitten im Zeichnen), ein Finger schiebt dort, wo er nichts
  // zeichnet – im Sitzplan (Schritt 4) und mit dem Werkzeug „Verschieben“.
  // Sonst bliebe auf einem Handy nur das, was gerade im Ausschnitt steht: Ein
  // Hörsaal mit 44 Spalten ist dort nie am Stück zu sehen.

  /** Alle Finger/Zeiger, die gerade auf dem Planfenster liegen. */
  const zeigerRef = useRef(new Map<number, { x: number; y: number }>());
  /** Was gerade gezogen wird – ein Finger schiebt, zwei schieben und zoomen. */
  const gesteRef = useRef<Geste | null>(null);
  /**
   * Der Punkt des Plans, der beim Zoomen unter den Fingern bleiben soll –
   * gemessen in Zellen, damit er von der Zellgröße unabhängig ist. Ohne ihn
   * zöge jeder Zoomschritt den Plan unter der Hand weg.
   */
  const ankerRef = useRef<Anker | null>(null);
  /** Die aktuellen Schrittweiten für die Rückrufe (dort ist der Render zu alt). */
  const masseRef = useRef({ schritt, schrittZeile, groesse });
  masseRef.current = { schritt, schrittZeile, groesse };

  const planFenster = () => flaecheRef.current as unknown as HTMLElement | null;

  const merkeAnker = (x: number, y: number, dauerhaft: boolean) => {
    const knoten = planFenster();
    if (!knoten) return;
    const rect = knoten.getBoundingClientRect();
    ankerRef.current = {
      spalte: (knoten.scrollLeft + x - rect.left) / masseRef.current.schritt,
      zeile: (knoten.scrollTop + y - rect.top) / masseRef.current.schrittZeile,
      x,
      y,
      dauerhaft,
    };
  };

  /** Den gemerkten Punkt wieder unter die Finger holen (schiebt und zoomt). */
  const halteAnker = () => {
    const anker = ankerRef.current;
    const knoten = planFenster();
    if (!anker || !knoten) return;
    const rect = knoten.getBoundingClientRect();
    knoten.scrollLeft = anker.spalte * masseRef.current.schritt - (anker.x - rect.left);
    knoten.scrollTop = anker.zeile * masseRef.current.schrittZeile - (anker.y - rect.top);
  };

  // Der Zoom kommt erst über die Ansicht zurück – der Anker greift deshalb
  // noch einmal, sobald die neue Zellgröße gezeichnet ist.
  useLayoutEffect(() => {
    if (!ankerRef.current) return;
    halteAnker();
    if (!ankerRef.current.dauerhaft) ankerRef.current = null;
    // Absicht: nur die Größe zählt, `halteAnker` liest den Rest aus Refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schritt, schrittZeile]);

  const zoomen = (faktor: number) => {
    if (!onZoomGeste) return;
    const ziel = begrenze(masseRef.current.groesse * faktor, ZELLE_FREI_MIN, ZELLE_FREI_MAX);
    if (ziel !== masseRef.current.groesse) onZoomGeste(ziel);
  };

  /** Ein laufendes Malen/Auswählen abbrechen – die Finger meinen jetzt den Ausschnitt. */
  const zugAbbrechen = () => {
    if (!zugRef.current) return;
    zugRef.current = null;
    setZug(null);
    onZugEnde?.();
  };

  /** Schiebt ein einzelner Finger? Nur, wo er nichts zu zeichnen hat. */
  const einFingerSchiebt = () =>
    !bearbeiten || werkzeug === 'schieben' || werkzeug === 'zeiger';

  /** Meldet ein Tippen die Zelle? Im Sitzplan und mit dem Zeiger. */
  const tippenMeldetZelle = () => !bearbeiten || werkzeug === 'zeiger';

  const gesteStart = (ereignis: globalThis.PointerEvent) => {
    // In einem Textfeld will man tippen und markieren, nicht schieben.
    if (istEingabefeld(ereignis.target)) return;
    const zeiger = zeigerRef.current;
    zeiger.set(ereignis.pointerId, { x: ereignis.clientX, y: ereignis.clientY });
    if (zeiger.size === 2) {
      const [a, b] = [...zeiger.values()];
      gesteRef.current = {
        art: 'zwei',
        bewegt: true,
        distanz: Math.hypot(a.x - b.x, a.y - b.y),
        groesse: masseRef.current.groesse,
      };
      merkeAnker((a.x + b.x) / 2, (a.y + b.y) / 2, true);
      // Der zweite Finger gilt dem Ausschnitt, nicht der Zelle unter dem ersten.
      zugAbbrechen();
      ereignis.stopPropagation();
      return;
    }
    if (zeiger.size !== 1 || !einFingerSchiebt()) return;
    const knoten = planFenster();
    if (!knoten) return;
    gesteRef.current = {
      art: 'schieben',
      bewegt: false,
      start: {
        x: ereignis.clientX,
        y: ereignis.clientY,
        links: knoten.scrollLeft,
        oben: knoten.scrollTop,
      },
    };
  };

  const gesteBewegt = (ereignis: globalThis.PointerEvent) => {
    const zeiger = zeigerRef.current;
    if (!zeiger.has(ereignis.pointerId)) return;
    zeiger.set(ereignis.pointerId, { x: ereignis.clientX, y: ereignis.clientY });
    const geste = gesteRef.current;
    const knoten = planFenster();
    if (!geste || !knoten) return;
    if (geste.art === 'zwei') {
      const [a, b] = [...zeiger.values()];
      if (!a || !b) return;
      const anker = ankerRef.current;
      if (anker) {
        // Der gemerkte Punkt folgt der Mitte zwischen den Fingern: Damit
        // schiebt dieselbe Geste auch, wenn der Abstand gleich bleibt.
        anker.x = (a.x + b.x) / 2;
        anker.y = (a.y + b.y) / 2;
      }
      const distanz = Math.hypot(a.x - b.x, a.y - b.y);
      if (geste.distanz > 0 && distanz > 0) {
        const ziel = begrenze(
          geste.groesse * (distanz / geste.distanz),
          ZELLE_FREI_MIN,
          ZELLE_FREI_MAX,
        );
        if (ziel !== masseRef.current.groesse) onZoomGeste?.(ziel);
      }
      halteAnker();
      return;
    }
    const dx = ereignis.clientX - geste.start.x;
    const dy = ereignis.clientY - geste.start.y;
    if (!geste.bewegt && Math.hypot(dx, dy) > TIPP_TOLERANZ) geste.bewegt = true;
    if (!geste.bewegt) return;
    knoten.scrollLeft = geste.start.links - dx;
    knoten.scrollTop = geste.start.oben - dy;
  };

  const gesteEnde = (ereignis: globalThis.PointerEvent) => {
    const zeiger = zeigerRef.current;
    if (!zeiger.has(ereignis.pointerId)) return;
    const geste = gesteRef.current;
    zeiger.delete(ereignis.pointerId);
    // Eine Zwei-Finger-Geste endet mit dem ersten Finger, der geht: Der zweite
    // allein würde sonst als Schieben weiterlaufen, wo er gerade liegt.
    if (zeiger.size < 2) {
      gesteRef.current = null;
      ankerRef.current = null;
    }
    if (geste?.art !== 'schieben') return;
    // Ein Tippen wirkt erst beim Loslassen – so öffnet ein Wischen über den
    // Plan keinen Platz, sondern schiebt den Ausschnitt.
    if (geste.bewegt || !tippenMeldetZelle()) return;
    const position = zelleBeiPunkt(ereignis.clientX, ereignis.clientY);
    if (!position) return;
    const zelle = kanonisch(position);
    onZellePress?.(zelle.zeile, zelle.spalte);
  };

  /** Am Rad zoomt nur, wer Strg/⌘ hält – sonst scrollt das Fenster wie gewohnt. */
  const aufRad = (ereignis: WheelEvent) => {
    if (!ereignis.ctrlKey && !ereignis.metaKey) return;
    ereignis.preventDefault();
    merkeAnker(ereignis.clientX, ereignis.clientY, false);
    zoomen(ereignis.deltaY < 0 ? RAD_SCHRITT : 1 / RAD_SCHRITT);
  };

  const gesten = useRef({ gesteStart, gesteBewegt, gesteEnde, aufRad });
  gesten.current = { gesteStart, gesteBewegt, gesteEnde, aufRad };
  useEffect(() => {
    const knoten = flaecheRef.current as unknown as HTMLElement | null;
    if (!beweglich || !knoten) return;
    // In der Capture-Phase, damit der zweite Finger vor den Zellen drankommt;
    // Bewegung und Loslassen hört das Fenster mit, denn losgelassen wird oft
    // neben dem Plan.
    const gedrueckt = (e: globalThis.PointerEvent) => gesten.current.gesteStart(e);
    const bewegt = (e: globalThis.PointerEvent) => gesten.current.gesteBewegt(e);
    const beendet = (e: globalThis.PointerEvent) => gesten.current.gesteEnde(e);
    const gerollt = (e: WheelEvent) => gesten.current.aufRad(e);
    knoten.addEventListener('pointerdown', gedrueckt, true);
    window.addEventListener('pointermove', bewegt, true);
    window.addEventListener('pointerup', beendet, true);
    window.addEventListener('pointercancel', beendet, true);
    knoten.addEventListener('wheel', gerollt, { passive: false });
    return () => {
      knoten.removeEventListener('pointerdown', gedrueckt, true);
      window.removeEventListener('pointermove', bewegt, true);
      window.removeEventListener('pointerup', beendet, true);
      window.removeEventListener('pointercancel', beendet, true);
      knoten.removeEventListener('wheel', gerollt);
    };
  }, [beweglich]);

  /** Zellen unter einem verbundenen Textfeld – sie liegen hinter dem Feld. */
  const verdeckt = useMemo(() => {
    const schluessel = new Set<string>();
    for (const b of schema.beschriftungen) {
      for (let z = b.zeile; z < b.zeile + b.hoehe; z++) {
        for (let s = b.spalte; s < b.spalte + b.breite; s++) schluessel.add(`${z}|${s}`);
      }
    }
    return schluessel;
  }, [schema.beschriftungen]);

  const merkeBreite = (ereignis: LayoutChangeEvent) => {
    const gemessen = Math.round(ereignis.nativeEvent.layout.width);
    if (gemessen > 0 && gemessen !== breite) setBreite(gemessen);
  };

  const inhalt = (
    <View style={[styles.aussen, beweglich ? styles.aussenBeweglich : null]}>
      {mitGitter ? (
        <View style={[styles.kopfZeile, { gap: abstand }]}>
          <View style={{ width: kopfGroesse, height: kopfGroesse }} />
          {Array.from({ length: spaltenAnzahl }, (_, s) => (
            <View key={s} style={[styles.kopf, { width: groesse, height: kopfGroesse }]}>
              <Text style={[styles.kopfText, { fontSize: masse.kopfSchrift }]} numberOfLines={1}>
                {spaltenName(s)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.innen, { gap: abstand }]}>
        {mitGitter ? (
          <View style={{ gap: abstand }}>
            {raster.map((_, z) => (
              <View key={z} style={[styles.kopf, { width: kopfGroesse, height: zellHoehe }]}>
                <Text style={[styles.kopfText, { fontSize: masse.kopfSchrift }]} numberOfLines={1}>
                  {zeilenName(z)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View
          ref={gitterRef}
          // Eigene Kennung: Die Köpfe liegen außerhalb, das reine Zellraster ist
          // der Bezugspunkt für Koordinaten (und für Tests).
          testID={testID ? `${testID}-raster` : undefined}
          style={[styles.raster, { gap: abstand }, bearbeiten ? ohneBrowserGeste : null]}
          // Zusätzlich zum Fenster (siehe oben): Wird sehr schnell geklickt,
          // ist das Loslassen da, bevor der Effekt den Zeiger am Fenster
          // angemeldet hat. Doppelt schadet nicht – `pointerUp` räumt den Zug
          // im Ref auf und tut beim zweiten Mal nichts.
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
        >
          {raster.map((zeile, z) => (
            <View key={z} style={[styles.zeile, { gap: abstand }]}>
              {zeile.map((zelle, s) => {
                const platz = platzSchluessel(belegSchluessel, zelle.zeile, zelle.spalte);
                return (
                  <Zelle
                    key={s}
                    zeile={z}
                    spalte={s}
                    zelle={zelle}
                    masse={masse}
                    platz={belegungJePlatz.get(platz)}
                    nummer={nummern.get(platz)}
                    personen={personen}
                    ausgewaehlt={ausgewaehlt ?? null}
                    anzeige={anzeige}
                    gitter={mitGitter}
                    verdeckt={verdeckt.has(`${zelle.zeile}|${zelle.spalte}`)}
                    markiert={!!auswahl && imBereich(auswahl, zelle.zeile, zelle.spalte)}
                    vorschau={
                      (!!vorschau && imBereich(vorschau, z, s)) ||
                      (!!zielZelle &&
                        zielZelle.zeile === zelle.zeile &&
                        zielZelle.spalte === zelle.spalte)
                    }
                    griff={
                      !!bearbeiten &&
                      !!auswahlAnzeige &&
                      auswahlAnzeige.zeile + auswahlAnzeige.hoehe - 1 === z &&
                      auswahlAnzeige.spalte + auswahlAnzeige.breite - 1 === s
                    }
                    interaktiv={!!onZellePress || !!bearbeiten}
                    // Am `data-zelle` findet die Palette ihr Ziel – dort
                    // zählt der Raum, denn bearbeitet wird sein Raster.
                    datenSchluessel={platzSchluessel(schema.raum, zelle.zeile, zelle.spalte)}
                    onPointerDown={zellDown}
                    onGriffPointerDown={griffDown}
                  />
                );
              })}
            </View>
          ))}

          {/* Verbundene Zellen liegen als eigene Felder über dem Raster – ein
              Rechteck statt vieler Einzelzellen, damit der Text durchläuft. */}
          {schema.beschriftungen.map((beschriftung) => (
            <Textfeld
              key={`${beschriftung.zeile}|${beschriftung.spalte}`}
              beschriftung={beschriftung}
              bereich={anzeigeBereich(beschriftung, schema, drehungen)}
              masse={masse}
              bearbeiten={!!bearbeiten}
              markiert={!!auswahl && imBereich(auswahl, beschriftung.zeile, beschriftung.spalte)}
              zeiger={werkzeug === 'zeiger'}
              frischAufgezogen={
                werkzeug === 'aufziehen' &&
                !!auswahl &&
                imBereich(auswahl, beschriftung.zeile, beschriftung.spalte)
              }
              onAuswahl={onAuswahl}
              onText={onBeschriftungText}
              testID={testID ? `${testID}-text-${beschriftung.zeile}-${beschriftung.spalte}` : undefined}
            />
          ))}
        </View>
      </View>
    </View>
  );

  // Beweglich: ein eigenes Fenster mit Ausschnitt – es scrollt in beide
  // Richtungen, lässt sich mit dem Finger schieben und zoomen und begrenzt die
  // Höhe, damit auf einem Handy Werkzeuge und Plan zugleich zu sehen bleiben.
  // Sonst wie bisher: nur waagerecht scrollen, in die Höhe wachsen – so
  // gehört der Plan auf Aushang und Papier.
  if (!beweglich) {
    return (
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        onLayout={merkeBreite}
        testID={testID}
      >
        {inhalt}
      </ScrollView>
    );
  }
  return (
    <View
      ref={flaecheRef}
      style={[
        styles.flaeche,
        hoehe && hoehe > 0 ? { height: hoehe } : { maxHeight: fensterHoehe },
        scrollbaresFenster,
      ]}
      onLayout={merkeBreite}
      testID={testID}
    >
      {inhalt}
    </View>
  );
}

/**
 * Ein verbundenes Textfeld über dem Raster.
 *
 * Es liegt über den Zellen, statt sie zu ersetzen: So lässt sich auch eine Tür
 * („Haupteingang“) oder eine Tischreihe („Aufsicht“) beschriften. Beim
 * Bearbeiten bekommt es deshalb einen sichtbaren Rahmen, sonst nur der Text
 * eine helle Unterlage – darunter bleibt der Plan zu sehen.
 */
function Textfeld({
  beschriftung,
  bereich,
  masse,
  bearbeiten,
  markiert,
  zeiger,
  frischAufgezogen,
  onAuswahl,
  onText,
  testID,
}: {
  beschriftung: Beschriftung;
  bereich: Bereich;
  masse: Rastermasse;
  bearbeiten: boolean;
  markiert: boolean;
  /** Der Zeiger ist am Werk: Ein Klick gehört dem Blatt, nicht dem Feld. */
  zeiger: boolean;
  /** Mit dem Textwerkzeug gerade aufgezogen – dann gleich hinein. */
  frischAufgezogen: boolean;
  onAuswahl?: (bereich: Bereich) => void;
  onText?: (zeile: number, spalte: number, text: string) => void;
  testID?: string;
}) {
  const feldRef = useRef<View>(null);
  /** Wird gerade im Feld selbst geschrieben (nach einem Doppelklick). */
  const [schreibt, setzeSchreibt] = useState(false);
  const schreiben = bearbeiten && !!onText && (schreibt || frischAufgezogen);

  // Wie in einer Tabellenkalkulation: **Doppelt** klicken öffnet den Text zum
  // Schreiben. Ein einzelner Klick tut das nicht mehr – der gehört dem
  // Werkzeug (Zeiger: Infos im Blatt, Auswählen: markieren). Vorher lag über
  // jedem Feld ein Eingabefeld, und ein Klick daneben landete im Text.
  useEffect(() => {
    const knoten = feldRef.current as unknown as HTMLElement | null;
    if (!knoten || !bearbeiten || !onText) return;
    const doppelt = () => setzeSchreibt(true);
    knoten.addEventListener('dblclick', doppelt);
    return () => knoten.removeEventListener('dblclick', doppelt);
  }, [bearbeiten, onText]);

  // Wer das Werkzeug wechselt oder woanders hinklickt, schreibt nicht weiter.
  useEffect(() => {
    if (!bearbeiten || !markiert) setzeSchreibt(false);
  }, [bearbeiten, markiert]);

  // Der Cursor steht am Ende, nicht vor dem ersten Zeichen: Wer ein Feld
  // öffnet, will meist etwas anhängen – und tippte sonst mitten in den Text.
  const eingabeRef = useRef<TextInput>(null);
  useEffect(() => {
    if (!schreiben) return;
    const knoten = eingabeRef.current as unknown as HTMLTextAreaElement | null;
    const ende = knoten?.value?.length ?? 0;
    knoten?.setSelectionRange?.(ende, ende);
  }, [schreiben]);

  const schritt = masse.groesse + masse.abstand;
  const schrittZeile = masse.zellHoehe + masse.abstand;
  const rahmen = {
    left: bereich.spalte * schritt,
    top: bereich.zeile * schrittZeile,
    width: bereich.breite * masse.groesse + (bereich.breite - 1) * masse.abstand,
    height: bereich.hoehe * masse.zellHoehe + (bereich.hoehe - 1) * masse.abstand,
  };
  const schrift = { fontSize: Math.max(8, Math.min(16, Math.round(rahmen.height * 0.45))) };
  const ecken = { borderRadius: Math.min(radius.md, Math.round(masse.zellHoehe * 0.3)) };

  return (
    <View
      ref={feldRef}
      style={[
        styles.textfeld,
        rahmen,
        ecken,
        bearbeiten && styles.textfeldBearbeiten,
        markiert && styles.textfeldMarkiert,
      ]}
      pointerEvents={bearbeiten ? 'auto' : 'none'}
      // Mit dem Zeiger meldet erst das Loslassen die Zelle darunter – das Feld
      // markiert dann nichts, sonst spränge die Auswahl beim bloßen Nachsehen.
      onPointerDown={zeiger ? undefined : () => onAuswahl?.(beschriftung)}
      testID={testID}
    >
      {schreiben && onText ? (
        <TextInput
          ref={eingabeRef}
          style={[styles.textfeldEingabe, schrift, mitTextauswahl]}
          autoFocus
          onBlur={() => setzeSchreibt(false)}
          value={beschriftung.text}
          onChangeText={(text) => onText(beschriftung.zeile, beschriftung.spalte, text)}
          placeholder="Text …"
          placeholderTextColor={colors.textMuted}
          multiline
        />
      ) : beschriftung.text ? (
        <Text style={[styles.textfeldText, schrift]}>{beschriftung.text}</Text>
      ) : null}
    </View>
  );
}

const Zelle = memo(function Zelle({
  zeile,
  spalte,
  zelle,
  masse,
  platz,
  nummer,
  personen,
  ausgewaehlt,
  anzeige,
  markiert,
  vorschau,
  griff,
  gitter,
  verdeckt,
  interaktiv,
  datenSchluessel,
  onPointerDown,
  onGriffPointerDown,
}: {
  /** Position in der Anzeige – nur für die Rückrufe. */
  zeile: number;
  spalte: number;
  zelle: AnzeigeZelle;
  masse: Rastermasse;
  platz?: Platzbelegung;
  nummer?: number;
  personen: Map<string, Sitzplatz>;
  ausgewaehlt: string | null;
  anzeige: PlanAnzeige;
  markiert: boolean;
  vorschau: boolean;
  griff: boolean;
  gitter: boolean;
  /** Liegt unter einem Textfeld: Der Platz bleibt, seine Beschriftung weicht. */
  verdeckt: boolean;
  interaktiv: boolean;
  datenSchluessel: string;
  onPointerDown: (zeile: number, spalte: number) => void;
  onGriffPointerDown: () => void;
}) {
  const person = platz?.matrikelnummer ? personen.get(platz.matrikelnummer) : undefined;
  const istAusgewaehlt = !!ausgewaehlt && platz?.matrikelnummer === ausgewaehlt;
  const { groesse, zellHoehe, abstand } = masse;

  /**
   * Was im Kasten steht. In einen halbhohen Kasten passt eine Zeile, in einen
   * großen zwei – deshalb kommt zuerst, was am wichtigsten ist: die Person,
   * dann die Nummer.
   */
  const inhalt = (() => {
    if (verdeckt || !masse.zeigeNamen) return null;
    switch (zelle.typ) {
      case 'tisch': {
        const zeilen: { text: string; stil: object }[] = [];
        if (platz?.reserviert) {
          // Warum der Platz frei bleibt, steht im Kasten – sonst sieht die
          // Aufsicht eine Lücke und hält sie für einen Fehler.
          zeilen.push({ text: platz.notiz || 'Reserve', stil: styles.reserve });
        } else if (person) {
          if (anzeige.namensPraefix) {
            zeilen.push({ text: person.anfangNachname, stil: styles.name });
          }
          if (anzeige.matrikelnummer) {
            zeilen.push({ text: person.matrikelnummer, stil: styles.klein });
          }
          // Ohne Namen wäre der Kasten leer, obwohl dort jemand sitzt – die
          // Farbe allein sagt nicht, dass der Platz vergeben ist.
          if (zeilen.length === 0 && !anzeige.sitzplatznummer) {
            zeilen.push({ text: '•', stil: styles.klein });
          }
        }
        if (anzeige.sitzplatznummer && nummer !== undefined) {
          zeilen.push({ text: String(nummer), stil: styles.nummer });
        }
        const passt = masse.zeigeDetails ? 2 : 1;
        return (
          <>
            {zeilen.slice(0, passt).map((eintrag, i) => (
              <Text
                key={i}
                style={[
                  eintrag.stil,
                  { fontSize: eintrag.stil === styles.name ? masse.namenSchrift : masse.kleinSchrift },
                ]}
                numberOfLines={1}
              >
                {eintrag.text}
              </Text>
            ))}
            {platz?.vorgabe && masse.zeigeDetails ? (
              <Text style={[styles.vorgabe, { fontSize: masse.kleinSchrift }]}>fest</Text>
            ) : null}
          </>
        );
      }
      case 'reserve':
        return (
          <Text style={[styles.reserve, { fontSize: masse.kleinSchrift }]} numberOfLines={1}>
            Reserve
          </Text>
        );
      case 'tuer':
        return <Text style={[styles.symbolText, { fontSize: masse.kleinSchrift }]}>Tür</Text>;
      case 'pult':
        return anzeige.pultText ? (
          <Text style={[styles.symbolText, { fontSize: masse.kleinSchrift }]}>Pult</Text>
        ) : null;
      default:
        return null;
    }
  })();

  return (
    <View
      // Wände rücken zusammen, damit eine Reihe wie eine durchgehende Wand wirkt.
      style={[
        styles.zelle,
        // Die Ecken runden mit: Bei 18 px Zellen wären 8 px Radius Kreise.
        { width: groesse, height: zellHoehe, borderRadius: Math.min(radius.md, Math.round(zellHoehe * 0.3)) },
        gitter && styles.gitterlinie,
        zelle.typ === 'tisch' && styles.tisch,
        zelle.typ === 'reserve' && styles.dauerReserve,
        zelle.typ === 'tuer' && styles.tuer,
        zelle.typ === 'pult' && styles.pult,
        zelle.typ === 'wand' && styles.wand,
        zelle.typ === 'tisch' && platz?.reserviert && styles.reserviertZelle,
        zelle.typ === 'tisch' && !!person && styles.belegt,
        istAusgewaehlt && styles.personAusgewaehlt,
        markiert && styles.markiert,
        vorschau && styles.vorschau,
      ]}
      onPointerDown={interaktiv ? () => onPointerDown(zeile, spalte) : undefined}
      {...datenAttribute({ zelle: datenSchluessel })}
    >
      {/* Die Wand füllt auch die Fugen zu ihren Nachbarn, damit eine Reihe wie
          eine durchgehende Wand wirkt – als Überstand, nicht als negativer
          Rand: Der würde die ganze Zeile schmaler machen als das Raster. */}
      {zelle.typ === 'wand' ? (
        <View
          style={[
            styles.wandFuellung,
            // Halbe Fuge auf jeder Seite (plus der 1 px Rahmen) – dann stoßen
            // zwei Wandzellen genau aneinander, ohne den Nachbarn zu überdecken.
            (() => {
              const ueberstand = -(abstand / 2 + 1);
              return { left: ueberstand, top: ueberstand, right: ueberstand, bottom: ueberstand };
            })(),
          ]}
        />
      ) : null}
      {inhalt}
      {griff ? (
        <View
          // Der Griff muss in den halbhohen Kasten passen und trotzdem zu
          // treffen sein – deshalb an der Höhe gemessen, nicht an der Breite.
          style={[
            styles.griff,
            {
              width: Math.max(10, Math.min(groesse * 0.22, zellHoehe * 0.6)),
              height: Math.max(10, Math.min(groesse * 0.22, zellHoehe * 0.6)),
            },
          ]}
          onPointerDown={(ereignis) => {
            ereignis.stopPropagation();
            onGriffPointerDown();
          }}
        />
      ) : null}
    </View>
  );
});

/**
 * Liegt der Zeiger in einem Eingabefeld? Dort gehört das Ziehen der
 * Textauswahl und nicht dem Ausschnitt.
 */
function istEingabefeld(ziel: EventTarget | null): boolean {
  const element = ziel as HTMLElement | null;
  const art = element?.tagName;
  return art === 'INPUT' || art === 'TEXTAREA' || !!element?.isContentEditable;
}

/** Browser-Gesten (Scrollen, Textauswahl) während des Zeichnens abschalten. */
const ohneBrowserGeste = {
  touchAction: 'none',
  userSelect: 'none',
} as unknown as object;

/**
 * Das Planfenster scrollt in beide Richtungen (RN kennt nur `scroll`, gemeint
 * ist `auto`), und der Finger darauf gehört dem Plan: `touch-action: none`
 * hält den Browser vom eigenen Scrollen und Zoomen ab, sonst zöge er die Seite
 * mit, während der Plan geschoben wird. `overscroll-behavior: contain` hält
 * das Gummiband am Rand des Plans auf, statt die Seite zu bewegen.
 */
const scrollbaresFenster = {
  overflow: 'auto',
  overscrollBehavior: 'contain',
  touchAction: 'none',
  userSelect: 'none',
} as unknown as object;

/** Im Textfeld gilt das Gegenteil: Dort will man tippen und markieren. */
const mitTextauswahl = {
  touchAction: 'auto',
  userSelect: 'text',
} as unknown as object;

const styles = StyleSheet.create({
  // Maße hier und in `planMasse` müssen zusammenpassen – sonst rechnet
  // „Ganzer Raum“ an dem vorbei, was gezeichnet wird.
  aussen: { padding: PLAN_POLSTER, gap: KOPF_ABSTAND },
  /**
   * Im Planfenster wächst der Plan über den Ausschnitt hinaus: `flex-start`
   * lässt ihn so breit werden, wie er ist (gestreckt wäre er so breit wie das
   * Fenster und der Rest liefe darüber hinaus), `minWidth: 100%` hält ihn im
   * kleinen Raum trotzdem über die volle Breite.
   */
  aussenBeweglich: { alignSelf: 'flex-start', minWidth: '100%' },
  /**
   * Der Ausschnitt selbst: nie breiter als sein Platz – sonst schöbe der Plan
   * eines Hörsaals mit 44 Spalten die Schaltflächen daneben aus dem Bild.
   */
  flaeche: { width: '100%', maxWidth: '100%', backgroundColor: colors.background, borderRadius: radius.md },
  innen: { flexDirection: 'row' },
  raster: {},
  kopfZeile: { flexDirection: 'row' },
  kopf: { alignItems: 'center', justifyContent: 'center' },
  kopfText: { color: colors.textMuted },
  /** Dünne Linie um jedes Feld – zeigt Größe des Rasters und Klickflächen. */
  gitterlinie: { borderColor: colors.gitter, borderStyle: 'solid' },
  zeile: { flexDirection: 'row' },
  zelle: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1,
    overflow: 'hidden',
  },
  tisch: { borderColor: colors.tischRand, backgroundColor: colors.tisch, borderStyle: 'solid' },
  belegt: { borderStyle: 'solid', backgroundColor: '#eef2ff', borderColor: colors.primary },
  reserviertZelle: { backgroundColor: colors.surface, borderStyle: 'dashed' },
  personAusgewaehlt: { borderColor: colors.danger, borderWidth: 2 },
  /** Dauerhaft freigehaltener Tisch: Holzton, aber gestrichelt und blass. */
  dauerReserve: {
    backgroundColor: colors.surface,
    borderColor: colors.tischRand,
    borderStyle: 'dashed',
  },
  klein: { color: colors.textMuted },
  markiert: { borderColor: colors.primary, borderWidth: 2, borderStyle: 'solid' },
  vorschau: { backgroundColor: '#dbeafe', borderColor: colors.primary, borderWidth: 2, borderStyle: 'dashed' },
  tuer: { backgroundColor: colors.successBg, borderColor: colors.success },
  pult: { backgroundColor: colors.pult, borderColor: colors.pultRand },
  // Wand: eckig, ohne eigene Ecken – die Fugen schließt `wandFuellung`.
  wand: { backgroundColor: '#475569', borderRadius: 0, borderColor: '#475569', overflow: 'visible' },
  wandFuellung: { position: 'absolute', backgroundColor: '#475569' },
  /**
   * Der Ziehgriff sitzt **innerhalb** der Zelle: Die Zelle schneidet ab, was
   * über ihren Rand ragt (`overflow: hidden`), und ein Griff, der nach außen
   * steht, ließe sich zur Hälfte nicht treffen – der Druck landete auf der
   * Zelle und verschöbe die Auswahl, statt sie aufzuziehen.
   */
  griff: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  textfeld: {
    position: 'absolute',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
    // Ohne Bearbeiten unsichtbar: Der Plan darunter soll durchscheinen.
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textfeldBearbeiten: { borderColor: '#c7d2fe', backgroundColor: 'rgba(255, 251, 235, 0.55)' },
  textfeldMarkiert: { borderColor: colors.primary, borderWidth: 2 },
  textfeldText: {
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
    // Helle Unterlage nur hinter dem Text – über Tür, Tisch oder Wand lesbar.
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 3,
    borderRadius: 4,
  },
  textfeldEingabe: {
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    width: '100%',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  nummer: { color: colors.textMuted },
  name: { fontWeight: '600', color: colors.text, textAlign: 'center' },
  reserve: { fontWeight: '600', color: colors.textMuted },
  vorgabe: { fontWeight: '700', color: colors.danger },
  symbolText: { fontWeight: '600', color: colors.text },
});
