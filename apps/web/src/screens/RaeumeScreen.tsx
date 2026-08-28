import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  erstelleZip,
  kopiereRaumschema,
  parseRaeume,
  PLAN_ANZEIGE_STANDARD,
  parseRaumschemaDateien,
  raeumeToCsv,
  raumDateiname,
  Raumschema,
  raumschemaDateien,
  sitzplaenePdf,
  standardRaumschema,
  tischzellen,
} from '@exam-manager/core';
import {
  AppButton,
  Arbeitsflaeche,
  BlattModal,
  LabeledNumberInput,
  LabeledTextInput,
  Menueleiste,
  PALETTEN_HINWEIS_ZEILE,
  paletteEintraege,
  PlanFuss,
  ProjektQuelle,
  rasterEintraege,
  rasterText,
  RaumListe,
  RaumplanBuehne,
  raumZuZeile,
  Reiterinhalt,
  Section,
  StatusText,
  useProjektDownloadEintrag,
  useRaumplanEditor,
  werkzeugTitel,
  zeileZuRaum,
  type MenuEintrag,
  type MenuGruppe,
  type RaumZeile,
} from '../components';
import { downloadCsv, downloadFile, downloadZip, readFileAsText } from '../files';
import { useProjekt } from '../projekt';
import { BEISPIEL_RAEUME, BEISPIEL_RAUMSCHEMATA } from '../sampleData';
import { colors, spacing } from '../theme';

/**
 * Beim Einrichten eines Raums zählen die Möbel, nicht die Namen: Das Pult wird
 * hier beschriftet (in Schritt 4 stünde „Pult“ nur im Weg).
 */
const ANZEIGE_RAUMPLANUNG = { ...PLAN_ANZEIGE_STANDARD, pultText: true };

/** Der Reiter mit der Raumliste – die übrigen Reiter sind die Räume selbst. */
const REITER_RAEUME = '#raeume';

/**
 * Was gerade am Bestand geändert wird – das Blatt fragt danach.
 *
 * Ein Raumname ist eine Entscheidung und kein Tippen nebenbei: Er steht auf
 * dem Aushang, im Sitzplan und als Dateiname in `Raeume/`. Deshalb fragt die
 * App danach, statt einen „Raum 3“ hinzustellen.
 */
type RaumVorgang =
  | { art: 'neu' }
  | { art: 'duplizieren'; raum: string }
  | { art: 'umbenennen'; raum: string }
  | { art: 'loeschen'; raum: string };

/** Plätze, mit denen ein neuer Raum vorgeschlagen wird – änderbar im Blatt. */
const NEUE_RAUM_PLAETZE = 24;

function RaumVorgangBlatt({
  vorgang,
  raumVergeben,
  onSchliessen,
  onName,
  onLoeschen,
}: {
  vorgang: RaumVorgang;
  /** Gibt es den Namen im Bestand schon? Zwei gleiche Räume gibt es nicht. */
  raumVergeben: (name: string) => boolean;
  onSchliessen: () => void;
  /** Anlegen, Duplizieren, Umbenennen – der Name steht fest, die Plätze nur beim Anlegen. */
  onName: (name: string, plaetze: number) => void;
  onLoeschen: () => void;
}) {
  const [name, setzeName] = useState(
    vorgang.art === 'duplizieren'
      ? `${vorgang.raum} Kopie`
      : vorgang.art === 'umbenennen'
        ? vorgang.raum
        : '',
  );
  const [plaetze, setzePlaetze] = useState<number | null>(NEUE_RAUM_PLAETZE);

  const getrimmt = name.trim();
  /** Beim Umbenennen ist der eigene Name kein Konflikt – sonst schon. */
  const eigener = vorgang.art === 'umbenennen' ? vorgang.raum : null;
  const problem =
    getrimmt === ''
      ? 'Bitte einen Namen eingeben.'
      : getrimmt !== eigener && raumVergeben(getrimmt)
        ? `„${getrimmt}“ gibt es im Bestand schon – im Haus hat jeder Raum genau einen Namen.`
        : null;

  const titel = {
    neu: 'Neuen Raum anlegen',
    duplizieren: 'Raum duplizieren',
    umbenennen: 'Raum umbenennen',
    loeschen: 'Raum löschen',
  }[vorgang.art];

  const untertitel =
    vorgang.art === 'duplizieren'
      ? `Kopie von ${vorgang.raum} – samt Raster`
      : vorgang.art === 'umbenennen'
        ? `bisher ${vorgang.raum}`
        : vorgang.art === 'loeschen'
          ? vorgang.raum
          : 'Bestand des Hauses';

  return (
    <BlattModal
      offen
      titel={titel}
      untertitel={untertitel}
      onSchliessen={onSchliessen}
      testID="raeume-vorgang"
    >
      {vorgang.art === 'loeschen' ? (
        <>
          <Text style={styles.hinweis}>
            {`${vorgang.raum} verschwindet aus der Raumliste, sein Raster aus `}
            <Text style={styles.pfad}>Raeume/</Text>
            {'. Rückgängig (Strg/⌘ + Z) holt beides zurück.'}
          </Text>
          <AppButton title="Löschen" onPress={onLoeschen} testID="raeume-vorgang-loeschen" />
        </>
      ) : (
        <>
          <LabeledTextInput
            label="Name des Raums"
            value={name}
            onChangeText={setzeName}
            placeholder="z. B. 94/E01"
            testID="raeume-vorgang-name"
          />
          {vorgang.art === 'neu' ? (
            <>
              <LabeledNumberInput label="Plätze" value={plaetze} onChange={setzePlaetze} />
              <Text style={styles.hinweis}>
                Daraus entsteht ein Vorschlagsraster: Tische in Zweierblöcken mit Gang, Pult vorne,
                Tür hinten. Von Hand zu zeichnen ist nur, was davon abweicht.
              </Text>
            </>
          ) : null}
          {problem ? <StatusText kind="error">{problem}</StatusText> : null}
          <AppButton
            title={{ neu: 'Anlegen', duplizieren: 'Duplizieren', umbenennen: 'Umbenennen' }[vorgang.art]}
            disabled={problem !== null}
            onPress={() => onName(getrimmt, Math.max(0, Math.round(plaetze ?? 0)))}
            testID="raeume-vorgang-ok"
          />
        </>
      )}
    </BlattModal>
  );
}

/**
 * Schritt 5: Räume und ihre leeren Raster pflegen – ohne Studierende.
 *
 * Räume überleben die einzelne Klausur: Derselbe Hörsaal wird jedes Semester
 * wieder gebraucht, sein Grundriss ändert sich fast nie. Im Projektordner
 * liegen sie deshalb in `Raeume/`, außerhalb der nummerierten Schritt-Ordner,
 * und hier lassen sie sich bearbeiten, ohne vorher eine Teilnehmerliste zu
 * laden. Hier steht der **Bestand des Hauses**; welche dieser Räume eine
 * Klausur benutzt (und ob mehrfach), entscheidet Schritt 4.
 *
 * Der Screen ist als **Arbeitsfläche** gebaut, wie eine Tabellenkalkulation:
 * oben das Menüband („Datei“, „Werkzeuge“, „Räume“ – jedes klappt auf), unten
 * die Fußleiste mit Ansicht und Meldungen, dazwischen nichts als der Plan in
 * voller Breite. Welcher Raum offen ist, steht im Menü „Räume“ und hinter
 * dessen Namen – bearbeitet wird immer **einer**: Nebeneinander sind ein
 * Hörsaal mit 44 × 32 Feldern und vier weitere Räume nicht zu überblicken, und
 * man bearbeitet ohnehin einen nach dem anderen. Gespeichert werden alle.
 */
export function RaeumeScreen() {
  const [zeilen, setZeilen] = useState<RaumZeile[]>([]);
  const [schemata, setSchemata] = useState<Raumschema[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  /** Welcher Reiter offen ist: die Raumliste oder ein Raum (Name). */
  const [reiter, setReiter] = useState<string>(REITER_RAEUME);
  /** Läuft gerade ein PDF? Das Zeichnen dauert einen Moment. */
  const [pdfLaeuft, setPdfLaeuft] = useState(false);
  /** Offenes Blatt der Bestandspflege (anlegen, duplizieren, umbenennen, löschen). */
  const [vorgang, setzeVorgang] = useState<RaumVorgang | null>(null);

  /**
   * Der Stand liegt zusätzlich in einem Ref: Beim Ziehen kommen viele
   * Änderungen schnell hintereinander, und jede muss auf dem Ergebnis der
   * vorherigen aufsetzen – der Zustand aus dem Render wäre dafür zu alt.
   */
  const schemataRef = useRef<Raumschema[]>([]);
  const uebernehmeSchemata = (neu: Raumschema[]) => {
    schemataRef.current = neu;
    setSchemata(neu);
  };
  /** Dasselbe für die Raumliste: Sie geht bei jedem Vorgang mit ins Rückgängig. */
  const zeilenRef = useRef<RaumZeile[]>([]);
  const uebernehmeZeilen = (neu: RaumZeile[]) => {
    zeilenRef.current = neu;
    setZeilen(neu);
  };

  const raeume = zeilen.map(zeileZuRaum);
  const projekt = useProjekt();

  // Eingaben aus dem Projektordner, solange nichts eigenes geladen wurde.
  useEffect(() => {
    if (zeilen.length > 0 || schemata.length > 0) return;
    const raumDatei = projekt.datei('raeume');
    // Je Raum eine Datei: Gelesen werden alle, nicht nur die erste.
    const schemaTexte = projekt
      .dateienMit('raumschema')
      .map((datei) => datei.text ?? '')
      .filter((text) => text !== '');
    if (!raumDatei?.text && schemaTexte.length === 0) return;
    try {
      if (raumDatei?.text) uebernehmeZeilen(parseRaeume(raumDatei.text).map(raumZuZeile));
      if (schemaTexte.length > 0) uebernehmeSchemata(parseRaumschemaDateien(schemaTexte));
    } catch (e) {
      setFehler(`Projektdateien konnten nicht gelesen werden: ${String(e)}`);
    }
  }, [projekt, zeilen, schemata]);

  /**
   * Änderungen wandern gleich in den Projektstand – und damit in den
   * Browserspeicher. Ein Neuladen soll nichts kosten: Vorher war ein Raster
   * erst dann sicher, wenn jemand „Raster als CSV speichern“ gedrückt hatte.
   * Gebündelt (400 ms), sonst schriebe ein Malzug bei jeder Zelle alle Räume
   * neu; die Knöpfe bleiben für den Download.
   */
  const { ersetze: projektErsetze, schreibe: projektSchreibe } = projekt;
  /** Erst schreiben, wenn hier je etwas lag – sonst leerte der erste Besuch den Ordner. */
  const schonGeschrieben = useRef(false);
  useEffect(() => {
    if (schemata.length === 0 && !schonGeschrieben.current) return;
    const gleich = setTimeout(() => {
      projektErsetze('raumschema', raumschemaDateien(schemata));
      schonGeschrieben.current = true;
    }, 400);
    return () => clearTimeout(gleich);
  }, [schemata, projektErsetze]);
  const listeGeschrieben = useRef(false);
  useEffect(() => {
    if (zeilen.length === 0 && !listeGeschrieben.current) return;
    const gleich = setTimeout(() => {
      projektSchreibe('raeume.csv', raeumeToCsv(zeilen.map(zeileZuRaum)), 'raeume');
      listeGeschrieben.current = true;
    }, 400);
    return () => clearTimeout(gleich);
  }, [zeilen, projektSchreibe]);

  const editor = useRaumplanEditor({
    schemata: schemataRef,
    aendere: (raum, wandel) =>
      uebernehmeSchemata(schemataRef.current.map((s) => (s.raum === raum ? wandel(s) : s))),
    // Raster **und** Raumliste: Ein Raum wird hier angelegt, umbenannt oder
    // gelöscht – käme nur das Raster zurück, stünde es hinterher ohne Raum.
    zustand: () => ({ schemata: schemataRef.current, raeume: zeilenRef.current }),
    setzeZustand: (stand) => {
      uebernehmeSchemata(stand.schemata);
      if (stand.raeume) uebernehmeZeilen(stand.raeume);
    },
  });

  /**
   * Der Raum, dessen Plan gerade zu sehen ist. Die Auswahl kann veralten (das
   * Raster wurde entfernt, andere Dateien geladen) – dann steht wieder die
   * Raumliste da, statt dass gar nichts mehr zu sehen ist.
   */
  const aktivesSchema = schemata.find((schema) => schema.raum === reiter) ?? null;
  const offenerReiter = aktivesSchema ? aktivesSchema.raum : REITER_RAEUME;

  const reiterWechseln = (ziel: string) => {
    setReiter(ziel);
    // Die Auswahl gehört zum vorherigen Plan – im neuen wäre sie geraten.
    editor.setzeAuswahl(null);
  };

  /** Räume der Liste, für die es noch kein Raster gibt. */
  const ohneRaster = useMemo(
    () =>
      raeume
        .filter((raum) => raum.raum !== '')
        .filter((raum) => !schemata.some((schema) => schema.raum === raum.raum)),
    [raeume, schemata],
  );

  const beispielLaden = () => {
    setFehler(null);
    uebernehmeZeilen(parseRaeume(BEISPIEL_RAEUME).map(raumZuZeile));
    uebernehmeSchemata(parseRaumschemaDateien(Object.values(BEISPIEL_RAUMSCHEMATA)));
    setHinweis('Beispieldaten geladen.');
  };

  const raeumeLaden = async (files: File[]) => {
    setFehler(null);
    try {
      uebernehmeZeilen(parseRaeume(await readFileAsText(files[0])).map(raumZuZeile));
      setHinweis('Raumliste geladen.');
    } catch (e) {
      setFehler(`Räume-CSV konnte nicht gelesen werden: ${String(e)}`);
    }
  };

  /** Raster laden – je Raum eine Datei, deshalb ruhig mehrere auf einmal. */
  const schemaLaden = async (files: File[]) => {
    setFehler(null);
    try {
      const texte = await Promise.all(files.map(readFileAsText));
      const geladen = parseRaumschemaDateien(texte);
      uebernehmeSchemata(geladen);
      setHinweis(`${geladen.length} Raumraster geladen.`);
    } catch (e) {
      setFehler(`Raumschema konnte nicht gelesen werden: ${String(e)}`);
    }
  };

  /**
   * Für Räume ohne Raster einen Vorschlag anlegen: Tische in Zweierblöcken mit
   * Gang, Pult vorne, Tür hinten. Von Hand zeichnen muss man nur, was davon
   * abweicht.
   */
  const rasterAnlegen = () => {
    setFehler(null);
    editor.merkeStand();
    uebernehmeSchemata([
      ...schemataRef.current,
      ...ohneRaster.map((raum) => standardRaumschema(raum.raum, raum.plaetze)),
    ]);
    // Was gerade entstanden ist, will man auch sehen.
    if (ohneRaster.length > 0) reiterWechseln(ohneRaster[0].raum);
    setHinweis(`Raster angelegt für: ${ohneRaster.map((raum) => raum.raum).join(', ')}.`);
  };

  const rasterEntfernen = (raum: string) => {
    setHinweis(null);
    editor.merkeStand();
    uebernehmeSchemata(schemataRef.current.filter((schema) => schema.raum !== raum));
    reiterWechseln(REITER_RAEUME);
  };

  /** Die Platzzahl der Liste aus dem Raster übernehmen (Tische zählen). */
  const plaetzeUebernehmen = (schema: Raumschema) => {
    const tische = tischzellen(schema).length;
    uebernehmeZeilen(
      zeilen.map((zeile) =>
        zeile.raum.trim() === schema.raum ? { ...zeile, plaetzeText: String(tische) } : zeile,
      ),
    );
    setHinweis(`${schema.raum}: ${tische} Plätze aus dem Raster übernommen.`);
  };

  /**
   * Gibt es diesen Raum schon? Liste **und** Raster zählen: Beides zusammen
   * ist der Bestand, und die Raster liegen je Raum in einer Datei
   * (`94_E01.csv`), die sich sonst gegenseitig überschriebe.
   */
  const raumVergeben = (name: string) =>
    zeilen.some((zeile) => zeile.raum.trim() === name) ||
    schemata.some((schema) => schema.raum === name);

  /**
   * Ein neuer Raum – mit Raster, nicht nur als Zeile in der Liste: Wer „Neuer
   * Raum“ wählt, will ihn danach zeichnen und nicht erst noch „Fehlende Raster
   * anlegen“ suchen. Der Vorschlag kommt aus `standardRaumschema`.
   */
  const raumAnlegen = (name: string, plaetze: number) => {
    editor.merkeStand();
    uebernehmeZeilen([
      ...zeilenRef.current,
      { raum: name, plaetzeText: String(plaetze), reservierteZeit: '' },
    ]);
    uebernehmeSchemata([...schemataRef.current, standardRaumschema(name, plaetze)]);
    reiterWechseln(name);
    setHinweis(`Raum ${name} angelegt – Vorschlagsraster mit ${plaetze} Plätzen.`);
  };

  /**
   * Denselben Raum noch einmal, unter neuem Namen: Zwei Hörsäle sind sich
   * ähnlicher, als man denkt – ein Duplikat samt Raster ist schneller
   * angepasst als ein leerer Raum neu gezeichnet.
   */
  const raumDuplizieren = (alt: string, neu: string) => {
    editor.merkeStand();
    const quelle = zeilenRef.current.find((zeile) => zeile.raum.trim() === alt);
    uebernehmeZeilen([
      ...zeilenRef.current,
      quelle ? { ...quelle, raum: neu } : { raum: neu, plaetzeText: '', reservierteZeit: '' },
    ]);
    const schema = schemataRef.current.find((eintrag) => eintrag.raum === alt);
    if (schema) {
      uebernehmeSchemata([...schemataRef.current, kopiereRaumschema(schema, neu)]);
      reiterWechseln(neu);
    }
    setHinweis(`${neu} ist eine Kopie von ${alt}${schema ? ' samt Raster' : ' (ohne Raster)'}.`);
  };

  /**
   * Umbenennen heißt: Liste **und** Raster. Nur die Zeile zu ändern ließe das
   * Raster unter dem alten Namen im Ordner liegen – der Raum stünde ohne
   * Grundriss da, und in `Raeume/` läge eine Datei zu einem Raum, den es nicht
   * mehr gibt.
   */
  const raumUmbenennen = (alt: string, neu: string) => {
    editor.merkeStand();
    uebernehmeZeilen(
      zeilenRef.current.map((zeile) => (zeile.raum.trim() === alt ? { ...zeile, raum: neu } : zeile)),
    );
    uebernehmeSchemata(
      schemataRef.current.map((schema) =>
        schema.raum === alt ? kopiereRaumschema(schema, neu) : schema,
      ),
    );
    editor.benenneUm(alt, neu);
    if (reiter === alt) setReiter(neu);
    setHinweis(`${alt} heißt jetzt ${neu}.`);
  };

  /** Raum und Raster zusammen aus dem Bestand nehmen – ein Rückgängig holt beides zurück. */
  const raumLoeschen = (raum: string) => {
    editor.merkeStand();
    uebernehmeZeilen(zeilenRef.current.filter((zeile) => zeile.raum.trim() !== raum));
    uebernehmeSchemata(schemataRef.current.filter((schema) => schema.raum !== raum));
    reiterWechseln(REITER_RAEUME);
    setHinweis(`Raum ${raum} gelöscht – Rückgängig holt ihn samt Raster zurück.`);
  };

  /**
   * Eine Änderung in der Raumliste. Wird dabei ein Raum **umbenannt**, wandert
   * sein Raster mit: Der Name im Feld ist der Raum, nicht nur eine
   * Beschriftung. Zeilen kommen und gehen hier nicht – dafür gibt es „Neuer
   * Raum“ und „Löschen“, die auch das Raster anfassen.
   */
  const zeilenGeaendert = (neu: RaumZeile[]) => {
    if (neu.length === zeilenRef.current.length) {
      const umbenannt = neu
        .map((zeile, i) => ({ alt: zeilenRef.current[i].raum.trim(), neu: zeile.raum.trim() }))
        .filter((paar) => paar.alt !== '' && paar.neu !== '' && paar.alt !== paar.neu)
        // Nicht auf einen Namen umbenennen, den ein anderes Raster schon trägt –
        // sonst lägen zwei Raster unter derselben Datei in `Raeume/`.
        .filter((paar) => !schemataRef.current.some((schema) => schema.raum === paar.neu));
      if (umbenannt.length > 0) {
        uebernehmeSchemata(
          schemataRef.current.map((schema) => {
            const paar = umbenannt.find((eintrag) => eintrag.alt === schema.raum);
            return paar ? kopiereRaumschema(schema, paar.neu) : schema;
          }),
        );
        for (const paar of umbenannt) {
          editor.benenneUm(paar.alt, paar.neu);
          if (reiter === paar.alt) setReiter(paar.neu);
        }
      }
    }
    uebernehmeZeilen(neu);
  };

  /**
   * Den Raumplan als PDF – gezeichnet von derselben Funktion wie in Schritt 4
   * (`sitzplaenePdf`), nur ohne Belegung: Hier ist der Raum das Ergebnis, nicht
   * wer darin sitzt. Je Raum eine Datei, denn hier arbeitet man an einem Raum
   * und will genau dessen Plan ausdrucken oder weitergeben.
   */
  const planAlsPdf = async (schema: Raumschema) => {
    setFehler(null);
    setHinweis(null);
    setPdfLaeuft(true);
    try {
      const pdf = await sitzplaenePdf([
        {
          schema,
          titel: schema.raum,
          untertitel: `${tischzellen(schema).length} Sitzplätze`,
          // Gedruckt wird, was am Bildschirm steht – samt Drehung und „Pult“.
          drehungen: editor.drehungen[schema.raum] ?? 0,
          anzeige: ANZEIGE_RAUMPLANUNG,
        },
      ]);
      downloadFile(`${raumDateiname(schema.raum)}.pdf`, pdf, 'application/pdf');
      setHinweis(`Raumplan ${schema.raum} als PDF gespeichert.`);
    } catch (e) {
      setFehler(`Der Raumplan konnte nicht als PDF erzeugt werden: ${String(e)}`);
    } finally {
      setPdfLaeuft(false);
    }
  };

  const raeumeSpeichern = () => {
    const csv = raeumeToCsv(raeume);
    downloadCsv('raeume.csv', csv);
    projekt.schreibe('raeume.csv', csv, 'raeume');
    setHinweis('Raumliste heruntergeladen – im Projekt liegt sie ohnehin schon.');
  };

  /**
   * Die Raster speichern – je Raum eine Datei, benannt nach dem Raum. Im
   * Projekt ersetzen sie den bisherigen Bestand: Wer ein Raster entfernt hat,
   * will die Datei danach nicht mehr im Ordner haben.
   */
  const schemaSpeichern = async () => {
    const dateien = raumschemaDateien(schemata);
    projekt.ersetze('raumschema', dateien);
    const namen = [...dateien.keys()];
    if (namen.length === 1) {
      downloadCsv(namen[0], dateien.get(namen[0]) ?? '');
    } else {
      // Mehrere Dateien auf einmal lässt der Browser nicht herunterladen –
      // deshalb als ZIP, entpackt liegen sie direkt richtig.
      const inhalte = new Map<string, Uint8Array | string>(
        [...dateien].map(([name, csv]) => [`Raeume/${name}`, csv]),
      );
      downloadZip('raumschema.zip', await erstelleZip(inhalte));
    }
    setHinweis(`Raster heruntergeladen (${namen.join(', ')}) – im Projekt liegen sie ohnehin schon.`);
  };

  /** Plätze laut Liste je Raum – zum Abgleich mit den Tischen im Raster. */
  const plaetzeJeRaum = new Map<string, number>(raeume.map((raum) => [raum.raum, raum.plaetze]));

  /** Stimmt die Platzzahl der Liste mit den Tischen im Raster überein? */
  const plaetzeVergleich = (schema: Raumschema): string => {
    const laut = plaetzeJeRaum.get(schema.raum);
    if (laut === undefined) return 'nicht in der Raumliste';
    const tische = tischzellen(schema).length;
    return laut === tische ? `${laut} Plätze` : `Liste: ${laut} Plätze – weicht ab`;
  };

  const projektEintrag = useProjektDownloadEintrag(setFehler, 'raeume-projekt-download');

  /**
   * Das Menüband: „Datei“, „Werkzeuge“ und „Räume“ – wie die Menüleiste einer
   * Tabellenkalkulation. Was es zu tun gibt, steht hier als Beschreibung;
   * ob daraus ein herunterklappendes Menü wird oder auf dem Handy eine
   * Schublade, entscheidet `Menueleiste`.
   *
   * „Werkzeuge“ gibt es nur mit offenem Raum: Ohne Plan wäre jeder Eintrag
   * darin grau.
   */
  const menus: MenuGruppe[] = [
    {
      titel: 'Datei',
      testID: 'raeume-menue-datei',
      eintraege: [
        { art: 'trenner', titel: 'Speichern' },
        {
          art: 'aktion',
          titel: 'Räume als CSV speichern',
          hinweis: 'die Raumliste als Raeume/raeume.csv',
          onWaehlen: raeumeSpeichern,
          testID: 'raeume-speichern',
        },
        {
          art: 'aktion',
          titel: 'Raster als CSV speichern',
          hinweis: 'je Raum eine Datei in Raeume/',
          deaktiviert: schemata.length === 0,
          onWaehlen: schemaSpeichern,
          testID: 'raeume-schema-speichern',
        },
        {
          art: 'aktion',
          titel: pdfLaeuft ? 'PDF läuft …' : 'Raumplan als PDF',
          hinweis: aktivesSchema
            ? `der Grundriss von ${aktivesSchema.raum}`
            : 'erst einen Raum öffnen',
          deaktiviert: pdfLaeuft || !aktivesSchema,
          onWaehlen: () => aktivesSchema && planAlsPdf(aktivesSchema),
          testID: 'raeume-plan-pdf',
        },
        { art: 'trenner', titel: 'Laden' },
        {
          art: 'datei',
          titel: 'Räume-CSV laden',
          accept: '.csv',
          onDateien: raeumeLaden,
          testID: 'raeume-csv-laden',
        },
        {
          art: 'datei',
          titel: 'Raumschema-CSVs laden',
          hinweis: 'mehrere auf einmal – je Raum eine Datei',
          accept: '.csv',
          mehrere: true,
          onDateien: schemaLaden,
          testID: 'raeume-schema-laden',
        },
        {
          art: 'aktion',
          titel: 'Beispieldaten laden',
          onWaehlen: beispielLaden,
          testID: 'raeume-beispiel',
        },
        { art: 'trenner', titel: 'Projekt' },
        projektEintrag,
      ],
    },
    ...(aktivesSchema
      ? [
          {
            titel: 'Werkzeuge',
            // Welches Werkzeug gerade malt, steht hinter dem Namen – in einer
            // Knopfreihe war es die hervorgehobene Kachel.
            wert: werkzeugTitel(editor),
            testID: 'raeume-menue-werkzeuge',
            eintraege: [
              { art: 'trenner', titel: 'Palette' } as MenuEintrag,
              ...paletteEintraege(editor),
              ...rasterEintraege(editor, aktivesSchema.raum, true),
            ],
          },
        ]
      : []),
    {
      titel: 'Räume',
      wert: aktivesSchema ? aktivesSchema.raum : 'Liste',
      testID: 'raeume-menue-raeume',
      eintraege: [
        {
          art: 'aktion',
          titel: 'Raumliste',
          hinweis: 'Bestand des Hauses bearbeiten',
          gewaehlt: !aktivesSchema,
          onWaehlen: () => reiterWechseln(REITER_RAEUME),
          testID: 'raeume-reiter-liste',
        },
        { art: 'trenner', titel: 'Raumpläne' },
        ...schemata.map(
          (schema): MenuEintrag => ({
            art: 'aktion',
            titel: schema.raum,
            hinweis: `${tischzellen(schema).length} Sitzplätze`,
            gewaehlt: schema.raum === offenerReiter,
            onWaehlen: () => reiterWechseln(schema.raum),
            testID: `raeume-waehlen-${schema.raum}`,
          }),
        ),
        { art: 'trenner', titel: 'Bestand' },
        {
          art: 'aktion',
          titel: 'Neuer Raum …',
          hinweis: 'Name und Plätze – mit Vorschlagsraster',
          onWaehlen: () => setzeVorgang({ art: 'neu' }),
          testID: 'raeume-neu',
        },
        ohneRaster.length > 0 &&
          ({
            art: 'aktion',
            titel: 'Fehlende Raster anlegen',
            hinweis: ohneRaster.map((raum) => raum.raum).join(', '),
            onWaehlen: rasterAnlegen,
            testID: 'raeume-raster-anlegen-menue',
          } as MenuEintrag),
        aktivesSchema && ({ art: 'trenner', titel: aktivesSchema.raum } as MenuEintrag),
        aktivesSchema &&
          ({
            art: 'aktion',
            titel: 'Raum duplizieren …',
            hinweis: 'dasselbe Raster unter neuem Namen',
            onWaehlen: () => setzeVorgang({ art: 'duplizieren', raum: aktivesSchema.raum }),
            testID: 'raeume-duplizieren',
          } as MenuEintrag),
        aktivesSchema &&
          ({
            art: 'aktion',
            titel: 'Raum umbenennen …',
            hinweis: 'Liste und Raster wandern mit',
            onWaehlen: () => setzeVorgang({ art: 'umbenennen', raum: aktivesSchema.raum }),
            testID: 'raeume-umbenennen',
          } as MenuEintrag),
        aktivesSchema &&
          ({
            art: 'aktion',
            titel: 'Plätze übernehmen',
            hinweis: 'die Tische des Rasters in die Raumliste',
            deaktiviert: !plaetzeJeRaum.has(aktivesSchema.raum),
            onWaehlen: () => plaetzeUebernehmen(aktivesSchema),
            testID: `raeume-plaetze-${aktivesSchema.raum}`,
          } as MenuEintrag),
        aktivesSchema &&
          ({
            art: 'aktion',
            titel: 'Raster entfernen',
            hinweis: 'der Raum bleibt in der Liste, nur der Grundriss geht',
            onWaehlen: () => rasterEntfernen(aktivesSchema.raum),
            testID: `raeume-raster-entfernen-${aktivesSchema.raum}`,
          } as MenuEintrag),
        aktivesSchema &&
          ({
            art: 'aktion',
            titel: 'Raum löschen …',
            hinweis: 'Raum und Raster aus dem Bestand',
            onWaehlen: () => setzeVorgang({ art: 'loeschen', raum: aktivesSchema.raum }),
            testID: 'raeume-loeschen',
          } as MenuEintrag),
      ],
    },
  ];

  /**
   * Links in der Fußleiste – die Statuszeile: erst die Meldung, dann der Stand.
   * Beides nebeneinander, damit ein „Beispieldaten geladen“ nicht dauerhaft
   * verdeckt, wie groß das Raster gerade ist.
   */
  const fussText = [
    fehler,
    fehler ? null : hinweis,
    aktivesSchema
      ? `${plaetzeVergleich(aktivesSchema)} · ${rasterText(editor, aktivesSchema)} · ${PALETTEN_HINWEIS_ZEILE}`
      : `${schemata.length} Raster · ${raeume.filter((raum) => raum.raum !== '').length} Räume in der Liste`,
  ]
    .filter((teil): teil is string => !!teil)
    .join(' · ');

  return (
    <>
      <Arbeitsflaeche
        kopf={<Menueleiste menus={menus} testID="raeume-menue" />}
        fuss={
          <PlanFuss
            editor={editor}
            text={fussText}
            ansichtZeigen={aktivesSchema !== null}
            testID="raeume-fuss"
          />
        }
        testID="Raeume-screen"
      >
        {(hoehe) =>
          aktivesSchema ? (
            <RaumplanBuehne
              key={aktivesSchema.raum}
              editor={editor}
              schema={aktivesSchema}
              hoehe={hoehe}
              anzeige={ANZEIGE_RAUMPLANUNG}
              bearbeiten
            />
          ) : (
            <Reiterinhalt testID="raeume-liste">
              <Section title="Räume">
                <Text style={styles.hinweis}>
                  Bestand des Hauses – gilt für jede Klausur. Liegt in{' '}
                  <Text style={styles.pfad}>Raeume/</Text>, je Raum eine Raster-Datei
                  (<Text style={styles.pfad}>94_E01.csv</Text>). Wer welchen Raum benutzt: Schritt 4.
                </Text>
                <RaumListe
                  zeilen={zeilen}
                  onChange={zeilenGeaendert}
                  hinzufuegenTitel="Leere Zeile hinzufügen"
                  // Löschen fragt nach: Mit dem Raum geht sein Raster.
                  onEntfernen={(index) => {
                    const name = zeilen[index].raum.trim();
                    if (name === '') return zeilenGeaendert(zeilen.filter((_, j) => j !== index));
                    setzeVorgang({ art: 'loeschen', raum: name });
                  }}
                  aktionen={(zeile) => {
                    const name = zeile.raum.trim();
                    if (name === '') return null;
                    const hatRaster = schemata.some((schema) => schema.raum === name);
                    return (
                      <>
                        <AppButton
                          title="Plan"
                          variant="secondary"
                          onPress={() => reiterWechseln(name)}
                          disabled={!hatRaster}
                          testID={`raeume-plan-${name}`}
                        />
                        <AppButton
                          title="Duplizieren"
                          variant="secondary"
                          onPress={() => setzeVorgang({ art: 'duplizieren', raum: name })}
                          testID={`raeume-duplizieren-${name}`}
                        />
                      </>
                    );
                  }}
                />
                <Text style={styles.hinweis}>
                  Der Name im Feld ist der Raum: Wird er geändert, wandert sein Raster mit. „Plan“
                  öffnet den Grundriss, „Duplizieren“ legt ihn unter neuem Namen daneben,
                  „Entfernen“ nimmt Raum und Raster aus dem Bestand. Einen ganz neuen Raum legt
                  „Neuer Raum …“ im Menü „Räume“ an – mit Vorschlagsraster.
                </Text>
                <ProjektQuelle rolle="raeume" testID="raeume-quelle-raeume" />
                <ProjektQuelle rolle="raumschema" alle testID="raeume-quelle-schema" />
                {ohneRaster.length > 0 ? (
                  <>
                    <StatusText kind="info" testID="raeume-ohne-raster">
                      {`Noch ohne Raster: ${ohneRaster.map((raum) => raum.raum).join(', ')}`}
                    </StatusText>
                    <AppButton
                      title="Fehlende Raster anlegen"
                      onPress={rasterAnlegen}
                      testID="raeume-raster-anlegen"
                    />
                  </>
                ) : null}
                {schemata.length === 0 ? (
                  <StatusText kind="info">
                    Noch kein Raster geladen – oben Räume eintragen und „Fehlende Raster anlegen“
                    wählen, Raumschema-CSVs laden oder die Beispieldaten nehmen.
                  </StatusText>
                ) : (
                  <Text style={styles.hinweis}>
                    Im Menü „Räume“ steht jeder Raumplan – bearbeitet wird einer nach dem anderen,
                    gespeichert werden alle. Reserve: Tisch bleibt frei, ohne Nummer. Nur für diese
                    Klausur: Schritt 4.
                  </Text>
                )}
                {fehler ? <StatusText kind="error">{fehler}</StatusText> : null}
                {hinweis ? (
                  <StatusText kind="info" testID="raeume-hinweis">
                    {hinweis}
                  </StatusText>
                ) : null}
              </Section>
            </Reiterinhalt>
          )
        }
      </Arbeitsflaeche>
      {vorgang ? (
        <RaumVorgangBlatt
          // Ein neuer Vorgang beginnt mit leeren Feldern, nicht mit denen von vorhin.
          key={`${vorgang.art}-${'raum' in vorgang ? vorgang.raum : ''}`}
          vorgang={vorgang}
          raumVergeben={raumVergeben}
          onSchliessen={() => setzeVorgang(null)}
          onName={(name, plaetze) => {
            setzeVorgang(null);
            if (vorgang.art === 'neu') raumAnlegen(name, plaetze);
            else if (vorgang.art === 'duplizieren') raumDuplizieren(vorgang.raum, name);
            else if (vorgang.art === 'umbenennen') raumUmbenennen(vorgang.raum, name);
          }}
          onLoeschen={() => {
            setzeVorgang(null);
            if (vorgang.art === 'loeschen') raumLoeschen(vorgang.raum);
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  pfad: { fontWeight: '600', color: colors.text },
});
