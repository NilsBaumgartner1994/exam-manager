import { MutableRefObject, ReactNode, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import {
  anzeigeBereich,
  Bereich,
  bereichAendern,
  bereichAus,
  bereichName,
  Beschriftung,
  beschriftungBei,
  mitGroesse,
  PlanAnzeige,
  Platzbelegung,
  platzSchluessel,
  Raumschema,
  setzeBeschriftungsText,
  setzeZelle,
  Sitzplatz,
  tischzellen,
  trenneZellen,
  verbindeZellen,
  verschiebeBereich,
  ZellTyp,
} from '@exam-manager/core';
import { useResponsiveLayout } from '../responsive';
import { colors, spacing } from '../theme';
import { AppButton } from './AppButton';
import { BlattModal } from './BlattModal';
import { LabeledTextInput } from './LabeledInput';
import { useModalEbene } from './ModalHost';
import { PaletteElement } from './PaletteElement';
import {
  PLAN_ANSICHT_EDITOR,
  Raumplan,
  ZELLE_FREI_MAX,
  ZELLE_FREI_MIN,
  type Ansichtsmodus,
  type PlanAnsicht,
  type PlanWerkzeug,
} from './Raumplan';

/**
 * Werkzeug im Bearbeiten-Modus: nachsehen (der Zeiger), auswählen/verschieben,
 * den Ausschnitt schieben (die Hand), ein Element malen oder ein Textfeld über
 * verbundenen Zellen aufziehen.
 */
export type Werkzeug = 'zeiger' | 'auswahl' | 'hand' | 'text' | ZellTyp;

/** Werkzeuge, die am Raster nichts ändern. */
function aendertNichts(werkzeug: Werkzeug): werkzeug is 'zeiger' | 'auswahl' | 'hand' {
  return werkzeug === 'zeiger' || werkzeug === 'auswahl' || werkzeug === 'hand';
}

/**
 * Die Elemente der Palette.
 *
 * „Sitzplatz“, „Reserve“ und „Pult“ sind alle drei Tische – der Unterschied
 * ist, ob dort jemand geprüft wird: Nur Sitzplätze werden nummeriert und
 * bekommen in Schritt 4 Studierende. Ein **Reserveplatz** bleibt in diesem
 * Raum dauerhaft frei (defekt, zu nah an der Tafel, für die Aufsicht) – warum,
 * schreibt man mit dem Textwerkzeug daneben. Das **Pult** ist der einfache
 * Tisch für alles andere (Ablage, Materialtisch).
 */
export const PALETTE: { werkzeug: Werkzeug; titel: string; untertitel: string }[] = [
  { werkzeug: 'zeiger', titel: '↖ Zeiger', untertitel: 'antippen zeigt Infos' },
  { werkzeug: 'auswahl', titel: 'Auswählen', untertitel: 'markieren & verschieben' },
  { werkzeug: 'hand', titel: 'Verschieben', untertitel: 'Ausschnitt ziehen' },
  { werkzeug: 'tisch', titel: 'Sitzplatz', untertitel: 'Tisch für Studierende · T' },
  { werkzeug: 'reserve', titel: 'Reserve', untertitel: 'Tisch bleibt frei · R' },
  { werkzeug: 'pult', titel: 'Pult', untertitel: 'Tisch ohne Sitzplatz · P' },
  { werkzeug: 'wand', titel: 'Wand', untertitel: 'W' },
  { werkzeug: 'tuer', titel: 'Tür', untertitel: 'D' },
  { werkzeug: 'text', titel: 'Text', untertitel: 'über Zellen legen' },
  { werkzeug: 'leer', titel: 'Radierer', untertitel: 'frei' },
];

/** Ein Schritt der Lupe: So viel größer bzw. kleiner wird eine Zelle. */
const ZOOM_SCHRITT = 1.35;

/** So viele Schritte lassen sich rückgängig machen. */
const VERLAUF_TIEFE = 100;

/** Ein Block, der als Ganzes wandert – Schritt 4 zieht daran die Belegung mit. */
export interface Verschiebung {
  bereich: Bereich;
  dZeile: number;
  dSpalte: number;
}

export interface RaumplanAnbindung {
  /**
   * Der aktuelle Stand für Ereignis-Handler. Beim Ziehen kommen viele
   * Änderungen schnell hintereinander, und jede muss auf dem Ergebnis der
   * vorherigen aufsetzen – der Zustand aus dem Render wäre dafür zu alt.
   */
  schemata: MutableRefObject<Raumschema[]>;
  /**
   * Ein Schema ändern. Wer eine Belegung führt, zieht sie hier nach;
   * `verschiebung` sagt, dass ein ganzer Block gewandert ist.
   */
  aendere: (
    raum: string,
    wandel: (schema: Raumschema) => Raumschema,
    verschiebung?: Verschiebung,
  ) => void;
  /**
   * Nur das Schema ändern, ohne eine Belegung nachzuziehen. Getrennt, weil am
   * Text eines Feldes keine Belegung hängt: Sonst liefe bei jedem Tastendruck
   * die Verteilung über alle Räume neu.
   */
  aendereOhneBelegung?: (raum: string, wandel: (schema: Raumschema) => Raumschema) => void;
  /**
   * Momentaufnahme des Standes für Rückgängig/Wiederholen. Ohne die beiden
   * Rückrufe gibt es keinen Verlauf – der Editor weiß ja nicht, was am
   * Bildschirm sonst noch am Raster hängt.
   */
  zustand?: () => PlanZustand;
  setzeZustand?: (zustand: PlanZustand) => void;
}

/**
 * Ein Stand, zu dem „Rückgängig“ zurückkehrt: die Raster und – wo eine geführt
 * wird (Schritt 4) – die Belegung dazu. Beides gehört zusammen: Wandert ein
 * Tischblock, wandern die Personen darin mit; einzeln zurückgesetzt stünde
 * hinterher das eine ohne das andere.
 */
export interface PlanZustand {
  schemata: Raumschema[];
  belegung?: Platzbelegung[];
}

export interface RaumplanEditor {
  werkzeug: Werkzeug;
  setzeWerkzeug: (werkzeug: Werkzeug) => void;
  auswahl: { raum: string; bereich: Bereich } | null;
  setzeAuswahl: (auswahl: { raum: string; bereich: Bereich } | null) => void;
  auswahlIn: (raum: string) => Bereich | null;
  zielZelle: { raum: string; zeile: number; spalte: number } | null;
  /** Wie groß gezeichnet wird (eingepasst, auf Breite oder frei in Pixeln). */
  ansicht: PlanAnsicht;
  setzeAnsichtModus: (modus: Ansichtsmodus) => void;
  /** Frei zoomen wie in einem Bild – ausgehend von der gerade sichtbaren Größe. */
  zoomAendern: (richtung: 1 | -1) => void;
  /** Zellgröße in Pixeln setzen – so meldet der Plan eine Zoom-Geste zurück. */
  zoomSetzen: (zellGroesse: number) => void;
  /**
   * Welcher Plan im Vollbild liegt (Schlüssel des Einsatzes bzw. Raumname),
   * `null` = keiner. In Schritt 4 stehen mehrere Pläne untereinander – deshalb
   * ein Schlüssel und nicht bloß „an/aus“.
   */
  vollbild: string | null;
  setzeVollbild: (plan: string | null) => void;
  /** Ein Plan meldet, wie groß seine Zellen gerade sind (für den Zoom). */
  merkeZellGroesse: (raum: string, groesse: number) => void;
  /** Gibt es einen Verlauf? Ohne `zustand` in der Anbindung: nein. */
  mitVerlauf: boolean;
  kannRueckgaengig: boolean;
  kannWiederholen: boolean;
  rueckgaengig: () => void;
  wiederholen: () => void;
  /**
   * Den jetzigen Stand vor einer Änderung merken. Der Editor tut das für seine
   * eigenen Werkzeuge selbst; Screens rufen es für alles auf, was sie außer
   * der Reihe am Plan ändern (Platzieren, Reserve, Vorgabe).
   */
  merkeStand: (marke?: string | null) => void;
  /** Ein Zug im Plan ist zu Ende – der nächste wird wieder einzeln gemerkt. */
  zugBeendet: () => void;
  drehungen: Record<string, number>;
  drehen: (raum: string, richtung: 1 | -1) => void;
  zellePress: (raum: string, zeile: number, spalte: number) => void;
  bereichAufziehen: (raum: string, bereich: Bereich) => void;
  bereichVerschieben: (raum: string, dZeile: number, dSpalte: number) => void;
  beschriftungSchreiben: (raum: string, zeile: number, spalte: number, text: string) => void;
  groesseAendern: (raum: string, dZeilen: number, dSpalten: number) => void;
  zellenVerbinden: () => void;
  zellenTrennen: () => void;
  /** Ein Textfeld über eine einzelne Zelle legen – aus dem Info-Blatt heraus. */
  textfeldAnlegen: (raum: string, zeile: number, spalte: number) => void;
  paletteZiehen: (x: number, y: number) => void;
  paletteAblegen: (werkzeug: Werkzeug) => (x: number, y: number) => void;
}

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

/**
 * Das Bearbeiten eines Raumrasters: Werkzeug, Auswahl, Ansicht, Drehung und
 * der Verlauf für Rückgängig/Wiederholen.
 *
 * Zwei Screens bearbeiten dieselben Raster – Schritt 4 mit Studierenden darin,
 * Schritt 5 ohne. Was sie unterscheidet, steckt allein in `aendere`: Schritt 4
 * zieht dort die Belegung nach, Schritt 5 schreibt nur das Schema.
 */
export function useRaumplanEditor({
  schemata,
  aendere,
  aendereOhneBelegung,
  zustand,
  setzeZustand,
}: RaumplanAnbindung): RaumplanEditor {
  // Voreingestellt ist der Zeiger: Ein Klick in den Plan zeigt, was dort ist,
  // und ändert nichts. Wer zeichnen will, wählt vorher ein Element – das ist
  // die Reihenfolge, die man von einer Tabellenkalkulation kennt.
  const [werkzeug, setzeWerkzeug] = useState<Werkzeug>('zeiger');
  const [auswahl, setzeAuswahl] = useState<{ raum: string; bereich: Bereich } | null>(null);
  const [zielZelle, setzeZielZelle] = useState<{ raum: string; zeile: number; spalte: number } | null>(null);
  const [drehungen, setzeDrehungen] = useState<Record<string, number>>({});
  const [ansicht, setzeAnsicht] = useState<PlanAnsicht>(PLAN_ANSICHT_EDITOR);
  const [vollbild, setzeVollbild] = useState<string | null>(null);

  /** Was die Pläne gerade zeichnen – der freie Zoom setzt darauf auf. */
  const gezeichneteGroesse = useRef<Record<string, number>>({});

  /**
   * Der Verlauf liegt im Ref, nicht im Zustand: Beim Malen kommen die
   * Änderungen schneller, als React neu rendert. Für die Knöpfe (an/aus)
   * genügt die Länge – die steht daneben im Zustand.
   */
  const verlauf = useRef<{ zurueck: PlanZustand[]; vor: PlanZustand[]; marke: string | null }>({
    zurueck: [],
    vor: [],
    marke: null,
  });
  const [verlaufTiefe, setzeVerlaufTiefe] = useState({ zurueck: 0, vor: 0 });
  const meldeTiefe = () =>
    setzeVerlaufTiefe({ zurueck: verlauf.current.zurueck.length, vor: verlauf.current.vor.length });

  /**
   * Den Stand vor einer Änderung merken. Gleiche `marke` heißt „gehört noch
   * zum selben Schritt“ – sonst wäre jeder Buchstabe in einem Textfeld und
   * jede Zelle eines Malzugs ein eigenes Rückgängig.
   */
  const merkeStand = (marke: string | null = null) => {
    if (!zustand) return;
    const stand = verlauf.current;
    if (marke !== null && marke === stand.marke) {
      if (stand.vor.length === 0) return;
      stand.vor = [];
      meldeTiefe();
      return;
    }
    stand.zurueck = [...stand.zurueck, zustand()].slice(-VERLAUF_TIEFE);
    stand.vor = [];
    stand.marke = marke;
    meldeTiefe();
  };

  /** Einen Schritt zurück oder wieder vor – der jetzige Stand wandert dabei um. */
  const gehe = (richtung: 'zurueck' | 'vor') => {
    if (!zustand || !setzeZustand) return;
    const stand = verlauf.current;
    const quelle = richtung === 'zurueck' ? stand.zurueck : stand.vor;
    if (quelle.length === 0) return;
    const ziel = quelle[quelle.length - 1];
    const jetzt = zustand();
    if (richtung === 'zurueck') {
      stand.zurueck = stand.zurueck.slice(0, -1);
      stand.vor = [...stand.vor, jetzt];
    } else {
      stand.vor = stand.vor.slice(0, -1);
      stand.zurueck = [...stand.zurueck, jetzt];
    }
    stand.marke = null;
    setzeZustand(ziel);
    // Der ausgewählte Bereich muss es im alten Stand nicht geben.
    setzeAuswahl(null);
    meldeTiefe();
  };

  // Strg/⌘ + Z und Strg/⌘ + Umschalt + Z (bzw. Y) wie überall sonst. In einem
  // Textfeld gilt weiter das Rückgängig des Browsers für den Text selbst.
  const tasten = useRef({ gehe });
  tasten.current = { gehe };
  useEffect(() => {
    const aufTaste = (ereignis: KeyboardEvent) => {
      if (!ereignis.ctrlKey && !ereignis.metaKey) return;
      const ziel = ereignis.target as HTMLElement | null;
      const art = ziel?.tagName;
      if (art === 'INPUT' || art === 'TEXTAREA' || ziel?.isContentEditable) return;
      const taste = ereignis.key.toLowerCase();
      if (taste !== 'z' && taste !== 'y') return;
      ereignis.preventDefault();
      tasten.current.gehe(taste === 'y' || ereignis.shiftKey ? 'vor' : 'zurueck');
    };
    window.addEventListener('keydown', aufTaste);
    return () => window.removeEventListener('keydown', aufTaste);
  }, []);

  const nurSchema = aendereOhneBelegung ?? ((raum: string, wandel: (s: Raumschema) => Raumschema) => aendere(raum, wandel));

  /** Ein Element auf eine Zelle setzen und sie auswählen (Malen und Ablegen). */
  const elementSetzen = (raum: string, zeile: number, spalte: number, typ: Werkzeug) => {
    if (aendertNichts(typ)) return;
    // Ein Malzug über viele Zellen ist ein Schritt – bis der Zeiger losgelassen
    // wird (`zugBeendet`).
    merkeStand('malen');
    const bereich = bereichAus({ zeile, spalte }, { zeile, spalte });
    aendere(raum, (schema) =>
      typ === 'text' ? verbindeZellen(schema, bereich) : setzeZelle(schema, zeile, spalte, typ),
    );
    setzeAuswahl({ raum, bereich });
  };

  return {
    werkzeug,
    setzeWerkzeug,
    auswahl,
    setzeAuswahl,
    auswahlIn: (raum) => (auswahl?.raum === raum ? auswahl.bereich : null),
    zielZelle,
    ansicht,
    setzeAnsichtModus: (modus) => setzeAnsicht((alt) => ({ ...alt, modus })),
    /**
     * Beim ersten Zoomen aus einer eingepassten Ansicht heraus wird die gerade
     * gezeichnete Zellgröße zur Ausgangsgröße – sonst spränge der Plan.
     */
    zoomAendern: (richtung) =>
      setzeAnsicht((alt) => {
        const gezeichnet = Object.values(gezeichneteGroesse.current);
        const basis = alt.modus === 'frei' || gezeichnet.length === 0
          ? alt.zellGroesse
          : Math.max(...gezeichnet);
        const gewuenscht = richtung > 0 ? basis * ZOOM_SCHRITT : basis / ZOOM_SCHRITT;
        return {
          modus: 'frei',
          zellGroesse: Math.round(
            Math.min(ZELLE_FREI_MAX, Math.max(ZELLE_FREI_MIN, gewuenscht)),
          ),
        };
      }),
    vollbild,
    setzeVollbild,
    zoomSetzen: (zellGroesse) =>
      setzeAnsicht({
        modus: 'frei',
        zellGroesse: Math.round(Math.min(ZELLE_FREI_MAX, Math.max(ZELLE_FREI_MIN, zellGroesse))),
      }),
    merkeZellGroesse: (raum, groesse) => {
      gezeichneteGroesse.current[raum] = groesse;
    },

    mitVerlauf: !!zustand && !!setzeZustand,
    kannRueckgaengig: verlaufTiefe.zurueck > 0,
    kannWiederholen: verlaufTiefe.vor > 0,
    rueckgaengig: () => gehe('zurueck'),
    wiederholen: () => gehe('vor'),
    merkeStand,
    zugBeendet: () => {
      verlauf.current.marke = null;
    },
    drehungen,
    drehen: (raum, richtung) =>
      setzeDrehungen((alt) => ({ ...alt, [raum]: ((((alt[raum] ?? 0) + richtung) % 4) + 4) % 4 })),

    zellePress: (raum, zeile, spalte) => {
      // „Auswählen“ und „Text“ ziehen einen Bereich auf – das erledigt
      // onAufziehen; „Verschieben“ rührt das Raster gar nicht an.
      if (!aendertNichts(werkzeug) && werkzeug !== 'text') elementSetzen(raum, zeile, spalte, werkzeug);
    },

    /**
     * Auswahl über mehrere Felder aufziehen – am Griff an der unteren Ecke
     * oder mit dem Textwerkzeug. Gefüllt wird mit dem Element der bisherigen
     * Auswahl, so wird aus einem Tisch eine Tischreihe und aus einer Wandzelle
     * eine ganze Wand. Das bloße Auswählen zieht nicht auf: Es markiert nur,
     * damit sich ein Block auch verschieben lässt, ohne ihn zu verändern.
     */
    bereichAufziehen: (raum, neuerBereich) => {
      const alteAuswahl = auswahl && auswahl.raum === raum ? auswahl.bereich : neuerBereich;
      const schema = schemata.current.find((s) => s.raum === raum);
      // „Auswählen“ zieht sehr wohl auf (der Griff füllt mit dem Element der
      // Auswahl); Hand und Zeiger fassen das Raster nie an.
      if (!schema || werkzeug === 'hand' || werkzeug === 'zeiger') return;
      merkeStand();
      if (werkzeug === 'text') {
        // Mit dem Textwerkzeug wird aufgezogen, was verbunden werden soll.
        aendere(raum, (aktuell) => verbindeZellen(aktuell, neuerBereich));
      } else {
        const typ =
          werkzeug !== 'auswahl'
            ? werkzeug
            : schema.zellen[alteAuswahl.zeile]?.[alteAuswahl.spalte] ?? 'leer';
        aendere(raum, (aktuell) => bereichAendern(aktuell, alteAuswahl, neuerBereich, typ));
      }
      setzeAuswahl({ raum, bereich: neuerBereich });
    },

    bereichVerschieben: (raum, dZeile, dSpalte) => {
      if (!auswahl || auswahl.raum !== raum || (dZeile === 0 && dSpalte === 0)) return;
      merkeStand();
      const bereich = auswahl.bereich;
      aendere(raum, (schema) => verschiebeBereich(schema, bereich, dZeile, dSpalte), {
        bereich,
        dZeile,
        dSpalte,
      });
      setzeAuswahl({
        raum,
        bereich: { ...bereich, zeile: bereich.zeile + dZeile, spalte: bereich.spalte + dSpalte },
      });
    },

    beschriftungSchreiben: (raum, zeile, spalte, text) => {
      // Ein Tastendruck ist kein eigener Schritt: Alles, was in dasselbe Feld
      // getippt wird, macht ein Rückgängig zusammen weg.
      merkeStand(`text ${raum} ${zeile}|${spalte}`);
      nurSchema(raum, (schema) => setzeBeschriftungsText(schema, zeile, spalte, text));
    },

    groesseAendern: (raum, dZeilen, dSpalten) => {
      merkeStand();
      aendere(raum, (aktuell) =>
        mitGroesse(aktuell, aktuell.zellen.length + dZeilen, (aktuell.zellen[0]?.length ?? 1) + dSpalten),
      );
    },

    zellenVerbinden: () => {
      if (!auswahl) return;
      merkeStand();
      aendere(auswahl.raum, (schema) => verbindeZellen(schema, auswahl.bereich));
      setzeWerkzeug('text');
    },

    zellenTrennen: () => {
      if (!auswahl) return;
      merkeStand();
      aendere(auswahl.raum, (schema) => trenneZellen(schema, auswahl.bereich));
    },

    textfeldAnlegen: (raum, zeile, spalte) => {
      merkeStand();
      const bereich = bereichAus({ zeile, spalte }, { zeile, spalte });
      aendere(raum, (schema) => verbindeZellen(schema, bereich));
      setzeAuswahl({ raum, bereich });
    },

    paletteZiehen: (x, y) => setzeZielZelle(zelleUnterPunkt(x, y)),

    paletteAblegen: (typ) => (x, y) => {
      setzeZielZelle(null);
      setzeWerkzeug(typ);
      const ziel = zelleUnterPunkt(x, y);
      if (!ziel || aendertNichts(typ)) return;
      if (!schemata.current.some((schema) => schema.raum === ziel.raum)) return;
      elementSetzen(ziel.raum, ziel.zeile, ziel.spalte, typ);
      // Jedes Ablegen ist ein eigener Schritt im Verlauf.
      verlauf.current.marke = null;
    },
  };
}

/**
 * Kurzanleitung der Palette – **eine Zeile je Sache**. Wer hier arbeitet, will
 * den Plan sehen und nicht lesen; das Ausführliche steht in der README.
 */
const PALETTEN_HINWEISE: { was: string; wie: string }[] = [
  { was: 'Zeiger', wie: 'zeigt Infos' },
  { was: 'Element ziehen', wie: 'setzt es' },
  { was: 'Element antippen', wie: 'dann malen' },
  { was: 'Auswählen', wie: 'markieren, ziehen verschiebt' },
  { was: 'Blauer Griff', wie: 'Auswahl aufziehen' },
  { was: 'Doppelklick', wie: 'Text schreiben' },
  { was: 'Zwei Finger', wie: 'schieben & zoomen' },
  { was: 'Strg/⌘ + Z', wie: 'rückgängig' },
];

/** Die Palette der Elemente – antippen wählt aus, ziehen legt direkt ab. */
export function RaumPalette({ editor, testID }: { editor: RaumplanEditor; testID?: string }) {
  const { isCompact } = useResponsiveLayout();
  return (
    <View
      // Neben mehreren großen Räumen scrollt man weit; die Palette bleibt
      // deshalb stehen, statt oben aus dem Bild zu wandern. Gestapelt (schmales
      // Fenster) läge sie sonst über dem Plan – dort scrollt sie mit.
      style={[styles.palette, isCompact ? styles.paletteBreit : klebtOben]}
      testID={testID}
    >
      <Text style={styles.palettenTitel}>Elemente</Text>
      {PALETTE.map((eintrag) => (
        <PaletteElement
          key={eintrag.werkzeug}
          titel={eintrag.titel}
          untertitel={eintrag.untertitel}
          aktiv={editor.werkzeug === eintrag.werkzeug}
          onTippen={() => editor.setzeWerkzeug(eintrag.werkzeug)}
          onZiehen={editor.paletteZiehen}
          onAblegen={editor.paletteAblegen(eintrag.werkzeug)}
          testID={`raum-zelle-${eintrag.werkzeug}`}
        />
      ))}
      <View style={isCompact ? styles.hinweiseBreit : undefined}>
        {PALETTEN_HINWEISE.map((eintrag) => (
          <Text key={eintrag.was} style={styles.hinweis}>
            <Text style={styles.betont}>{eintrag.was}</Text> · {eintrag.wie}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * Leiste über den Plänen: Wie groß gezeichnet wird und – wo es einen Verlauf
 * gibt – Rückgängig/Wiederholen.
 *
 * Drei Ansichten, weil je nach Raum eine andere passt: „Auf Breite“ nutzt den
 * Platz aus (ein schmaler Raum wäre eingepasst winzig, obwohl daneben alles
 * frei ist), „Ganzer Raum“ zeigt auch 47 × 34 Felder am Stück, und mit − / +
 * stellt man die Zellgröße selbst ein wie beim Zoomen in ein Bild.
 */
export function PlanLeiste({ editor }: { editor: RaumplanEditor }) {
  const { ansicht } = editor;
  const { isCompact } = useResponsiveLayout();
  return (
    <View style={styles.buttonZeile}>
      <Text style={styles.hinweis}>Ansicht:</Text>
      <AppButton
        title="Auf Breite"
        variant={ansicht.modus === 'breite' ? 'primary' : 'secondary'}
        kompakt={isCompact}
        onPress={() => editor.setzeAnsichtModus('breite')}
        testID="raum-zoom-breite"
      />
      <AppButton
        title="Ganzer Raum"
        variant={ansicht.modus === 'einpassen' ? 'primary' : 'secondary'}
        kompakt={isCompact}
        onPress={() => editor.setzeAnsichtModus('einpassen')}
        testID="raum-zoom-einpassen"
      />
      <AppButton title="−" variant="secondary" kompakt={isCompact} onPress={() => editor.zoomAendern(-1)} testID="raum-zoom-kleiner" />
      <AppButton title="+" variant="secondary" kompakt={isCompact} onPress={() => editor.zoomAendern(1)} testID="raum-zoom-groesser" />
      <Text style={styles.hinweis}>
        {ansicht.modus === 'frei' ? `${ansicht.zellGroesse} px je Feld` : 'passt sich an'}
      </Text>
      {editor.mitVerlauf ? (
        <>
          <AppButton
            title="↶ Rückgängig"
            variant="secondary"
            kompakt={isCompact}
            onPress={editor.rueckgaengig}
            disabled={!editor.kannRueckgaengig}
            testID="raum-rueckgaengig"
          />
          <AppButton
            title="↷ Wiederholen"
            variant="secondary"
            kompakt={isCompact}
            onPress={editor.wiederholen}
            disabled={!editor.kannWiederholen}
            testID="raum-wiederholen"
          />
        </>
      ) : null}
    </View>
  );
}

/** Was das gewählte Werkzeug im Plan bedeutet. */
function planWerkzeug(werkzeug: Werkzeug): PlanWerkzeug {
  if (werkzeug === 'zeiger') return 'zeiger';
  if (werkzeug === 'auswahl') return 'auswahl';
  if (werkzeug === 'hand') return 'schieben';
  if (werkzeug === 'text') return 'aufziehen';
  return 'malen';
}

/** Die Namen der Zellarten im Klartext – im Blatt steht kein Kürzel. */
const ART_NAMEN: Record<ZellTyp, string> = {
  leer: 'Frei',
  tisch: 'Sitzplatz',
  reserve: 'Reserve (bleibt in diesem Raum immer frei)',
  pult: 'Pult (Tisch ohne Sitzplatz)',
  wand: 'Wand',
  tuer: 'Tür',
};

/** Leere Vorgaben – als Konstanten, damit `React.memo` in den Zellen greift. */
const OHNE_BELEGUNG: Platzbelegung[] = [];
const OHNE_NUMMERN = new Map<string, number>();
const OHNE_PERSONEN = new Map<string, Sitzplatz>();

/**
 * Der Plan im Vollbild – der Bildschirm gehört dem Raum, wie in einer
 * Tabellenkalkulation.
 *
 * Oben die Werkzeugleiste: die Elemente der Palette zum Auswählen, daneben
 * Drehen, Raster und Verlauf, ganz rechts der Weg hinaus. Unten die Fußleiste
 * mit dem Zoom – sie bleibt immer stehen, damit die Zellgröße dort liegt, wo
 * man sie sucht. Dazwischen nichts als der Plan; wie hoch er ist, misst der
 * Rahmen und gibt es dem Plan mit (`onHoehe`), denn der braucht seine Höhe in
 * Pixeln, um „Ganzer Raum“ ausrechnen zu können.
 *
 * Gezeichnet wird in die Modal-Ebene der App-Shell – dieselbe wie beim Blatt.
 * Ein Vollbild, das den Screen darunter bloß überdeckt, würde ihn weiter
 * scrollen lassen.
 */
function VollbildRahmen({
  editor,
  titel,
  rasterText,
  bearbeiten,
  werkzeugKnoepfe,
  onHoehe,
  children,
}: {
  editor: RaumplanEditor;
  titel: string;
  rasterText: string;
  bearbeiten: boolean;
  werkzeugKnoepfe: ReactNode;
  onHoehe: (hoehe: number) => void;
  children: ReactNode;
}) {
  // Escape führt hinaus – wie aus jedem Vollbild.
  useEffect(() => {
    const aufTaste = (ereignis: KeyboardEvent) => {
      if (ereignis.key === 'Escape') editor.setzeVollbild(null);
    };
    window.addEventListener('keydown', aufTaste);
    return () => window.removeEventListener('keydown', aufTaste);
  }, [editor]);

  const gemessen = (ereignis: LayoutChangeEvent) => {
    const hoehe = Math.round(ereignis.nativeEvent.layout.height);
    if (hoehe > 0) onHoehe(hoehe);
  };

  const { ansicht } = editor;
  return (
    <View style={styles.vollbild} testID="raum-vollbild">
      {/*
        Eine einzige umbrechende Zeile – Titel, Werkzeuge und der Weg hinaus in
        derselben. Jedes Stück nimmt genau seine Breite und rückt in die Zeile
        davor, wenn es dort noch passt. Lag der Knopf daneben in einem eigenen
        Kasten, fehlte **jeder** Zeile dessen Breite, und rechts blieb Platz
        liegen. `marginLeft: auto` schiebt ihn ans rechte Ende seiner Zeile –
        passt alles nebeneinander, steht er wie erwartet oben rechts.
      */}
      <View style={styles.vollbildLeiste}>
        <Text style={styles.vollbildTitel}>{titel}</Text>
        {bearbeiten
          ? PALETTE.map((eintrag) => (
              <PaletteElement
                key={eintrag.werkzeug}
                titel={eintrag.titel}
                kompakt
                aktiv={editor.werkzeug === eintrag.werkzeug}
                onTippen={() => editor.setzeWerkzeug(eintrag.werkzeug)}
                onZiehen={editor.paletteZiehen}
                onAblegen={editor.paletteAblegen(eintrag.werkzeug)}
                testID={`raum-vollbild-zelle-${eintrag.werkzeug}`}
              />
            ))
          : null}
        {werkzeugKnoepfe}
        <View style={styles.leisteEnde}>
          <AppButton
            title="⤢ Vollbild aus"
            variant="secondary"
            kompakt
            onPress={() => editor.setzeVollbild(null)}
            testID="raum-vollbild-aus"
          />
        </View>
      </View>

      {/* Alles dazwischen gehört dem Plan. */}
      <View style={styles.vollbildKoerper} onLayout={gemessen}>
        {children}
      </View>

      <View style={styles.vollbildFuss}>
        <Text style={styles.hinweis} numberOfLines={1}>
          {rasterText}
        </Text>
        <View style={styles.fussZoom}>
          <AppButton
            title="Auf Breite"
            variant={ansicht.modus === 'breite' ? 'primary' : 'secondary'}
            kompakt
            onPress={() => editor.setzeAnsichtModus('breite')}
            testID="raum-vollbild-breite"
          />
          <AppButton
            title="Ganzer Raum"
            variant={ansicht.modus === 'einpassen' ? 'primary' : 'secondary'}
            kompakt
            onPress={() => editor.setzeAnsichtModus('einpassen')}
            testID="raum-vollbild-einpassen"
          />
          <AppButton title="−" variant="secondary" kompakt onPress={() => editor.zoomAendern(-1)} testID="raum-vollbild-kleiner" />
          <Text style={styles.zoomWert} testID="raum-vollbild-zoom">
            {ansicht.modus === 'frei' ? `${ansicht.zellGroesse} px` : 'auto'}
          </Text>
          <AppButton title="+" variant="secondary" kompakt onPress={() => editor.zoomAendern(1)} testID="raum-vollbild-groesser" />
        </View>
      </View>
    </View>
  );
}

interface KarteProps {
  editor: RaumplanEditor;
  schema: Raumschema;
  /**
   * Schlüssel des Raumeinsatzes für Belegung und Nummern (`raumSchluessel`) –
   * ohne Angabe der Raumname. Bearbeitet wird immer das Raster des Raums:
   * Zwei Durchgänge desselben Raums teilen es sich.
   */
  schluessel?: string;
  /** Überschrift statt des Raumnamens, z. B. „94/E01 · 2. Durchgang“. */
  titel?: string;
  /** Zeigt Palette-Werkzeuge, Auswahl und Ziehgriff im Plan. */
  bearbeiten: boolean;
  /** Zusatz in der Überschrift, z. B. „3/108 belegt“. */
  kopfZusatz?: string;
  /** Weitere Knöpfe neben Drehen und Rastergröße. */
  knoepfe?: ReactNode;
  belegung?: Platzbelegung[];
  nummern?: Map<string, number>;
  personen?: Map<string, Sitzplatz>;
  /** Was in den Kästen steht (Kürzel, Matrikelnummer, Platznummer, „Pult“). */
  anzeige?: PlanAnzeige;
  ausgewaehlt?: string | null;
  /** Zelle angetippt, solange nicht bearbeitet wird (Platzieren, Reserve, Vorgabe). */
  onZellePress?: (zeile: number, spalte: number) => void;
  testID?: string;
}

/**
 * Ein Raum im Editor: Überschrift mit Rastergröße und Adresse der Auswahl,
 * die Knöpfe für Drehen und Rastergröße und darunter der Plan selbst.
 */
export function RaumplanKarte({
  editor,
  schema,
  schluessel,
  titel,
  bearbeiten,
  kopfZusatz,
  knoepfe,
  belegung = OHNE_BELEGUNG,
  nummern = OHNE_NUMMERN,
  personen = OHNE_PERSONEN,
  anzeige,
  ausgewaehlt = null,
  onZellePress,
  testID,
}: KarteProps) {
  const drehungen = editor.drehungen[schema.raum] ?? 0;
  const auswahl = editor.auswahlIn(schema.raum);
  const { isCompact } = useResponsiveLayout();
  /**
   * Die Zelle, über die das Info-Blatt gerade Auskunft gibt. Der Zeiger ist das
   * neutrale Werkzeug: Ein Klick zeigt, was an dieser Stelle ist, und ändert
   * nichts. Der Stand gehört zu dieser Karte – zwei Durchgänge desselben Raums
   * stehen nebeneinander und meinen verschiedene Belegungen.
   */
  const [infoZelle, setzeInfoZelle] = useState<{ zeile: number; spalte: number } | null>(null);

  /** Dieser Plan – in Schritt 4 der Einsatz, sonst der Raum. */
  const planId = schluessel ?? schema.raum;
  const imVollbild = editor.vollbild === planId;
  /** Was im Vollbild zwischen Kopf- und Fußleiste übrig bleibt. */
  const [planHoehe, setzePlanHoehe] = useState(0);

  const name = titel ?? schema.raum;
  const ueberschrift = `${name}${kopfZusatz ? ` (${kopfZusatz})` : ''}`;
  const rasterText = `Raster ${schema.zellen[0]?.length ?? 0} Spalten × ${schema.zellen.length} Zeilen · ${tischzellen(schema).length} Sitzplätze${
    auswahl ? ` · Auswahl ${bereichName(anzeigeBereich(auswahl, schema, drehungen))}` : ''
  }`;
  // Oben in der Leiste zählt jeder Millimeter: Dort steht nur der Raum, alles
  // Weitere (Plätze, Belegung, Raster, Auswahl) unten in der Fußzeile.
  const fussText = `${kopfZusatz ? `${kopfZusatz} · ` : ''}${rasterText}`;

  const plan = (hoehe?: number) => (
    <Raumplan
      schema={schema}
      schluessel={schluessel}
      drehungen={drehungen}
      belegung={belegung}
      nummern={nummern}
      personen={personen}
      anzeige={anzeige}
      ausgewaehlt={ausgewaehlt}
      onZellePress={
        bearbeiten
          ? (zeile, spalte) => {
              // Der Zeiger ändert nichts – er schlägt nach.
              if (editor.werkzeug === 'zeiger') setzeInfoZelle({ zeile, spalte });
              else editor.zellePress(schema.raum, zeile, spalte);
            }
          : onZellePress
      }
      ansicht={editor.ansicht}
      onZellGroesse={(groesse) => editor.merkeZellGroesse(schema.raum, groesse)}
      // Im Editor sitzt der Plan in einem Fenster, das sich schieben und
      // zoomen lässt – am Bildschirm arbeitet man in einem Ausschnitt.
      beweglich
      hoehe={hoehe}
      onZoomGeste={editor.zoomSetzen}
      bearbeiten={bearbeiten}
      werkzeug={planWerkzeug(editor.werkzeug)}
      auswahl={auswahl}
      onAuswahl={(bereich) => editor.setzeAuswahl({ raum: schema.raum, bereich })}
      onAufziehen={(bereich) => editor.bereichAufziehen(schema.raum, bereich)}
      onVerschieben={(dZeile, dSpalte) => editor.bereichVerschieben(schema.raum, dZeile, dSpalte)}
      onBeschriftungText={(zeile, spalte, text) =>
        editor.beschriftungSchreiben(schema.raum, zeile, spalte, text)
      }
      zielZelle={editor.zielZelle?.raum === schema.raum ? editor.zielZelle : null}
      onZugEnde={editor.zugBeendet}
      testID={testID ?? `raum-plan-${schema.raum}`}
    />
  );

  const werkzeugKnoepfe = (
    <>
      <AppButton
        title="↺ 90°"
        variant="secondary"
        kompakt
        onPress={() => editor.drehen(schema.raum, -1)}
        testID={`raum-drehen-links-${schema.raum}`}
      />
      <AppButton
        title="↻ 90°"
        variant="secondary"
        kompakt
        onPress={() => editor.drehen(schema.raum, 1)}
        testID={`raum-drehen-rechts-${schema.raum}`}
      />
      {bearbeiten ? (
        <>
          <AppButton title="+ Zeile" variant="secondary" kompakt onPress={() => editor.groesseAendern(schema.raum, 1, 0)} />
          <AppButton title="− Zeile" variant="secondary" kompakt onPress={() => editor.groesseAendern(schema.raum, -1, 0)} />
          <AppButton title="+ Spalte" variant="secondary" kompakt onPress={() => editor.groesseAendern(schema.raum, 0, 1)} />
          <AppButton title="− Spalte" variant="secondary" kompakt onPress={() => editor.groesseAendern(schema.raum, 0, -1)} />
          <AppButton
            title="Verbinden"
            variant="secondary"
            kompakt
            onPress={editor.zellenVerbinden}
            disabled={!auswahl}
          />
          <AppButton
            title="Trennen"
            variant="secondary"
            kompakt
            onPress={editor.zellenTrennen}
            disabled={!auswahl}
          />
        </>
      ) : null}
      {editor.mitVerlauf ? (
        <>
          <AppButton
            title="↶"
            variant="secondary"
            kompakt
            onPress={editor.rueckgaengig}
            disabled={!editor.kannRueckgaengig}
          />
          <AppButton
            title="↷"
            variant="secondary"
            kompakt
            onPress={editor.wiederholen}
            disabled={!editor.kannWiederholen}
          />
        </>
      ) : null}
    </>
  );

  const rahmen = useModalEbene(
    imVollbild ? (
      <VollbildRahmen
        editor={editor}
        titel={name}
        rasterText={fussText}
        bearbeiten={bearbeiten}
        werkzeugKnoepfe={werkzeugKnoepfe}
        onHoehe={setzePlanHoehe}
      >
        {plan(planHoehe)}
      </VollbildRahmen>
    ) : null,
  );

  return (
    <View style={styles.planBlock}>
      <Text style={styles.raumUeberschrift}>
        {ueberschrift} · {rasterText}
      </Text>
      <View style={styles.buttonZeile}>
        {werkzeugKnoepfe}
        {knoepfe}
        <AppButton
          title="⤢ Vollbild"
          variant="secondary"
          kompakt
          onPress={() => editor.setzeVollbild(planId)}
          testID={`raum-vollbild-${schema.raum}`}
        />
      </View>
      {imVollbild ? (
        <Text style={styles.hinweis}>Der Plan liegt im Vollbild.</Text>
      ) : (
        plan()
      )}
      {rahmen}
      <ZellInfoBlatt
        editor={editor}
        schema={schema}
        schluessel={schluessel}
        titel={titel ?? schema.raum}
        drehungen={drehungen}
        belegung={belegung}
        nummern={nummern}
        personen={personen}
        zelle={infoZelle}
        onSchliessen={() => setzeInfoZelle(null)}
      />
    </View>
  );
}

/**
 * Was an einer Stelle des Plans ist – und das Feld, in das der Text dieser
 * Stelle geschrieben wird.
 *
 * Das Blatt ist die Antwort auf „was ist das hier?“: Art der Zelle,
 * Sitzplatznummer, wer dort sitzt, welcher Text darüber liegt. Geändert wird
 * darin nur der Text – alles andere ändert man mit einem Element aus der
 * Palette, damit ein Nachschlagen nie aus Versehen den Raum umbaut.
 */
function ZellInfoBlatt({
  editor,
  schema,
  schluessel,
  titel,
  drehungen,
  belegung,
  nummern,
  personen,
  zelle,
  onSchliessen,
}: {
  editor: RaumplanEditor;
  schema: Raumschema;
  schluessel?: string;
  titel: string;
  drehungen: number;
  belegung: Platzbelegung[];
  nummern: Map<string, number>;
  personen: Map<string, Sitzplatz>;
  zelle: { zeile: number; spalte: number } | null;
  onSchliessen: () => void;
}) {
  if (!zelle) return null;
  const { zeile, spalte } = zelle;
  const art: ZellTyp = schema.zellen[zeile]?.[spalte] ?? 'leer';
  const adresse = bereichName(
    anzeigeBereich(bereichAus({ zeile, spalte }, { zeile, spalte }), schema, drehungen),
  );
  const platz = belegung.find((p) => p.zeile === zeile && p.spalte === spalte);
  const nummer = nummern.get(platzSchluessel(schluessel ?? schema.raum, zeile, spalte));
  const person = platz?.matrikelnummer ? personen.get(platz.matrikelnummer) : undefined;
  const beschriftung: Beschriftung | undefined = beschriftungBei(schema, zeile, spalte);

  return (
    <BlattModal
      offen
      titel={`${titel} · ${adresse}`}
      untertitel={ART_NAMEN[art]}
      onSchliessen={onSchliessen}
      testID="raum-info-blatt"
    >
      <View style={styles.infoBlock}>
        {art === 'tisch' ? (
          <Text style={styles.hinweis}>
            {nummer !== undefined
              ? `Sitzplatznummer ${nummer} – sie gehört zum Tisch, nicht zur Person.`
              : 'Noch keine Sitzplatznummer – die vergibt Schritt 4 beim Verteilen.'}
          </Text>
        ) : null}
        {art === 'tisch' ? (
          <Text style={styles.hinweis}>
            {person
              ? `Hier sitzt ${person.vorname} ${person.nachname} (${person.matrikelnummer})${
                  platz?.vorgabe ? ' – fest gesetzt' : ''
                }.`
              : platz?.reserviert
                ? 'Für diese Klausur freigehalten (steht in der Belegung, nicht im Raster).'
                : 'Frei.'}
          </Text>
        ) : null}
        {beschriftung ? (
          <>
            <Text style={styles.hinweis}>
              {`Text über ${bereichName(anzeigeBereich(beschriftung, schema, drehungen))} – er legt sich über den Plan, die Zelle darunter bleibt, was sie ist.`}
            </Text>
            <LabeledTextInput
              label="Text"
              value={beschriftung.text}
              onChangeText={(text) =>
                editor.beschriftungSchreiben(schema.raum, beschriftung.zeile, beschriftung.spalte, text)
              }
              placeholder="z. B. Tafel, Haupteingang, Aufsicht"
              testID="raum-info-text"
            />
          </>
        ) : (
          <>
            <Text style={styles.hinweis}>
              Hier liegt kein Text. „Text anlegen“ legt eines über diese Zelle – über mehrere
              Felder ziehst du es mit dem Werkzeug „Text“ auf.
            </Text>
            <AppButton
              title="Text anlegen"
              variant="secondary"
              onPress={() => editor.textfeldAnlegen(schema.raum, zeile, spalte)}
              testID="raum-info-text-anlegen"
            />
          </>
        )}
        <Text style={styles.hinweis}>
          Ändern lässt sich die Zelle mit einem Element aus der Palette: antippen und im Plan
          darauf tippen oder das Element direkt hierher ziehen.
        </Text>
      </View>
    </BlattModal>
  );
}

/**
 * Palette links, Pläne rechts – auf schmalen Fenstern untereinander, und dort
 * steht der Plan **oben**: Auf einem Handy scrollte man sonst an der ganzen
 * Palette vorbei, ehe der Raum zu sehen ist. Das Werkzeug wählt man darunter
 * und arbeitet im Plan darüber weiter, wie bei einer Leiste unten am Bild.
 */
export function RaumplanFlaeche({ palette, children }: { palette?: ReactNode; children: ReactNode }) {
  const { isCompact } = useResponsiveLayout();
  if (isCompact) {
    return (
      <View style={[styles.editorZeile, styles.editorZeileGestapelt]}>
        <View style={styles.plaene}>{children}</View>
        {palette}
      </View>
    );
  }
  return (
    <View style={styles.editorZeile}>
      {palette}
      <View style={styles.plaene}>{children}</View>
    </View>
  );
}

/** `position: sticky` kennt React Native nicht – im Web ist es genau richtig. */
const klebtOben = { position: 'sticky', top: spacing.sm } as unknown as object;

const styles = StyleSheet.create({
  buttonZeile: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', maxWidth: '100%' },
  planBlock: { gap: spacing.sm, maxWidth: '100%' },
  raumUeberschrift: { fontSize: 15, fontWeight: '600', color: colors.text },
  editorZeile: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  /**
   * Gestapelt muss `alignItems` mitwandern: `flex-start` misst die Kinder an
   * ihrem Inhalt, und der Plan eines Hörsaals ist breiter als das Fenster –
   * die Spalte wurde so breit wie er, und die Schaltflächen darüber standen
   * neben dem Bildschirm. Untereinander gilt deshalb wieder die volle Breite.
   */
  editorZeileGestapelt: { flexDirection: 'column', alignItems: 'stretch' },
  palette: { gap: spacing.sm, flexShrink: 0, maxWidth: 200 },
  paletteBreit: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: '100%', alignItems: 'center' },
  palettenTitel: { fontSize: 14, fontWeight: '700', color: colors.text },
  plaene: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: spacing.md },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  infoBlock: { gap: spacing.sm },
  betont: { fontWeight: '600', color: colors.text },
  /** Auf dem Handy stehen die Kurzhinweise nebeneinander statt untereinander. */
  hinweiseBreit: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, maxWidth: '100%' },
  /** Das Vollbild füllt die Modal-Ebene: Kopfleiste, Plan, Fußleiste. */
  vollbild: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
    flexDirection: 'column',
  },
  vollbildLeiste: {
    flexShrink: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  /** Schiebt den Knopf ans rechte Ende seiner Zeile. */
  leisteEnde: { marginLeft: 'auto' },
  vollbildTitel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    paddingRight: spacing.xs,
    // Auf dem Handy weicht der Name zuerst: Die Werkzeuge sind wichtiger.
    flexShrink: 1,
  },
  /** `minHeight: 0` ist Pflicht: Sonst wächst der Körper über den Bildschirm hinaus. */
  vollbildKoerper: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
  vollbildFuss: {
    flexShrink: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fussZoom: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 0 },
  zoomWert: { fontSize: 13, color: colors.textMuted, minWidth: 52, textAlign: 'center' },
});
