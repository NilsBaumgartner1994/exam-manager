import { StyleSheet, Text, TextInput, View } from 'react-native';
import { mitDurchgaengen, Platzbedarf, plaetzeDesRaums, Raum } from '@exam-manager/core';
import { useResponsiveLayout } from '../responsive';
import { colors, radius, spacing } from '../theme';
import { AppButton } from './AppButton';
import { StatusText } from './StatusText';

/**
 * Eine Zeile der Raumliste beim Bearbeiten.
 *
 * Die Plätze stehen **nicht** darin: Wie viele es sind, sagen die Tische im
 * Raster des Raums (`plaetzeJeRaum`). Eine Zahl daneben ginge beim ersten
 * Umbau des Raums auseinander – und niemand könnte sagen, welche der beiden
 * stimmt.
 */
export interface RaumZeile {
  raum: string;
  reservierteZeit: string;
}

export function raumZuZeile(raum: Raum): RaumZeile {
  return { raum: raum.raum, reservierteZeit: raum.reservierteZeit };
}

export function zeileZuRaum(zeile: RaumZeile): Raum {
  return { raum: zeile.raum.trim(), reservierteZeit: zeile.reservierteZeit.trim() };
}

export const LEERE_RAUM_ZEILE: RaumZeile = { raum: '', reservierteZeit: '' };

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

/** Wie viele Plätze dieser Raum hat – als Text neben seiner Zeile. */
function plaetzeText(zeile: RaumZeile, plaetze: Map<string, number>): string {
  const name = zeile.raum.trim();
  if (name === '') return 'Raum noch ohne Namen';
  if (!plaetze.has(name)) return 'kein Raster – 0 Plätze';
  return `${plaetzeDesRaums({ raum: name }, plaetze)} Plätze im Raster`;
}

/** Eine Eingabezeile des Raum-Editors. */
function RaumEditorZeile({
  zeile,
  plaetze,
  onChange,
  onRemove,
  testID,
}: {
  zeile: RaumZeile;
  plaetze: Map<string, number>;
  onChange: (zeile: RaumZeile) => void;
  onRemove: () => void;
  testID?: string;
}) {
  const { isCompact } = useResponsiveLayout();
  // Gestapelt wäre flexBasis die Höhe – dort bekommen die Felder volle Breite.
  const voll = styles.raumInputVoll;
  const ohneRaster = zeile.raum.trim() !== '' && !plaetze.has(zeile.raum.trim());
  return (
    <View style={[styles.raumZeile, isCompact && styles.raumZeileGestapelt]} testID={testID}>
      <TextInput
        style={[styles.raumInput, isCompact ? voll : styles.raumInputName]}
        value={zeile.raum}
        onChangeText={(raum) => onChange({ ...zeile, raum })}
        placeholder="Raum-Name"
        placeholderTextColor={colors.textMuted}
      />
      {/* Die Platzzahl ist kein Feld, sondern eine Auskunft: Sie steht im
          Raster des Raums und wird in Schritt 5 geändert. */}
      <Text
        style={[styles.plaetze, isCompact ? voll : styles.plaetzeSpalte, ohneRaster && styles.plaetzeFehlt]}
      >
        {plaetzeText(zeile, plaetze)}
      </Text>
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
 * Reichen die Räume für die Teilnehmenden? Die Zeile steht über der Liste –
 * dort werden Räume hinzugefügt, und dort soll zu sehen sein, ob es genug
 * sind. Ohne sie fiele erst nach dem Verteilen auf, dass Leute übrig bleiben.
 */
export function PlatzBedarf({ bedarf, testID }: { bedarf: Platzbedarf; testID?: string }) {
  const ohneRaster =
    bedarf.ohneRaster.length > 0
      ? ` Ohne Raster und damit ohne Plätze: ${bedarf.ohneRaster.join(', ')} – Raster in Schritt 5 anlegen.`
      : '';
  return (
    <StatusText kind={bedarf.reicht ? 'success' : 'error'} testID={testID}>
      {`${bedarf.teilnehmende} Teilnehmende · höchstens ${bedarf.plaetze} Plätze in den gewählten Räumen · ` +
        (bedarf.reicht
          ? `${bedarf.frei} Plätze frei.`
          : `${bedarf.fehlende} Plätze zu wenig – weitere Räume hinzufügen.`) +
        ohneRaster}
    </StatusText>
  );
}

interface Props {
  zeilen: RaumZeile[];
  /** Plätze je Raum, aus den Rastern (`plaetzeJeRaum`). */
  plaetze: Map<string, number>;
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
 * Name und reservierte Zeit, derselbe Raum darf mehrfach vorkommen. Wie viele
 * Plätze ein Raum hat, steht daneben – die Zahl kommt aus seinem Raster und
 * wird hier nicht getippt. Den Bestand des Hauses zeigt Schritt 5 dagegen als
 * `RaumBestandListe` – dort hängt an jedem Raum sein Raster.
 */
export function RaumListe({
  zeilen,
  plaetze,
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
            plaetze={plaetze}
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
  plaetze: { fontSize: 13, color: colors.textMuted },
  plaetzeFehlt: { color: colors.danger },
  // Keine festen Breiten: flexBasis ist nur die Umbruchgrenze, die Felder
  // teilen sich die tatsächliche Breite über flexGrow.
  raumInputName: { flexGrow: 2, flexShrink: 1, flexBasis: 120, minWidth: 0 },
  plaetzeSpalte: { flexGrow: 1, flexShrink: 1, flexBasis: 110, minWidth: 0 },
  raumInputZeit: { flexGrow: 3, flexShrink: 1, flexBasis: 180, minWidth: 0 },
  raumInputVoll: { width: '100%' },
});
