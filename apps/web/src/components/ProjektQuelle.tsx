import { DateiRolle, PROJEKT_ORDNER, ROLLEN_TITEL } from '@exam-manager/core';
import { useProjekt } from '../projekt';
import { StatusText } from './StatusText';

interface Props {
  rolle: DateiRolle;
  /** Der Schritt nutzt alle Dateien dieser Rolle, nicht nur die erste. */
  alle?: boolean;
  testID?: string;
}

const basisname = (pfad: string) => pfad.split('/').pop() ?? pfad;

/**
 * Zeigt an, welche Datei aus dem Projektordner ein Schritt standardmäßig
 * verwendet – und welche nicht.
 *
 * Ohne diese Zeile bleibt unklar, woher die Daten kommen: Der Ordner kann
 * mehrere Dateien derselben Rolle enthalten (drei Jahreslisten, zwei
 * Notenlisten), und genutzt wird bei einer einzelnen Eingabe die erste in
 * alphabetischer Reihenfolge. Wer das sieht, merkt sofort, wenn die falsche
 * Datei am Zug wäre.
 *
 * Eine Auswahl von Hand (Knopf darüber) überschreibt die Vorgabe; welche Datei
 * das ist, steht unter dem Knopf.
 */
export function ProjektQuelle({ rolle, alle, testID }: Props) {
  const projekt = useProjekt();
  // Ohne geladenes Projekt gibt es keine Vorgabe, über die man reden könnte.
  if (projekt.ordner === null && projekt.dateien.length === 0) return null;

  const dateien = projekt.dateienMit(rolle);
  const ordner = PROJEKT_ORDNER[rolle] ?? '';

  if (dateien.length === 0) {
    return (
      <StatusText kind="info" testID={testID}>
        {`Im Projektordner liegt keine Datei „${ROLLEN_TITEL[rolle]}“ (erwartet in ${ordner}/) – hier von Hand auswählen.`}
      </StatusText>
    );
  }

  if (alle) {
    return (
      <StatusText kind="success" testID={testID}>
        {`Aus dem Projekt (${dateien.length}): ${dateien.map((datei) => datei.pfad).join(', ')}`}
      </StatusText>
    );
  }

  const weitere = dateien.slice(1);
  return (
    <StatusText kind="success" testID={testID}>
      {`Aus dem Projekt: ${dateien[0].pfad}` +
        (weitere.length > 0
          ? ` – nicht verwendet: ${weitere.map((datei) => basisname(datei.pfad)).join(', ')}`
          : '')}
    </StatusText>
  );
}
