import { StatusBar } from 'expo-status-bar';
import { SCREENS } from './src/navigation';
import { Router } from './src/Router';
import { HomeScreen } from './src/screens/HomeScreen';
import { KlausurTeilnehmerScreen } from './src/screens/KlausurTeilnehmerScreen';
import { RaumzuteilungScreen } from './src/screens/RaumzuteilungScreen';
import { VipsScreen } from './src/screens/VipsScreen';
import { ZulassungsPdfsScreen } from './src/screens/ZulassungsPdfsScreen';

// Die Seite soll im Browser nativ scrollen: Expo fixiert #root auf 100 % Höhe,
// wir lassen den Inhalt stattdessen natürlich wachsen.
if (typeof document !== 'undefined' && !document.getElementById('exam-manager-css')) {
  const style = document.createElement('style');
  style.id = 'exam-manager-css';
  style.textContent = '#root { height: auto !important; min-height: 100vh; }';
  document.head.appendChild(style);
}

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
