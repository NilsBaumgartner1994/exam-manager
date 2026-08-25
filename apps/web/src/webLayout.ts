/**
 * Web-Layout der App: eine Seite, die genau den Viewport füllt.
 *
 * Aufbau wie in üblichen Expo-Apps (z. B. rocket-meals/score-tracker): Die
 * Wurzel ist so hoch wie das Fenster, die Kopfzeile steht fest darin, und
 * gescrollt wird im ScrollView des jeweiligen Screens. Deshalb darf – und
 * soll – das Dokument selbst nicht scrollen.
 *
 * Expo legt dafür bereits ein Reset-Stylesheet (`#expo-reset`) an:
 *
 *     html, body { height: 100%; }
 *     body       { overflow: hidden; }
 *     #root      { height: 100%; }
 *
 * Zwei Dinge fehlen dort für Tablets und Handys, und genau die ergänzen wir:
 *
 * - `100%` bezieht sich auf das Layout-Viewport. Auf iPad/iPhone ist das
 *   inklusive der ein- und ausblendenden Safari-Leisten – der untere Rand der
 *   App liegt dann außerhalb des sichtbaren Bereichs. `100dvh` misst den
 *   tatsächlich sichtbaren Bereich (Browser ohne dvh nehmen weiter die
 *   100 %-Regel davor).
 * - `overscroll-behavior: none` verhindert das Gummiband-Scrollen der Seite,
 *   das sonst über dem nicht scrollenden Dokument hängt.
 *
 * Wichtig: Wer hier auf Seiten-Scrollen zurückbaut (`overflow: visible`),
 * muss auch die Kopfzeile in `Router.tsx` und den ScrollView in
 * `ScreenContainer` umstellen – sonst scrollt am Ende gar nichts mehr.
 */
const STYLE_ID = 'exam-manager-css';

export function aktiviereAppLayout(): void {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
  }
  style.textContent = `
    html, body {
      height: 100%;
      height: 100dvh;
      overflow: hidden;
      overscroll-behavior: none;
    }
    #root {
      height: 100%;
      height: 100dvh;
      display: flex;
      overflow: hidden;
    }
  `;
  // Ans Ende des <head>, damit die Regeln nach #expo-reset stehen.
  document.head.appendChild(style);
}
