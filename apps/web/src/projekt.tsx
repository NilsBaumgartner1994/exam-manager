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
 * Welche Datei welche Rolle hat, entscheidet der Ordner (`PROJEKT_SCHEMA` im
 * Core). Gelesen wird trotzdem alles: Auch Dateien, die zu keiner Regel
 * passen, bleiben unverändert im Stand und damit in der ZIP – sonst würde ein
 * Herunterladen-und-Ersetzen die eigene LIESMICH oder Notizen verschlucken.
 */
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import {
  DateiRolle,
  erkenneRolle,
  erstelleZip,
  projektPfad,
  projektVorlage,
} from '@exam-manager/core';
import { readFileAsArrayBuffer, readFileAsText } from './files';

export interface ProjektDatei {
  /** Pfad innerhalb des Projektordners, z. B. `Zulassungen/pv2025_zulassungen.csv`. */
  pfad: string;
  rolle: DateiRolle;
  /** Textdateien (CSV, TXT, MD). */
  text?: string;
  /** Binärdateien (Excel, PDF …). */
  bytes?: Uint8Array;
}

export interface ProjektStand {
  /** Name des gewählten Ordners, `null` wenn keiner geladen ist. */
  ordner: string | null;
  dateien: ProjektDatei[];
}

interface ProjektWert extends ProjektStand {
  ladeOrdner: (files: File[]) => Promise<void>;
  leeren: () => void;
  datei: (rolle: DateiRolle) => ProjektDatei | undefined;
  dateienMit: (rolle: DateiRolle) => ProjektDatei[];
  /** Ergebnis in den Projektstand schreiben (überschreibt gleiche Pfade). */
  schreibe: (dateiname: string, inhalt: string | Uint8Array, rolle: DateiRolle) => void;
  /**
   * Alle Dateien einer Rolle durch neue ersetzen – der zugehörige Ordner wird
   * vorher geleert (Zulassungs-PDFs: alte Stände dürfen nicht stehenbleiben).
   */
  ersetze: (rolle: DateiRolle, dateien: Map<string, string | Uint8Array>) => void;
  alsZip: () => Promise<Uint8Array>;
}

const TEXT_ENDUNGEN = ['.csv', '.txt', '.md', '.json'];

const istText = (name: string) =>
  TEXT_ENDUNGEN.some((endung) => name.toLowerCase().endsWith(endung));

/** Pfad innerhalb des Ordners (ohne den Ordnernamen selbst). */
function relativerPfad(file: File): { ordner: string | null; pfad: string } {
  const voll = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const teile = voll.split('/');
  if (teile.length <= 1) return { ordner: null, pfad: voll };
  const ordner = teile.shift() ?? null;
  return { ordner, pfad: teile.join('/') };
}

const nachPfad = (a: ProjektDatei, b: ProjektDatei) => a.pfad.localeCompare(b.pfad, 'de');

const ProjektContext = createContext<ProjektWert | null>(null);

export function ProjektProvider({ children }: { children: ReactNode }) {
  const [stand, setStand] = useState<ProjektStand>({ ordner: null, dateien: [] });

  const ladeOrdner = useCallback(async (files: File[]) => {
    let ordnerName: string | null = null;
    const dateien: ProjektDatei[] = [];

    for (const file of files) {
      const { ordner, pfad } = relativerPfad(file);
      if (ordner !== null) ordnerName = ordner;
      // Versteckte Dateien (.DS_Store …) interessieren nicht.
      if (pfad.split('/').some((teil) => teil.startsWith('.'))) continue;

      if (istText(pfad)) {
        const text = await readFileAsText(file);
        dateien.push({ pfad, rolle: erkenneRolle(pfad, text.split('\n')[0]), text });
      } else {
        const bytes = new Uint8Array(await readFileAsArrayBuffer(file));
        dateien.push({ pfad, rolle: erkenneRolle(pfad), bytes });
      }
    }

    dateien.sort(nachPfad);
    setStand({ ordner: ordnerName, dateien });
  }, []);

  const leeren = useCallback(() => setStand({ ordner: null, dateien: [] }), []);

  const schreibe = useCallback((dateiname: string, inhalt: string | Uint8Array, rolle: DateiRolle) => {
    setStand((vorher) => {
      // Der Ordner kommt aus dem Schema, nicht aus dem Fundort: Ergebnisse
      // landen dort, wo die App sie beim nächsten Laden wieder erwartet.
      const pfad = projektPfad(rolle, dateiname);
      const neu: ProjektDatei =
        typeof inhalt === 'string' ? { pfad, rolle, text: inhalt } : { pfad, rolle, bytes: inhalt };
      const dateien = vorher.dateien.some((datei) => datei.pfad === pfad)
        ? vorher.dateien.map((datei) => (datei.pfad === pfad ? neu : datei))
        : [...vorher.dateien, neu].sort(nachPfad);
      return { ...vorher, dateien };
    });
  }, []);

  const ersetze = useCallback((rolle: DateiRolle, neueDateien: Map<string, string | Uint8Array>) => {
    setStand((vorher) => {
      const dateien = vorher.dateien.filter((datei) => datei.rolle !== rolle);
      for (const [dateiname, inhalt] of neueDateien) {
        const pfad = projektPfad(rolle, dateiname);
        dateien.push(
          typeof inhalt === 'string' ? { pfad, rolle, text: inhalt } : { pfad, rolle, bytes: inhalt },
        );
      }
      return { ...vorher, dateien: dateien.sort(nachPfad) };
    });
  }, []);

  const alsZip = useCallback(async () => {
    // Der ganze Stand: erkannte Dateien, Ergebnisse der Schritte und alles,
    // was der Ordner sonst noch enthielt. Die ZIP ersetzt den Ordner – sie
    // darf nichts verlieren.
    const inhalte = new Map<string, Uint8Array | string>();
    for (const datei of stand.dateien) {
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
      ersetze,
      alsZip,
      datei: (rolle) => stand.dateien.find((datei) => datei.rolle === rolle),
      dateienMit: (rolle) => stand.dateien.filter((datei) => datei.rolle === rolle),
    }),
    [stand, ladeOrdner, leeren, schreibe, ersetze, alsZip],
  );

  return <ProjektContext.Provider value={wert}>{children}</ProjektContext.Provider>;
}

export function useProjekt(): ProjektWert {
  const wert = useContext(ProjektContext);
  if (!wert) throw new Error('useProjekt außerhalb des ProjektProviders benutzt');
  return wert;
}

/** Leere Projektvorlage als ZIP – alle Ordner des Schemas, sonst nichts. */
export async function vorlageAlsZip(): Promise<Uint8Array> {
  const inhalte = new Map<string, Uint8Array | string>();
  for (const [pfad, inhalt] of projektVorlage()) inhalte.set(pfad, inhalt);
  return erstelleZip(inhalte);
}
