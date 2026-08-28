import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useResponsiveLayout } from '../responsive';
import { colors, radius, spacing } from '../theme';
import { AppButton } from './AppButton';
import { zeileZuRaum, type RaumZeile } from './RaumListe';

/**
 * Ein Raum des Bestands: seine Zeile in `raeume.csv` **und** sein Raster.
 * Beides zusammen ist der Raum – ein Raster ohne Zeile wäre nur im Menü zu
 * finden, eine Zeile ohne Raster ein Raum, den niemand zeichnen kann.
 */
export interface RaumBestandEintrag {
  zeile: RaumZeile;
  /** Tische im Raster – `null`, solange es zu dem Raum keines gibt. */
  sitzplaetze: number | null;
}

interface Props {
  eintraege: RaumBestandEintrag[];
  /**
   * Plätze oder reservierte Zeit einer Zeile ändern. Der **Name** steht nicht
   * darunter: Er ist zugleich der Dateiname des Rasters in `Raeume/` und läuft
   * deshalb über „Umbenennen …“, damit beides zusammen wandert.
   */
  onZeile: (index: number, zeile: RaumZeile) => void;
  /** Den Plan dieses Raums öffnen – dort wird gezeichnet. */
  onPlan: (index: number) => void;
  /** Vorschlagsraster für einen Raum anlegen, der noch keines hat. */
  onRasterAnlegen: (index: number) => void;
  /** Die Tische des Rasters als Platzzahl in die Liste übernehmen. */
  onPlaetzeAusRaster: (index: number) => void;
  onUmbenennen: (index: number) => void;
  onDuplizieren: (index: number) => void;
  onEntfernen: (index: number) => void;
}

/** Ein Eingabefeld der Zeile mit Beschriftung darüber. */
function Feld({
  label,
  value,
  onChangeText,
  numerisch,
  breit,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  numerisch?: boolean;
  /** Die reservierte Zeit ist ein Satz, die Platzzahl eine Zahl. */
  breit?: boolean;
  testID?: string;
}) {
  const { isCompact } = useResponsiveLayout();
  return (
    <View style={[styles.feld, isCompact ? styles.feldVoll : breit ? styles.feldBreit : styles.feldSchmal]}>
      <Text style={styles.feldLabel}>{label}</Text>
      <TextInput
        style={styles.eingabe}
        value={value}
        inputMode={numerisch ? 'numeric' : 'text'}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textMuted}
        testID={testID}
      />
    </View>
  );
}

/**
 * Der Bestand des Hauses als Liste – je Raum ein Kasten mit seinem Raster.
 *
 * Anders als die Raumliste einer Klausur (`RaumListe`, Schritt 4) ist das hier
 * kein Formular aus Zeilen, sondern der **Bestand**: Jeder Raum steht darin,
 * auch einer, der bisher nur als Raster in `Raeume/` liegt, und an jedem Raum
 * hängen die Vorgänge, die ihn betreffen – Plan bearbeiten, umbenennen,
 * duplizieren, entfernen. Ohne das war die Liste eine Sammlung von Textfeldern
 * neben den Raumplänen, statt der Ort, an dem man sie verwaltet.
 */
export function RaumBestandListe({
  eintraege,
  onZeile,
  onPlan,
  onRasterAnlegen,
  onPlaetzeAusRaster,
  onUmbenennen,
  onDuplizieren,
  onEntfernen,
}: Props) {
  return (
    <>
      {eintraege.map((eintrag, i) => {
        const name = eintrag.zeile.raum.trim();
        const plaetze = zeileZuRaum(eintrag.zeile).plaetze;
        const weichtAb = eintrag.sitzplaetze !== null && eintrag.sitzplaetze !== plaetze;
        return (
          <View key={`${name}-${i}`} style={styles.eintrag} testID={`raeume-bestand-${name}`}>
            <View style={styles.kopf}>
              <Text style={styles.name}>{name === '' ? 'Ohne Namen' : name}</Text>
              <Text style={[styles.status, weichtAb && styles.statusAbweichung]}>
                {eintrag.sitzplaetze === null
                  ? 'noch kein Raster'
                  : weichtAb
                    ? `${eintrag.sitzplaetze} Tische im Raster – Liste sagt ${plaetze}`
                    : `${eintrag.sitzplaetze} Sitzplätze im Raster`}
              </Text>
            </View>
            {name === '' ? (
              <Text style={styles.hinweis}>
                Eine Zeile ohne Raumnamen – so stand sie in der Raumliste des Projekts. Ohne Namen
                gibt es weder Raster noch Aushang: Die Zeile gehört nicht in den Bestand.
              </Text>
            ) : (
              <View style={styles.felder}>
                <Feld
                  label="Plätze"
                  value={eintrag.zeile.plaetzeText}
                  numerisch
                  onChangeText={(plaetzeText) => onZeile(i, { ...eintrag.zeile, plaetzeText })}
                  testID={`raeume-plaetze-feld-${name}`}
                />
                <Feld
                  label="Reservierte Zeit"
                  value={eintrag.zeile.reservierteZeit}
                  breit
                  onChangeText={(reservierteZeit) => onZeile(i, { ...eintrag.zeile, reservierteZeit })}
                  testID={`raeume-zeit-feld-${name}`}
                />
              </View>
            )}
            <View style={styles.knoepfe}>
              {name === '' ? null : eintrag.sitzplaetze === null ? (
                <AppButton
                  title="Raster anlegen"
                  kompakt
                  onPress={() => onRasterAnlegen(i)}
                  testID={`raeume-raster-fuer-${name}`}
                />
              ) : (
                <AppButton
                  title="Plan bearbeiten"
                  kompakt
                  onPress={() => onPlan(i)}
                  testID={`raeume-plan-${name}`}
                />
              )}
              {weichtAb ? (
                <AppButton
                  title="Plätze aus Raster"
                  variant="secondary"
                  kompakt
                  onPress={() => onPlaetzeAusRaster(i)}
                  testID={`raeume-plaetze-uebernehmen-${name}`}
                />
              ) : null}
              {name === '' ? null : (
                <>
                  <AppButton
                    title="Umbenennen …"
                    variant="secondary"
                    kompakt
                    onPress={() => onUmbenennen(i)}
                    testID={`raeume-umbenennen-${name}`}
                  />
                  <AppButton
                    title="Duplizieren …"
                    variant="secondary"
                    kompakt
                    onPress={() => onDuplizieren(i)}
                    testID={`raeume-duplizieren-${name}`}
                  />
                </>
              )}
              <AppButton
                title="Entfernen"
                variant="secondary"
                kompakt
                onPress={() => onEntfernen(i)}
                testID={`raeume-entfernen-${name}`}
              />
            </View>
          </View>
        );
      })}
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
  statusAbweichung: { color: colors.danger },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  felder: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.sm },
  // Keine festen Breiten: flexBasis ist nur die Umbruchgrenze, die Felder
  // teilen sich die tatsächliche Breite über flexGrow.
  feld: { gap: spacing.xs, minWidth: 0 },
  feldSchmal: { flexGrow: 1, flexShrink: 1, flexBasis: 80 },
  feldBreit: { flexGrow: 4, flexShrink: 1, flexBasis: 200 },
  feldVoll: { width: '100%' },
  feldLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  eingabe: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  knoepfe: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
});
