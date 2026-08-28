import { StyleSheet, Text, TextInput, View } from 'react-native';
import { mitDurchgaengen, Raum } from '@exam-manager/core';
import { useResponsiveLayout } from '../responsive';
import { colors, radius, spacing } from '../theme';
import { AppButton } from './AppButton';

/**
 * Eine Zeile der Raumliste beim Bearbeiten.
 *
 * Die Plätze stehen als Text darin, nicht als Zahl: Sonst ließe sich das Feld
 * nicht leeren und nicht Ziffer für Ziffer tippen (aus „10“ würde beim Löschen
 * der 0 sofort wieder eine 10).
 */
export interface RaumZeile {
  raum: string;
  plaetzeText: string;
  reservierteZeit: string;
}

export function raumZuZeile(raum: Raum): RaumZeile {
  return { raum: raum.raum, plaetzeText: String(raum.plaetze), reservierteZeit: raum.reservierteZeit };
}

export function zeileZuRaum(zeile: RaumZeile): Raum {
  const plaetze = Number(zeile.plaetzeText.trim().replace(',', '.'));
  return {
    raum: zeile.raum.trim(),
    plaetze: Number.isFinite(plaetze) ? plaetze : 0,
    reservierteZeit: zeile.reservierteZeit.trim(),
  };
}

export const LEERE_RAUM_ZEILE: RaumZeile = { raum: '', plaetzeText: '', reservierteZeit: '' };

/**
 * Die Zeilen als Räume – mit durchgezählten Durchgängen. Derselbe Raum darf
 * mehrfach in der Liste stehen: Dann wird er in dieser Klausur mehrfach
 * belegt (Gruppe 1 vormittags, Gruppe 2 nachmittags).
 */
export function zeilenZuRaeumen(zeilen: RaumZeile[]): Raum[] {
  return mitDurchgaengen(zeilen.map(zeileZuRaum));
}

/** Der wievielte Eintrag dieses Raums die Zeile ist (1-basiert). */
function durchgangDerZeile(zeilen: RaumZeile[], index: number): number {
  const name = zeilen[index].raum.trim();
  return zeilen.slice(0, index + 1).filter((zeile) => zeile.raum.trim() === name).length;
}

/** Kommt der Raum dieser Zeile mehrfach in der Liste vor? */
function mehrfach(zeilen: RaumZeile[], index: number): boolean {
  const name = zeilen[index].raum.trim();
  if (name === '') return false;
  return zeilen.filter((zeile) => zeile.raum.trim() === name).length > 1;
}

/** Eine Eingabezeile des Raum-Editors. */
function RaumEditorZeile({
  zeile,
  onChange,
  onRemove,
  testID,
}: {
  zeile: RaumZeile;
  onChange: (zeile: RaumZeile) => void;
  onRemove: () => void;
  testID?: string;
}) {
  const { isCompact } = useResponsiveLayout();
  // Gestapelt wäre flexBasis die Höhe – dort bekommen die Felder volle Breite.
  const voll = styles.raumInputVoll;
  return (
    <View style={[styles.raumZeile, isCompact && styles.raumZeileGestapelt]} testID={testID}>
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

interface Props {
  zeilen: RaumZeile[];
  onChange: (zeilen: RaumZeile[]) => void;
  /** Beschriftung des Knopfes zum Anlegen – je nach Screen anders formuliert. */
  hinzufuegenTitel?: string;
  /**
   * Denselben Raum mehrfach eintragen ist erlaubt und benennt den Durchgang
   * („2. Durchgang“). Nur in Schritt 4 sinnvoll: Im Bestand des Hauses
   * (Schritt 5) gibt es jeden Raum genau einmal – der steht als
   * `RaumBestandListe` da, mit dem Raster an jedem Raum.
   */
  mitDurchgang?: boolean;
  testIDPrefix?: string;
}

/**
 * Die Räume **einer Klausur** (`klausurraeume.csv`) als Formular: je Zeile
 * Name, Plätze und die reservierte Zeit, derselbe Raum darf mehrfach
 * vorkommen. Den Bestand des Hauses zeigt Schritt 5 dagegen als
 * `RaumBestandListe` – dort hängt an jedem Raum sein Raster.
 */
export function RaumListe({
  zeilen,
  onChange,
  hinzufuegenTitel = 'Raum hinzufügen',
  mitDurchgang,
  testIDPrefix = 'raum',
}: Props) {
  return (
    <>
      {zeilen.map((zeile, i) => (
        <View key={i} style={styles.eintrag}>
          {mitDurchgang && mehrfach(zeilen, i) ? (
            <Text style={styles.durchgang} testID={`${testIDPrefix}-durchgang-${i}`}>
              {`${durchgangDerZeile(zeilen, i)}. Durchgang`}
            </Text>
          ) : null}
          <RaumEditorZeile
            zeile={zeile}
            onChange={(neu) => onChange(zeilen.map((alt, j) => (j === i ? neu : alt)))}
            onRemove={() => onChange(zeilen.filter((_, j) => j !== i))}
            testID={`${testIDPrefix}-zeile-${i}`}
          />
        </View>
      ))}
      <AppButton
        title={hinzufuegenTitel}
        onPress={() => onChange([...zeilen, LEERE_RAUM_ZEILE])}
        testID={`${testIDPrefix}-hinzufuegen`}
      />
    </>
  );
}

const styles = StyleSheet.create({
  eintrag: { gap: 2 },
  durchgang: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
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
});
