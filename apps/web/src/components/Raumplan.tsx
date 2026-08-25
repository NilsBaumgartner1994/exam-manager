import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AnzeigeZelle,
  anzeigeRaster,
  Platzbelegung,
  platzSchluessel,
  Raumschema,
  Sitzplatz,
} from '@exam-manager/core';
import { useResponsiveLayout } from '../responsive';
import { colors, radius, spacing } from '../theme';

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
  onZellePress?: (zeile: number, spalte: number) => void;
  /** Aushang-Darstellung: nur Namenskürzel statt vollem Namen. */
  anonym?: boolean;
  testID?: string;
}

/**
 * Sitzplan eines Raums als Raster.
 *
 * Die Ansicht lässt sich um jeweils 90° drehen, damit sie zur eigenen
 * Blickrichtung im Raum passt. Gedreht wird nur die Darstellung – jede Zelle
 * behält ihre gespeicherte Position, Sitzplatznummern bleiben also gleich.
 */
export function Raumplan({
  schema,
  drehungen,
  belegung,
  nummern,
  personen,
  ausgewaehlt,
  onZellePress,
  anonym,
  testID,
}: Props) {
  const { isCompact } = useResponsiveLayout();
  const raster = anzeigeRaster(schema, drehungen);
  const groesse = isCompact ? 64 : 84;

  const belegungJePlatz = new Map(
    belegung.map((platz) => [platzSchluessel(platz.raum, platz.zeile, platz.spalte), platz]),
  );

  return (
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator testID={testID}>
      <View style={styles.raster}>
        {raster.map((zeile, z) => (
          <View key={z} style={styles.zeile}>
            {zeile.map((zelle, s) => (
              <Zelle
                key={s}
                zelle={zelle}
                groesse={groesse}
                platz={belegungJePlatz.get(platzSchluessel(schema.raum, zelle.zeile, zelle.spalte))}
                nummer={nummern.get(platzSchluessel(schema.raum, zelle.zeile, zelle.spalte))}
                personen={personen}
                ausgewaehlt={ausgewaehlt ?? null}
                anonym={anonym ?? false}
                onPress={onZellePress}
              />
            ))}
          </View>
        ))}
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
  onPress,
}: {
  zelle: AnzeigeZelle;
  groesse: number;
  platz?: Platzbelegung;
  nummer?: number;
  personen: Map<string, Sitzplatz>;
  ausgewaehlt: string | null;
  anonym: boolean;
  onPress?: (zeile: number, spalte: number) => void;
}) {
  const person = platz?.matrikelnummer ? personen.get(platz.matrikelnummer) : undefined;
  const istAusgewaehlt = !!ausgewaehlt && platz?.matrikelnummer === ausgewaehlt;
  const masse = { width: groesse, height: groesse };

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
      case 'wand':
        return null;
      default:
        return null;
    }
  })();

  const stil = [
    styles.zelle,
    masse,
    zelle.typ === 'tisch' && styles.tisch,
    zelle.typ === 'tuer' && styles.tuer,
    zelle.typ === 'pult' && styles.pult,
    zelle.typ === 'wand' && styles.wand,
    zelle.typ === 'tisch' && platz?.reserviert && styles.reserviertZelle,
    zelle.typ === 'tisch' && person && styles.belegt,
    istAusgewaehlt && styles.ausgewaehlt,
  ];

  if (!onPress) return <View style={stil}>{inhalt}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(zelle.zeile, zelle.spalte)}
      style={({ pressed }) => [...stil, pressed && styles.gedrueckt]}
    >
      {inhalt}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  raster: { gap: 4, padding: spacing.xs },
  zeile: { flexDirection: 'row', gap: 4 },
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
  ausgewaehlt: { borderColor: colors.danger, borderWidth: 2 },
  gedrueckt: { opacity: 0.7 },
  tuer: { backgroundColor: colors.successBg, borderColor: colors.success },
  pult: { backgroundColor: '#fef3c7', borderColor: '#d97706' },
  wand: { backgroundColor: '#cbd5e1' },
  nummer: { fontSize: 11, color: colors.textMuted },
  name: { fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'center' },
  frei: { fontSize: 12, color: colors.textMuted },
  reserve: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  vorgabe: { fontSize: 10, fontWeight: '700', color: colors.danger },
  symbolText: { fontSize: 12, fontWeight: '600', color: colors.text },
});
