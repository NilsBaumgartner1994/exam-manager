/**
 * Schlanker Hash-Router (#/Vips …) statt react-navigation:
 * Die Seite scrollt nativ im Browser (kein inneres ScrollView-Div) – wichtig
 * für normales Browser-Verhalten und für Maestro-Scrolling. Der Hash macht
 * Screens verlinkbar und übersteht einen Reload (auch auf GitHub Pages).
 */
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from './navigation';
import { colors, spacing } from './theme';

export type Route = keyof RootStackParamList;

const ROUTES: Route[] = ['Home', 'Vips', 'ZulassungsPdfs', 'KlausurTeilnehmer', 'Raumzuteilung'];

const NavContext = createContext<{ route: Route; navigate: (route: Route) => void }>({
  route: 'Home',
  navigate: () => {},
});

export function useNavigation() {
  return useContext(NavContext);
}

function routeFromHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return ROUTES.find((r) => r === hash) ?? 'Home';
}

interface ScreenDef {
  titel: string;
  component: () => ReactNode;
}

export function Router({ screens }: { screens: Record<Route, ScreenDef> }) {
  const [route, setRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = `Exam Manager – ${screens[route].titel}`;
  }, [route, screens]);

  const navigate = (ziel: Route) => {
    window.location.hash = ziel === 'Home' ? '/' : `/${ziel}`;
  };

  const { titel, component } = screens[route];
  return (
    <NavContext.Provider value={{ route, navigate }}>
      <View style={styles.page}>
        {route !== 'Home' ? (
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigate('Home')}
              style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
              testID="nav-zurueck"
            >
              <Text style={styles.backText}>← Zurück</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{titel}</Text>
          </View>
        ) : null}
        {component()}
      </View>
    </NavContext.Provider>
  );
}

const styles = StyleSheet.create({
  page: { minHeight: '100vh' as unknown as number, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { paddingVertical: spacing.xs, paddingRight: spacing.sm },
  backPressed: { opacity: 0.6 },
  backText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
});
