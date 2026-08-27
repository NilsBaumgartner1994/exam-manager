import { useRef, useState } from 'react';
import { PointerEvent, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface Props {
  titel: string;
  /** Kurze Erklärung unter dem Titel (z. B. das Zeichen in der CSV). */
  untertitel?: string;
  /**
   * Nur der Titel, kleiner und schmaler – für die Werkzeugleiste im Vollbild,
   * wo zehn Elemente in eine Zeile passen müssen.
   */
  kompakt?: boolean;
  aktiv?: boolean;
  /** Angetippt (ohne Ziehen): Element als Werkzeug wählen. */
  onTippen: () => void;
  /** Während des Ziehens – Bildschirmkoordinaten des Fingers/Zeigers. */
  onZiehen?: (x: number, y: number) => void;
  /** Losgelassen – hier wird das Element abgelegt. */
  onAblegen?: (x: number, y: number) => void;
  testID?: string;
}

/** Ab dieser Strecke gilt es als Ziehen und nicht mehr als Tippen. */
const ZIEH_SCHWELLE = 6;

/**
 * Ein Element der seitlichen Palette: antippen wählt es als Werkzeug, ziehen
 * legt es direkt auf einer Zelle des Raumplans ab.
 *
 * Der Zeiger wird beim Drücken eingefangen (`setPointerCapture`), damit auch
 * mit dem Finger alle Ereignisse hier ankommen – ohne das Einfangen bliebe ein
 * Zug auf dem Touchgerät beim Startelement hängen bzw. würde die Seite
 * scrollen. Wo das Element landet, entscheidet deshalb die Koordinate beim
 * Loslassen, nicht das Ereignisziel.
 */
export function PaletteElement({ titel, untertitel, kompakt, aktiv, onTippen, onZiehen, onAblegen, testID }: Props) {
  const ref = useRef<View>(null);
  const [zieht, setZieht] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const knoten = () => ref.current as unknown as HTMLElement | null;

  const pointerDown = (ereignis: PointerEvent) => {
    const { clientX, clientY, pointerId } = ereignis.nativeEvent;
    start.current = { x: clientX, y: clientY };
    setZieht(false);
    knoten()?.setPointerCapture?.(pointerId);
  };

  const pointerMove = (ereignis: PointerEvent) => {
    if (!start.current) return;
    const { clientX, clientY } = ereignis.nativeEvent;
    const weit =
      Math.abs(clientX - start.current.x) > ZIEH_SCHWELLE ||
      Math.abs(clientY - start.current.y) > ZIEH_SCHWELLE;
    if (!weit) return;
    if (!zieht) setZieht(true);
    onZiehen?.(clientX, clientY);
  };

  const pointerUp = (ereignis: PointerEvent) => {
    const { clientX, clientY, pointerId } = ereignis.nativeEvent;
    knoten()?.releasePointerCapture?.(pointerId);
    if (zieht) onAblegen?.(clientX, clientY);
    else onTippen();
    start.current = null;
    setZieht(false);
  };

  return (
    <View
      ref={ref}
      accessibilityRole="button"
      testID={testID}
      style={[
        styles.element,
        kompakt && styles.elementKompakt,
        aktiv && styles.aktiv,
        zieht && styles.zieht,
        ohneBrowserGeste,
      ]}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={() => {
        start.current = null;
        setZieht(false);
      }}
    >
      <Text style={[styles.titel, kompakt && styles.titelKompakt, aktiv && styles.titelAktiv]}>
        {titel}
      </Text>
      {untertitel && !kompakt ? (
        <Text style={[styles.untertitel, aktiv && styles.untertitelAktiv]}>{untertitel}</Text>
      ) : null}
    </View>
  );
}

/** Browser-Gesten (Scrollen, Textauswahl) während des Ziehens abschalten. */
const ohneBrowserGeste = { touchAction: 'none', userSelect: 'none' } as unknown as object;

const styles = StyleSheet.create({
  element: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 96,
  },
  elementKompakt: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, minWidth: 0 },
  aktiv: { backgroundColor: colors.primary },
  zieht: { opacity: 0.6 },
  titel: { fontSize: 15, fontWeight: '600', color: colors.primary },
  titelKompakt: { fontSize: 13 },
  titelAktiv: { color: colors.primaryText },
  untertitel: { fontSize: 12, color: colors.textMuted },
  untertitelAktiv: { color: colors.primaryText },
});
