import { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { AppButton } from './AppButton';

interface Props {
  offen: boolean;
  titel: string;
  /** Zweite Zeile unter dem Titel, z. B. die Adresse der Zelle. */
  untertitel?: string;
  onSchliessen: () => void;
  children: ReactNode;
  testID?: string;
}

/**
 * Ein Blatt, das von unten hereinfährt und die volle Breite einnimmt.
 *
 * Für Entscheidungen an einer Stelle des Plans: Der Plan bleibt im oberen
 * Fünftel sichtbar, damit klar ist, worum es geht, und alles Weitere steht
 * groß genug darunter – auch auf einem Tablet, wo ein kleines Menü neben dem
 * Finger nicht zu treffen wäre.
 *
 * Ein Tippen daneben schließt: Das ist die Geste, die man von einem solchen
 * Blatt erwartet, und sie ist auf dem Touchgerät leichter zu treffen als ein
 * kleines Kreuz in der Ecke (das es trotzdem gibt).
 */
export function BlattModal({ offen, titel, untertitel, onSchliessen, children, testID }: Props) {
  return (
    <Modal visible={offen} transparent animationType="slide" onRequestClose={onSchliessen}>
      <View style={styles.hintergrund}>
        <Pressable style={styles.freiflaeche} onPress={onSchliessen} testID={testID ? `${testID}-hintergrund` : undefined} />
        <View style={styles.blatt} testID={testID}>
          <View style={styles.griff} />
          <View style={styles.kopf}>
            <View style={styles.kopfText}>
              <Text style={styles.titel} testID={testID ? `${testID}-titel` : undefined}>
                {titel}
              </Text>
              {untertitel ? <Text style={styles.untertitel}>{untertitel}</Text> : null}
            </View>
            <AppButton
              title="Schließen"
              variant="secondary"
              onPress={onSchliessen}
              testID={testID ? `${testID}-schliessen` : undefined}
            />
          </View>
          <ScrollView style={styles.scroller} contentContainerStyle={styles.inhalt}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hintergrund: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  freiflaeche: { flex: 1 },
  // Vier Fünftel der Höhe: genug für eine Namensliste, und der Plan darüber
  // bleibt zu sehen.
  blatt: {
    height: '80%',
    width: '100%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  griff: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  kopf: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  kopfText: { flexShrink: 1, gap: 2 },
  titel: { fontSize: 18, fontWeight: '700', color: colors.text },
  untertitel: { fontSize: 13, color: colors.textMuted },
  scroller: { flex: 1 },
  inhalt: { gap: spacing.sm, paddingBottom: spacing.lg },
});
