import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useResponsiveLayout } from '../responsive';
import { colors, radius, spacing } from '../theme';

export interface Column {
  key: string;
  title: string;
}

interface Props {
  columns: Column[];
  rows: Record<string, string | number>[];
  /** Hinweis, wenn keine Zeilen vorhanden sind. */
  emptyText?: string;
  testID?: string;
}

/**
 * Einfache Tabelle für Ergebnislisten. Die Zellenbreite richtet sich nach dem
 * Fenster; passt die Tabelle nicht in die Breite, scrollt sie horizontal.
 */
export function DataTable({ columns, rows, emptyText, testID }: Props) {
  const { cellMinWidth } = useResponsiveLayout();
  if (rows.length === 0) {
    return emptyText ? <Text style={styles.empty}>{emptyText}</Text> : null;
  }
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsHorizontalScrollIndicator
      testID={testID}
    >
      <View style={styles.table}>
        <View style={[styles.row, styles.headerRow]}>
          {columns.map((col) => (
            <Text key={col.key} style={[styles.cell, { flexBasis: cellMinWidth }, styles.headerCell]}>
              {col.title}
            </Text>
          ))}
        </View>
        {rows.map((row, i) => (
          <View key={i} style={[styles.row, i % 2 === 1 && styles.zebra]}>
            {columns.map((col) => (
              <Text key={col.key} style={[styles.cell, { flexBasis: cellMinWidth }]}>
                {String(row[col.key] ?? '')}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  // Schmale Tabellen füllen die volle Breite, breite scrollen horizontal.
  scrollContent: { minWidth: '100%' },
  table: { flexGrow: 1, minWidth: '100%' },
  row: { flexDirection: 'row' },
  headerRow: { backgroundColor: colors.background },
  zebra: { backgroundColor: '#fafbfc' },
  cell: {
    // Gleiche Basis in jeder Zeile => Spalten bleiben untereinander bündig.
    flexGrow: 1,
    flexShrink: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    fontSize: 14,
    color: colors.text,
  },
  headerCell: { fontWeight: '700' },
  empty: { fontSize: 14, color: colors.textMuted },
});
