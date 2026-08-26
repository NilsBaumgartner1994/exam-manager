import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  parseRaeume,
  parseRaumschemata,
  Raum,
  raeumeToCsv,
  Raumschema,
  raumschemataToCsv,
  standardRaumschema,
  tischzellen,
} from '@exam-manager/core';
import {
  AppButton,
  FilePickerButton,
  PlanZoomLeiste,
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
import { downloadCsv, readFileAsText } from '../files';
import { useProjekt } from '../projekt';
import { BEISPIEL_RAEUME, BEISPIEL_RAUMSCHEMA } from '../sampleData';
import { colors, spacing } from '../theme';

/**
 * Schritt 5: Räume und ihre leeren Raster pflegen – ohne Studierende.
 *
 * Räume überleben die einzelne Klausur: Derselbe Hörsaal wird jedes Semester
 * wieder gebraucht, sein Grundriss ändert sich fast nie. Im Projektordner
 * liegen sie deshalb in `Raeume/`, außerhalb der nummerierten Schritt-Ordner,
 * und hier lassen sie sich bearbeiten, ohne vorher eine Teilnehmerliste zu
 * laden. Schritt 4 nimmt das Ergebnis als Vorlage und legt die Belegung
 * darüber.
 */
export function RaeumeScreen() {
  const [zeilen, setZeilen] = useState<RaumZeile[]>([]);
  const [schemata, setSchemata] = useState<Raumschema[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

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
    const schemaDatei = projekt.datei('raumschema');
    if (!raumDatei?.text && !schemaDatei?.text) return;
    try {
      if (raumDatei?.text) setZeilen(parseRaeume(raumDatei.text).map(raumZuZeile));
      if (schemaDatei?.text) uebernehmeSchemata(parseRaumschemata(schemaDatei.text));
    } catch (e) {
      setFehler(`Projektdateien konnten nicht gelesen werden: ${String(e)}`);
    }
  }, [projekt, zeilen, schemata]);

  const editor = useRaumplanEditor({
    schemata: schemataRef,
    aendere: (raum, wandel) =>
      uebernehmeSchemata(schemataRef.current.map((s) => (s.raum === raum ? wandel(s) : s))),
  });

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
    uebernehmeSchemata(parseRaumschemata(BEISPIEL_RAUMSCHEMA));
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

  const schemaLaden = async (files: File[]) => {
    setFehler(null);
    try {
      const geladen = parseRaumschemata(await readFileAsText(files[0]));
      uebernehmeSchemata(geladen);
      setHinweis(`${geladen.length} Raumschemata geladen.`);
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
    uebernehmeSchemata([
      ...schemataRef.current,
      ...ohneRaster.map((raum) => standardRaumschema(raum.raum, raum.plaetze)),
    ]);
    setHinweis(`Raster angelegt für: ${ohneRaster.map((raum) => raum.raum).join(', ')}.`);
  };

  const rasterEntfernen = (raum: string) => {
    setHinweis(null);
    uebernehmeSchemata(schemataRef.current.filter((schema) => schema.raum !== raum));
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
    setHinweis('Raumliste gespeichert – im Projekt unter Raeume/raeume.csv.');
  };

  const schemaSpeichern = () => {
    const csv = raumschemataToCsv(schemata);
    downloadCsv('raumschema.csv', csv);
    projekt.schreibe('raumschema.csv', csv, 'raumschema');
    setHinweis('Raster gespeichert – im Projekt unter Raeume/raumschema.csv.');
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
          Ein Raum überlebt die einzelne Klausur: Derselbe Hörsaal wird jedes Semester wieder
          gebraucht, sein Grundriss ändert sich fast nie. Im Projektordner liegen Raumliste und
          Raster deshalb zusammen in <Text style={styles.pfad}>Raeume/</Text>.
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
        <ProjektQuelle rolle="raumschema" testID="raeume-quelle-schema" />
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
        <Text style={styles.hinweis}>
          Ein Element aus der Palette auf eine Zelle ziehen setzt es dort; antippen wählt es aus und
          man malt damit im Plan. Mit „Auswählen“ verschiebst du einen Block, am blauen Griff an der
          unteren Ecke ziehst du ihn über mehrere Felder auf. Mit „Text“ (oder „Zellen verbinden“)
          entsteht über den ausgewählten Feldern ein Feld zum Reinschreiben.
        </Text>

        {schemata.length === 0 ? (
          <StatusText kind="info">
            Noch kein Raster geladen – oben Räume eintragen und „Fehlende Raster anlegen“ wählen,
            eine Raumschema-CSV laden oder die Beispieldaten nehmen.
          </StatusText>
        ) : (
          <>
            <PlanZoomLeiste editor={editor} />
            <RaumplanFlaeche palette={<RaumPalette editor={editor} testID="raeume-palette" />}>
              {schemata.map((schema) => (
                <RaumplanKarte
                  key={schema.raum}
                  editor={editor}
                  schema={schema}
                  bearbeiten
                  kopfZusatz={kopfZusatz(schema)}
                  knoepfe={
                    <>
                      <AppButton
                        title="Plätze übernehmen"
                        variant="secondary"
                        onPress={() => plaetzeUebernehmen(schema)}
                        disabled={!plaetzeJeRaum.has(schema.raum)}
                        testID={`raeume-plaetze-${schema.raum}`}
                      />
                      <AppButton
                        title="Raster entfernen"
                        variant="secondary"
                        onPress={() => rasterEntfernen(schema.raum)}
                        testID={`raeume-raster-entfernen-${schema.raum}`}
                      />
                    </>
                  }
                />
              ))}
            </RaumplanFlaeche>
          </>
        )}
      </Section>

      <Section title="Speichern">
        <Text style={styles.hinweis}>
          Beides landet im Projektordner unter <Text style={styles.pfad}>Raeume/</Text> und wird
          zusätzlich heruntergeladen – Schritt 4 findet es dort beim nächsten Laden wieder.
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
        <FilePickerButton label="Raumschema-CSV laden" accept=".csv" onFiles={schemaLaden} />
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
