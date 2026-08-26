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

/**
 * Ein Raum, wie ihn eine Klausur benutzt.
 *
 * Der Raum selbst (sein Raster) liegt in `Raeume/` und gilt für jedes Jahr;
 * diese Liste sagt, **welche** Räume diese Klausur belegt und wann. Derselbe
 * Hörsaal kommt dabei oft mehrfach vor – Gruppe 1 vormittags, Gruppe 2
 * nachmittags. Jeder dieser Einsätze hat seine eigene Belegung und eigene
 * Sitzplatznummern, aber dasselbe Raster.
 */
export interface Raum {
  /** Name des Raums – zeigt auf sein Raster in `Raeume/`. */
  raum: string;
  plaetze: number;
  reservierteZeit: string;
  /**
   * Wievielter Einsatz dieses Raums in der Klausur (1 = der erste). Steht
   * nicht in der CSV: `parseRaeume` zählt beim Einlesen durch, wie oft ein
   * Raum schon vorkam. Ohne Angabe gilt 1.
   */
  durchgang?: number;
}

/** Eine Zeile der Raum-/Sitzplatzzuteilung. */
export interface Sitzplatz {
  anfangNachname: string;
  sitzplatznummer: number;
  /** Name des Raums – das, was auf dem Aushang und im PDF steht. */
  raum: string;
  /**
   * Schlüssel des Raumeinsatzes (`raumSchluessel`). Trennt zwei Durchgänge
   * desselben Raums: Belegung, Sitzplan und Sitzplatznummern hängen daran,
   * der Name allein wäre zweimal derselbe. Steht nicht in der CSV – beim
   * Einlesen gilt der Raumname.
   */
  raumSchluessel: string;
  reservierteZeit: string;
  matrikelnummer: string;
  anwesend: string;
  nachname: string;
  vorname: string;
  zeitUndRaum: string;
  email: string;
}
