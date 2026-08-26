import { StatusBar } from 'expo-status-bar';
import { ModalProvider } from './src/components';
import { SCREENS } from './src/navigation';
import { ProjektProvider } from './src/projekt';
import { Router } from './src/Router';
import { HomeScreen } from './src/screens/HomeScreen';
import { KlausurTeilnehmerScreen } from './src/screens/KlausurTeilnehmerScreen';
import { RaeumeScreen } from './src/screens/RaeumeScreen';
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
    <ProjektProvider>
      {/*
        Blätter (BlattModal) zeichnen in eine Ebene über der App – innerhalb
        der App-Shell, nicht als eigenes `div` am `body`. Siehe ModalHost.
      */}
      <ModalProvider>
        <Router
          screens={{
            Home: { titel: 'Start', component: () => <HomeScreen /> },
            Vips: { titel: titel('Vips'), component: () => <VipsScreen /> },
            ZulassungsPdfs: { titel: titel('ZulassungsPdfs'), component: () => <ZulassungsPdfsScreen /> },
            KlausurTeilnehmer: { titel: titel('KlausurTeilnehmer'), component: () => <KlausurTeilnehmerScreen /> },
            Raumzuteilung: { titel: titel('Raumzuteilung'), component: () => <RaumzuteilungScreen /> },
            Raeume: { titel: titel('Raeume'), component: () => <RaeumeScreen /> },
          }}
        />
      </ModalProvider>
      <StatusBar style="auto" />
    </ProjektProvider>
  );
}
