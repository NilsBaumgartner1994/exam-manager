/** Routen der App – Screens registrieren sich in App.tsx. */
export type RootStackParamList = {
  Home: undefined;
  Vips: undefined;
  ZulassungsPdfs: undefined;
  KlausurTeilnehmer: undefined;
  Raumzuteilung: undefined;
  Raeume: undefined;
};

export interface ScreenInfo {
  route: keyof RootStackParamList;
  titel: string;
  beschreibung: string;
}

/** Die Kacheln der Startseite in Workflow-Reihenfolge. */
export const SCREENS: ScreenInfo[] = [
  {
    route: 'Vips',
    titel: '1. VIPS-Punkte auswerten',
    beschreibung:
      'Notenliste und Teilnehmendenexport hochladen und ermitteln, wer in diesem Semester die Zulassung neu erworben hat.',
  },
  {
    route: 'ZulassungsPdfs',
    titel: '2. Zulassungs-PDFs generieren',
    beschreibung:
      'Für alle Teilnehmenden mit Zulassung (neu oder aus Vorjahren) PDFs erzeugen und als ZIP herunterladen.',
  },
  {
    route: 'KlausurTeilnehmer',
    titel: '3. Klausur-Anmeldungen prüfen',
    beschreibung:
      'HIS-Export (Excel) gegen den Zulassungsbestand prüfen: Wer ist zugelassen, wer nicht?',
  },
  {
    route: 'Raumzuteilung',
    titel: '4. Raumzuteilung & Sitzplan',
    beschreibung:
      'Teilnehmende auf Räume verteilen, Sitzplan erstellen und Ansichten für Aushang, Lehrende und Tutor:innen erzeugen.',
  },
  {
    route: 'Raeume',
    titel: '5. Räume & Raumpläne',
    beschreibung:
      'Räume und ihre leeren Raster pflegen – ohne Teilnehmende. Gilt für jede Klausur und ist die Vorlage für Schritt 4.',
  },
];
