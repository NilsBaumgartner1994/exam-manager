/**
 * Responsives Layout für alle Screens.
 *
 * Grundsatz: keine festen Fensterbreiten. Alle Maße leiten sich aus der
 * aktuellen Fensterbreite ab – Ränder und Abstände wachsen mit, Inhalte
 * füllen die verfügbare Breite und Kachel-/Formularspalten brechen um,
 * statt an einer Pixelgrenze zu kleben.
 */
import { useWindowDimensions } from 'react-native';
import { spacing } from './theme';

/** Umbruchpunkte in Gerätebreite (px). */
export const breakpoints = {
  /** Handy hochkant */
  compact: 600,
  /** Tablet / schmales Fenster */
  medium: 900,
  /** Laptop */
  expanded: 1440,
};

export type Breakpoint = 'compact' | 'medium' | 'expanded' | 'wide';

export interface ResponsiveLayout {
  breakpoint: Breakpoint;
  isCompact: boolean;
  /** Seitenrand des Screens – wächst mit dem Fenster. */
  gutter: number;
  /** Abstand oben/unten. */
  gutterY: number;
  /** Abstand zwischen den Sections. */
  gap: number;
  /** Breite des Inhalts (prozentual, nie eine feste Pixelbreite). */
  contentWidth: `${number}%`;
  /** Maximale Breite von Formularfeldern – prozentual zur Section. */
  fieldMaxWidth: `${number}%`;
  /** Breite einer Kachel auf der Startseite (prozentual, Rest füllt flexGrow). */
  tileBasis: `${number}%`;
  titleFontSize: number;
  introFontSize: number;
  /** Mindestbreite einer Tabellenzelle; darunter scrollt die Tabelle horizontal. */
  cellMinWidth: number;
}

function breakpointFor(width: number): Breakpoint {
  if (width < breakpoints.compact) return 'compact';
  if (width < breakpoints.medium) return 'medium';
  if (width < breakpoints.expanded) return 'expanded';
  return 'wide';
}

/** Zahl auf ein Intervall begrenzen. */
function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(value, min), max));
}

/** Layout-Werte zu einer Fensterbreite – ohne Hook, damit testbar. */
export function layoutFor(width: number): ResponsiveLayout {
  const breakpoint = breakpointFor(width);
  const isCompact = breakpoint === 'compact';
  // Seitenrand als Anteil der Fensterbreite: schmale Fenster nutzen fast die
  // ganze Breite, große Monitore bekommen Luft am Rand.
  const gutter = clamp(width * 0.04, spacing.sm + 4, spacing.xl * 2);
  switch (breakpoint) {
    case 'compact':
      return {
        breakpoint,
        isCompact,
        gutter,
        gutterY: spacing.md,
        gap: spacing.md,
        contentWidth: '100%',
        fieldMaxWidth: '100%',
        tileBasis: '100%',
        titleFontSize: 22,
        introFontSize: 15,
        cellMinWidth: 104,
      };
    case 'medium':
      return {
        breakpoint,
        isCompact,
        gutter,
        gutterY: spacing.lg,
        gap: spacing.md,
        contentWidth: '100%',
        fieldMaxWidth: '80%',
        tileBasis: '46%',
        titleFontSize: 24,
        introFontSize: 15,
        cellMinWidth: 120,
      };
    case 'expanded':
      return {
        breakpoint,
        isCompact,
        gutter,
        gutterY: spacing.lg,
        gap: spacing.lg,
        contentWidth: '100%',
        fieldMaxWidth: '60%',
        tileBasis: '30%',
        titleFontSize: 26,
        introFontSize: 16,
        cellMinWidth: 140,
      };
    default:
      return {
        breakpoint,
        isCompact,
        gutter,
        gutterY: spacing.xl,
        gap: spacing.lg,
        contentWidth: '100%',
        fieldMaxWidth: '45%',
        tileBasis: '22%',
        titleFontSize: 30,
        introFontSize: 17,
        cellMinWidth: 150,
      };
  }
}

/** Aktuelles Layout; rechnet bei jeder Fenstergrößenänderung neu. */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width } = useWindowDimensions();
  return layoutFor(width);
}
