import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DateiRolle, PROJEKT_SCHEMA, ROLLEN_TITEL } from '@exam-manager/core';
import {
  AppButton,
  DataTable,
  FilePickerButton,
  ProjektDownload,
  ScreenContainer,
  Section,
  StatusText,
  Tile,
} from '../components';
import { downloadZip } from '../files';
import { SCREENS } from '../navigation';
import { useProjekt, vorlageAlsZip } from '../projekt';
import { useResponsiveLayout } from '../responsive';
import { useNavigation } from '../Router';
import { colors, spacing } from '../theme';

export function HomeScreen() {
  const { navigate } = useNavigation();
  const layout = useResponsiveLayout();
  const projekt = useProjekt();
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  const ordnerLaden = async (files: File[]) => {
    setStatus(null);
    try {
      await projekt.ladeOrdner(files);
    } catch (fehler) {
      setStatus({ kind: 'error', text: `Ordner konnte nicht gelesen werden: ${String(fehler)}` });
    }
  };

  const vorlageHerunterladen = async () => {
    setStatus(null);
    try {
      downloadZip('klausur-projekt-vorlage.zip', await vorlageAlsZip());
    } catch (fehler) {
      setStatus({ kind: 'error', text: `ZIP konnte nicht erzeugt werden: ${String(fehler)}` });
    }
  };

  const erkannt = projekt.dateien.filter((datei) => datei.rolle !== 'unbekannt');
  // Markdown im Ordner ist erklärender Text (LIESMICH.md) – keine Datei, die
  // jemand am falschen Platz abgelegt hat. Beide werden mitgeführt, aber nur
  // die zweite Sorte ist einen Hinweis wert.
  const istHinweis = (pfad: string) => pfad.toLowerCase().endsWith('.md');
  const rolleTitel = (datei: { pfad: string; rolle: DateiRolle }) =>
    datei.rolle === 'unbekannt' && istHinweis(datei.pfad)
      ? 'Hinweistext (bleibt erhalten)'
      : ROLLEN_TITEL[datei.rolle];
  const nichtZugeordnet = projekt.dateien.filter(
    (datei) => datei.rolle === 'unbekannt' && !istHinweis(datei.pfad),
  ).length;

  return (
    <ScreenContainer
      title="Exam Manager"
      intro="Klausuren lokal im Browser verwalten – alle Dateien werden nur auf diesem Rechner verarbeitet, nichts wird hochgeladen."
      testID="home-screen"
    >
      <View style={[styles.tiles, { gap: layout.gap }]}>
        {SCREENS.map((screen) => (
          <Tile
            key={screen.route}
            title={screen.titel}
            subtitle={screen.beschreibung}
            onPress={() => navigate(screen.route)}
            testID={`tile-${screen.route}`}
          />
        ))}
      </View>

      <Section title="Projektordner (optional)" testID="home-projekt">
        <Text style={styles.hinweis}>
          Der Projektordner hält alle Dateien einer Klausur an einem Ort. Einmal auswählen, dann
          holen sich die Schritte ihre Eingaben von selbst und legen ihre Ergebnisse wieder darin
          ab. Ohne Ordner funktioniert weiterhin jeder Schritt einzeln.
        </Text>
        <Text style={styles.hinweis}>
          Entscheidend ist der <Text style={styles.pfad}>Ordner</Text>: Gelesen wird eine Datei nur,
          wenn sie am vorgesehenen Platz mit der passenden Endung liegt. Alles andere zeigt die
          Tabelle als „nicht zugeordnet“ – es bleibt unangetastet erhalten, wird aber von keinem
          Schritt verwendet.
        </Text>

        <DataTable
          columns={[
            { key: 'ordner', title: 'Ordner' },
            { key: 'dateien', title: 'Dateien' },
            { key: 'zweck', title: 'Was hineingehört' },
          ]}
          rows={PROJEKT_SCHEMA.map((regel) => ({
            ordner: `${regel.ordner}/`,
            dateien: `${regel.nameEnthaelt ? `*${regel.nameEnthaelt}*` : '*'}${regel.endungen.join(', *')}`,
            zweck: regel.zweck,
          }))}
          testID="home-schema"
        />

        <FilePickerButton
          label="Projektordner auswählen"
          directory
          onFiles={ordnerLaden}
          testID="home-ordner"
        />

        {projekt.ordner !== null || projekt.dateien.length > 0 ? (
          <StatusText kind="success" testID="home-projekt-status">
            {`Ordner „${projekt.ordner ?? '—'}“: ${projekt.dateien.length} Dateien gelesen, ${erkannt.length} davon zugeordnet.` +
              (nichtZugeordnet > 0
                ? ` ${nichtZugeordnet} liegen nicht im erwarteten Ordner und werden nicht verwendet.`
                : '')}
          </StatusText>
        ) : null}

        {projekt.dateien.length > 0 ? (
          <DataTable
            columns={[
              { key: 'pfad', title: 'Datei' },
              { key: 'rolle', title: 'Erkannt als' },
            ]}
            rows={projekt.dateien.map((datei) => ({
              pfad: datei.pfad,
              rolle: rolleTitel(datei),
            }))}
            testID="home-projekt-dateien"
          />
        ) : null}

        <View style={styles.buttonZeile}>
          <AppButton
            title="Projektvorlage als ZIP"
            variant="secondary"
            onPress={vorlageHerunterladen}
            testID="home-vorlage-zip"
          />
          {projekt.dateien.length > 0 ? (
            <AppButton
              title="Projekt schließen"
              variant="secondary"
              onPress={projekt.leeren}
              testID="home-projekt-leeren"
            />
          ) : null}
        </View>

        <ProjektDownload testID="home-stand-zip" />

        {status ? <StatusText kind={status.kind}>{status.text}</StatusText> : null}

        <Text style={styles.hinweis}>
          Der Stand bleibt in diesem Browser – auch nach einem Neuladen, samt aller Änderungen.
          Ein neuer Ordner ersetzt ihn vollständig. Das sind Personendaten: Sie liegen im Profil
          dieses Geräts, bis „Projekt schließen“ sie entfernt. Am fremden Rechner: unbedingt
          schließen.
        </Text>
        {projekt.speicher.art === 'ohneBinaer' ? (
          <StatusText kind="info" testID="home-speicher-hinweis">
            {`Für ${projekt.speicher.ausgelassen} Datei(en) reicht der Browserspeicher nicht – PDFs und Excel-Dateien sind nach einem Neuladen weg. Vorher die ZIP herunterladen.`}
          </StatusText>
        ) : null}
        {projekt.speicher.art === 'nichts' ? (
          <StatusText kind="info" testID="home-speicher-hinweis">
            Dieser Browser speichert nichts (privates Fenster?) – nach einem Neuladen ist der Stand
            weg. Vorher die ZIP herunterladen.
          </StatusText>
        ) : null}
        <Text style={styles.hinweis}>
          Der Browser darf nicht in den Ordner zurückschreiben – deshalb der Umweg über die ZIP:
          herunterladen, entpacken und den eigenen Ordner damit ersetzen. Die Vorlage-ZIP enthält
          einen leeren Ordner mit genau dieser Struktur (siehe LIESMICH.md darin).
        </Text>
      </Section>

      <Text style={styles.footer}>
        Die Schritte folgen dem Prüfungs-Workflow (siehe WORKFLOW.md im Repository).
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Kachelraster: Anzahl der Spalten ergibt sich aus der Fensterbreite
  // (siehe responsive.ts -> tileBasis), nicht aus einer festen Kachelbreite.
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  buttonZeile: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hinweis: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  pfad: { fontWeight: '600', color: colors.text },
  footer: { fontSize: 13, color: colors.textMuted, marginTop: spacing.lg },
});
