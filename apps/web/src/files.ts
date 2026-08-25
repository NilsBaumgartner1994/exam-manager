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
