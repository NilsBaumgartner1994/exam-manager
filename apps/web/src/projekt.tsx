/**
 * Projektordner der App.
 *
 * Wer auf der Startseite den Ordner mit allen Klausurdateien auswählt, muss in
 * den einzelnen Schritten nichts mehr hochladen: Die Dateien liegen hier im
 * Speicher, jeder Screen holt sich daraus, was er braucht, und schreibt seine
 * Ergebnisse zurück. Heruntergeladen wird der Stand als ZIP – die App schreibt
 * nichts von selbst auf die Festplatte (der Browser darf das nicht, und das
 * ist gut so).
 *
 * Im ZIP landet nur, was der Projektordner dauerhaft hält (siehe
 * `PROJEKT_ORDNER` im Core): der Zulassungsbestand und die leeren Raumraster.
 * Klausurbezogene Dateien bleiben im Speicher – sie werden im jeweiligen
 * Schritt heruntergeladen, nicht im Ordner abgelegt.
 */
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import {
  DateiRolle,
  erkenneRolle,
  erstelleZip,
  gehoertInsProjekt,
  PROJEKT_ORDNER,
  projektVorlage,
  verzeichnis,
} from '@exam-manager/core';
import { readFileAsArrayBuffer, readFileAsText } from './files';

export interface ProjektDatei {
  /** Pfad innerhalb des Projektordners, z. B. `Zulassungen/pv2025_zulassungen.csv`. */
  pfad: string;
  rolle: DateiRolle;
  /** Textdateien (CSV, TXT, MD). */
  text?: string;
  /** Binärdateien (Excel). */
  bytes?: Uint8Array;
}

export interface ProjektStand {
  /** Name des gewählten Ordners, `null` wenn keiner geladen ist. */
  ordner: string | null;
  dateien: ProjektDatei[];
  /** Beim Einlesen übersprungene Dateien (weder CSV noch Excel). */
  uebersprungen: number;
}

interface ProjektWert extends ProjektStand {
  ladeOrdner: (files: File[]) => Promise<void>;
  leeren: () => void;
  datei: (rolle: DateiRolle) => ProjektDatei | undefined;
  dateienMit: (rolle: DateiRolle) => ProjektDatei[];
  /** Ergebnis in den Projektstand schreiben (überschreibt gleiche Pfade). */
  schreibe: (dateiname: string, text: string, rolle: DateiRolle) => void;
  alsZip: () => Promise<Uint8Array>;
}

const TEXT_ENDUNGEN = ['.csv', '.txt', '.md', '.json'];
const BINAER_ENDUNGEN = ['.xlsx', '.xls'];

const endet = (name: string, endungen: string[]) =>
  endungen.some((endung) => name.toLowerCase().endsWith(endung));

/** Pfad innerhalb des Ordners (ohne den Ordnernamen selbst). */
function relativerPfad(file: File): { ordner: string | null; pfad: string } {
  const voll = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const teile = voll.split('/');
  if (teile.length <= 1) return { ordner: null, pfad: voll };
  const ordner = teile.shift() ?? null;
  return { ordner, pfad: teile.join('/') };
}

const ProjektContext = createContext<ProjektWert | null>(null);

export function ProjektProvider({ children }: { children: ReactNode }) {
  const [stand, setStand] = useState<ProjektStand>({ ordner: null, dateien: [], uebersprungen: 0 });

  const ladeOrdner = useCallback(async (files: File[]) => {
    let ordnerName: string | null = null;
    const dateien: ProjektDatei[] = [];
    let uebersprungen = 0;

    for (const file of files) {
      const { ordner, pfad } = relativerPfad(file);
      if (ordner !== null) ordnerName = ordner;
      // Versteckte Dateien (.DS_Store …) interessieren nicht.
      if (pfad.split('/').some((teil) => teil.startsWith('.'))) continue;

      if (endet(pfad, TEXT_ENDUNGEN)) {
        const text = await readFileAsText(file);
        dateien.push({ pfad, rolle: erkenneRolle(pfad, text.split('\n')[0]), text });
      } else if (endet(pfad, BINAER_ENDUNGEN)) {
        const bytes = new Uint8Array(await readFileAsArrayBuffer(file));
        dateien.push({ pfad, rolle: erkenneRolle(pfad), bytes });
      } else {
        // PDFs, Bilder, ZIPs: Die App braucht sie nicht und würde sie beim
        // Herunterladen nur unnötig mitschleppen.
        uebersprungen++;
      }
    }

    dateien.sort((a, b) => a.pfad.localeCompare(b.pfad, 'de'));
    setStand({ ordner: ordnerName, dateien, uebersprungen });
  }, []);

  const leeren = useCallback(() => setStand({ ordner: null, dateien: [], uebersprungen: 0 }), []);

  const schreibe = useCallback((dateiname: string, text: string, rolle: DateiRolle) => {
    setStand((vorher) => {
      // Neben eine vorhandene Datei derselben Rolle legen, sonst in den
      // Ordner der Projektvorlage (nur aufbewahrte Rollen haben einen).
      const vorbild = vorher.dateien.find((datei) => datei.rolle === rolle);
      const ordner = vorbild ? verzeichnis(vorbild.pfad) : PROJEKT_ORDNER[rolle] ?? '';
      const pfad = ordner === '' ? dateiname : `${ordner}/${dateiname}`;
      const neu: ProjektDatei = { pfad, rolle, text };
      const dateien = vorher.dateien.some((datei) => datei.pfad === pfad)
        ? vorher.dateien.map((datei) => (datei.pfad === pfad ? neu : datei))
        : [...vorher.dateien, neu].sort((a, b) => a.pfad.localeCompare(b.pfad, 'de'));
      return { ...vorher, dateien };
    });
  }, []);

  const alsZip = useCallback(async () => {
    const inhalte = new Map<string, Uint8Array | string>();
    // Nur der dauerhafte Bestand – klausurbezogene Dateien gehören nicht in
    // den Projektordner und damit auch nicht ins ZIP.
    for (const datei of stand.dateien) {
      if (!gehoertInsProjekt(datei.rolle)) continue;
      inhalte.set(datei.pfad, datei.text ?? datei.bytes ?? '');
    }
    return erstelleZip(inhalte);
  }, [stand.dateien]);

  const wert = useMemo<ProjektWert>(
    () => ({
      ...stand,
      ladeOrdner,
      leeren,
      schreibe,
      alsZip,
      datei: (rolle) => stand.dateien.find((datei) => datei.rolle === rolle),
      dateienMit: (rolle) => stand.dateien.filter((datei) => datei.rolle === rolle),
    }),
    [stand, ladeOrdner, leeren, schreibe, alsZip],
  );

  return <ProjektContext.Provider value={wert}>{children}</ProjektContext.Provider>;
}

export function useProjekt(): ProjektWert {
  const wert = useContext(ProjektContext);
  if (!wert) throw new Error('useProjekt außerhalb des ProjektProviders benutzt');
  return wert;
}

/** Leere Projektvorlage als ZIP (Zulassungen/ und Raeume/, sonst nichts). */
export async function vorlageAlsZip(): Promise<Uint8Array> {
  const inhalte = new Map<string, Uint8Array | string>();
  for (const [pfad, inhalt] of projektVorlage()) inhalte.set(pfad, inhalt);
  return erstelleZip(inhalte);
}
