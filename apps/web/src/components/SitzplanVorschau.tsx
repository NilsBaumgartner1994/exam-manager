import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  PlanAnzeige,
  Raum,
  Raumschema,
  raumSchluessel,
  Sitzplanung,
  Sitzplatz,
} from '@exam-manager/core';
import { PLAN_ANSICHT, Raumplan } from './Raumplan';
import { StatusText } from './StatusText';
import { colors, spacing } from '../theme';

/** Höhe eines Vorschauplans – groß genug zum Erkennen, klein genug für mehrere. */
const VORSCHAU_HOEHE = 320;

interface Props {
  /** Das gerechnete Ergebnis (`planeSitzplan`) – noch nicht übernommen. */
  planung: Sitzplanung;
  /** Die Räume dieser Klausur, für Titel und Blickrichtung. */
  raeume: Raum[];
  /** Raster der Einsätze (`einsatzRaster`) – der Name ist der Raumschlüssel. */
  raster: Raumschema[];
  /** Drehung der Ansicht je **Raum** (aus dem Editor). */
  drehungen: Record<string, number>;
  anzeige: PlanAnzeige;
  testID?: string;
}

/**
 * Wie die Plätze verteilt **würden** – die Vorschau unter den Einstellungen.
 *
 * Sie rechnet nichts selbst: `planeSitzplan` liefert die Belegung, hier steht
 * nur das Bild dazu. So sieht man beim Umschalten der Verteilungsart sofort,
 * wo die Leute säßen, statt erst zu verteilen, dann in die Raumreiter zu
 * wechseln und im Zweifel wieder zurück.
 *
 * Gezeigt wird ein Plan je Raumeinsatz, in dem jemand sitzt; leer bleibende
 * Räume stehen als Zeile darunter – bei „Räume nacheinander füllen“ sind das
 * schnell drei von fünf, und fünf leere Pläne sagen weniger als eine Zeile.
 */
export function SitzplanVorschau({
  planung,
  raeume,
  raster,
  drehungen,
  anzeige,
  testID,
}: Props) {
  const personen = useMemo(
    () => new Map<string, Sitzplatz>(planung.sitzplaetze.map((platz) => [platz.matrikelnummer, platz])),
    [planung],
  );
  const belegungJeRaum = useMemo(() => {
    const gruppen = new Map<string, typeof planung.belegung>();
    for (const platz of planung.belegung) {
      const liste = gruppen.get(platz.raum);
      if (liste) liste.push(platz);
      else gruppen.set(platz.raum, [platz]);
    }
    return gruppen;
  }, [planung]);

  /** Blickrichtung gehört zum Raum, die Belegung zum Einsatz. */
  const raumNameJeSchluessel = new Map(raeume.map((raum) => [raumSchluessel(raum), raum.raum]));
  const benutzte = planung.raeume.filter((einsatz) => einsatz.belegt > 0);
  const leere = planung.raeume.filter((einsatz) => einsatz.belegt === 0);

  if (planung.raeume.length === 0) {
    return (
      <StatusText kind="info" testID={testID}>
        Noch kein Raster – Räume hinzufügen oder in Schritt 5 anlegen.
      </StatusText>
    );
  }

  return (
    <View style={styles.aussen} testID={testID}>
      {benutzte.map((einsatz) => {
        const schema = raster.find((eintrag) => eintrag.raum === einsatz.schluessel);
        if (!schema) return null;
        const raumName = raumNameJeSchluessel.get(einsatz.schluessel) ?? einsatz.raum;
        return (
          <View key={einsatz.schluessel} style={styles.raum}>
            <Text style={styles.ueberschrift}>
              {einsatz.schluessel}
              {einsatz.reservierteZeit ? ` · ${einsatz.reservierteZeit}` : ''} ·{' '}
              {einsatz.belegt} von {einsatz.plaetze} Plätzen
              {einsatz.freigehalten > 0 ? ` · ${einsatz.freigehalten} freigehalten` : ''}
            </Text>
            <Raumplan
              schema={schema}
              schluessel={einsatz.schluessel}
              drehungen={drehungen[raumName] ?? 0}
              belegung={belegungJeRaum.get(einsatz.schluessel) ?? []}
              nummern={planung.nummern}
              personen={personen}
              anzeige={anzeige}
              ansicht={PLAN_ANSICHT}
              hoehe={VORSCHAU_HOEHE}
              testID={`vorschau-plan-${einsatz.schluessel}`}
            />
          </View>
        );
      })}
      {leere.length > 0 ? (
        <Text style={styles.hinweis} testID="vorschau-leer">
          {`Bleibt leer: ${leere.map((einsatz) => einsatz.schluessel).join(', ')}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  aussen: { gap: spacing.md },
  raum: { gap: spacing.xs },
  ueberschrift: { fontSize: 15, fontWeight: '600', color: colors.text },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
