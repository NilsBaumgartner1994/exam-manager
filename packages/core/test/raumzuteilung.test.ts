import { lies, liesRaumschemata, pfad } from './fixtures';
import {
  eindeutigeNamenspraefixe,
  einsatzRaster,
  mitDurchgaengen,
  parseRaeume,
  parseRaumschemaDateien,
  parseRaumschemata,
  parseSitzplaetze,
  plaetzeGesamt,
  planeSitzplan,
  plaetzeJeRaum,
  pruefePlatzbedarf,
  raumSchluessel,
  sitzplaetzeToCsv,
  sitzplatznummern,
  tischzellen,
  verteileAufRaumschemata,
  Zulassung,
} from '../src';

const TEILNEHMER: Zulassung[] = [
  { nachname: 'Archi', vorname: 'Archimedes', matrikelnummer: '1000001', email: 'archimedes@test.de' },
  { nachname: 'Darwin', vorname: 'Charles', matrikelnummer: '1000003', email: 'charles@test.de' },
  { nachname: 'Galilei', vorname: 'Galileo', matrikelnummer: '1000007', email: 'galileo@test.de' },
  { nachname: 'Hodgkin', vorname: 'Dorothy', matrikelnummer: '1000004', email: 'dorothy@test.de' },
  { nachname: 'Lamarr', vorname: 'Hedy', matrikelnummer: '1000008', email: 'hedy@test.de' },
  { nachname: 'Pascal', vorname: 'Blaise', matrikelnummer: '1000002', email: 'blaise@test.de' },
  { nachname: 'Schrödinger', vorname: 'Erwin', matrikelnummer: '1000005', email: 'erwin@test.de' },
];

describe('Raumzuteilung (Screen 4)', () => {
  const raeume = parseRaeume(lies(pfad.raeume));
  const schemata = parseRaumschemaDateien(liesRaumschemata());
  /** Die Plätze kommen aus den Rastern – gespeichert wird die Zahl nirgends. */
  const plaetze = plaetzeJeRaum(schemata);

  it('liest die Raumliste', () => {
    expect(raeume.map((r) => r.raum)).toEqual(['01/E01', '66/E33', '94/E01', '94/E03', '94/E06']);
    expect(raeume[0]).toMatchObject({ raum: '01/E01', reservierteZeit: expect.any(String) });
    // Auch eine alte Liste mit einer Spalte `Plätze` bleibt lesbar – die
    // Spalte wird überlesen, die Platzzahl steht im Raster.
    expect(Object.keys(raeume[0])).not.toContain('plaetze');
  });

  it('nimmt die Plätze eines Raums aus den Tischen seines Rasters', () => {
    // Es gibt keine zweite Stelle, an der eine Platzzahl steht: Wer im Plan
    // einen Tisch entfernt, ändert damit die Plätze des Raums.
    expect(schemata.map((s) => s.raum)).toEqual(raeume.map((r) => r.raum));
    for (const raum of raeume) {
      const schema = schemata.find((s) => s.raum === raum.raum);
      expect(schema).toBeDefined();
      expect(plaetze.get(raum.raum)).toBe(tischzellen(schema!).length);
    }
    expect(plaetze.get('01/E01')).toBe(193);
    expect(plaetzeGesamt(raeume, plaetze)).toBe(
      schemata.reduce((summe, schema) => summe + tischzellen(schema).length, 0),
    );
  });

  it('sagt vor der Zuteilung, ob die Räume für die Teilnehmenden reichen', () => {
    const genug = pruefePlatzbedarf(TEILNEHMER.length, raeume, plaetze);
    expect(genug).toMatchObject({ reicht: true, fehlende: 0, ohneRaster: [] });
    expect(genug.frei).toBe(genug.plaetze - TEILNEHMER.length);

    // Ein Raum ohne Raster hat keine Plätze – das ist der Hinweis, den
    // Schritt 4 anzeigt, statt stillschweigend eine Zahl anzunehmen.
    const eng = pruefePlatzbedarf(300, [raeume[2], { raum: 'Neu', reservierteZeit: '' }], plaetze);
    expect(eng.reicht).toBe(false);
    expect(eng.fehlende).toBe(300 - (plaetze.get('94/E01') ?? 0));
    expect(eng.ohneRaster).toEqual(['Neu']);
  });

  it('verteilt alle 7 Teilnehmenden und vergibt Sitzplätze ab 1001', () => {
    const { sitzplaetze, ohnePlatz } = planeSitzplan(TEILNEHMER, raeume, schemata);
    expect(ohnePlatz).toHaveLength(0);
    expect(sitzplaetze).toHaveLength(7);
    // Die Nummern gehören zu den Tischen, nicht zu den Personen: In einem
    // Hörsaal mit 193 Tischen sind die sieben gewählten weit auseinander.
    expect(sitzplaetze.map((s) => s.sitzplatznummer)).toEqual(
      [...sitzplaetze].map((s) => s.sitzplatznummer).sort((a, b) => a - b),
    );
    // Zugeordnet wird der Reihe nach: alphabetisch aufs Raster, also steigt
    // mit dem Nachnamen die Sitzplatznummer.
    const namen = sitzplaetze.map((s) => s.nachname);
    expect(namen).toEqual([...namen].sort((a, b) => a.localeCompare(b, 'de')));
  });

  it('respektiert eine andere Start-Sitzplatznummer', () => {
    const { sitzplaetze } = planeSitzplan(TEILNEHMER, raeume, schemata, [], {
      sitzverteilung: 'lesereihenfolge',
      ersteSitzplatznummer: 1,
    });
    expect(sitzplaetze[0].sitzplatznummer).toBe(1);
  });

  it('meldet Teilnehmende ohne Platz, wenn die Räume voll sind', () => {
    // Zwei Tische im Raster heißen zwei Plätze – mehr passen nicht hinein.
    const klein = parseRaumschemata('Raum;Klein\nT;T\n');
    const { sitzplaetze, ohnePlatz } = planeSitzplan(
      TEILNEHMER,
      [{ raum: 'Klein', reservierteZeit: '' }],
      klein,
    );
    expect(sitzplaetze).toHaveLength(2);
    expect(ohnePlatz).toHaveLength(5);
  });

  it('lässt einen Raum ohne Raster leer, statt ihn zu raten', () => {
    const { sitzplaetze, ohnePlatz } = planeSitzplan(
      TEILNEHMER,
      [{ raum: 'Ohne Raster', reservierteZeit: '' }],
      schemata,
    );
    expect(sitzplaetze).toHaveLength(0);
    expect(ohnePlatz).toHaveLength(TEILNEHMER.length);
  });

  it('erzeugt eindeutige Namenspräfixe für den Aushang', () => {
    const praefixe = eindeutigeNamenspraefixe(TEILNEHMER);
    const werte = [...praefixe.values()];
    expect(new Set(werte).size).toBe(werte.length);
    expect(praefixe.get(TEILNEHMER[0])).toBe('A'); // Archi ist eindeutig ab "A"... 
  });

  it('schreibt und liest das CSV-Format des Python-Originals', () => {
    const { sitzplaetze } = planeSitzplan(TEILNEHMER, raeume, schemata);
    const wieder = parseSitzplaetze(sitzplaetzeToCsv(sitzplaetze));
    expect(wieder).toEqual(sitzplaetze);
  });

  it('liest das eingecheckte Beispiel-Sitzplan-CSV', () => {
    const sitzplaetze = parseSitzplaetze(lies(pfad.sitzplan));
    expect(sitzplaetze).toHaveLength(7);
    expect(sitzplaetze[0].sitzplatznummer).toBe(1001);
  });
});

describe('Derselbe Raum mehrfach (zwei Durchgänge)', () => {
  const ZWEI_DURCHGAENGE = parseRaeume(
    'Raum;ReservierteZeit\n' +
      '94/E01;01.02.2026 Gruppe 1\n' +
      '94/E01;01.02.2026 Gruppe 2\n',
  );
  /** Ein Raster mit zwei Tischen – jeder Durchgang hat also zwei Plätze. */
  const ZWEI_TISCHE = parseRaumschemata('Raum;94/E01\nT;T\n');

  it('liest auch eine alte Liste mit Spalte „Plätze“ und überliest sie', () => {
    const alt = parseRaeume('Raum;Plätze;ReservierteZeit\n94/E01;99;Gruppe 1\n');
    expect(alt).toEqual([{ raum: '94/E01', reservierteZeit: 'Gruppe 1', durchgang: 1 }]);
  });

  it('zählt beim Einlesen die Durchgänge durch', () => {
    expect(ZWEI_DURCHGAENGE.map((r) => r.durchgang)).toEqual([1, 2]);
    expect(ZWEI_DURCHGAENGE.map(raumSchluessel)).toEqual(['94/E01', '94/E01 (2. Durchgang)']);
  });

  it('zählt auch eine von Hand zusammengestellte Liste durch', () => {
    const liste = mitDurchgaengen([
      { raum: '94/E01', reservierteZeit: 'Gruppe 1' },
      { raum: '94/E03', reservierteZeit: 'Gruppe 1' },
      { raum: '94/E01', reservierteZeit: 'Gruppe 2' },
    ]);
    expect(liste.map((r) => r.durchgang)).toEqual([1, 1, 2]);
  });

  it('behandelt jeden Durchgang als eigenen Raum mit eigenen Plätzen', () => {
    const { sitzplaetze, ohnePlatz } = planeSitzplan(
      TEILNEHMER.slice(0, 4),
      ZWEI_DURCHGAENGE,
      ZWEI_TISCHE,
    );
    expect(ohnePlatz).toHaveLength(0);
    // Beide Durchgänge heißen im Aushang gleich – auseinander hält sie der
    // Schlüssel und die reservierte Zeit.
    expect(new Set(sitzplaetze.map((s) => s.raum))).toEqual(new Set(['94/E01']));
    expect(new Set(sitzplaetze.map((s) => s.raumSchluessel))).toEqual(
      new Set(['94/E01', '94/E01 (2. Durchgang)']),
    );
    expect(sitzplaetze.filter((s) => s.raumSchluessel === '94/E01')).toHaveLength(2);
  });

  it('gibt jedem Durchgang eigene Tische, eigene Belegung und eigene Nummern', () => {
    const schema = parseRaumschemata('Raum;94/E01\nT;T\n')[0];
    const raster = einsatzRaster(ZWEI_DURCHGAENGE, [schema]);
    expect(raster.map((r) => r.raum)).toEqual(['94/E01', '94/E01 (2. Durchgang)']);

    const { sitzplaetze, belegung, ohnePlatz } = planeSitzplan(
      TEILNEHMER.slice(0, 4),
      ZWEI_DURCHGAENGE,
      [schema],
    );
    expect(ohnePlatz).toHaveLength(0);
    expect(belegung.filter((p) => p.raum === '94/E01 (2. Durchgang)')).toHaveLength(2);
    // Die Nummern laufen über beide Durchgänge weiter – derselbe Tisch hat im
    // zweiten Durchgang eine andere Nummer.
    const nummern = sitzplatznummern(raster, 1001);
    expect(nummern.get('94/E01|0|0')).toBe(1001);
    expect(nummern.get('94/E01 (2. Durchgang)|0|0')).toBe(1003);
  });
});
