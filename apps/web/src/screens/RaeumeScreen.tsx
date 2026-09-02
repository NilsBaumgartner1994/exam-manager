import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  erstelleZip,
  kopiereRaumschema,
  PLAN_ANZEIGE_STANDARD,
  parseRaumschemaDateien,
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
  RaumBestandListe,
  RaumplanBuehne,
  Reiterinhalt,
  Section,
  StatusText,
  useProjektDownloadEintrag,
  useRaumplanEditor,
  werkzeugTitel,
  type MenuEintrag,
  type MenuGruppe,
} from '../components';
import { downloadCsv, downloadFile, downloadZip, readFileAsText } from '../files';
import { useProjekt } from '../projekt';
import { BEISPIEL_RAUMSCHEMATA } from '../sampleData';
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

  const projekt = useProjekt();

  // Eingaben aus dem Projektordner, solange nichts eigenes geladen wurde.
  useEffect(() => {
    if (schemata.length > 0) return;
    // Je Raum eine Datei: Gelesen werden alle, nicht nur die erste. Mehr gibt
    // es zum Bestand nicht – der Ordner ist die Raumliste.
    const schemaTexte = projekt
      .dateienMit('raumschema')
      .map((datei) => datei.text ?? '')
      .filter((text) => text !== '');
    if (schemaTexte.length === 0) return;
    try {
      uebernehmeSchemata(parseRaumschemaDateien(schemaTexte));
    } catch (e) {
      setFehler(`Projektdateien konnten nicht gelesen werden: ${String(e)}`);
    }
  }, [projekt, schemata]);

  /**
   * Änderungen wandern gleich in den Projektstand – und damit in den
   * Browserspeicher. Ein Neuladen soll nichts kosten: Vorher war ein Raster
   * erst dann sicher, wenn jemand „Raster als CSV speichern“ gedrückt hatte.
   * Gebündelt (400 ms), sonst schriebe ein Malzug bei jeder Zelle alle Räume
   * neu; die Knöpfe bleiben für den Download.
   */
  const { ersetze: projektErsetze } = projekt;
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

  const editor = useRaumplanEditor({
    schemata: schemataRef,
    aendere: (raum, wandel) =>
      uebernehmeSchemata(schemataRef.current.map((s) => (s.raum === raum ? wandel(s) : s))),
    // Ein Raum ist sein Raster: Anlegen, Umbenennen und Löschen fassen genau
    // das an – ein Schritt zurück holt es als Ganzes wieder.
    zustand: () => ({ schemata: schemataRef.current }),
    setzeZustand: (stand) => uebernehmeSchemata(stand.schemata),
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

  /**
   * Der Bestand für die Liste: je Raum sein Raster, und daraus die Zahl seiner
   * Sitzplätze. Eine zweite Liste daneben gibt es nicht – der Ordner
   * `Raeume/` ist die Liste.
   */
  const bestand = useMemo(
    () => schemata.map((schema) => ({ raum: schema.raum, sitzplaetze: tischzellen(schema).length })),
    [schemata],
  );

  const beispielLaden = () => {
    setFehler(null);
    uebernehmeSchemata(parseRaumschemaDateien(Object.values(BEISPIEL_RAUMSCHEMATA)));
    setHinweis('Beispieldaten geladen.');
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
   * Gibt es diesen Raum schon? Die Raster liegen je Raum in einer Datei
   * (`94_E01.csv`), die sich sonst gegenseitig überschriebe.
   */
  const raumVergeben = (name: string) => schemata.some((schema) => schema.raum === name);

  /**
   * Ein neuer Raum – das heißt: ein Raster. Die Plätze im Blatt sind nur der
   * Vorschlag, mit dem `standardRaumschema` zeichnet (Tische in
   * Zweierblöcken mit Gang, Pult vorne, Tür hinten); die Plätze des Raums
   * sind danach die Tische, die wirklich im Plan stehen.
   */
  const raumAnlegen = (name: string, plaetze: number) => {
    editor.merkeStand();
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
    const schema = schemataRef.current.find((eintrag) => eintrag.raum === alt);
    if (!schema) return;
    uebernehmeSchemata([...schemataRef.current, kopiereRaumschema(schema, neu)]);
    reiterWechseln(neu);
    setHinweis(`${neu} ist eine Kopie von ${alt} samt Raster.`);
  };

  /**
   * Umbenennen heißt: Das Raster wandert mit. Es liegt unter dem Namen des
   * Raums in `Raeume/` – bliebe die Datei stehen, gäbe es den Raum zweimal:
   * einmal unter dem alten und einmal unter dem neuen Namen.
   */
  const raumUmbenennen = (alt: string, neu: string) => {
    editor.merkeStand();
    uebernehmeSchemata(
      schemataRef.current.map((schema) =>
        schema.raum === alt ? kopiereRaumschema(schema, neu) : schema,
      ),
    );
    editor.benenneUm(alt, neu);
    if (reiter === alt) setReiter(neu);
    setHinweis(`${alt} heißt jetzt ${neu}.`);
  };

  /** Den Raum samt Raster aus dem Bestand nehmen – ein Rückgängig holt ihn zurück. */
  const raumLoeschen = (raum: string) => {
    editor.merkeStand();
    uebernehmeSchemata(schemataRef.current.filter((schema) => schema.raum !== raum));
    reiterWechseln(REITER_RAEUME);
    setHinweis(`Raum ${raum} gelöscht – Rückgängig holt ihn samt Raster zurück.`);
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

  /** Wie viele Plätze der offene Raum hat: die Tische in seinem Raster. */
  const plaetzeText = (schema: Raumschema): string => `${tischzellen(schema).length} Plätze`;

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
          hinweis: 'Bestand des Hauses',
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
          hinweis: 'Name und Plätze des Vorschlagsrasters',
          onWaehlen: () => setzeVorgang({ art: 'neu' }),
          testID: 'raeume-neu',
        },
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
            hinweis: 'das Raster wandert mit',
            onWaehlen: () => setzeVorgang({ art: 'umbenennen', raum: aktivesSchema.raum }),
            testID: 'raeume-umbenennen',
          } as MenuEintrag),
        aktivesSchema &&
          ({
            art: 'aktion',
            titel: 'Raum löschen …',
            hinweis: 'der Raum samt Raster aus dem Bestand',
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
      ? `${plaetzeText(aktivesSchema)} · ${rasterText(editor, aktivesSchema)} · ${PALETTEN_HINWEIS_ZEILE}`
      : `${schemata.length} Räume im Bestand · ${bestand.reduce((summe, raum) => summe + raum.sitzplaetze, 0)} Plätze`,
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
                  Bestand des Hauses – gilt für jede Klausur. Er liegt in{' '}
                  <Text style={styles.pfad}>Raeume/</Text>, je Raum eine Raster-Datei
                  (<Text style={styles.pfad}>94_E01.csv</Text>): Der Ordner ist die Raumliste.
                  Wie viele Plätze ein Raum hat, wird nirgends gespeichert – es sind die Tische
                  in seinem Raster, und wer hier einen setzt oder entfernt, ändert damit die
                  Platzzahl. Wer welchen Raum benutzt: Schritt 4.
                </Text>
                <RaumBestandListe
                  eintraege={bestand}
                  onPlan={reiterWechseln}
                  onUmbenennen={(raum) => setzeVorgang({ art: 'umbenennen', raum })}
                  onDuplizieren={(raum) => setzeVorgang({ art: 'duplizieren', raum })}
                  // Löschen fragt nach: Mit dem Raum geht sein Raster.
                  onEntfernen={(raum) => setzeVorgang({ art: 'loeschen', raum })}
                />
                <AppButton
                  title="Neuer Raum …"
                  onPress={() => setzeVorgang({ art: 'neu' })}
                  testID="raeume-neu-liste"
                />
                {bestand.length === 0 ? null : (
                  <Text style={styles.hinweis}>
                    „Plan bearbeiten“ öffnet den Grundriss, „Duplizieren …“ legt den Raum samt
                    Raster unter neuem Namen daneben, „Entfernen“ nimmt ihn aus dem Bestand. Der
                    Name läuft über „Umbenennen …“, damit das Raster mitwandert – es liegt unter
                    diesem Namen in <Text style={styles.pfad}>Raeume/</Text>.
                  </Text>
                )}
                <ProjektQuelle rolle="raumschema" alle testID="raeume-quelle-schema" />
                {schemata.length === 0 ? (
                  <StatusText kind="info">
                    Noch kein Raster geladen – „Neuer Raum …“ legt einen mit Vorschlagsraster an,
                    „Raumschema-CSVs laden“ holt vorhandene herein, und die Beispieldaten zeigen,
                    wie es aussieht.
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
