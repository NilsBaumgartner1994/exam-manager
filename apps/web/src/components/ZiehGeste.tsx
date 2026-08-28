import { useRef, useState } from 'react';
import { PointerEvent, View } from 'react-native';

/** Ab dieser Strecke gilt es als Ziehen und nicht mehr als Tippen. */
const ZIEH_SCHWELLE = 6;

/**
 * Die Geste hinter einem Element der Palette: antippen wählt es als Werkzeug,
 * ziehen legt es direkt auf einer Zelle des Raumplans ab.
 *
 * Der Zeiger wird beim Drücken eingefangen (`setPointerCapture`), damit auch
 * mit dem Finger alle Ereignisse hier ankommen – ohne das Einfangen bliebe ein
 * Zug auf dem Touchgerät beim Startelement hängen bzw. würde die Seite
 * scrollen. Wo das Element landet, entscheidet deshalb die Koordinate beim
 * Loslassen (`document.elementFromPoint` im Editor), nicht das Ereignisziel.
 *
 * Als eigener Baustein, weil die Palette im Menü „Werkzeuge“ steht
 * (`Menueband`) und dieselbe Geste auch anderswo taugt: Die Geste ist die
 * Sache, das Aussehen nicht.
 */
export function useZiehGeste({
  onTippen,
  onZiehen,
  onAblegen,
}: {
  onTippen: () => void;
  onZiehen?: (x: number, y: number) => void;
  onAblegen?: (x: number, y: number) => void;
}) {
  const ref = useRef<View>(null);
  const [zieht, setzeZieht] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const knoten = () => ref.current as unknown as HTMLElement | null;

  const handler = {
    onPointerDown: (ereignis: PointerEvent) => {
      const { clientX, clientY, pointerId } = ereignis.nativeEvent;
      start.current = { x: clientX, y: clientY };
      setzeZieht(false);
      knoten()?.setPointerCapture?.(pointerId);
    },
    onPointerMove: (ereignis: PointerEvent) => {
      if (!start.current) return;
      const { clientX, clientY } = ereignis.nativeEvent;
      const weit =
        Math.abs(clientX - start.current.x) > ZIEH_SCHWELLE ||
        Math.abs(clientY - start.current.y) > ZIEH_SCHWELLE;
      if (!weit) return;
      if (!zieht) setzeZieht(true);
      onZiehen?.(clientX, clientY);
    },
    onPointerUp: (ereignis: PointerEvent) => {
      const { clientX, clientY, pointerId } = ereignis.nativeEvent;
      knoten()?.releasePointerCapture?.(pointerId);
      if (zieht) onAblegen?.(clientX, clientY);
      else onTippen();
      start.current = null;
      setzeZieht(false);
    },
    onPointerCancel: () => {
      start.current = null;
      setzeZieht(false);
    },
  };

  return { ref, zieht, handler };
}

/** Browser-Gesten (Scrollen, Textauswahl) während des Ziehens abschalten. */
export const ohneBrowserGeste = { touchAction: 'none', userSelect: 'none' } as unknown as object;
