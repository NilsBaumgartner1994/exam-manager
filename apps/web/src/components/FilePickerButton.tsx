import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { oeffneDateiDialog } from '../files';
import { colors, spacing } from '../theme';
import { AppButton } from './AppButton';

interface Props {
  label: string;
  /** z. B. ".csv" oder ".xlsx" */
  accept?: string;
  multiple?: boolean;
  /** Ganzen Ordner auswählen (webkitdirectory). */
  directory?: boolean;
  /** Schmaler Knopf ohne Dateiname darunter – für die Menübänder. */
  kompakt?: boolean;
  onFiles: (files: File[]) => void;
  testID?: string;
}

/**
 * Datei-/Ordner-Auswahl über den Browser-Dialog. Die Dateien werden nur
 * lokal gelesen – nichts verlässt den Rechner.
 *
 * Den Dialog selbst öffnet `oeffneDateiDialog` (`src/files.ts`) – dieselbe
 * Stelle, an der auch ein Menüeintrag „… laden“ hängt.
 */
export function FilePickerButton({ label, accept, multiple, directory, kompakt, onFiles, testID }: Props) {
  const [namen, setNamen] = useState<string[]>([]);

  const oeffneDialog = () =>
    oeffneDateiDialog({
      accept,
      mehrere: multiple,
      ordner: directory,
      onDateien: (dateien) => {
        setNamen(dateien.map((datei) => datei.name));
        onFiles(dateien);
      },
    });

  if (kompakt) {
    return (
      <AppButton title={label} variant="secondary" kompakt onPress={oeffneDialog} testID={testID} />
    );
  }

  // Bei einem Ordner sagt die Liste der Dateinamen nichts: Gewählt wurde der
  // Ordner, und was darin erkannt wurde, steht ohnehin daneben.
  const zeigeNamen = namen.length > 0 && directory !== true;

  return (
    <View style={styles.container}>
      <AppButton title={label} variant="secondary" onPress={oeffneDialog} testID={testID} />
      {zeigeNamen ? (
        <Text style={styles.namen} testID={testID ? `${testID}-namen` : undefined}>
          {namen.length === 1 ? namen[0] : `${namen.length} Dateien: ${namen.join(', ')}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  namen: { fontSize: 13, color: colors.success },
});
