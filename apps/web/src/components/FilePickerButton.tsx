import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
 */
export function FilePickerButton({ label, accept, multiple, directory, kompakt, onFiles, testID }: Props) {
  const [namen, setNamen] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const oeffneDialog = () => {
    let input = inputRef.current;
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.style.display = 'none';
      document.body.appendChild(input);
      inputRef.current = input;
    }
    input.accept = accept ?? '';
    input.multiple = multiple ?? false;
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = directory ?? false;
    input.onchange = () => {
      const files = Array.from(input!.files ?? []);
      if (files.length > 0) {
        setNamen(files.map((f) => f.name));
        onFiles(files);
      }
      input!.value = '';
    };
    input.click();
  };

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
