import { MutableRefObject, ReactNode, useState } from 'react';
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
import { Raumplan } from './Raumplan';

/**
 * Werkzeug im Bearbeiten-Modus: auswählen/verschieben, ein Element malen oder
 * ein Textfeld über verbundenen Zellen aufziehen.
 */
export type Werkzeug = 'auswahl' | 'text' | ZellTyp;

export const PALETTE: { werkzeug: Werkzeug; titel: string; untertitel: string }[] = [
  { werkzeug: 'auswahl', titel: 'Auswählen', untertitel: 'wählen & schieben' },
  { werkzeug: 'tisch', titel: 'Tisch', untertitel: 'T' },
  { werkzeug: 'wand', titel: 'Wand', untertitel: 'W' },
  { werkzeug: 'tuer', titel: 'Tür', untertitel: 'D' },
  { werkzeug: 'pult', titel: 'Pult', untertitel: 'P' },
  { werkzeug: 'text', titel: 'Text', untertitel: 'Zellen verbinden' },
  { werkzeug: 'leer', titel: 'Radierer', untertitel: 'frei' },
];

/** Zoomstufen des Plans: 1 = ganzer Raum im Fenster. */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 6;
const ZOOM_SCHRITT = 1.35;

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
}

export interface RaumplanEditor {
  werkzeug: Werkzeug;
  setzeWerkzeug: (werkzeug: Werkzeug) => void;
  auswahl: { raum: string; bereich: Bereich } | null;
  setzeAuswahl: (auswahl: { raum: string; bereich: Bereich } | null) => void;
  auswahlIn: (raum: string) => Bereich | null;
  zielZelle: { raum: string; zeile: number; spalte: number } | null;
  zoom: number;
  zoomAendern: (richtung: 1 | -1) => void;
  zoomZuruecksetzen: () => void;
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
 * Das Bearbeiten eines Raumrasters: Werkzeug, Auswahl, Zoom und Drehung.
 *
 * Zwei Screens bearbeiten dieselben Raster – Schritt 4 mit Studierenden darin,
 * Schritt 5 ohne. Was sie unterscheidet, steckt allein in `aendere`: Schritt 4
 * zieht dort die Belegung nach, Schritt 5 schreibt nur das Schema.
 */
export function useRaumplanEditor({
  schemata,
  aendere,
  aendereOhneBelegung,
}: RaumplanAnbindung): RaumplanEditor {
  const [werkzeug, setzeWerkzeug] = useState<Werkzeug>('tisch');
  const [auswahl, setzeAuswahl] = useState<{ raum: string; bereich: Bereich } | null>(null);
  const [zielZelle, setzeZielZelle] = useState<{ raum: string; zeile: number; spalte: number } | null>(null);
  const [drehungen, setzeDrehungen] = useState<Record<string, number>>({});
  const [zoom, setzeZoom] = useState(1);

  const nurSchema = aendereOhneBelegung ?? ((raum: string, wandel: (s: Raumschema) => Raumschema) => aendere(raum, wandel));

  /** Ein Element auf eine Zelle setzen und sie auswählen (Malen und Ablegen). */
  const elementSetzen = (raum: string, zeile: number, spalte: number, typ: Werkzeug) => {
    if (typ === 'auswahl') return;
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
    zoom,
    zoomAendern: (richtung) =>
      setzeZoom((wert) =>
        richtung > 0 ? Math.min(ZOOM_MAX, wert * ZOOM_SCHRITT) : Math.max(ZOOM_MIN, wert / ZOOM_SCHRITT),
      ),
    zoomZuruecksetzen: () => setzeZoom(1),
    drehungen,
    drehen: (raum, richtung) =>
      setzeDrehungen((alt) => ({ ...alt, [raum]: ((((alt[raum] ?? 0) + richtung) % 4) + 4) % 4 })),

    zellePress: (raum, zeile, spalte) => {
      // „Auswählen“ und „Text“ ziehen einen Bereich auf – das erledigt onAufziehen.
      if (werkzeug !== 'auswahl' && werkzeug !== 'text') elementSetzen(raum, zeile, spalte, werkzeug);
    },

    /**
     * Auswahl über mehrere Felder aufziehen (Griff an der unteren Ecke).
     * Gefüllt wird mit dem Element der bisherigen Auswahl – so wird aus einem
     * Tisch eine Tischreihe und aus einer Wandzelle eine ganze Wand.
     */
    bereichAufziehen: (raum, neuerBereich) => {
      const alteAuswahl = auswahl && auswahl.raum === raum ? auswahl.bereich : neuerBereich;
      const schema = schemata.current.find((s) => s.raum === raum);
      if (!schema) return;
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

    beschriftungSchreiben: (raum, zeile, spalte, text) =>
      nurSchema(raum, (schema) => setzeBeschriftungsText(schema, zeile, spalte, text)),

    groesseAendern: (raum, dZeilen, dSpalten) =>
      aendere(raum, (aktuell) =>
        mitGroesse(aktuell, aktuell.zellen.length + dZeilen, (aktuell.zellen[0]?.length ?? 1) + dSpalten),
      ),

    zellenVerbinden: () => {
      if (!auswahl) return;
      aendere(auswahl.raum, (schema) => verbindeZellen(schema, auswahl.bereich));
      setzeWerkzeug('text');
    },

    zellenTrennen: () => {
      if (!auswahl) return;
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
        Zellen ziehen – praktisch für eine ganze Wand.
      </Text>
    </View>
  );
}

/**
 * Zoomleiste: Ohne Zoom passt jeder Raum ganz ins Fenster – auch 47 × 34
 * Felder. Zum Lesen der Namen zoomt man hinein, dann scrollt der Plan.
 */
export function PlanZoomLeiste({ editor }: { editor: RaumplanEditor }) {
  return (
    <View style={styles.buttonZeile}>
      <Text style={styles.hinweis}>Ansicht: {Math.round(editor.zoom * 100)} %</Text>
      <AppButton title="−" variant="secondary" onPress={() => editor.zoomAendern(-1)} testID="raum-zoom-kleiner" />
      <AppButton title="+" variant="secondary" onPress={() => editor.zoomAendern(1)} testID="raum-zoom-groesser" />
      <AppButton
        title="Einpassen"
        variant="secondary"
        onPress={editor.zoomZuruecksetzen}
        testID="raum-zoom-einpassen"
      />
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
        {schema.raum}
        {kopfZusatz ? ` (${kopfZusatz})` : ''} · Raster {schema.zellen[0]?.length ?? 0} Spalten ×{' '}
        {schema.zellen.length} Zeilen · {tischzellen(schema).length} Tische
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
        zoom={editor.zoom}
        bearbeiten={bearbeiten}
        werkzeug={editor.werkzeug === 'auswahl' || editor.werkzeug === 'text' ? 'auswahl' : 'malen'}
        auswahl={auswahl}
        onAuswahl={(bereich) => editor.setzeAuswahl({ raum: schema.raum, bereich })}
        onAufziehen={(bereich) => editor.bereichAufziehen(schema.raum, bereich)}
        onVerschieben={(dZeile, dSpalte) => editor.bereichVerschieben(schema.raum, dZeile, dSpalte)}
        onBeschriftungText={(zeile, spalte, text) =>
          editor.beschriftungSchreiben(schema.raum, zeile, spalte, text)
        }
        zielZelle={editor.zielZelle?.raum === schema.raum ? editor.zielZelle : null}
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
