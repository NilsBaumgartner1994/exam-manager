import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PointerEvent,
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

/** Werkzeug im Bearbeiten-Modus: auswählen/verschieben oder Zellen malen. */
export type PlanWerkzeug = 'auswahl' | 'malen';

interface Props {
  schema: Raumschema;
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

  /** Aushang-Darstellung: nur Namenskürzel statt vollem Namen. */
  anonym?: boolean;
  testID?: string;
}

/** Laufender Zug auf dem Raster (alles in Anzeige-Koordinaten). */
interface Zug {
  art: 'malen' | 'verschieben' | 'groesse';
  start: { zeile: number; spalte: number };
  aktuell: { zeile: number; spalte: number };
  /** Beim Aufziehen der feste Eckpunkt (Anzeige oben links der Auswahl). */
  anker?: { zeile: number; spalte: number };
}

/** Grenzen der Zellgröße beim Einpassen: für große Räume klein, zum Lesen groß. */
const ZELLE_MIN = 14;
const ZELLE_MAX = 120;
/** Grenzen der frei eingestellten Zellgröße (Zoom in Pixeln). */
export const ZELLE_FREI_MIN = 8;
export const ZELLE_FREI_MAX = 240;
/** Höhe, die neben dem Plan für Kopfzeile, Schaltflächen und Listen bleibt. */
const HOEHE_FUER_DEN_REST = 340;

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
 * Voreinstellung im Editor: Die Breite wird genutzt. Ein schmaler Raum in
 * einem breiten Fenster wäre eingepasst winzig, obwohl daneben alles frei ist.
 */
export const PLAN_ANSICHT_EDITOR: PlanAnsicht = { modus: 'breite', zellGroesse: 32 };

function begrenze(wert: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(wert, min), max));
}

/** Fuge zwischen zwei Zellen – bei kleinen Zellen wäre mehr Fuge als Zelle. */
function fugenbreite(zellGroesse: number): number {
  return zellGroesse >= 40 ? 4 : zellGroesse >= 24 ? 2 : 1;
}

/**
 * Maße des Rasters zu einer Raumgröße. Wie groß eine Zelle wird, sagt die
 * Ansicht: eingepasst (ganzer Raum sichtbar), auf Breite (volle Breite, in
 * die Höhe wird gescrollt) oder frei in Pixeln.
 *
 * Abstand, Kopfgröße und Schriftgrößen hängen an der Zellgröße – sonst wäre
 * bei 47 Spalten mehr Fuge als Zelle zu sehen.
 */
export function rastermasse(
  anzahlZeilen: number,
  anzahlSpalten: number,
  breite: number,
  hoehe: number,
  ansicht: PlanAnsicht = PLAN_ANSICHT,
) {
  // Die Zeilenköpfe stehen links neben dem Raster: gut eine Drittelzelle, die
  // von der Breite abgeht, sonst ragt der Plan bei „Breite“ knapp heraus.
  const proSpalte = breite / (Math.max(1, anzahlSpalten) + 0.4);
  const proZeile = hoehe / Math.max(1, anzahlZeilen);
  const platz = ansicht.modus === 'breite' ? proSpalte : Math.min(proSpalte, proZeile);
  // Zellgröße und Fuge hängen voneinander ab (kleine Zellen bekommen eine
  // schmalere Fuge). Erst mit der größten Fuge schätzen, dann mit der Fuge
  // rechnen, die dazu gehört – sonst bliebe bei vielen Spalten ein Streifen
  // ungenutzt (47 Spalten × 3 px sind über 140 px).
  const geschaetzt = begrenze(platz - 4, ZELLE_MIN, ZELLE_MAX);
  const gewuenscht = begrenze(platz - fugenbreite(geschaetzt), ZELLE_MIN, ZELLE_MAX);
  const groesse =
    ansicht.modus === 'frei'
      ? begrenze(ansicht.zellGroesse, ZELLE_FREI_MIN, ZELLE_FREI_MAX)
      : // Die endgültige Fuge kann eine Stufe breiter sein als die geschätzte;
        // dann eine Spur kleiner, damit der Plan sicher hineinpasst.
        Math.max(ZELLE_MIN, Math.min(gewuenscht, Math.floor(platz - fugenbreite(gewuenscht))));
  return {
    groesse,
    abstand: fugenbreite(groesse),
    kopfGroesse: begrenze(groesse * 0.34, 11, 22),
    kopfSchrift: begrenze(groesse * 0.22, 8, 11),
    /** Ab hier ist Platz für Nummer und Zusatz, darunter nur noch der Name. */
    zeigeDetails: groesse >= 40,
    zeigeNamen: groesse >= 26,
    namenSchrift: begrenze(groesse * 0.2, 8, 13),
    kleinSchrift: begrenze(groesse * 0.16, 7, 11),
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
 * lässt – auch dort, wo (noch) nichts steht. Der Aushang (`anonym`) verzichtet
 * darauf. Beschriftet wird immer das, was man sieht: Nach einer Drehung
 * benennen die Köpfe die gedrehte Ansicht.
 *
 * Die Zellgröße richtet sich nach der Ansicht: eingepasst passt der ganze Raum
 * ins Fenster (auch ein Hörsaal mit 47 × 34 Feldern), auf Breite nutzt er die
 * volle Breite, und frei gezoomt gibt man die Zellgröße in Pixeln vor wie bei
 * einem Bild. Was nicht mehr hineinpasst, wird gescrollt.
 *
 * Im Bearbeiten-Modus wird gezogen wie in einer Tabellenkalkulation:
 * über Zellen ziehen malt (praktisch für Wände), am Griff an der unteren Ecke
 * zieht man ein Element über mehrere Felder auf, und innerhalb der Auswahl
 * verschiebt man den ganzen Block. Welche Zelle unter dem Finger liegt, wird
 * aus den Koordinaten gerechnet (nicht aus Hover-Ereignissen): Beim Ziehen mit
 * dem Finger bleiben alle Ereignisse beim Startelement.
 */
export function Raumplan({
  schema,
  drehungen,
  belegung,
  nummern,
  personen,
  ausgewaehlt,
  onZellePress,
  ansicht = PLAN_ANSICHT,
  onZellGroesse,
  bearbeiten,
  werkzeug = 'auswahl',
  auswahl,
  onAuswahl,
  onVerschieben,
  onAufziehen,
  onBeschriftungText,
  zielZelle,
  onZugEnde,
  anonym,
  testID,
}: Props) {
  const fenster = useWindowDimensions();
  const [breite, setBreite] = useState(0);
  const gitterRef = useRef<View>(null);
  const [zug, setZug] = useState<Zug | null>(null);

  const raster = useMemo(() => anzeigeRaster(schema, drehungen), [schema, drehungen]);
  const spaltenAnzahl = raster[0]?.length ?? 0;
  const mitGitter = !anonym;

  const masse = rastermasse(
    raster.length,
    spaltenAnzahl,
    (breite > 0 ? breite : fenster.width) - spacing.md,
    Math.max(280, fenster.height - HOEHE_FUER_DEN_REST),
    ansicht,
  );
  const { groesse, abstand, kopfGroesse } = masse;
  const schritt = groesse + abstand;

  useEffect(() => {
    onZellGroesse?.(groesse);
  }, [groesse, onZellGroesse]);

  const belegungJePlatz = useMemo(
    () =>
      new Map(belegung.map((platz) => [platzSchluessel(platz.raum, platz.zeile, platz.spalte), platz])),
    [belegung],
  );

  /** Anzeige-Position einer Zelle aus den Bildschirmkoordinaten. */
  const zelleBeiPunkt = (x: number, y: number): { zeile: number; spalte: number } | null => {
    const knoten = gitterRef.current as unknown as HTMLElement | null;
    if (!knoten) return null;
    // Der gemessene Knoten ist genau das Zellraster (die Köpfe liegen außerhalb),
    // die erste Zelle beginnt also an seiner Ecke.
    const rect = knoten.getBoundingClientRect();
    const zeile = Math.floor((y - rect.top) / schritt);
    const spalte = Math.floor((x - rect.left) / schritt);
    if (zeile < 0 || spalte < 0 || zeile >= raster.length || spalte >= spaltenAnzahl) return null;
    return { zeile, spalte };
  };

  const kanonisch = (position: { zeile: number; spalte: number }) =>
    raster[position.zeile][position.spalte];

  /** Anzeige-Rechteck der Auswahl – für Griff und Vorschau. */
  const auswahlAnzeige = auswahl ? anzeigeBereich(auswahl, schema, drehungen) : null;

  /** Vorschau während eines Zugs (Anzeige-Koordinaten). */
  const vorschau = (() => {
    if (!zug) return null;
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
      onZellePress?.(zelle.zeile, zelle.spalte);
      return;
    }
    if (auswahl && imBereich(auswahl, zelle.zeile, zelle.spalte) && werkzeug === 'auswahl') {
      setZug({ art: 'verschieben', start: anzeige, aktuell: anzeige });
      return;
    }
    if (werkzeug === 'malen') {
      onZellePress?.(zelle.zeile, zelle.spalte);
      setZug({ art: 'malen', start: anzeige, aktuell: anzeige });
      return;
    }
    // Auswählen: einzelne Zelle wählen, ziehen zieht direkt einen Bereich auf.
    onAuswahl?.(bereichAus(zelle, zelle));
    setZug({ art: 'groesse', start: anzeige, aktuell: anzeige, anker: anzeige });
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
    setZug({ art: 'groesse', start: ecke, aktuell: ecke, anker: { zeile: bereich.zeile, spalte: bereich.spalte } });
  }, []);

  const pointerMove = (ereignis: PointerEvent) => {
    if (!zug) return;
    const position = zelleBeiPunkt(ereignis.nativeEvent.clientX, ereignis.nativeEvent.clientY);
    if (!position) return;
    if (position.zeile === zug.aktuell.zeile && position.spalte === zug.aktuell.spalte) return;
    if (zug.art === 'malen') {
      const zelle = kanonisch(position);
      onZellePress?.(zelle.zeile, zelle.spalte);
    }
    setZug({ ...zug, aktuell: position });
  };

  const pointerUp = () => {
    if (!zug) return;
    if (zug.art === 'groesse' && zug.anker) {
      onAufziehen?.(bereichAus(kanonisch(zug.anker), kanonisch(zug.aktuell)));
    } else if (zug.art === 'verschieben') {
      const von = kanonisch(zug.start);
      const bis = kanonisch(zug.aktuell);
      onVerschieben?.(bis.zeile - von.zeile, bis.spalte - von.spalte);
    }
    setZug(null);
    onZugEnde?.();
  };

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

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator
      onLayout={merkeBreite}
      testID={testID}
    >
      <View style={styles.aussen}>
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
                <View key={z} style={[styles.kopf, { width: kopfGroesse, height: groesse }]}>
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
            onPointerMove={bearbeiten || zug ? pointerMove : undefined}
            onPointerUp={pointerUp}
            onPointerCancel={() => {
              setZug(null);
              onZugEnde?.();
            }}
          >
            {raster.map((zeile, z) => (
              <View key={z} style={[styles.zeile, { gap: abstand }]}>
                {zeile.map((zelle, s) => {
                  const schluessel = platzSchluessel(schema.raum, zelle.zeile, zelle.spalte);
                  return (
                    <Zelle
                      key={s}
                      zeile={z}
                      spalte={s}
                      zelle={zelle}
                      masse={masse}
                      platz={belegungJePlatz.get(schluessel)}
                      nummer={nummern.get(schluessel)}
                      personen={personen}
                      ausgewaehlt={ausgewaehlt ?? null}
                      anonym={anonym ?? false}
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
                      datenSchluessel={schluessel}
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
                onAuswahl={onAuswahl}
                onText={onBeschriftungText}
                testID={testID ? `${testID}-text-${beschriftung.zeile}-${beschriftung.spalte}` : undefined}
              />
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
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
  onAuswahl,
  onText,
  testID,
}: {
  beschriftung: Beschriftung;
  bereich: Bereich;
  masse: Rastermasse;
  bearbeiten: boolean;
  markiert: boolean;
  onAuswahl?: (bereich: Bereich) => void;
  onText?: (zeile: number, spalte: number, text: string) => void;
  testID?: string;
}) {
  const schritt = masse.groesse + masse.abstand;
  const rahmen = {
    left: bereich.spalte * schritt,
    top: bereich.zeile * schritt,
    width: bereich.breite * masse.groesse + (bereich.breite - 1) * masse.abstand,
    height: bereich.hoehe * masse.groesse + (bereich.hoehe - 1) * masse.abstand,
  };
  const schrift = { fontSize: Math.max(9, Math.min(16, Math.round(masse.groesse * 0.24))) };
  const ecken = { borderRadius: Math.min(radius.md, Math.round(masse.groesse * 0.18)) };

  return (
    <View
      style={[
        styles.textfeld,
        rahmen,
        ecken,
        bearbeiten && styles.textfeldBearbeiten,
        markiert && styles.textfeldMarkiert,
      ]}
      pointerEvents={bearbeiten ? 'auto' : 'none'}
      onPointerDown={() => onAuswahl?.(beschriftung)}
      testID={testID}
    >
      {bearbeiten && onText ? (
        <TextInput
          style={[styles.textfeldEingabe, schrift, mitTextauswahl]}
          // Ein frisch aufgezogenes Feld ist ausgewählt: Dann gleich hinein,
          // damit man losschreiben kann, ohne noch einmal zu klicken.
          autoFocus={markiert}
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
  anonym,
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
  anonym: boolean;
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
  const { groesse, abstand } = masse;

  const inhalt = (() => {
    if (verdeckt) return null;
    switch (zelle.typ) {
      case 'tisch':
        return (
          <>
            {masse.zeigeDetails ? (
              <Text style={[styles.nummer, { fontSize: masse.kleinSchrift }]}>{nummer ?? ''}</Text>
            ) : null}
            {!masse.zeigeNamen ? null : platz?.reserviert ? (
              <Text style={[styles.reserve, { fontSize: masse.kleinSchrift }]} numberOfLines={1}>
                Reserve
              </Text>
            ) : person ? (
              <Text style={[styles.name, { fontSize: masse.namenSchrift }]} numberOfLines={2}>
                {anonym ? person.anfangNachname : person.nachname}
              </Text>
            ) : platz && masse.zeigeDetails ? (
              // Nur wo eine Belegung geführt wird: In Schritt 5 gibt es keine,
              // dort stünde in jedem Tisch ein sinnloses „frei“.
              <Text style={[styles.frei, { fontSize: masse.kleinSchrift }]}>frei</Text>
            ) : null}
            {platz?.vorgabe && masse.zeigeDetails ? (
              <Text style={[styles.vorgabe, { fontSize: masse.kleinSchrift }]}>fest</Text>
            ) : null}
          </>
        );
      case 'tuer':
        return masse.zeigeNamen ? (
          <Text style={[styles.symbolText, { fontSize: masse.kleinSchrift }]}>Tür</Text>
        ) : null;
      case 'pult':
        return masse.zeigeNamen ? (
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
        { width: groesse, height: groesse, borderRadius: Math.min(radius.md, Math.round(groesse * 0.18)) },
        gitter && styles.gitterlinie,
        zelle.typ === 'tisch' && styles.tisch,
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
          style={[styles.griff, { width: Math.max(10, groesse * 0.2), height: Math.max(10, groesse * 0.2) }]}
          onPointerDown={(ereignis) => {
            ereignis.stopPropagation();
            onGriffPointerDown();
          }}
        />
      ) : null}
    </View>
  );
});

/** Browser-Gesten (Scrollen, Textauswahl) während des Zeichnens abschalten. */
const ohneBrowserGeste = {
  touchAction: 'none',
  userSelect: 'none',
} as unknown as object;

/** Im Textfeld gilt das Gegenteil: Dort will man tippen und markieren. */
const mitTextauswahl = {
  touchAction: 'auto',
  userSelect: 'text',
} as unknown as object;

const styles = StyleSheet.create({
  aussen: { padding: spacing.xs, gap: 4 },
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
  markiert: { borderColor: colors.primary, borderWidth: 2, borderStyle: 'solid' },
  vorschau: { backgroundColor: '#dbeafe', borderColor: colors.primary, borderWidth: 2, borderStyle: 'dashed' },
  tuer: { backgroundColor: colors.successBg, borderColor: colors.success },
  pult: { backgroundColor: colors.pult, borderColor: colors.pultRand },
  // Wand: eckig, ohne eigene Ecken – die Fugen schließt `wandFuellung`.
  wand: { backgroundColor: '#475569', borderRadius: 0, borderColor: '#475569', overflow: 'visible' },
  wandFuellung: { position: 'absolute', backgroundColor: '#475569' },
  griff: {
    position: 'absolute',
    right: -5,
    bottom: -5,
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
  frei: { color: colors.textMuted },
  reserve: { fontWeight: '600', color: colors.textMuted },
  vorgabe: { fontWeight: '700', color: colors.danger },
  symbolText: { fontWeight: '600', color: colors.text },
});
