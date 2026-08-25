import { ViewProps } from 'react-native';

/**
 * React Native Web macht aus der Eigenschaft `dataSet` echte
 * `data-*`-Attribute im DOM. Im React-Native-Typ gibt es sie nicht – daher
 * dieser eng begrenzte Cast an einer Stelle statt verstreuter Casts.
 *
 * Gebraucht wird das für Dinge, die außerhalb von React am DOM ansetzen:
 * Seitenumbrüche im Druck-CSS und das Finden der Zelle unter dem Finger beim
 * Ablegen eines Elements aus der Palette.
 */
export function datenAttribute(werte: Record<string, string>): ViewProps {
  return { dataSet: werte } as unknown as ViewProps;
}
