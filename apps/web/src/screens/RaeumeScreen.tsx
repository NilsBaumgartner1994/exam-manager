import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  erstelleZip,
  parseRaeume,
  PLAN_ANZEIGE_STANDARD,
  parseRaumschemaDateien,
  Raum,
  raeumeToCsv,
  Raumschema,
  raumschemaDateien,
  standardRaumschema,
  tischzellen,
} from '@exam-manager/core';
import {
  AppButton,
  FilePickerButton,
  PlanLeiste,
  ProjektDownload,
  ProjektQuelle,
  RaumListe,
  RaumPalette,
  RaumplanFlaeche,
  RaumplanKarte,
  raumZuZeile,
  ScreenContainer,
  Section,
  StatusText,
  useRaumplanEditor,
  zeileZuRaum,
  type RaumZeile,
} from '../components';
import { downloadCsv, downloadZip, readFileAsText } from '../files';
import { useProjekt } from '../projekt';
import { useResponsiveLayout } from '../responsive';
import { BEISPIEL_RAEUME, BEISPIEL_RAUMSCHEMATA } from '../sampleData';
import { colors, spacing } from '../theme';

/**
 * Beim Einrichten eines Raums zählen die Möbel, nicht die Namen: Das Pult wird
 * hier beschriftet (in Schritt 4 stünde „Pult“ nur im Weg).
 */
const ANZEIGE_RAUMPLANUNG = { ...PLAN_ANZEIGE_STANDARD, pultText: true };

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
 * Bearbeitet wird immer **ein** Raum: Oben steht die Liste der Räume, darunter
 * der Plan des gewählten. Nebeneinander sind ein Hörsaal mit 44 × 32 Feldern
 * und vier weitere Räume nicht zu überblicken – und man bearbeitet ohnehin
 * einen nach dem anderen.
 */
export function RaeumeScreen() {
  const [zeilen, setZeilen] = useState<RaumZeile[]>([]);
  const [schemata, setSchemata] = useState<Raumschema[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  /** Welcher Raum gerade bearbeitet wird (Name); `null` = der erste. */
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

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
  const { isCompact } = useResponsiveLayout();

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
   * Raster wurde entfernt, andere Dateien geladen) – dann rückt der erste
   * Raum nach, statt dass gar nichts mehr zu sehen ist.
   */
  const aktiverRaum =
    schemata.find((schema) => schema.raum === gewaehlt)?.raum ?? schemata[0]?.raum ?? null;
  const aktivesSchema = schemata.find((schema) => schema.raum === aktiverRaum) ?? null;

  const raumWechseln = (raum: string) => {
    setGewaehlt(raum);
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
    if (ohneRaster.length > 0) setGewaehlt(ohneRaster[0].raum);
    setHinweis(`Raster angelegt für: ${ohneRaster.map((raum) => raum.raum).join(', ')}.`);
  };

  const rasterEntfernen = (raum: string) => {
    setHinweis(null);
    editor.merkeStand();
    uebernehmeSchemata(schemataRef.current.filter((schema) => schema.raum !== raum));
    setGewaehlt(null);
    editor.setzeAuswahl(null);
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

  const kopfZusatz = (schema: Raumschema): string | undefined => {
    const laut = plaetzeJeRaum.get(schema.raum);
    if (laut === undefined) return 'nicht in der Raumliste';
    const tische = tischzellen(schema).length;
    return laut === tische ? `${laut} Plätze` : `Liste: ${laut} Plätze – weicht ab`;
  };

  return (
    <ScreenContainer
      title="5. Räume & Raumpläne"
      intro="Räume und ihre leeren Raster pflegen – ohne Teilnehmende. Was hier entsteht, gilt für jede Klausur: Schritt 4 legt nur noch die Belegung darüber."
      testID="Raeume-screen"
    >
      <Section title="Räume">
        <Text style={styles.hinweis}>
          Bestand des Hauses – gilt für jede Klausur. Liegt in{' '}
          <Text style={styles.pfad}>Raeume/</Text>. Wer welchen Raum benutzt: Schritt 4.
        </Text>
        <RaumListe zeilen={zeilen} onChange={setZeilen} />
        <View style={styles.buttonZeile}>
          <FilePickerButton label="Räume-CSV laden" accept=".csv" onFiles={raeumeLaden} />
          <AppButton
            title="Beispieldaten laden"
            variant="secondary"
            onPress={beispielLaden}
            testID="raeume-beispiel"
          />
        </View>
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
        {fehler ? <StatusText kind="error">{fehler}</StatusText> : null}
        {hinweis ? <StatusText kind="info" testID="raeume-hinweis">{hinweis}</StatusText> : null}
      </Section>

      <Section title="Raumpläne" testID="raeume-plaene">
        {/* Kurz halten: Wer hier arbeitet, will den Plan sehen, nicht lesen.
            Das Ausführliche steht in der README. */}
        <Text style={styles.hinweis}>Ein Raum nach dem anderen. Gespeichert werden alle.</Text>
        <Text style={styles.hinweis}>
          Reserve: Tisch bleibt frei, ohne Nummer. Nur für diese Klausur: Schritt 4.
        </Text>

        {schemata.length === 0 || !aktivesSchema ? (
          <StatusText kind="info">
            Noch kein Raster geladen – oben Räume eintragen und „Fehlende Raster anlegen“ wählen,
            Raumschema-CSVs laden oder die Beispieldaten nehmen.
          </StatusText>
        ) : (
          <>
            {/* Welcher Raum bearbeitet wird: einer nach dem anderen, sonst
                ist neben einem Hörsaal mit 44 × 32 Feldern nichts zu sehen. */}
            <View style={styles.buttonZeile} testID="raeume-auswahl">
              <Text style={styles.hinweis}>Raum:</Text>
              {schemata.map((schema) => (
                <AppButton
                  key={schema.raum}
                  title={`${schema.raum} (${tischzellen(schema).length})`}
                  variant={schema.raum === aktiverRaum ? 'primary' : 'secondary'}
                  kompakt={isCompact}
                  onPress={() => raumWechseln(schema.raum)}
                  testID={`raeume-waehlen-${schema.raum}`}
                />
              ))}
            </View>

            <PlanLeiste editor={editor} />
            <RaumplanFlaeche palette={<RaumPalette editor={editor} testID="raeume-palette" />}>
              <RaumplanKarte
                key={aktivesSchema.raum}
                editor={editor}
                schema={aktivesSchema}
                anzeige={ANZEIGE_RAUMPLANUNG}
                bearbeiten
                kopfZusatz={kopfZusatz(aktivesSchema)}
                knoepfe={
                  <>
                    <AppButton
                      title="Plätze übernehmen"
                      variant="secondary"
                      kompakt={isCompact}
                      onPress={() => plaetzeUebernehmen(aktivesSchema)}
                      disabled={!plaetzeJeRaum.has(aktivesSchema.raum)}
                      testID={`raeume-plaetze-${aktivesSchema.raum}`}
                    />
                    <AppButton
                      title="Raster entfernen"
                      variant="secondary"
                      kompakt={isCompact}
                      onPress={() => rasterEntfernen(aktivesSchema.raum)}
                      testID={`raeume-raster-entfernen-${aktivesSchema.raum}`}
                    />
                  </>
                }
              />
            </RaumplanFlaeche>
          </>
        )}
      </Section>

      <Section title="Speichern">
        <Text style={styles.hinweis}>
          Ziel: <Text style={styles.pfad}>Raeume/</Text>, je Raum eine Datei (
          <Text style={styles.pfad}>94_E01.csv</Text>). Mehrere Räume: als ZIP.
        </Text>
        <View style={styles.buttonZeile}>
          <AppButton title="Räume als CSV speichern" onPress={raeumeSpeichern} testID="raeume-speichern" />
          <AppButton
            title="Raster als CSV speichern"
            onPress={schemaSpeichern}
            disabled={schemata.length === 0}
            testID="raeume-schema-speichern"
          />
        </View>
        <FilePickerButton label="Raumschema-CSVs laden" accept=".csv" multiple onFiles={schemaLaden} />
        <ProjektDownload hinweis="Raumliste und Raster liegen in Raeume/." testID="raeume-projekt-download" />
      </Section>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  buttonZeile: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  pfad: { fontWeight: '600', color: colors.text },
});
