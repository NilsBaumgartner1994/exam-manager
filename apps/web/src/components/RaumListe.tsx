import { StyleSheet, TextInput, View } from 'react-native';
import { Raum } from '@exam-manager/core';
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
  testIDPrefix?: string;
}

/**
 * Die Raumliste (`raeume.csv`) als Formular: je Raum Name, Plätze und die
 * reservierte Zeit. Zwei Screens bearbeiten dieselbe Liste – Schritt 4 für
 * eine konkrete Klausur, Schritt 5 losgelöst davon –, deshalb liegt sie hier
 * als Baustein und nicht in einem der beiden.
 */
export function RaumListe({ zeilen, onChange, hinzufuegenTitel = 'Raum hinzufügen', testIDPrefix = 'raum' }: Props) {
  return (
    <>
      {zeilen.map((zeile, i) => (
        <RaumEditorZeile
          key={i}
          zeile={zeile}
          onChange={(neu) => onChange(zeilen.map((alt, j) => (j === i ? neu : alt)))}
          onRemove={() => onChange(zeilen.filter((_, j) => j !== i))}
          testID={`${testIDPrefix}-zeile-${i}`}
        />
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
