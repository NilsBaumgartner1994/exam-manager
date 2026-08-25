import JSZip from 'jszip';

/** Dateien (Name → Inhalt) als ZIP bündeln – z. B. alle Matrikelnummern-PDFs. */
export async function erstelleZip(dateien: Map<string, Uint8Array | string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, inhalt] of dateien) {
    zip.file(name, inhalt);
  }
  return zip.generateAsync({ type: 'uint8array' });
}
