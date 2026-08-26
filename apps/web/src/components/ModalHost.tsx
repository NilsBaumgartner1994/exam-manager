import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createPortal } from 'react-dom';

/**
 * Der Platz, an dem alle Blätter erscheinen: eine Fläche ganz oben **in** der
 * App-Shell.
 *
 * Vorbild ist der `ModalProvider`/`ModalRenderer` von rocket-meals: Ein Modal
 * ist dort kein eigenes Fenster des Browsers, sondern eine Ebene über der App
 * (`StyleSheet.absoluteFill` + `zIndex`), die der Renderer an der Wurzel
 * zeichnet. Der Inhalt bleibt im React-Baum bei dem Screen, der ihn öffnet –
 * nur im DOM landet er in dieser Fläche.
 *
 * Warum nicht `Modal` aus React Native: Im Web hängt es sich als eigenes
 * `div` an den `body` – **außerhalb** von `#root` und damit außerhalb der
 * App-Shell, die genau so hoch ist wie der sichtbare Bereich
 * (`src/webLayout.ts`). Was dort liegt, gehorcht den Regeln der Shell nicht:
 * Der Browser fängt an, die Seite selbst zu scrollen, statt im ScrollView des
 * Screens zu bleiben, und der Fokusfang des Modals holt beim Schließen den
 * vorherigen Knopf zurück ins Bild – die Seite springt. In der Shell kann das
 * nicht passieren: Dort gibt es keine Seite, die scrollen könnte.
 *
 * Der Provider gehört genau einmal um die ganze App (siehe `App.tsx`).
 */
const ModalKontext = createContext<HTMLElement | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  /**
   * Der DOM-Knoten der Fläche. Als Zustand (nicht als Ref), damit die Blätter
   * ein zweites Mal zeichnen, sobald er steht – beim ersten Durchlauf gibt es
   * ihn noch nicht.
   */
  const [flaeche, setzeFlaeche] = useState<HTMLElement | null>(null);

  /**
   * Geisterklicks abfangen.
   *
   * Auf dem Touchgerät schickt der Browser nach dem Loslassen noch einen
   * `click` hinterher – auf das Element, das dann an dieser Stelle liegt. Ein
   * Tippen in den Plan öffnet aber genau dort ein Blatt: Der Klick trifft die
   * frisch gezeichnete Fläche dahinter und schließt es sofort wieder (oder,
   * schlimmer, drückt einen Knopf darin, den niemand angetippt hat).
   *
   * Die Regel dagegen kommt ohne Zeitfenster aus: Ein echter Klick in der
   * Ebene beginnt mit einem `pointerdown` **in** der Ebene. Fehlt das, gehört
   * der Klick zu einer Geste, die woanders begonnen hat – der wird geschluckt.
   */
  useEffect(() => {
    if (!flaeche) return;
    let hierGedrueckt = false;
    const gedrueckt = () => {
      hierGedrueckt = true;
    };
    const geklickt = (ereignis: MouseEvent) => {
      if (hierGedrueckt) {
        hierGedrueckt = false;
        return;
      }
      ereignis.stopPropagation();
      ereignis.preventDefault();
    };
    flaeche.addEventListener('pointerdown', gedrueckt, true);
    flaeche.addEventListener('click', geklickt, true);
    return () => {
      flaeche.removeEventListener('pointerdown', gedrueckt, true);
      flaeche.removeEventListener('click', geklickt, true);
    };
  }, [flaeche]);

  return (
    <ModalKontext.Provider value={flaeche}>
      {/* Die App bleibt, wie sie ist: eine Spalte, die den Viewport füllt. */}
      <View style={styles.app}>{children}</View>
      {/*
        Die Ebene für die Blätter liegt darüber. `box-none` heißt: Sie selbst
        fängt keine Klicks – nur, was ein Blatt hineinzeichnet. Solange nichts
        offen ist, ist sie also nicht da.
      */}
      <View
        ref={(knoten) => setzeFlaeche((knoten as unknown as HTMLElement | null) ?? null)}
        style={styles.ebene}
        pointerEvents="box-none"
      />
    </ModalKontext.Provider>
  );
}

/**
 * Ein Blatt in die Modal-Ebene zeichnen. Ohne Provider (oder im ersten
 * Durchlauf, bevor die Fläche steht) kommt `null` zurück – dann zeichnet das
 * Blatt noch nichts und beim nächsten Durchlauf erscheint es.
 */
export function useModalEbene(inhalt: ReactNode): ReactNode {
  const flaeche = useContext(ModalKontext);
  if (!flaeche || inhalt === null) return null;
  return createPortal(inhalt, flaeche);
}

const styles = StyleSheet.create({
  app: { flex: 1, minHeight: 0, width: '100%' },
  /**
   * Über der App, aber innerhalb der Shell: absolut über den ganzen Bereich,
   * nicht `position: fixed` am Fenster. Deshalb bleibt sie auch dann genau so
   * hoch wie der sichtbare Bereich, wenn auf dem Handy die Browserleisten
   * ein- und ausfahren.
   */
  ebene: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100 },
});
