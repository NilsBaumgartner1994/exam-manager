/**
 * Die fünf Schritte der Web-App als Befehle.
 *
 * Jeder Befehl macht genau das, was sein Screen macht, und ruft dafür dieselbe
 * Fachlogik im Core auf – gerechnet wird nichts zweimal. Was hier dazukommt,
 * ist nur das Drumherum: Dateien lesen, das Ergebnis hinschreiben und es in
 * einer Zeile zusammenfassen.
 */
import {
  anmeldungenToCsv,
  defaultZulassungsDateiname,
  einsatzRaster,
  erstelleRaumzuteilung,
  kursAusDateiname,
  ladeZulassungsBestand,
  ladeZulassungsFunde,
  neueZulassungen,
  parseAnmeldungen,
  parseHisRows,
  parseNotenliste,
  parseRaeume,
  parseRaumschemaDateien,
  parseStudipExport,
  parseZulassungsliste,
  plaetzeJeRaum,
  pruefePlatzbedarf,
  pruefeZulassungen,
  raumschemaDateiname,
  raumschemataToCsv,
  raumSchluessel,
  sitzplaetzeMitBelegung,
  sitzplaetzeToCsv,
  sitzplanRasterCsv,
  sitzplatznummern,
  Sitzverteilung,
  standardRaumschema,
  sucheImBestand,
  teilnehmerMitZulassung,
  tischzellen,
  veranstaltungAlsKennung,
  verteileAufRaumschemata,
  Verteilmodus,
  VORLAGE_ZULASSUNG,
  zulassungenToCsv,
  zulassungsPdf,
} from '@exam-manager/core';
import { basename, dirname, join } from 'path';
import {
  Argumente,
  BefehlBeschreibung,
  FehlendeAngabe,
  gesetzt,
  text,
  zahl,
} from './argumente';
import { lieseDatei, lieseQuelle, lieseQuellen, projektAus, schreibeDatei } from './eingaben';
import { Projekt } from './projektordner';

export interface Befehl {
  beschreibung: BefehlBeschreibung;
  ausfuehren: (args: Argumente) => Promise<void>;
}

/** Gemeinsamer Schalter aller Befehle: der Projektordner. */
const PROJEKT_SCHALTER = {
  name: 'projekt',
  art: 'pfad',
  beschreibung: 'Projektordner, aus dem fehlende Eingaben genommen werden',
} as const;

/** Eine Tabelle als Text – ohne Rahmen, aber mit fluchtenden Spalten. */
function tabelle(kopf: string[], zeilen: string[][]): string {
  const breiten = kopf.map((titel, i) =>
    Math.max(titel.length, ...zeilen.map((zeile) => (zeile[i] ?? '').length)),
  );
  const zeile = (werte: string[]) =>
    werte.map((wert, i) => (wert ?? '').padEnd(breiten[i], ' ')).join('  ').trimEnd();
  return [zeile(kopf), zeile(breiten.map((breite) => '-'.repeat(breite))), ...zeilen.map(zeile)].join(
    '\n',
  );
}

/**
 * Schritt 1: VIPS-Punkte auswerten – wer hat die Zulassung neu erworben?
 */
const vips: Befehl = {
  beschreibung: {
    name: '1_vips',
    titel: '1. VIPS-Punkte auswerten',
    beschreibung:
      'Wertet die VIPS-Notenliste aus und listet, wer die Klausurzulassung neu erworben hat.\n' +
      'Die E-Mail-Adressen kommen aus dem Stud.IP-Teilnehmendenexport.',
    positionen: [
      { name: 'Notenliste.csv', beschreibung: 'VIPS-Notenliste des Semesters' },
      { name: 'Teilnehmendenexport.csv', beschreibung: 'Stud.IP-Export der Veranstaltung' },
    ],
    schalter: [
      PROJEKT_SCHALTER,
      {
        name: 'min_points',
        art: 'zahl',
        beschreibung: 'Punkte, ab denen ein Aufgabenblatt bestanden ist',
        standard: 30,
      },
      {
        name: 'min_assignments',
        art: 'zahl',
        beschreibung: 'so viele Aufgabenblätter müssen bestanden sein',
        standard: 3,
      },
      { name: 'veranstaltung', art: 'text', beschreibung: 'Name für den Dateinamen der Zulassungsliste' },
      {
        name: 'out',
        art: 'pfad',
        beschreibung: 'Zulassungsliste hierhin schreiben (mit --projekt: nach Zulassungen/)',
      },
    ],
    beispiele: [
      'yarn 1_vips Notenliste.csv Teilnehmendenexport.csv --min_points 30 --min_assignments 3',
      'yarn 1_vips --projekt Beispielprojekt --min_points 30 --min_assignments 3 --out neu.csv',
    ],
  },
  async ausfuehren(args) {
    const projekt = projektAus(args);
    const noten = lieseQuelle({
      pfad: args.positionen[0],
      schalter: 'notenliste',
      rolle: 'notenliste',
      projekt,
      args,
    });
    const studip = lieseQuelle({
      pfad: args.positionen[1],
      schalter: 'teilnehmende',
      rolle: 'studipExport',
      projekt,
      args,
    });
    const kriterien = {
      minPunkteProBlatt: zahl(args, 'min_points', 30),
      minBlaetterBestehen: zahl(args, 'min_assignments', 3),
    };
    const zulassungen = neueZulassungen(
      parseNotenliste(noten.text),
      parseStudipExport(studip.text),
      kriterien,
    );

    console.log(`Notenliste:   ${Projekt.kurz(noten.pfad)}`);
    console.log(`Stud.IP:      ${Projekt.kurz(studip.pfad)}`);
    console.log(
      `Kriterien:    mindestens ${kriterien.minPunkteProBlatt} Punkte auf ${kriterien.minBlaetterBestehen} Aufgabenblättern`,
    );
    console.log('');
    console.log(
      tabelle(
        ['Nachname', 'Vorname', 'Matrikelnummer', 'E-Mail'],
        zulassungen.map((z) => [z.nachname, z.vorname, z.matrikelnummer, z.email]),
      ),
    );
    console.log('');
    console.log(`${zulassungen.length} Studierende haben die Zulassung neu erworben.`);

    // Die Veranstaltung steckt im Dateinamen des Stud.IP-Exports – dieselbe
    // Herleitung wie in der App (`kursAusDateiname`), nichts wird geraten.
    const kurs = kursAusDateiname(basename(studip.pfad));
    const veranstaltung =
      text(args, 'veranstaltung') ??
      (kurs !== null ? veranstaltungAlsKennung(kurs) : 'veranstaltung');
    const dateiname = defaultZulassungsDateiname(veranstaltung, new Date().getFullYear());
    const ziel =
      text(args, 'out') ?? (projekt ? projekt.ziel('zulassungsbestand', dateiname) : undefined);
    if (ziel === undefined) {
      console.log(`Zum Sichern: --out ${dateiname} (oder --projekt <Ordner>).`);
      return;
    }
    schreibeDatei(ziel, zulassungenToCsv(zulassungen));
  },
};

/**
 * Schritt 2: Zulassung nachschlagen und die Schreiben als PDF erzeugen.
 */
const zulassung: Befehl = {
  beschreibung: {
    name: '2_zulassung',
    titel: '2. Zulassung prüfen & PDFs erzeugen',
    beschreibung:
      'Prüft die Teilnehmenden der Veranstaltung gegen den Zulassungsbestand aller Jahre\n' +
      'und erzeugt je Person ein PDF <Matrikelnummer>.pdf. Mit --suche wird nur nachgeschlagen.',
    positionen: [
      { name: 'Zulassungen/', beschreibung: 'Ordner mit den Jahreslisten *zulassungen*.csv' },
      { name: 'Teilnehmendenexport.csv', beschreibung: 'Stud.IP-Export der Veranstaltung' },
    ],
    schalter: [
      PROJEKT_SCHALTER,
      { name: 'suche', art: 'text', beschreibung: 'Name oder Matrikelnummer im Bestand nachschlagen' },
      {
        name: 'out',
        art: 'pfad',
        beschreibung: 'Ordner für die PDFs (mit --projekt: 2_Zulassungs_PDFs_Export/)',
      },
      { name: 'vorlage', art: 'pfad', beschreibung: 'Markdown-Vorlage für den Text der Schreiben' },
    ],
    beispiele: [
      'yarn 2_zulassung Zulassungen/ Teilnehmendenexport.csv --out pdfs/',
      'yarn 2_zulassung --projekt Beispielprojekt --suche Schrödinger',
    ],
  },
  async ausfuehren(args) {
    const projekt = projektAus(args);
    const listen = lieseQuellen({
      pfad: args.positionen[0],
      schalter: 'zulassungen',
      rolle: 'zulassungsbestand',
      projekt,
      args,
    });
    const funde = ladeZulassungsFunde(
      listen.map((quelle) => ({ datei: basename(quelle.pfad), text: quelle.text })),
    );
    console.log(`Bestand:      ${funde.length} Einträge aus ${listen.length} Datei(en)`);

    const suche = text(args, 'suche');
    if (suche !== undefined) {
      const treffer = sucheImBestand(funde, suche);
      if (treffer.length === 0) {
        console.log(`„${suche}“ steht in keiner Zulassungsliste – keine Zulassung gefunden.`);
        return;
      }
      console.log('');
      console.log(
        tabelle(
          ['Nachname', 'Vorname', 'Matrikelnummer', 'Zulassung aus Datei'],
          treffer.map((fund) => [
            fund.zulassung.nachname,
            fund.zulassung.vorname,
            fund.zulassung.matrikelnummer,
            fund.datei,
          ]),
        ),
      );
      return;
    }

    const studip = lieseQuelle({
      pfad: args.positionen[1],
      schalter: 'teilnehmende',
      rolle: 'studipExport',
      projekt,
      args,
    });
    const zulassungen = teilnehmerMitZulassung(
      parseStudipExport(studip.text),
      ladeZulassungsBestand(listen.map((quelle) => quelle.text)),
    );
    console.log(`Stud.IP:      ${Projekt.kurz(studip.pfad)}`);
    console.log('');
    console.log(
      tabelle(
        ['Nachname', 'Vorname', 'Matrikelnummer', 'E-Mail'],
        zulassungen.map((z) => [z.nachname, z.vorname, z.matrikelnummer, z.email]),
      ),
    );
    console.log('');
    console.log(`${zulassungen.length} Teilnehmende haben eine Zulassung.`);

    const ordner = text(args, 'out') ?? (projekt ? projekt.ziel('zulassungsPdf', '') : undefined);
    if (ordner === undefined) {
      console.log('Zum Erzeugen der PDFs: --out <Ordner> (oder --projekt <Ordner>).');
      return;
    }
    const vorlagePfad = text(args, 'vorlage');
    const vorlage = vorlagePfad !== undefined ? lieseDatei(vorlagePfad) : VORLAGE_ZULASSUNG;
    for (const person of zulassungen) {
      schreibeDatei(
        join(ordner, `${person.matrikelnummer}.pdf`),
        await zulassungsPdf(person, vorlage),
      );
    }
    console.log(`${zulassungen.length} PDFs – je Person eine Datei <Matrikelnummer>.pdf.`);
    console.log(
      'Sie gehören in einen unsichtbaren Stud.IP-Ordner mit „Zugriff auf Dateien per Link“;',
    );
    console.log(
      'das Werkzeug „Klausureinsicht“ gibt jeder Person nur die Datei ihrer Matrikelnummer frei.',
    );
  },
};

/**
 * Das Excel-Blatt des Prüfungsamts einlesen.
 *
 * `read-excel-file` liegt als ES-Modul vor, dieser Befehl läuft als
 * CommonJS – deshalb erst beim Aufruf geladen (`import(...)`). Das kostet
 * nichts: Wer Schritt 3 nicht ruft, lädt den Excel-Leser auch nicht.
 */
async function lieseExcel(pfad: string): Promise<unknown[][]> {
  const { default: readXlsxFile } = await import('read-excel-file/node');
  return readXlsxFile(pfad);
}

/**
 * Schritt 3: Anmeldungen des Prüfungsamts gegen den Zulassungsbestand prüfen.
 */
const teilnehmende: Befehl = {
  beschreibung: {
    name: '3_teilnehmende',
    titel: '3. Klausur-Anmeldungen prüfen',
    beschreibung:
      'Prüft die Anmeldungen des Prüfungsamts (HIS-Export) gegen den Zulassungsbestand und\n' +
      'schreibt allowedStudents.csv und notAllowedStudents.csv.',
    positionen: [
      { name: 'check.xlsx', beschreibung: 'Anmeldungen des Prüfungsamts (.xlsx oder .csv)' },
      { name: 'Zulassungen/', beschreibung: 'Ordner mit den Jahreslisten *zulassungen*.csv' },
    ],
    schalter: [
      PROJEKT_SCHALTER,
      {
        name: 'out',
        art: 'pfad',
        beschreibung: 'Ordner für die beiden Listen (mit --projekt: 3_Klausur_Teilnehmende_Export/)',
      },
    ],
    beispiele: [
      'yarn 3_teilnehmende check.xlsx Zulassungen/ --out ./',
      'yarn 3_teilnehmende --projekt Beispielprojekt',
    ],
  },
  async ausfuehren(args) {
    const projekt = projektAus(args);
    const anmeldungenPfad =
      args.positionen[0] ?? text(args, 'anmeldungen') ?? projekt?.eine('hisExport')?.datei;
    if (anmeldungenPfad === undefined) {
      throw new FehlendeAngabe(
        'Es fehlt: die Anmeldungen des Prüfungsamts – als Pfad, mit --anmeldungen oder im Projektordner unter 0_Input_Klausuranmeldungen/*.xlsx.',
      );
    }
    // Der Export kommt als Excel; die Python-Kette wandelt ihn vorher in CSV,
    // deshalb wird beides gelesen.
    const anmeldungen = anmeldungenPfad.toLowerCase().endsWith('.csv')
      ? parseAnmeldungen(lieseDatei(anmeldungenPfad))
      : parseHisRows(await lieseExcel(anmeldungenPfad));
    const listen = lieseQuellen({
      pfad: args.positionen[1],
      schalter: 'zulassungen',
      rolle: 'zulassungsbestand',
      projekt,
      args,
    });
    const { zugelassen, nichtZugelassen } = pruefeZulassungen(
      anmeldungen,
      ladeZulassungsBestand(listen.map((quelle) => quelle.text)),
    );

    console.log(`Anmeldungen:  ${Projekt.kurz(anmeldungenPfad)} (${anmeldungen.length})`);
    console.log(`Bestand:      ${listen.length} Zulassungsliste(n)`);
    console.log('');
    console.log(`${zugelassen.length} von ${anmeldungen.length} Angemeldeten sind zugelassen.`);
    if (nichtZugelassen.length > 0) {
      console.log('');
      console.log(
        tabelle(
          ['Nicht zugelassen', 'Vorname', 'Matrikelnummer'],
          nichtZugelassen.map((p) => [p.nachname, p.vorname, p.matrikelnummer]),
        ),
      );
    }

    const ordner = text(args, 'out') ?? (projekt ? projekt.ziel('teilnehmer', '') : undefined);
    if (ordner === undefined) {
      console.log('');
      console.log('Zum Sichern: --out <Ordner> (oder --projekt <Ordner>).');
      return;
    }
    schreibeDatei(join(ordner, 'allowedStudents.csv'), anmeldungenToCsv(zugelassen));
    schreibeDatei(join(ordner, 'notAllowedStudents.csv'), anmeldungenToCsv(nichtZugelassen));
  },
};

/**
 * Schritt 4: Teilnehmende auf die Räume verteilen.
 */
const raumzuteilung: Befehl = {
  beschreibung: {
    name: '4_raumzuteilung',
    titel: '4. Raumzuteilung & Sitzplan',
    beschreibung:
      'Verteilt die Teilnehmenden auf die Räume dieser Klausur und vergibt Sitzplatznummern.\n' +
      'Wie viele Plätze ein Raum hat, sind die Tische in seinem Raster – reichen sie nicht,\n' +
      'sagt der Befehl, wie viele fehlen, und verteilt nicht.\n' +
      'Geschrieben werden drei Dateien: der Sitzplan als Liste und der Raumplan als Tabelle,\n' +
      'einmal nur mit den Sitzplatznummern und einmal mit Matrikelnummer und Name.',
    positionen: [
      { name: 'allowedStudents.csv', beschreibung: 'Teilnehmende aus Schritt 3' },
      { name: 'klausurraeume.csv', beschreibung: 'Räume dieser Klausur (Raum;ReservierteZeit)' },
    ],
    schalter: [
      PROJEKT_SCHALTER,
      { name: 'raeume', art: 'pfad', beschreibung: 'Ordner mit den Rastern (je Raum eine CSV)' },
      {
        name: 'modus',
        art: 'text',
        beschreibung: 'balanced (gleichmäßig) oder sequential (Raum für Raum)',
        standard: 'balanced',
      },
      { name: 'start', art: 'zahl', beschreibung: 'erste Sitzplatznummer', standard: 1001 },
      {
        name: 'sitzverteilung',
        art: 'text',
        beschreibung: 'Plätze im Raum: lesereihenfolge oder abstand',
        standard: 'lesereihenfolge',
      },
      {
        name: 'out',
        art: 'pfad',
        beschreibung:
          'Sitzplan hierhin schreiben; die Raster-CSVs landen daneben (mit --projekt: 4_Raumzuteilung_Export/)',
      },
      { name: 'trotzdem', art: 'ja', beschreibung: 'auch verteilen, wenn die Plätze nicht reichen' },
    ],
    beispiele: [
      'yarn 4_raumzuteilung allowedStudents.csv klausurraeume.csv --raeume Raeume/',
      'yarn 4_raumzuteilung --projekt Beispielprojekt --modus sequential --sitzverteilung abstand',
    ],
  },
  async ausfuehren(args) {
    const projekt = projektAus(args);
    const liste = lieseQuelle({
      pfad: args.positionen[0],
      schalter: 'teilnehmende',
      rolle: 'teilnehmer',
      projekt,
      args,
    });
    const raumliste = lieseQuelle({
      pfad: args.positionen[1],
      schalter: 'klausurraeume',
      rolle: 'klausurraeume',
      projekt,
      args,
    });
    const raster = lieseQuellen({
      schalter: 'raeume',
      rolle: 'raumschema',
      projekt,
      args,
    });

    const teilnehmer = parseZulassungsliste(liste.text);
    const raeume = parseRaeume(raumliste.text);
    const schemata = parseRaumschemaDateien(raster.map((quelle) => quelle.text));
    const plaetze = plaetzeJeRaum(schemata);
    const bedarf = pruefePlatzbedarf(teilnehmer.length, raeume, plaetze);

    console.log(`Teilnehmende: ${Projekt.kurz(liste.pfad)} (${teilnehmer.length})`);
    console.log(`Räume:        ${Projekt.kurz(raumliste.pfad)} (${raeume.length} Raumeinsätze)`);
    console.log(`Raster:       ${schemata.length} Datei(en)`);
    console.log('');
    console.log(
      tabelle(
        ['Raum', 'Plätze', 'Reservierte Zeit'],
        raeume.map((raum) => [
          raumSchluessel(raum),
          String(plaetze.get(raum.raum) ?? 0),
          raum.reservierteZeit,
        ]),
      ),
    );
    console.log('');
    console.log(
      `${bedarf.teilnehmende} Teilnehmende · höchstens ${bedarf.plaetze} Plätze · ` +
        (bedarf.reicht ? `${bedarf.frei} frei.` : `${bedarf.fehlende} zu wenig.`),
    );
    if (bedarf.ohneRaster.length > 0) {
      console.log(
        `Ohne Raster und damit ohne Plätze: ${bedarf.ohneRaster.join(', ')} – Raster in Raeume/ anlegen (yarn 5_raeume --neu <Name>).`,
      );
    }
    if (!bedarf.reicht && !gesetzt(args, 'trotzdem')) {
      throw new FehlendeAngabe(
        `Es fehlen ${bedarf.fehlende} Plätze: weitere Räume in ${basename(raumliste.pfad)} eintragen – oder mit --trotzdem verteilen, dann bleiben ${bedarf.fehlende} Personen ohne Platz.`,
      );
    }

    const modus = text(args, 'modus') ?? 'balanced';
    if (modus !== 'balanced' && modus !== 'sequential') {
      throw new FehlendeAngabe(`--modus kennt nur balanced und sequential, nicht „${modus}“.`);
    }
    const sitzverteilung = text(args, 'sitzverteilung') ?? 'lesereihenfolge';
    if (sitzverteilung !== 'lesereihenfolge' && sitzverteilung !== 'abstand') {
      throw new FehlendeAngabe(
        `--sitzverteilung kennt nur lesereihenfolge und abstand, nicht „${sitzverteilung}“.`,
      );
    }
    const ersteNummer = zahl(args, 'start', 1001);
    const { sitzplaetze: verteilt, ohnePlatz } = erstelleRaumzuteilung(teilnehmer, raeume, {
      modus: modus as Verteilmodus,
      plaetze,
      ersteSitzplatznummer: ersteNummer,
    });

    // Wer in welchem Raum sitzt, ist die eine Hälfte; an welchem Tisch, die
    // andere. Beides zusammen ergibt den Plan, den auch der Screen zeigt –
    // deshalb geht die Zuteilung hier noch durch die Raster.
    const einsaetze = einsatzRaster(raeume, schemata);
    const nummern = sitzplatznummern(einsaetze, ersteNummer);
    const { belegung, ohnePlatz: ohneTisch } = verteileAufRaumschemata(
      verteilt,
      einsaetze,
      [],
      sitzverteilung as Sitzverteilung,
    );
    const sitzplaetze = sitzplaetzeMitBelegung(verteilt, belegung, nummern);
    console.log('');
    console.log(
      tabelle(
        ['Sitzplatz', 'Nachname', 'Vorname', 'Raum', 'Zeit'],
        sitzplaetze.map((platz) => [
          String(platz.sitzplatznummer),
          platz.nachname,
          platz.vorname,
          platz.raumSchluessel,
          platz.reservierteZeit,
        ]),
      ),
    );
    console.log('');
    console.log(`${sitzplaetze.length} Sitzplätze vergeben.`);
    if (ohnePlatz.length > 0) {
      console.log(
        `Kein Platz für: ${ohnePlatz.map((p) => `${p.vorname} ${p.nachname}`).join(', ')}`,
      );
    }
    if (ohneTisch.length > 0) {
      console.log(
        `Ohne Tisch im Sitzplan: ${ohneTisch.map((p) => `${p.vorname} ${p.nachname}`).join(', ')} – im Raster mehr Tische setzen.`,
      );
    }

    const ziel =
      text(args, 'out') ??
      (projekt ? projekt.ziel('sitzplan', 'studierendeZuRaumUndZeitZuordnung.csv') : undefined);
    if (ziel === undefined) {
      console.log('Zum Sichern: --out <Datei> (oder --projekt <Ordner>).');
      return;
    }
    schreibeDatei(ziel, sitzplaetzeToCsv(sitzplaetze));
    // Neben die Liste der Raumplan als Tabelle – einmal für den Aushang (nur
    // Nummern) und einmal für die Aufsicht (mit Matrikelnummer und Name).
    const tabellen = einsaetze.map((schema) => ({ schema }));
    const daneben = (dateiname: string) => join(dirname(ziel), dateiname);
    schreibeDatei(
      daneben('sitzplan_nummern.csv'),
      sitzplanRasterCsv(tabellen, belegung, sitzplaetze, nummern, 'nummer'),
    );
    schreibeDatei(
      daneben('sitzplan_namen.csv'),
      sitzplanRasterCsv(tabellen, belegung, sitzplaetze, nummern, 'person'),
    );
  },
};

/**
 * Schritt 5: der Bestand des Hauses – welche Räume gibt es, wie viele Plätze
 * hat jeder?
 */
const raeume: Befehl = {
  beschreibung: {
    name: '5_raeume',
    titel: '5. Räume & Raumpläne',
    beschreibung:
      'Zeigt den Bestand des Hauses: je Raum sein Raster und die Tische darin.\n' +
      'Mit --neu entsteht ein Vorschlagsraster; gezeichnet wird es in der App.',
    positionen: [{ name: 'Raeume/', beschreibung: 'Ordner mit den Rastern, je Raum eine CSV' }],
    schalter: [
      PROJEKT_SCHALTER,
      { name: 'neu', art: 'text', beschreibung: 'Name eines neuen Raums – legt sein Raster an' },
      {
        name: 'plaetze',
        art: 'zahl',
        beschreibung: 'Plätze des Vorschlagsrasters für --neu',
        standard: 24,
      },
      { name: 'out', art: 'pfad', beschreibung: 'Ordner für das neue Raster (Standard: Raeume/)' },
    ],
    beispiele: [
      'yarn 5_raeume Raeume/',
      'yarn 5_raeume --projekt Beispielprojekt --neu 99/A01 --plaetze 30',
    ],
  },
  async ausfuehren(args) {
    const projekt = projektAus(args);
    const quellen = lieseQuellen({
      pfad: args.positionen[0],
      schalter: 'raeume',
      rolle: 'raumschema',
      projekt,
      args,
    });
    const schemata = parseRaumschemaDateien(quellen.map((quelle) => quelle.text));
    console.log(
      tabelle(
        ['Raum', 'Plätze', 'Raster'],
        schemata.map((schema) => [
          schema.raum,
          String(tischzellen(schema).length),
          `${schema.zellen.length} Zeilen × ${schema.zellen[0]?.length ?? 0} Spalten`,
        ]),
      ),
    );
    console.log('');
    console.log(
      `${schemata.length} Räume im Bestand · ${schemata.reduce((summe, schema) => summe + tischzellen(schema).length, 0)} Plätze insgesamt.`,
    );

    const neu = text(args, 'neu');
    if (neu === undefined) return;
    if (schemata.some((schema) => schema.raum === neu)) {
      throw new FehlendeAngabe(`„${neu}“ gibt es im Bestand schon – im Haus hat jeder Raum genau einen Namen.`);
    }
    const schema = standardRaumschema(neu, zahl(args, 'plaetze', 24));
    const ordner =
      text(args, 'out') ??
      (projekt ? projekt.ziel('raumschema', '') : undefined) ??
      // Ohne Projekt: neben die Raster, die gerade gelesen wurden.
      (quellen[0] ? join(quellen[0].pfad, '..') : 'Raeume');
    schreibeDatei(join(ordner, raumschemaDateiname(neu)), raumschemataToCsv([schema]));
    console.log(`Raum ${neu} angelegt – Vorschlagsraster mit ${tischzellen(schema).length} Plätzen.`);
  },
};

export const BEFEHLE: Befehl[] = [vips, zulassung, teilnehmende, raumzuteilung, raeume];
