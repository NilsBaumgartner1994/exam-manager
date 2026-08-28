import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  erstelleZip,
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
  Aktionsleiste,
  AppButton,
  Arbeitsflaeche,
  FilePickerButton,
  PALETTEN_HINWEIS_ZEILE,
  PalettenLeiste,
  PlanFuss,
  PlanWerkzeugKnoepfe,
  ProjektDownload,
  ProjektQuelle,
  rasterText,
  RaumListe,
  RaumplanBuehne,
  raumZuZeile,
  Reiterinhalt,
  Reiterleiste,
  Section,
  StatusText,
  useRaumplanEditor,
  zeileZuRaum,
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
 * oben das Menüband (Datei, Reiter, Werkzeuge), unten die Fußleiste mit
 * Ansicht und Meldungen, dazwischen nichts als der Plan in voller Breite. Ein
 * Reiter je Raum – bearbeitet wird immer **einer**: Nebeneinander sind ein
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
      if (raumDatei?.text) setZeilen(parseRaeume(raumDatei.text).map(raumZuZeile));
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
    // Hier hängt nur das Raster am Plan – ein Schritt zurück ist also genau
    // der Stand der Raster von davor.
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
    setZeilen(parseRaeume(BEISPIEL_RAEUME).map(raumZuZeile));
    uebernehmeSchemata(parseRaumschemaDateien(Object.values(BEISPIEL_RAUMSCHEMATA)));
    setHinweis('Beispieldaten geladen.');
  };

  const raeumeLaden = async (files: File[]) => {
    setFehler(null);
    try {
      setZeilen(parseRaeume(await readFileAsText(files[0])).map(raumZuZeile));
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
    setZeilen(
      zeilen.map((zeile) =>
        zeile.raum.trim() === schema.raum ? { ...zeile, plaetzeText: String(tische) } : zeile,
      ),
    );
    setHinweis(`${schema.raum}: ${tische} Plätze aus dem Raster übernommen.`);
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

  const kopf = (
    <>
      <Aktionsleiste titel="Datei" testID="raeume-datei">
        <AppButton
          title="Räume als CSV speichern"
          variant="secondary"
          kompakt
          onPress={raeumeSpeichern}
          testID="raeume-speichern"
        />
        <AppButton
          title="Raster als CSV speichern"
          variant="secondary"
          kompakt
          onPress={schemaSpeichern}
          disabled={schemata.length === 0}
          testID="raeume-schema-speichern"
        />
        <AppButton
          title={pdfLaeuft ? 'PDF läuft …' : 'Raumplan als PDF'}
          variant="secondary"
          kompakt
          onPress={() => aktivesSchema && planAlsPdf(aktivesSchema)}
          disabled={pdfLaeuft || !aktivesSchema}
          testID="raeume-plan-pdf"
        />
        <FilePickerButton label="Räume-CSV laden" accept=".csv" kompakt onFiles={raeumeLaden} />
        <FilePickerButton
          label="Raumschema-CSVs laden"
          accept=".csv"
          multiple
          kompakt
          onFiles={schemaLaden}
        />
        <AppButton
          title="Beispieldaten laden"
          variant="secondary"
          kompakt
          onPress={beispielLaden}
          testID="raeume-beispiel"
        />
        <ProjektDownload kompakt testID="raeume-projekt-download" />
      </Aktionsleiste>

      <Reiterleiste
        reiter={[
          { key: REITER_RAEUME, titel: 'Räume', testID: 'raeume-reiter-liste' },
          ...schemata.map((schema) => ({
            key: schema.raum,
            titel: `${schema.raum} (${tischzellen(schema).length})`,
            testID: `raeume-waehlen-${schema.raum}`,
          })),
        ]}
        aktiv={offenerReiter}
        onWaehlen={reiterWechseln}
        testID="raeume-reiter"
      />

      {aktivesSchema ? (
        <Aktionsleiste titel="Raum" testID="raeume-werkzeuge">
          <PalettenLeiste editor={editor} />
          <PlanWerkzeugKnoepfe editor={editor} raum={aktivesSchema.raum} bearbeiten />
          <AppButton
            title="Plätze übernehmen"
            variant="secondary"
            kompakt
            onPress={() => plaetzeUebernehmen(aktivesSchema)}
            disabled={!plaetzeJeRaum.has(aktivesSchema.raum)}
            testID={`raeume-plaetze-${aktivesSchema.raum}`}
          />
          <AppButton
            title="Raster entfernen"
            variant="secondary"
            kompakt
            onPress={() => rasterEntfernen(aktivesSchema.raum)}
            testID={`raeume-raster-entfernen-${aktivesSchema.raum}`}
          />
        </Aktionsleiste>
      ) : null}
    </>
  );

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
    <Arbeitsflaeche
      kopf={kopf}
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
              <RaumListe zeilen={zeilen} onChange={setZeilen} />
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
                  Ein Reiter je Raum – bearbeitet wird einer nach dem anderen, gespeichert werden
                  alle. Reserve: Tisch bleibt frei, ohne Nummer. Nur für diese Klausur: Schritt 4.
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
  );
}

const styles = StyleSheet.create({
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  pfad: { fontWeight: '600', color: colors.text },
});
