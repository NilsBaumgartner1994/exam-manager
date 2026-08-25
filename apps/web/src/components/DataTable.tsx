import { ScrollView, StyleSheet, Text, View } from 'react-native';
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

/** Einfache Tabelle für Ergebnislisten. */
export function DataTable({ columns, rows, emptyText, testID }: Props) {
  if (rows.length === 0) {
    return emptyText ? <Text style={styles.empty}>{emptyText}</Text> : null;
  }
  return (
    <ScrollView horizontal style={styles.scroll} testID={testID}>
      <View>
        <View style={[styles.row, styles.headerRow]}>
          {columns.map((col) => (
            <Text key={col.key} style={[styles.cell, styles.headerCell]}>{col.title}</Text>
          ))}
        </View>
        {rows.map((row, i) => (
          <View key={i} style={[styles.row, i % 2 === 1 && styles.zebra]}>
            {columns.map((col) => (
              <Text key={col.key} style={styles.cell}>{String(row[col.key] ?? '')}</Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row' },
  headerRow: { backgroundColor: colors.background },
  zebra: { backgroundColor: '#fafbfc' },
  cell: {
    minWidth: 140,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    fontSize: 14,
    color: colors.text,
  },
  headerCell: { fontWeight: '700' },
  empty: { fontSize: 14, color: colors.textMuted },
});
