import { StatusBar } from 'expo-status-bar';
import { SCREENS } from './src/navigation';
import { Router } from './src/Router';
import { HomeScreen } from './src/screens/HomeScreen';
import { KlausurTeilnehmerScreen } from './src/screens/KlausurTeilnehmerScreen';
import { RaumzuteilungScreen } from './src/screens/RaumzuteilungScreen';
import { VipsScreen } from './src/screens/VipsScreen';
import { ZulassungsPdfsScreen } from './src/screens/ZulassungsPdfsScreen';
import { aktiviereAppLayout } from './src/webLayout';

// Die App füllt den Viewport, gescrollt wird im ScrollView der Screens
// (siehe src/webLayout.ts).
aktiviereAppLayout();

const titel = (route: (typeof SCREENS)[number]['route']) =>
  SCREENS.find((s) => s.route === route)!.titel;

export default function App() {
  return (
    <>
      <Router
        screens={{
          Home: { titel: 'Start', component: () => <HomeScreen /> },
          Vips: { titel: titel('Vips'), component: () => <VipsScreen /> },
          ZulassungsPdfs: { titel: titel('ZulassungsPdfs'), component: () => <ZulassungsPdfsScreen /> },
          KlausurTeilnehmer: { titel: titel('KlausurTeilnehmer'), component: () => <KlausurTeilnehmerScreen /> },
          Raumzuteilung: { titel: titel('Raumzuteilung'), component: () => <RaumzuteilungScreen /> },
        }}
      />
      <StatusBar style="auto" />
    </>
  );
}
