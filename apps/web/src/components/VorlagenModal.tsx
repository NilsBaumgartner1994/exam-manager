import { useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputSelectionChangeEventData,
  View,
} from 'react-native';
import {
  fuelleVorlage,
  MarkdownBlock,
  parseMarkdown,
  Platzhalter,
  TextStueck,
} from '@exam-manager/core';
import { colors, radius, spacing } from '../theme';
import { AppButton } from './AppButton';
import { BlattModal } from './BlattModal';

interface Props {
  offen: boolean;
  /** Überschrift des Blattes, z. B. „Text der Sitzplatz-PDFs“. */
  titel: string;
  /** Wofür die Vorlage gilt – zweite Zeile im Kopf. */
  untertitel?: string;
  /** Vorlage, wie sie gerade gilt. */
  vorlage: string;
  /** Anfangstext, auf den „Zurücksetzen“ zurückgeht. */
  standard: string;
  platzhalter: Platzhalter[];
  /** Werte für die Vorschau – die erste Person der Liste oder ein Beispiel. */
  werte: Record<string, string>;
  onSpeichern: (vorlage: string) => void;
  onSchliessen: () => void;
  testID?: string;
}

/** Schriftgröße der Vorschau – so groß wie der Fließtext im PDF wirkt. */
const VORSCHAU_GROESSE = 13;

/**
 * Den Text der erzeugten PDFs bearbeiten.
 *
 * Was in den Schreiben an Studierende steht, ändert sich jedes Semester. Statt
 * dafür den Quelltext anzufassen, steht der Text als Markdown-Vorlage hier:
 * links tippen, rechts (bzw. darunter) sofort sehen, was daraus wird –
 * einschließlich der eingesetzten Platzhalter.
 *
 * Die Vorschau ist keine PDF-Vorschau, sondern dieselbe Zerlegung, die auch
 * die PDF-Erzeugung benutzt (`parseMarkdown`). Was hier fett ist, ist es auch
 * auf dem Papier; die Zeilenumbrüche entscheidet dagegen erst das Blatt.
 */
export function VorlagenModal({
  offen,
  titel,
  untertitel,
  vorlage,
  standard,
  platzhalter,
  werte,
  onSpeichern,
  onSchliessen,
  testID,
}: Props) {
  const [text, setText] = useState(vorlage);
  // Wo der Cursor steht – ein Platzhalter soll dort landen, wo gerade
  // geschrieben wird, und nicht am Ende des Textes.
  const cursor = useRef({ start: vorlage.length, end: vorlage.length });

  // Beim Öffnen den gültigen Stand übernehmen: Wer abbricht und wieder
  // aufmacht, soll nicht seinen verworfenen Text vorfinden.
  useEffect(() => {
    if (!offen) return;
    setText(vorlage);
    cursor.current = { start: vorlage.length, end: vorlage.length };
  }, [offen, vorlage]);

  const bloecke = useMemo(() => parseMarkdown(fuelleVorlage(text, werte)), [text, werte]);

  const einfuegen = (name: string) => {
    const marke = `<${name}>`;
    const { start, end } = cursor.current;
    const neu = text.slice(0, start) + marke + text.slice(end);
    cursor.current = { start: start + marke.length, end: start + marke.length };
    setText(neu);
  };

  const merkeCursor = (
    ereignis: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) => {
    cursor.current = ereignis.nativeEvent.selection;
  };

  return (
    <BlattModal
      offen={offen}
      titel={titel}
      untertitel={untertitel}
      onSchliessen={onSchliessen}
      testID={testID}
    >
      <Text style={styles.hinweis}>
        Markdown: # Überschrift, **fett**, *kursiv*, - Aufzählung, --- Trennlinie. Jede Zeile
        beginnt eine neue Zeile, eine Leerzeile lässt Abstand.
      </Text>

      <View style={styles.platzhalterZeile}>
        {platzhalter.map((eintrag) => (
          <Pressable
            key={eintrag.name}
            style={({ pressed }) => [styles.platzhalterMarke, pressed && styles.markePressed]}
            accessibilityRole="button"
            accessibilityLabel={`${eintrag.name} einfügen – ${eintrag.beschreibung}`}
            onPress={() => einfuegen(eintrag.name)}
            testID={testID ? `${testID}-platzhalter-${eintrag.name}` : undefined}
          >
            <Text style={styles.markeText}>{`<${eintrag.name}>`}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hinweis}>
        Platzhalter anklicken, um ihn an der Cursorstelle einzufügen. Er wird je Person ersetzt;
        ein unbekannter Platzhalter bleibt im PDF stehen.
      </Text>

      <TextInput
        style={styles.eingabe}
        value={text}
        onChangeText={setText}
        onSelectionChange={merkeCursor}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        testID={testID ? `${testID}-eingabe` : undefined}
      />

      <Text style={styles.vorschauTitel}>
        {`Vorschau mit den Daten von ${werte.Vorname ?? ''} ${werte.Nachname ?? ''}`.trim()}
      </Text>
      <View style={styles.vorschau} testID={testID ? `${testID}-vorschau` : undefined}>
        {bloecke.map((block, i) => (
          <VorschauZeile key={i} block={block} />
        ))}
      </View>

      <View style={styles.knopfZeile}>
        <AppButton
          title="Übernehmen"
          onPress={() => {
            onSpeichern(text);
            onSchliessen();
          }}
          testID={testID ? `${testID}-speichern` : undefined}
        />
        <AppButton
          title="Auf Standardtext zurücksetzen"
          variant="secondary"
          onPress={() => setText(standard)}
          testID={testID ? `${testID}-zuruecksetzen` : undefined}
        />
      </View>
    </BlattModal>
  );
}

/** Eine Zeile der Vorschau – dieselben Blöcke wie im PDF. */
function VorschauZeile({ block }: { block: MarkdownBlock }) {
  const abstand = block.leerzeilenDavor * 0.5 * VORSCHAU_GROESSE;
  if (block.art === 'linie') {
    return <View style={[styles.trennlinie, { marginTop: abstand + 4, marginBottom: 4 }]} />;
  }
  const groesse = VORSCHAU_GROESSE * block.faktor;
  const oben = abstand + (block.art === 'ueberschrift' ? VORSCHAU_GROESSE * 0.5 : 0);
  const zeilenStil = { fontSize: groesse, lineHeight: groesse * 1.35, color: colors.text };
  const inhalt = block.stuecke.map((stueck, i) => (
    <Text key={i} style={stueckStil(stueck, block.fett)}>
      {stueck.text}
    </Text>
  ));

  // Aufzählungen mit hängendem Einzug wie im PDF: Die Marke steht links, die
  // Folgezeilen fluchten mit dem Text und nicht mit dem Strich.
  if (block.marke) {
    return (
      <View style={{ flexDirection: 'row', marginTop: oben }}>
        <Text style={[zeilenStil, styles.punktMarke]}>{block.marke}</Text>
        <Text style={[zeilenStil, styles.punktText]}>{inhalt}</Text>
      </View>
    );
  }
  return <Text style={[zeilenStil, { marginTop: oben }]}>{inhalt}</Text>;
}

function stueckStil(stueck: TextStueck, fettBlock: boolean) {
  return {
    fontWeight: (stueck.fett || fettBlock ? '700' : '400') as '400' | '700',
    fontStyle: (stueck.kursiv ? 'italic' : 'normal') as 'italic' | 'normal',
  };
}

const styles = StyleSheet.create({
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  platzhalterZeile: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  platzhalterMarke: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  markePressed: { opacity: 0.6 },
  markeText: { fontSize: 13, color: colors.primary, fontFamily: 'monospace' },
  eingabe: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    minHeight: 220,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'monospace',
    color: colors.text,
    // Der Text ist zeilenweise gemeint – ein weicher Umbruch im Feld würde
    // eine Zeile vortäuschen, die es in der Vorlage nicht gibt.
    textAlignVertical: 'top',
  },
  vorschauTitel: { fontSize: 14, fontWeight: '600', color: colors.text },
  vorschau: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  trennlinie: { height: 1, backgroundColor: colors.border },
  punktMarke: { minWidth: 14 },
  punktText: { flex: 1 },
  knopfZeile: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
