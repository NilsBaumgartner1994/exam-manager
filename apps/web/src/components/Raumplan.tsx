import { useRef, useState } from 'react';
import { PointerEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AnzeigeZelle,
  anzeigeRaster,
  Bereich,
  bereichAus,
  imBereich,
  Platzbelegung,
  platzSchluessel,
  Raumschema,
  Sitzplatz,
} from '@exam-manager/core';
import { datenAttribute } from '../domProps';
import { useResponsiveLayout } from '../responsive';
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
  /** Zelle, über der gerade ein Element aus der Palette schwebt. */
  zielZelle?: { zeile: number; spalte: number } | null;

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

const GITTER_ABSTAND = 4;
/** Breite/Höhe der Zeilen- und Spaltenköpfe (wie in einer Tabelle). */
const KOPF_GROESSE = 20;

/**
 * Sitzplan eines Raums als Raster.
 *
 * Die Ansicht lässt sich um jeweils 90° drehen, damit sie zur eigenen
 * Blickrichtung im Raum passt. Gedreht wird nur die Darstellung – jede Zelle
 * behält ihre gespeicherte Position, Sitzplatznummern bleiben also gleich.
 *
 * Jedes Feld hat eine dünne Linie und das Raster Zeilen- und Spaltenköpfe:
 * So ist zu sehen, wie groß der Raum ist und wo sich klicken lässt – auch
 * dort, wo (noch) nichts steht. Der Aushang (`anonym`) verzichtet darauf.
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
  bearbeiten,
  werkzeug = 'auswahl',
  auswahl,
  onAuswahl,
  onVerschieben,
  onAufziehen,
  zielZelle,
  anonym,
  testID,
}: Props) {
  const { isCompact } = useResponsiveLayout();
  const raster = anzeigeRaster(schema, drehungen);
  const groesse = isCompact ? 64 : 84;
  const gitterRef = useRef<View>(null);
  const [zug, setZug] = useState<Zug | null>(null);

  const belegungJePlatz = new Map(
    belegung.map((platz) => [platzSchluessel(platz.raum, platz.zeile, platz.spalte), platz]),
  );

  /** Anzeige-Position einer Zelle aus den Bildschirmkoordinaten. */
  const zelleBeiPunkt = (x: number, y: number): { zeile: number; spalte: number } | null => {
    const knoten = gitterRef.current as unknown as HTMLElement | null;
    if (!knoten) return null;
    // Der gemessene Knoten ist genau das Zellraster (die Köpfe liegen außerhalb),
    // die erste Zelle beginnt also an seiner Ecke.
    const rect = knoten.getBoundingClientRect();
    const schritt = groesse + GITTER_ABSTAND;
    const zeile = Math.floor((y - rect.top) / schritt);
    const spalte = Math.floor((x - rect.left) / schritt);
    if (zeile < 0 || spalte < 0 || zeile >= raster.length || spalte >= (raster[0]?.length ?? 0)) return null;
    return { zeile, spalte };
  };

  const kanonisch = (position: { zeile: number; spalte: number }) =>
    raster[position.zeile][position.spalte];

  /** Anzeige-Rechteck der Auswahl – für Griff und Vorschau. */
  const auswahlAnzeige = (() => {
    if (!auswahl) return null;
    let minZ = Infinity, minS = Infinity, maxZ = -1, maxS = -1;
    raster.forEach((zeile, z) =>
      zeile.forEach((zelle, s) => {
        if (!imBereich(auswahl, zelle.zeile, zelle.spalte)) return;
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        minS = Math.min(minS, s); maxS = Math.max(maxS, s);
      }),
    );
    return maxZ < 0 ? null : { minZ, minS, maxZ, maxS };
  })();

  /** Vorschau während eines Zugs (Anzeige-Koordinaten). */
  const vorschau = (() => {
    if (!zug || !auswahlAnzeige) return null;
    if (zug.art === 'groesse' && zug.anker) {
      const z = [Math.min(zug.anker.zeile, zug.aktuell.zeile), Math.max(zug.anker.zeile, zug.aktuell.zeile)];
      const s = [Math.min(zug.anker.spalte, zug.aktuell.spalte), Math.max(zug.anker.spalte, zug.aktuell.spalte)];
      return { minZ: z[0], maxZ: z[1], minS: s[0], maxS: s[1] };
    }
    if (zug.art === 'verschieben') {
      const dz = zug.aktuell.zeile - zug.start.zeile;
      const ds = zug.aktuell.spalte - zug.start.spalte;
      return {
        minZ: auswahlAnzeige.minZ + dz, maxZ: auswahlAnzeige.maxZ + dz,
        minS: auswahlAnzeige.minS + ds, maxS: auswahlAnzeige.maxS + ds,
      };
    }
    return null;
  })();

  const inVorschau = (z: number, s: number) =>
    !!vorschau && z >= vorschau.minZ && z <= vorschau.maxZ && s >= vorschau.minS && s <= vorschau.maxS;

  const zellePointerDown = (anzeige: { zeile: number; spalte: number }) => {
    if (!bearbeiten) {
      const zelle = kanonisch(anzeige);
      onZellePress?.(zelle.zeile, zelle.spalte);
      return;
    }
    const inAuswahl = auswahl ? imBereich(auswahl, kanonisch(anzeige).zeile, kanonisch(anzeige).spalte) : false;
    if (inAuswahl && werkzeug === 'auswahl') {
      setZug({ art: 'verschieben', start: anzeige, aktuell: anzeige });
      return;
    }
    if (werkzeug === 'malen') {
      const zelle = kanonisch(anzeige);
      onZellePress?.(zelle.zeile, zelle.spalte);
      setZug({ art: 'malen', start: anzeige, aktuell: anzeige });
      return;
    }
    // Auswählen: einzelne Zelle wählen, ziehen zieht direkt einen Bereich auf.
    const zelle = kanonisch(anzeige);
    onAuswahl?.(bereichAus(zelle, zelle));
    setZug({ art: 'groesse', start: anzeige, aktuell: anzeige, anker: anzeige });
  };

  const griffPointerDown = () => {
    if (!auswahlAnzeige) return;
    const anker = { zeile: auswahlAnzeige.minZ, spalte: auswahlAnzeige.minS };
    const ecke = { zeile: auswahlAnzeige.maxZ, spalte: auswahlAnzeige.maxS };
    setZug({ art: 'groesse', start: ecke, aktuell: ecke, anker });
  };

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
  };

  const mitGitter = !anonym;
  const spaltenAnzahl = raster[0]?.length ?? 0;

  return (
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator testID={testID}>
      <View style={styles.aussen}>
        {mitGitter ? (
          <View style={styles.kopfZeile}>
            <View style={styles.kopfEcke} />
            {Array.from({ length: spaltenAnzahl }, (_, s) => (
              <View key={s} style={[styles.kopf, { width: groesse, height: KOPF_GROESSE }]}>
                <Text style={styles.kopfText}>{s + 1}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.innen}>
          {mitGitter ? (
            <View style={styles.kopfSpalte}>
              {raster.map((_, z) => (
                <View key={z} style={[styles.kopf, { width: KOPF_GROESSE, height: groesse }]}>
                  <Text style={styles.kopfText}>{z + 1}</Text>
                </View>
              ))}
            </View>
          ) : null}

      <View
        ref={gitterRef}
        // Eigene Kennung: Die Köpfe liegen außerhalb, das reine Zellraster ist
        // der Bezugspunkt für Koordinaten (und für Tests).
        testID={testID ? `${testID}-raster` : undefined}
        style={[styles.raster, bearbeiten ? ohneBrowserGeste : null]}
        onPointerMove={bearbeiten || zug ? pointerMove : undefined}
        onPointerUp={pointerUp}
        onPointerCancel={() => setZug(null)}
      >
        {raster.map((zeile, z) => (
          <View key={z} style={styles.zeile}>
            {zeile.map((zelle, s) => {
              const schluessel = platzSchluessel(schema.raum, zelle.zeile, zelle.spalte);
              const istZiel =
                !!zielZelle && zielZelle.zeile === zelle.zeile && zielZelle.spalte === zelle.spalte;
              return (
                <Zelle
                  key={s}
                  zelle={zelle}
                  groesse={groesse}
                  platz={belegungJePlatz.get(schluessel)}
                  nummer={nummern.get(schluessel)}
                  personen={personen}
                  ausgewaehlt={ausgewaehlt ?? null}
                  anonym={anonym ?? false}
                  gitter={mitGitter}
                  markiert={!!auswahl && imBereich(auswahl, zelle.zeile, zelle.spalte)}
                  vorschau={inVorschau(z, s) || istZiel}
                  griff={
                    !!bearbeiten &&
                    !!auswahlAnzeige &&
                    auswahlAnzeige.maxZ === z &&
                    auswahlAnzeige.maxS === s
                  }
                  interaktiv={!!onZellePress || !!bearbeiten}
                  datenSchluessel={schluessel}
                  onPointerDown={() => zellePointerDown({ zeile: z, spalte: s })}
                  onGriffPointerDown={griffPointerDown}
                />
              );
            })}
          </View>
        ))}
      </View>
        </View>
      </View>
    </ScrollView>
  );
}

function Zelle({
  zelle,
  groesse,
  platz,
  nummer,
  personen,
  ausgewaehlt,
  anonym,
  markiert,
  vorschau,
  griff,
  gitter,
  interaktiv,
  datenSchluessel,
  onPointerDown,
  onGriffPointerDown,
}: {
  zelle: AnzeigeZelle;
  groesse: number;
  platz?: Platzbelegung;
  nummer?: number;
  personen: Map<string, Sitzplatz>;
  ausgewaehlt: string | null;
  anonym: boolean;
  markiert: boolean;
  vorschau: boolean;
  griff: boolean;
  gitter: boolean;
  interaktiv: boolean;
  datenSchluessel: string;
  onPointerDown: () => void;
  onGriffPointerDown: () => void;
}) {
  const person = platz?.matrikelnummer ? personen.get(platz.matrikelnummer) : undefined;
  const istAusgewaehlt = !!ausgewaehlt && platz?.matrikelnummer === ausgewaehlt;

  const inhalt = (() => {
    switch (zelle.typ) {
      case 'tisch':
        return (
          <>
            <Text style={styles.nummer}>{nummer ?? ''}</Text>
            {platz?.reserviert ? (
              <Text style={styles.reserve}>Reserve</Text>
            ) : person ? (
              <Text style={styles.name} numberOfLines={2}>
                {anonym ? person.anfangNachname : person.nachname}
              </Text>
            ) : (
              <Text style={styles.frei}>frei</Text>
            )}
            {platz?.vorgabe ? <Text style={styles.vorgabe}>fest</Text> : null}
          </>
        );
      case 'tuer':
        return <Text style={styles.symbolText}>Tür</Text>;
      case 'pult':
        return <Text style={styles.symbolText}>Pult</Text>;
      default:
        return null;
    }
  })();

  return (
    <View
      // Wände rücken zusammen, damit eine Reihe wie eine durchgehende Wand wirkt.
      style={[
        styles.zelle,
        { width: groesse, height: groesse },
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
      onPointerDown={interaktiv ? onPointerDown : undefined}
      {...datenAttribute({ zelle: datenSchluessel })}
    >
      {inhalt}
      {griff ? (
        <View
          style={styles.griff}
          onPointerDown={(ereignis) => {
            ereignis.stopPropagation();
            onGriffPointerDown();
          }}
        />
      ) : null}
    </View>
  );
}

/** Browser-Gesten (Scrollen, Textauswahl) während des Zeichnens abschalten. */
const ohneBrowserGeste = {
  touchAction: 'none',
  userSelect: 'none',
} as unknown as object;

const styles = StyleSheet.create({
  aussen: { padding: spacing.xs, gap: GITTER_ABSTAND },
  innen: { flexDirection: 'row', gap: GITTER_ABSTAND },
  raster: { gap: GITTER_ABSTAND },
  kopfZeile: { flexDirection: 'row', gap: GITTER_ABSTAND },
  kopfSpalte: { gap: GITTER_ABSTAND },
  kopfEcke: { width: KOPF_GROESSE, height: KOPF_GROESSE },
  kopf: { alignItems: 'center', justifyContent: 'center' },
  kopfText: { fontSize: 11, color: colors.textMuted },
  /** Dünne Linie um jedes Feld – zeigt Größe des Rasters und Klickflächen. */
  gitterlinie: { borderColor: colors.gitter, borderStyle: 'solid' },
  zeile: { flexDirection: 'row', gap: GITTER_ABSTAND },
  zelle: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  tisch: { borderColor: colors.border, backgroundColor: colors.surface, borderStyle: 'dashed' },
  belegt: { borderStyle: 'solid', backgroundColor: '#eef2ff', borderColor: colors.primary },
  reserviertZelle: { backgroundColor: colors.background, borderStyle: 'solid' },
  personAusgewaehlt: { borderColor: colors.danger, borderWidth: 2 },
  markiert: { borderColor: colors.primary, borderWidth: 2, borderStyle: 'solid' },
  vorschau: { backgroundColor: '#dbeafe', borderColor: colors.primary, borderWidth: 2, borderStyle: 'dashed' },
  tuer: { backgroundColor: colors.successBg, borderColor: colors.success },
  pult: { backgroundColor: '#fef3c7', borderColor: '#d97706' },
  // Wand: eckig und mit negativem Rand, damit nebeneinanderliegende Zellen
  // eine durchgehende Wand ergeben statt einer gestrichelten Reihe.
  wand: {
    backgroundColor: '#475569',
    borderRadius: 0,
    margin: -GITTER_ABSTAND / 2,
    borderWidth: GITTER_ABSTAND / 2,
    borderColor: '#475569',
  },
  griff: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  nummer: { fontSize: 11, color: colors.textMuted },
  name: { fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'center' },
  frei: { fontSize: 12, color: colors.textMuted },
  reserve: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  vorgabe: { fontSize: 10, fontWeight: '700', color: colors.danger },
  symbolText: { fontSize: 12, fontWeight: '600', color: colors.text },
});
