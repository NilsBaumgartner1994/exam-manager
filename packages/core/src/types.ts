/** Zentrale Datentypen – Spaltennamen folgen den CSV-Formaten (siehe README). */

/** Eine Person mit Klausurzulassung: `Nachname;Vorname;Matrikelnummer;E-Mail` */
export interface Zulassung {
  nachname: string;
  vorname: string;
  matrikelnummer: string;
  email: string;
}

/** Zeile des Stud.IP-Teilnehmendenexports (nur die genutzten Spalten). */
export interface StudipTeilnehmer {
  status: string; // "dozent" | "tutor" | "autor" | ...
  vorname: string;
  nachname: string;
  benutzername: string;
  email: string;
  matrikelnummer: string;
}

/** Zeile der VIPS-Notenliste: Person plus Punkte je Aufgabenblatt. */
export interface NotenlistenEintrag {
  nachname: string;
  vorname: string;
  kennung: string;
  matrikelnummer: string;
  /** Punkte je Aufgabenblatt; leerer String = nicht abgegeben. */
  punkte: (number | null)[];
}

export interface Notenliste {
  /** Spaltenüberschriften der Aufgabenblätter, z. B. "PV - Aufgabenblatt 01". */
  aufgabenblaetter: string[];
  maximalpunkte: number[];
  eintraege: NotenlistenEintrag[];
}

/** Anmeldung aus dem HIS-Export des Prüfungsamts: `Nachname;Vorname;Matrikelnummer` */
export interface Anmeldung {
  nachname: string;
  vorname: string;
  matrikelnummer: string;
}

export interface Raum {
  raum: string;
  plaetze: number;
  reservierteZeit: string;
}

/** Eine Zeile der Raum-/Sitzplatzzuteilung. */
export interface Sitzplatz {
  anfangNachname: string;
  sitzplatznummer: number;
  raum: string;
  reservierteZeit: string;
  matrikelnummer: string;
  anwesend: string;
  nachname: string;
  vorname: string;
  zeitUndRaum: string;
  email: string;
}
