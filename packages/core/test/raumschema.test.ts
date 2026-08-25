import {
  anzeigeRaster,
  belegungToCsv,
  erstelleRaumzuteilung,
  leeresRaumschema,
  parseBelegung,
  ohneFreieBelegung,
  parseRaumschemata,
  Platzbelegung,
  raumschemataToCsv,
  schalteReserve,
  schalteVorgabe,
  setzePerson,
  setzeZelle,
  sitzplaetzeMitBelegung,
  sitzplatznummern,
  standardRaumschema,
  tischzellen,
  verteileAufRaumschemata,
  verteileImRaum,
  Zulassung,
} from '../src';

const SCHEMA_CSV = [
  'Raum;94/E01',
  'P;.;.;.;.',
  '.;T;T;.;T',
  '.;T;T;.;T',
  'D;.;.;.;.',
  'Raum;94/E03',
  '.;T;T',
  'D;.;.',
  '',
].join('\n');

const PERSONEN: Zulassung[] = [
  { nachname: 'Archi', vorname: 'Archimedes', matrikelnummer: '1000001', email: 'archimedes@test.de' },
  { nachname: 'Darwin', vorname: 'Charles', matrikelnummer: '1000003', email: 'charles@test.de' },
  { nachname: 'Galilei', vorname: 'Galileo', matrikelnummer: '1000007', email: 'galileo@test.de' },
  { nachname: 'Hodgkin', vorname: 'Dorothy', matrikelnummer: '1000004', email: 'dorothy@test.de' },
];

describe('Raumschema', () => {
  it('liest das Raster mehrerer Räume aus einer CSV', () => {
    const schemata = parseRaumschemata(SCHEMA_CSV);
    expect(schemata.map((s) => s.raum)).toEqual(['94/E01', '94/E03']);
    expect(schemata[0].zellen[0][0]).toBe('pult');
    expect(schemata[0].zellen[1][1]).toBe('tisch');
    expect(schemata[0].zellen[3][0]).toBe('tuer');
    expect(tischzellen(schemata[0])).toHaveLength(6);
    expect(tischzellen(schemata[1])).toHaveLength(2);
  });

  it('schreibt dieselbe CSV wieder heraus (Rundlauf)', () => {
    const schemata = parseRaumschemata(SCHEMA_CSV);
    expect(parseRaumschemata(raumschemataToCsv(schemata))).toEqual(schemata);
  });

  it('füllt kurze Zeilen auf, damit das Raster rechteckig ist', () => {
    const schema = parseRaumschemata('Raum;A\nT;T;T\nT\n')[0];
    expect(schema.zellen[1]).toEqual(['tisch', 'leer', 'leer']);
  });

  it('dreht nur die Ansicht – die Zellen behalten ihre Position', () => {
    const schema = parseRaumschemata(SCHEMA_CSV)[0]; // 4 Zeilen x 5 Spalten
    const gedreht = anzeigeRaster(schema, 1);
    expect(gedreht).toHaveLength(5); // aus 4x5 wird 5x4
    expect(gedreht[0]).toHaveLength(4);
    // Links unten (Tür, Zeile 3/Spalte 0) landet bei 90° im Uhrzeigersinn oben links.
    expect(gedreht[0][0]).toEqual({ typ: 'tuer', zeile: 3, spalte: 0 });
    // Viermal drehen ergibt wieder die Ausgangsansicht.
    expect(anzeigeRaster(schema, 4)).toEqual(anzeigeRaster(schema, 0));
    expect(anzeigeRaster(schema, -1)).toEqual(anzeigeRaster(schema, 3));
  });

  it('schlägt für eine Platzzahl ein Raster mit genau so vielen Tischen vor', () => {
    for (const plaetze of [1, 4, 7, 30]) {
      expect(tischzellen(standardRaumschema('X', plaetze))).toHaveLength(plaetze);
    }
  });

  it('setzt einzelne Zellen, ohne das Schema zu verändern', () => {
    const leer = leeresRaumschema('X', 2, 2);
    const neu = setzeZelle(leer, 0, 1, 'tisch');
    expect(neu.zellen[0][1]).toBe('tisch');
    expect(leer.zellen[0][1]).toBe('leer');
  });
});

describe('Raumbelegung', () => {
  const schemata = parseRaumschemata(SCHEMA_CSV);
  const alleNummern = sitzplatznummern(schemata, 1001);

  it('nummeriert die Tische über alle Räume fortlaufend in Lesereihenfolge', () => {
    expect(alleNummern.get('94/E01|1|1')).toBe(1001);
    expect(alleNummern.get('94/E01|1|4')).toBe(1003);
    expect(alleNummern.get('94/E01|2|1')).toBe(1004);
    // Zweiter Raum setzt die Nummerierung fort.
    expect(alleNummern.get('94/E03|0|1')).toBe(1007);
    expect(alleNummern.size).toBe(8);
  });

  it('verteilt Personen in Lesereihenfolge auf die Tische', () => {
    const { belegung, ohnePlatz } = verteileImRaum(schemata[0], ['a', 'b', 'c'], []);
    expect(ohnePlatz).toHaveLength(0);
    expect(belegung.filter((p) => p.matrikelnummer !== '').map((p) => p.matrikelnummer)).toEqual(['a', 'b', 'c']);
    expect(belegung[0]).toMatchObject({ zeile: 1, spalte: 1, matrikelnummer: 'a' });
  });

  it('lässt Reserveplätze frei und meldet, wer keinen Platz bekommt', () => {
    const reserve: Platzbelegung[] = [
      { raum: '94/E03', zeile: 0, spalte: 1, matrikelnummer: '', reserviert: true, vorgabe: false },
    ];
    const { belegung, ohnePlatz } = verteileImRaum(schemata[1], ['a', 'b'], reserve);
    expect(belegung.find((p) => p.zeile === 0 && p.spalte === 1)).toMatchObject({ reserviert: true, matrikelnummer: '' });
    expect(belegung.filter((p) => p.matrikelnummer !== '')).toHaveLength(1);
    expect(ohnePlatz).toEqual(['b']);
  });

  it('hält eine Vorgabe auf ihrem Platz, auch wenn neu verteilt wird', () => {
    const vorgabe: Platzbelegung[] = [
      { raum: '94/E01', zeile: 2, spalte: 4, matrikelnummer: 'c', reserviert: false, vorgabe: true },
    ];
    const { belegung } = verteileImRaum(schemata[0], ['a', 'b', 'c'], vorgabe);
    expect(belegung.find((p) => p.matrikelnummer === 'c')).toMatchObject({ zeile: 2, spalte: 4, vorgabe: true });
    // Die anderen füllen die übrigen Tische von vorne.
    expect(belegung.filter((p) => p.matrikelnummer !== '').map((p) => p.matrikelnummer).sort()).toEqual(['a', 'b', 'c']);
  });

  it('behält bestehende Plätze beim Umbauen des Raums', () => {
    const ersteRunde = verteileImRaum(schemata[0], ['a', 'b'], []).belegung;
    const umgesetzt = setzePerson(ersteRunde, '94/E01', 2, 4, 'a'); // a nach hinten rechts
    // Raum wird umgebaut: eine weitere Person kommt dazu
    const { belegung } = verteileImRaum(schemata[0], ['a', 'b', 'c'], umgesetzt);
    expect(belegung.find((p) => p.matrikelnummer === 'a')).toMatchObject({ zeile: 2, spalte: 4 });
    expect(belegung.filter((p) => p.matrikelnummer !== '')).toHaveLength(3);
  });

  it('verteilt mit ohneFreieBelegung von vorne, behält aber Vorgaben und Reserven', () => {
    const ersteRunde = verteileImRaum(schemata[0], ['a', 'b'], []).belegung;
    const umgesetzt = schalteVorgabe(setzePerson(ersteRunde, '94/E01', 2, 4, 'a'), '94/E01', 2, 4);
    const basis = ohneFreieBelegung(schalteReserve(umgesetzt, '94/E01', 1, 1));
    const { belegung } = verteileImRaum(schemata[0], ['a', 'b'], basis);
    expect(belegung.find((p) => p.matrikelnummer === 'a')).toMatchObject({ zeile: 2, spalte: 4, vorgabe: true });
    expect(belegung.find((p) => p.zeile === 1 && p.spalte === 1)).toMatchObject({ reserviert: true, matrikelnummer: '' });
    // b wird neu gesetzt – auf den ersten freien Tisch (Reserve übersprungen)
    expect(belegung.find((p) => p.matrikelnummer === 'b')).toMatchObject({ zeile: 1, spalte: 2 });
  });

  it('tauscht zwei Personen beim Umsetzen', () => {
    const { belegung } = verteileImRaum(schemata[1], ['a', 'b'], []);
    const [erster, zweiter] = belegung;
    const getauscht = setzePerson(belegung, '94/E03', erster.zeile, erster.spalte, 'b');
    expect(getauscht[0].matrikelnummer).toBe('b');
    expect(getauscht[1].matrikelnummer).toBe('a');
    expect(zweiter.matrikelnummer).toBe('b'); // Original unverändert
  });

  it('schaltet Reserve und Vorgabe um', () => {
    const { belegung } = verteileImRaum(schemata[1], ['a'], []);
    const reserviert = schalteReserve(belegung, '94/E03', 0, 2);
    expect(reserviert.find((p) => p.spalte === 2)).toMatchObject({ reserviert: true, matrikelnummer: '' });
    const vorgegeben = schalteVorgabe(belegung, '94/E03', 0, 1);
    expect(vorgegeben.find((p) => p.spalte === 1)).toMatchObject({ vorgabe: true, matrikelnummer: 'a' });
  });

  it('überträgt die Tischnummern auf die Sitzplätze', () => {
    const raeume = [
      { raum: '94/E01', plaetze: 6, reservierteZeit: 'Gruppe 1' },
      { raum: '94/E03', plaetze: 2, reservierteZeit: 'Gruppe 2' },
    ];
    const { sitzplaetze } = erstelleRaumzuteilung(PERSONEN, raeume, { modus: 'sequential' });
    const { belegung, ohnePlatz } = verteileAufRaumschemata(sitzplaetze, schemata);
    expect(ohnePlatz).toHaveLength(0);
    const mitPlatz = sitzplaetzeMitBelegung(sitzplaetze, belegung, alleNummern);
    expect(mitPlatz.map((s) => s.sitzplatznummer)).toEqual([1001, 1002, 1003, 1004]);
    // Jede Person sitzt an genau einem Tisch.
    expect(new Set(mitPlatz.map((s) => s.sitzplatznummer)).size).toBe(mitPlatz.length);
  });

  it('speichert die Belegung als CSV und liest sie wieder ein', () => {
    const { belegung } = verteileImRaum(schemata[1], ['1000001'], [
      { raum: '94/E03', zeile: 0, spalte: 2, matrikelnummer: '', reserviert: true, vorgabe: false },
    ]);
    const csv = belegungToCsv(schalteVorgabe(belegung, '94/E03', 0, 1), [], alleNummern);
    expect(csv.split('\n')[0]).toContain('Raum;Zeile;Spalte;Sitzplatznummer');
    const gelesen = parseBelegung(csv);
    expect(gelesen).toHaveLength(2);
    expect(gelesen[0]).toMatchObject({ raum: '94/E03', zeile: 0, spalte: 1, matrikelnummer: '1000001', vorgabe: true });
    expect(gelesen[1]).toMatchObject({ reserviert: true, matrikelnummer: '' });
  });
});
