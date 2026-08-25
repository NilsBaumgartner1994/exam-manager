import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer, Tile } from '../components';
import { SCREENS } from '../navigation';
import { useNavigation } from '../Router';
import { colors, spacing } from '../theme';

export function HomeScreen() {
  const { navigate } = useNavigation();
  return (
    <ScreenContainer
      title="Exam Manager"
      intro="Klausuren lokal im Browser verwalten – alle Dateien werden nur auf diesem Rechner verarbeitet, nichts wird hochgeladen."
      testID="home-screen"
    >
      <View style={styles.tiles}>
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
      <Text style={styles.footer}>
        Die Schritte folgen dem Prüfungs-Workflow (siehe WORKFLOW.md im Repository).
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  footer: { fontSize: 13, color: colors.textMuted, marginTop: spacing.lg },
});
