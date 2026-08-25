#!/usr/bin/env python3
# encoding: utf-8
"""
Schreibt die anonymisierten Beispieldaten des Repos als TypeScript-Modul in
die Web-App (apps/web/src/sampleData.ts), damit jeder Screen einen Button
"Beispieldaten laden" anbieten kann – auch für den Maestro-Testdurchlauf.

Nach Änderungen am Datensatz ausführen:

    python3 tools/generate_sample_data.py   # + Pipeline laut README
    python3 tools/sync_sample_data_to_app.py
"""
import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "apps" / "web" / "src" / "sampleData.ts"

def text(path):
    return (ROOT / path).read_text(encoding="utf-8")

def b64(path):
    return base64.b64encode((ROOT / path).read_bytes()).decode("ascii")

zulassungen_ordner = ROOT / "Zulassungen"
bestand = {
    p.name: p.read_text(encoding="utf-8")
    for p in sorted(zulassungen_ordner.glob("*.csv"))
    if "zulassungen" in p.name.lower()
}

content = f'''/**
 * Anonymisierte Beispieldaten – GENERIERT aus den Daten des Repos.
 * Nicht von Hand bearbeiten, sondern neu erzeugen:
 * `python3 tools/sync_sample_data_to_app.py` (siehe AGENTS.md).
 */

/** VIPS-Notenliste (`Notenliste.csv`). */
export const BEISPIEL_NOTENLISTE: string = {json.dumps(text("Zuslassungliste_Erstellen/1_check_bestandene_vips/Notenliste.csv"))};

/** Stud.IP-Teilnehmendenexport. */
export const BEISPIEL_TEILNEHMENDENEXPORT: string = {json.dumps(text("Zuslassungliste_Erstellen/1_check_bestandene_vips/Teilnehmendenexport_Beispielveranstaltung.csv"))};

/** Zulassungsbestand: Dateiname → CSV-Inhalt (Ordner `Zulassungen/`). */
export const BEISPIEL_ZULASSUNGS_BESTAND: Record<string, string> = {json.dumps(bestand, ensure_ascii=False, indent=2)};

/** HIS-Export des Prüfungsamts (`check.xlsx`) als Base64. */
export const BEISPIEL_HIS_EXPORT_XLSX_BASE64: string =
  {json.dumps(b64("Zulassungen/check.xlsx"))};

/** Raumliste (`raeume.csv`). */
export const BEISPIEL_RAEUME: string = {json.dumps(text("Zuslassungliste_Erstellen/4_MailRaumZuordnung/2_raum_zuteilung_erstellen/raeume.csv"))};

/** Ergebnis aus Schritt 3 (`allowedStudents.csv` mit E-Mail aus Schritt 2). */
export const BEISPIEL_KLAUSUR_TEILNEHMER: string = {json.dumps(text("Zuslassungliste_Erstellen/4_MailRaumZuordnung/2_raum_zuteilung_erstellen/result.csv"))};

/** Base64 → ArrayBuffer (für den Excel-Reader im Browser). */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {{
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}}
'''

OUT.write_text(content, encoding="utf-8")
print(f"geschrieben: {OUT.relative_to(ROOT)} ({len(content)} Zeichen)")
