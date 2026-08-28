/** Datei-Helfer – die App läuft nur im Browser, daher direkte DOM-APIs. */

export function readFileAsText(file: File): Promise<string> {
  return file.text();
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

/** Datei lokal herunterladen (kein Server – alles bleibt auf dem Rechner). */
export function downloadFile(
  dateiname: string,
  inhalt: string | Uint8Array,
  mimeType: string,
): void {
  const daten = typeof inhalt === 'string'
    ? new Blob([inhalt], { type: mimeType })
    : new Blob([inhalt.buffer.slice(inhalt.byteOffset, inhalt.byteOffset + inhalt.byteLength) as ArrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(daten);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(dateiname: string, csv: string): void {
  downloadFile(dateiname, csv, 'text/csv;charset=utf-8');
}

export function downloadZip(dateiname: string, zip: Uint8Array): void {
  downloadFile(dateiname, zip, 'application/zip');
}

/**
 * Den Dateidialog des Browsers öffnen – ohne sichtbaren Knopf.
 *
 * Gebraucht wird das im Menüband: Dort ist eine Dateiauswahl ein Menüeintrag
 * und kein Knopf, ein Eintrag aber nur eine Beschreibung samt Rückruf. Das
 * Eingabefeld liegt versteckt im Dokument und wird wiederverwendet – manche
 * Browser melden keine Auswahl mehr, wenn es zwischen Klick und Auswahl
 * verschwindet, und ein abgebrochener Dialog hinterließe sonst jedes Mal
 * eines.
 */
let dateiEingabe: HTMLInputElement | null = null;

export function oeffneDateiDialog({
  accept,
  mehrere,
  ordner,
  onDateien,
}: {
  accept?: string;
  mehrere?: boolean;
  /** Ganzen Ordner auswählen (webkitdirectory). */
  ordner?: boolean;
  onDateien: (dateien: File[]) => void;
}): void {
  if (!dateiEingabe) {
    dateiEingabe = document.createElement('input');
    dateiEingabe.type = 'file';
    dateiEingabe.style.display = 'none';
    document.body.appendChild(dateiEingabe);
  }
  const eingabe = dateiEingabe;
  eingabe.accept = accept ?? '';
  eingabe.multiple = mehrere ?? false;
  (eingabe as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = ordner ?? false;
  eingabe.onchange = () => {
    const dateien = Array.from(eingabe.files ?? []);
    // Zurücksetzen, damit dieselbe Datei ein zweites Mal gewählt werden kann.
    eingabe.value = '';
    if (dateien.length > 0) onDateien(dateien);
  };
  eingabe.click();
}
