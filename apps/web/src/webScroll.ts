/**
 * Seiten-Scrollen im Web wiederherstellen.
 *
 * Expo legt im Web ein Reset-Stylesheet (`#expo-reset`) an:
 *
 *     html, body { height: 100%; }
 *     body       { overflow: hidden; }   // "disable body scrolling if you are using <ScrollView>"
 *     #root      { height: 100%; }
 *
 * Das ist für Apps gedacht, deren Inhalt komplett in einem höhenbegrenzten
 * ScrollView steckt. `overflow: hidden` am Body überträgt sich aber auf den
 * Viewport: Die Seite selbst lässt sich dann weder per Touch noch mit dem
 * Mausrad scrollen. Genau das war auf dem iPad zu sehen – lange Seiten hingen
 * fest. Nur programmatisches `window.scrollTo` funktionierte noch, weshalb der
 * Maestro-Flow trotzdem grün war.
 *
 * Deshalb: Höhe frei wachsen lassen und das Scrollen an die Seite zurückgeben.
 * Der ScrollView der Screens bleibt dadurch höhenoffen und stört nicht; er
 * greift nur dort, wo die Höhe wirklich begrenzt ist (native Plattformen).
 */
const STYLE_ID = 'exam-manager-css';

export function aktiviereSeitenScrollen(): void {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
  }
  style.textContent = `
    html, body {
      height: auto !important;
      min-height: 100%;
      overflow: visible !important;
      -webkit-overflow-scrolling: touch;
    }
    #root {
      height: auto !important;
      /* dvh berücksichtigt die ein-/ausblendende Safari-Leiste auf iPad/iPhone */
      min-height: 100vh;
      min-height: 100dvh;
      overflow: visible !important;
    }
  `;
  // Ans Ende des <head>, damit die Regeln nach #expo-reset stehen.
  document.head.appendChild(style);
}
