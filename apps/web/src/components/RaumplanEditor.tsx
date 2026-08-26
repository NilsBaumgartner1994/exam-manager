import { MutableRefObject, ReactNode, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  anzeigeBereich,
  Bereich,
  bereichAendern,
  bereichAus,
  bereichName,
  mitGroesse,
  Platzbelegung,
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
import { PaletteElement } from './PaletteElement';
import {
  PLAN_ANSICHT_EDITOR,
  Raumplan,
  ZELLE_FREI_MAX,
  ZELLE_FREI_MIN,
  type Ansichtsmodus,
  type PlanAnsicht,
} from './Raumplan';

/**
 * Werkzeug im Bearbeiten-Modus: auswählen/verschieben, ein Element malen oder
 * ein Textfeld über verbundenen Zellen aufziehen.
 */
export type Werkzeug = 'auswahl' | 'text' | ZellTyp;

/**
 * Die Elemente der Palette.
 *
 * „Sitzplatz“ und „Pult“ sind beides Tische – der Unterschied ist, ob dort
 * jemand geprüft wird: Nur Sitzplätze werden nummeriert und bekommen in
 * Schritt 4 Studierende. Das Pult ist der einfache Tisch für alles andere
 * (Aufsicht, Ablage, Materialtisch).
 */
export const PALETTE: { werkzeug: Werkzeug; titel: string; untertitel: string }[] = [
  { werkzeug: 'auswahl', titel: 'Auswählen', untertitel: 'markieren & verschieben' },
  { werkzeug: 'tisch', titel: 'Sitzplatz', untertitel: 'Tisch für Studierende · T' },
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
  const [werkzeug, setzeWerkzeug] = useState<Werkzeug>('tisch');
  const [auswahl, setzeAuswahl] = useState<{ raum: string; bereich: Bereich } | null>(null);
  const [zielZelle, setzeZielZelle] = useState<{ raum: string; zeile: number; spalte: number } | null>(null);
  const [drehungen, setzeDrehungen] = useState<Record<string, number>>({});
  const [ansicht, setzeAnsicht] = useState<PlanAnsicht>(PLAN_ANSICHT_EDITOR);

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
    if (typ === 'auswahl') return;
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
      // „Auswählen“ und „Text“ ziehen einen Bereich auf – das erledigt onAufziehen.
      if (werkzeug !== 'auswahl' && werkzeug !== 'text') elementSetzen(raum, zeile, spalte, werkzeug);
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
      if (!schema) return;
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

    paletteZiehen: (x, y) => setzeZielZelle(zelleUnterPunkt(x, y)),

    paletteAblegen: (typ) => (x, y) => {
      setzeZielZelle(null);
      setzeWerkzeug(typ);
      const ziel = zelleUnterPunkt(x, y);
      if (!ziel || typ === 'auswahl') return;
      if (!schemata.current.some((schema) => schema.raum === ziel.raum)) return;
      elementSetzen(ziel.raum, ziel.zeile, ziel.spalte, typ);
      // Jedes Ablegen ist ein eigener Schritt im Verlauf.
      verlauf.current.marke = null;
    },
  };
}

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
      <Text style={styles.hinweis}>
        Auf eine Zelle ziehen setzt das Element dort. Antippen wählt es aus, dann im Plan über
        Zellen ziehen – praktisch für eine ganze Wand. Mit „Auswählen“ ziehst du über mehrere
        Zellen, ohne etwas zu ändern; gedrückt halten in der Auswahl und ziehen verschiebt den
        ganzen Block, der blaue Griff an der unteren Ecke zieht ihn auf. Ein Sitzplatz ist ein
        Tisch, an dem jemand geprüft wird (nur die werden nummeriert und belegt); das Pult ist der
        einfache Tisch für alles andere. Rückgängig geht mit Strg/⌘ + Z.
      </Text>
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
  return (
    <View style={styles.buttonZeile}>
      <Text style={styles.hinweis}>Ansicht:</Text>
      <AppButton
        title="Auf Breite"
        variant={ansicht.modus === 'breite' ? 'primary' : 'secondary'}
        onPress={() => editor.setzeAnsichtModus('breite')}
        testID="raum-zoom-breite"
      />
      <AppButton
        title="Ganzer Raum"
        variant={ansicht.modus === 'einpassen' ? 'primary' : 'secondary'}
        onPress={() => editor.setzeAnsichtModus('einpassen')}
        testID="raum-zoom-einpassen"
      />
      <AppButton title="−" variant="secondary" onPress={() => editor.zoomAendern(-1)} testID="raum-zoom-kleiner" />
      <AppButton title="+" variant="secondary" onPress={() => editor.zoomAendern(1)} testID="raum-zoom-groesser" />
      <Text style={styles.hinweis}>
        {ansicht.modus === 'frei' ? `${ansicht.zellGroesse} px je Feld` : 'Felder passen sich an'}
      </Text>
      {editor.mitVerlauf ? (
        <>
          <AppButton
            title="↶ Rückgängig"
            variant="secondary"
            onPress={editor.rueckgaengig}
            disabled={!editor.kannRueckgaengig}
            testID="raum-rueckgaengig"
          />
          <AppButton
            title="↷ Wiederholen"
            variant="secondary"
            onPress={editor.wiederholen}
            disabled={!editor.kannWiederholen}
            testID="raum-wiederholen"
          />
        </>
      ) : null}
    </View>
  );
}

/** Leere Vorgaben – als Konstanten, damit `React.memo` in den Zellen greift. */
const OHNE_BELEGUNG: Platzbelegung[] = [];
const OHNE_NUMMERN = new Map<string, number>();
const OHNE_PERSONEN = new Map<string, Sitzplatz>();

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
  ausgewaehlt = null,
  onZellePress,
  testID,
}: KarteProps) {
  const drehungen = editor.drehungen[schema.raum] ?? 0;
  const auswahl = editor.auswahlIn(schema.raum);
  return (
    <View style={styles.planBlock}>
      <Text style={styles.raumUeberschrift}>
        {titel ?? schema.raum}
        {kopfZusatz ? ` (${kopfZusatz})` : ''} · Raster {schema.zellen[0]?.length ?? 0} Spalten ×{' '}
        {schema.zellen.length} Zeilen · {tischzellen(schema).length} Sitzplätze
        {auswahl ? ` · Auswahl ${bereichName(anzeigeBereich(auswahl, schema, drehungen))}` : ''}
      </Text>
      <View style={styles.buttonZeile}>
        <AppButton
          title="↺ 90°"
          variant="secondary"
          onPress={() => editor.drehen(schema.raum, -1)}
          testID={`raum-drehen-links-${schema.raum}`}
        />
        <AppButton
          title="↻ 90°"
          variant="secondary"
          onPress={() => editor.drehen(schema.raum, 1)}
          testID={`raum-drehen-rechts-${schema.raum}`}
        />
        {bearbeiten ? (
          <>
            <AppButton title="+ Zeile" variant="secondary" onPress={() => editor.groesseAendern(schema.raum, 1, 0)} />
            <AppButton title="− Zeile" variant="secondary" onPress={() => editor.groesseAendern(schema.raum, -1, 0)} />
            <AppButton title="+ Spalte" variant="secondary" onPress={() => editor.groesseAendern(schema.raum, 0, 1)} />
            <AppButton title="− Spalte" variant="secondary" onPress={() => editor.groesseAendern(schema.raum, 0, -1)} />
            <AppButton
              title="Zellen verbinden"
              variant="secondary"
              onPress={editor.zellenVerbinden}
              disabled={!auswahl}
              testID={`raum-verbinden-${schema.raum}`}
            />
            <AppButton
              title="Zellen trennen"
              variant="secondary"
              onPress={editor.zellenTrennen}
              disabled={!auswahl}
              testID={`raum-trennen-${schema.raum}`}
            />
          </>
        ) : null}
        {knoepfe}
      </View>
      <Raumplan
        schema={schema}
        schluessel={schluessel}
        drehungen={drehungen}
        belegung={belegung}
        nummern={nummern}
        personen={personen}
        ausgewaehlt={ausgewaehlt}
        onZellePress={
          bearbeiten
            ? (zeile, spalte) => editor.zellePress(schema.raum, zeile, spalte)
            : onZellePress
        }
        ansicht={editor.ansicht}
        onZellGroesse={(groesse) => editor.merkeZellGroesse(schema.raum, groesse)}
        bearbeiten={bearbeiten}
        werkzeug={
          editor.werkzeug === 'auswahl' ? 'auswahl' : editor.werkzeug === 'text' ? 'aufziehen' : 'malen'
        }
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
    </View>
  );
}

/** Palette links, Pläne rechts – auf schmalen Fenstern untereinander. */
export function RaumplanFlaeche({ palette, children }: { palette?: ReactNode; children: ReactNode }) {
  const { isCompact } = useResponsiveLayout();
  return (
    <View style={[styles.editorZeile, isCompact && styles.editorZeileGestapelt]}>
      {palette}
      <View style={styles.plaene}>{children}</View>
    </View>
  );
}

/** `position: sticky` kennt React Native nicht – im Web ist es genau richtig. */
const klebtOben = { position: 'sticky', top: spacing.sm } as unknown as object;

const styles = StyleSheet.create({
  buttonZeile: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  planBlock: { gap: spacing.sm },
  raumUeberschrift: { fontSize: 15, fontWeight: '600', color: colors.text },
  editorZeile: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  editorZeileGestapelt: { flexDirection: 'column' },
  palette: { gap: spacing.sm, flexShrink: 0, maxWidth: 200 },
  paletteBreit: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: '100%', alignItems: 'center' },
  palettenTitel: { fontSize: 14, fontWeight: '700', color: colors.text },
  plaene: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: spacing.md },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
