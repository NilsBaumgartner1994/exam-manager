import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { AppButton } from './AppButton';

/**
 * Ein Raum des Bestands: sein Raster in `Raeume/`.
 *
 * Mehr gibt es zu einem Raum nicht – der Ordner ist die Raumliste, und wie
 * viele Plätze der Raum hat, sind die Tische in seinem Raster. Eine zweite
 * Liste daneben (früher `raeume.csv`) hätte dieselbe Zahl noch einmal
 * behauptet und wäre nach dem ersten Umbau falsch gewesen.
 */
export interface RaumBestandEintrag {
  raum: string;
  /** Tische im Raster – die Plätze des Raums. */
  sitzplaetze: number;
  /**
   * Reserve-Tische im Raster: Sie zählen nicht zu den Plätzen, lassen sich
   * aber in Schritt 4 von Hand belegen. Deshalb stehen sie daneben.
   */
  reserve?: number;
}

interface Props {
  eintraege: RaumBestandEintrag[];
  /** Den Plan dieses Raums öffnen – dort wird gezeichnet. */
  onPlan: (raum: string) => void;
  /**
   * Umbenennen läuft über ein Blatt: Der Name ist zugleich der Dateiname des
   * Rasters in `Raeume/` – ein halb getippter Name legte sonst je Tastendruck
   * eine Datei an.
   */
  onUmbenennen: (raum: string) => void;
  onDuplizieren: (raum: string) => void;
  onEntfernen: (raum: string) => void;
}

/**
 * Der Bestand des Hauses als Liste – je Raum ein Kasten mit seinem Raster.
 *
 * Anders als die Raumliste einer Klausur (`RaumListe`, Schritt 4) ist das hier
 * kein Formular aus Zeilen, sondern der **Bestand**: Jeder Raum steht darin,
 * mit den Sitzplätzen seines Rasters, und an jedem Raum hängen die Vorgänge,
 * die ihn betreffen – Plan bearbeiten, umbenennen, duplizieren, entfernen.
 * Ohne das war die Liste eine Sammlung von Textfeldern neben den Raumplänen,
 * statt der Ort, an dem man sie verwaltet.
 */
export function RaumBestandListe({
  eintraege,
  onPlan,
  onUmbenennen,
  onDuplizieren,
  onEntfernen,
}: Props) {
  return (
    <>
      {eintraege.map((eintrag) => (
        <View key={eintrag.raum} style={styles.eintrag} testID={`raeume-bestand-${eintrag.raum}`}>
          <View style={styles.kopf}>
            <Text style={styles.name}>{eintrag.raum}</Text>
            <Text style={styles.status}>
              {`${eintrag.sitzplaetze} Sitzplätze im Raster` +
                (eintrag.reserve ? ` (${eintrag.reserve} Reserve)` : '')}
            </Text>
          </View>
          <View style={styles.knoepfe}>
            <AppButton
              title="Plan bearbeiten"
              kompakt
              onPress={() => onPlan(eintrag.raum)}
              testID={`raeume-plan-${eintrag.raum}`}
            />
            <AppButton
              title="Umbenennen …"
              variant="secondary"
              kompakt
              onPress={() => onUmbenennen(eintrag.raum)}
              testID={`raeume-umbenennen-${eintrag.raum}`}
            />
            <AppButton
              title="Duplizieren …"
              variant="secondary"
              kompakt
              onPress={() => onDuplizieren(eintrag.raum)}
              testID={`raeume-duplizieren-${eintrag.raum}`}
            />
            <AppButton
              title="Entfernen"
              variant="secondary"
              kompakt
              onPress={() => onEntfernen(eintrag.raum)}
              testID={`raeume-entfernen-${eintrag.raum}`}
            />
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  eintrag: {
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  kopf: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  status: { fontSize: 13, color: colors.textMuted },
  knoepfe: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
});
