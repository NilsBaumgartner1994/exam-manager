import { ViewProps } from 'react-native';

/**
 * Drucken bzw. „Als PDF sichern“ im Browser.
 *
 * Statt ein eigenes PDF-Layout zu bauen, wird die **sichtbare Ansicht**
 * ausgegeben: Der DOM-Knoten des Views wird geklont, zusammen mit den
 * Stylesheets der Seite in ein eigenes Dokument gepackt und über den
 * Druckdialog des Browsers gedruckt – dort lässt sich „Als PDF sichern“
 * wählen. Derselbe Aufbau wie im Speiseplan-Druck von rocket-meals.
 *
 * Die Daten verlassen den Rechner dabei nicht: Das Dokument entsteht als
 * Blob-URL im selben Browser.
 */

/**
 * Marker für „im Druck hier eine neue Seite beginnen“, als Props für einen
 * View: `<View {...SEITENUMBRUCH}>`.
 *
 * React Native Web macht daraus `data-print-break="true"`; im RN-Typ gibt es
 * `dataSet` nicht, deshalb der Cast.
 */
export const SEITENUMBRUCH = { dataSet: { printBreak: 'true' } } as unknown as ViewProps;

function stylesheetsDerSeite(): string {
  return Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules ?? [])
          .map((rule) => rule.cssText)
          .join('\n');
      } catch {
        // Fremde Stylesheets (andere Herkunft) lassen sich nicht auslesen.
        return '';
      }
    })
    .join('\n');
}

const DRUCK_CSS = `
  @page { size: A4 portrait; margin: 12mm; }
  body {
    background: #ffffff !important;
    margin: 0;
    /* Die App begrenzt Höhe und Scrollen – im Druck soll alles sichtbar sein. */
    height: auto !important;
    overflow: visible !important;
  }
  body * {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  [data-print-break="true"] { break-before: page; page-break-before: always; }
  [data-print-break="true"]:first-of-type { break-before: auto; page-break-before: auto; }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  tr, [data-print-keep="true"] { break-inside: avoid !important; page-break-inside: avoid !important; }
`;

/**
 * Den Inhalt eines Views drucken. Gibt `false` zurück, wenn der Browser das
 * Fenster blockiert hat (Popup-Blocker) – dann sollte die App einen Hinweis
 * zeigen.
 */
export function druckeAnsicht(knoten: HTMLElement | null, titel: string): boolean {
  if (typeof document === 'undefined' || knoten === null) return false;

  const inhalt = (knoten.cloneNode(true) as HTMLElement).outerHTML;
  const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <title>${titel.replace(/[<>&]/g, '')}</title>
    <base href="${document.baseURI}">
    <style>${stylesheetsDerSeite()}</style>
    <style>${DRUCK_CSS}</style>
  </head>
  <body>
    ${inhalt}
    <script>
      window.onload = function () {
        var drucken = function () { window.print(); };
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(drucken, drucken);
        } else {
          drucken();
        }
      };
    </script>
  </body>
</html>`;

  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const fenster = window.open(url, '_blank');
  if (!fenster) {
    URL.revokeObjectURL(url);
    return false;
  }
  fenster.addEventListener('load', () => URL.revokeObjectURL(url));
  return true;
}
