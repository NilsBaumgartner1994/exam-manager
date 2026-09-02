import {
  anzeigeBereich,
  anzeigeRaster,
  beschriftungBei,
  bereichName,
  bereichAendern,
  bereichAus,
  fuelleBereich,
  imBereich,
  verschiebeBelegung,
  verschiebeBereich,
  belegungToCsv,
  erstelleRaumzuteilung,
  plaetzeJeRaum,
  kopiereRaumschema,
  leeresRaumschema,
  mitGroesse,
  parseBelegung,
  ohneFreieBelegung,
  parseRaumschemaDateien,
  parseRaumschemata,
  plaetzeMitAbstand,
  reservezellen,
  Platzbelegung,
  raumschemaDateien,
  raumschemaDateiname,
  raumschemataToCsv,
  schalteReserve,
  schalteVorgabe,
  setzeBeschriftungsText,
  setzePerson,
  setzeZelle,
  sitzplaetzeMitBelegung,
  sitzplatznummern,
  spaltenName,
  standardRaumschema,
  tischzellen,
  trenneZellen,
  verbindeZellen,
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

  it('bildet Bereiche aus zwei Ecken, egal in welcher Reihenfolge gezogen wird', () => {
    expect(bereichAus({ zeile: 3, spalte: 4 }, { zeile: 1, spalte: 2 })).toEqual({
      zeile: 1, spalte: 2, hoehe: 3, breite: 3,
    });
    const bereich = bereichAus({ zeile: 1, spalte: 1 }, { zeile: 1, spalte: 3 });
    expect(imBereich(bereich, 1, 2)).toBe(true);
    expect(imBereich(bereich, 2, 2)).toBe(false);
  });

  it('zieht ein Element über mehrere Felder auf', () => {
    const leer = leeresRaumschema('X', 3, 4);
    const wand = fuelleBereich(leer, bereichAus({ zeile: 0, spalte: 0 }, { zeile: 0, spalte: 3 }), 'wand');
    expect(wand.zellen[0]).toEqual(['wand', 'wand', 'wand', 'wand']);
    expect(wand.zellen[1]).toEqual(['leer', 'leer', 'leer', 'leer']);
  });

  it('verkleinert einen Bereich wieder und gibt die Zellen frei', () => {
    const leer = leeresRaumschema('X', 3, 4);
    const gross = fuelleBereich(leer, { zeile: 0, spalte: 0, hoehe: 1, breite: 4 }, 'tisch');
    const klein = bereichAendern(gross, { zeile: 0, spalte: 0, hoehe: 1, breite: 4 }, { zeile: 0, spalte: 0, hoehe: 1, breite: 2 }, 'tisch');
    expect(klein.zellen[0]).toEqual(['tisch', 'tisch', 'leer', 'leer']);
  });

  it('verschiebt einen Bereich samt Inhalt und gibt die alten Zellen frei', () => {
    const schema = parseRaumschemata('Raum;X\nT;T;.;.\n.;.;.;.\n')[0];
    const verschoben = verschiebeBereich(schema, { zeile: 0, spalte: 0, hoehe: 1, breite: 2 }, 1, 2);
    expect(verschoben.zellen[0]).toEqual(['leer', 'leer', 'leer', 'leer']);
    expect(verschoben.zellen[1]).toEqual(['leer', 'leer', 'tisch', 'tisch']);
  });

  it('lässt beim Verschieben liegen, was aus dem Raster fallen würde', () => {
    const schema = parseRaumschemata('Raum;X\nT;T\n.;.\n')[0];
    const verschoben = verschiebeBereich(schema, { zeile: 0, spalte: 0, hoehe: 1, breite: 2 }, 0, 1);
    // Die rechte Zelle fällt heraus, die linke wandert eins nach rechts.
    expect(verschoben.zellen[0]).toEqual(['leer', 'tisch']);
  });

  it('setzt einzelne Zellen, ohne das Schema zu verändern', () => {
    const leer = leeresRaumschema('X', 2, 2);
    const neu = setzeZelle(leer, 0, 1, 'tisch');
    expect(neu.zellen[0][1]).toBe('tisch');
    expect(leer.zellen[0][1]).toBe('leer');
  });

  it('benennt Spalten wie eine Tabellenkalkulation', () => {
    expect([0, 1, 25, 26, 27, 46, 51, 52].map(spaltenName)).toEqual([
      'A', 'B', 'Z', 'AA', 'AB', 'AU', 'AZ', 'BA',
    ]);
    expect(bereichName({ zeile: 2, spalte: 1, hoehe: 1, breite: 1 })).toBe('B3');
    expect(bereichName({ zeile: 2, spalte: 1, hoehe: 3, breite: 4 })).toBe('B3:E5');
  });

  it('rechnet einen Bereich in die gedrehte Ansicht um', () => {
    const schema = parseRaumschemata(SCHEMA_CSV)[0]; // 4 Zeilen x 5 Spalten
    // Ungedreht bleibt alles, wie es ist.
    const bereich = { zeile: 1, spalte: 1, hoehe: 2, breite: 3 };
    expect(anzeigeBereich(bereich, schema, 0)).toEqual(bereich);
    // Gedreht deckt der Bereich dieselben Zellen ab wie das gedrehte Raster.
    for (const drehungen of [1, 2, 3]) {
      const raster = anzeigeRaster(schema, drehungen);
      const gedreht = anzeigeBereich(bereich, schema, drehungen);
      raster.forEach((zeile, z) =>
        zeile.forEach((zelle, s) => {
          expect(imBereich(gedreht, z, s)).toBe(imBereich(bereich, zelle.zeile, zelle.spalte));
        }),
      );
    }
  });
});

describe('Textfelder über verbundenen Zellen', () => {
  const mitText = () =>
    verbindeZellen(leeresRaumschema('X', 3, 4), { zeile: 0, spalte: 1, hoehe: 1, breite: 3 }, 'Hinweis');

  it('verbindet Zellen zu einem Textfeld und trennt sie wieder', () => {
    const schema = mitText();
    expect(schema.beschriftungen).toEqual([
      { zeile: 0, spalte: 1, hoehe: 1, breite: 3, text: 'Hinweis' },
    ]);
    expect(beschriftungBei(schema, 0, 3)?.text).toBe('Hinweis');
    expect(beschriftungBei(schema, 1, 3)).toBeUndefined();
    const getrennt = trenneZellen(schema, { zeile: 0, spalte: 3, hoehe: 1, breite: 1 });
    expect(getrennt.beschriftungen).toEqual([]);
  });

  it('zieht beim Verbinden die Texte der beteiligten Felder zusammen', () => {
    const eins = verbindeZellen(leeresRaumschema('X', 2, 4), { zeile: 0, spalte: 0, hoehe: 1, breite: 1 }, 'A');
    const zwei = verbindeZellen(eins, { zeile: 0, spalte: 2, hoehe: 1, breite: 1 }, 'B');
    const zusammen = verbindeZellen(zwei, { zeile: 0, spalte: 0, hoehe: 1, breite: 4 });
    expect(zusammen.beschriftungen).toEqual([
      { zeile: 0, spalte: 0, hoehe: 1, breite: 4, text: 'A B' },
    ]);
  });

  it('beschriftet, was im Raster steht, ohne es zu entfernen', () => {
    const schema = verbindeZellen(
      fuelleBereich(leeresRaumschema('X', 2, 3), { zeile: 0, spalte: 0, hoehe: 1, breite: 3 }, 'tisch'),
      { zeile: 0, spalte: 0, hoehe: 1, breite: 2 },
      'Aufsicht',
    );
    // Die Tische bleiben Tische – ein beschrifteter Platz bleibt ein Platz.
    expect(schema.zellen[0]).toEqual(['tisch', 'tisch', 'tisch']);
    expect(tischzellen(schema)).toHaveLength(3);
    // Auch ein Tür-Feld darf beschriftet werden.
    expect(setzeZelle(schema, 0, 1, 'tuer').beschriftungen).toEqual([
      { zeile: 0, spalte: 0, hoehe: 1, breite: 2, text: 'Aufsicht' },
    ]);
    // Nur der Radierer räumt das Feld mit weg.
    expect(setzeZelle(schema, 0, 1, 'leer').beschriftungen).toEqual([]);
  });

  it('nimmt Textfelder beim Verschieben eines Blocks mit', () => {
    const schema = verbindeZellen(leeresRaumschema('X', 3, 4), { zeile: 0, spalte: 0, hoehe: 1, breite: 2 }, 'Tafel');
    const verschoben = verschiebeBereich(schema, { zeile: 0, spalte: 0, hoehe: 1, breite: 2 }, 1, 1);
    expect(verschoben.beschriftungen).toEqual([
      { zeile: 1, spalte: 1, hoehe: 1, breite: 2, text: 'Tafel' },
    ]);
  });

  it('ändert den Text eines Feldes über eine beliebige seiner Zellen', () => {
    const schema = setzeBeschriftungsText(mitText(), 0, 3, 'Neuer Text');
    expect(schema.beschriftungen[0].text).toBe('Neuer Text');
  });

  it('schreibt Textfelder in die CSV und liest sie wieder ein', () => {
    const schema = mitText();
    const csv = raumschemataToCsv([schema]);
    expect(csv).toContain('Text;0;1;1;3;Hinweis');
    expect(parseRaumschemata(csv)).toEqual([schema]);
  });

  it('nimmt auch Semikolon im Text mit', () => {
    const gelesen = parseRaumschemata('Raum;X\n.;.\nText;0;0;1;2;Erst A; dann B\n')[0];
    expect(gelesen.beschriftungen[0].text).toBe('Erst A; dann B');
  });

  it('begrenzt Textfelder auf das Raster, wenn der Raum kleiner wird', () => {
    const schema = verbindeZellen(leeresRaumschema('X', 3, 4), { zeile: 2, spalte: 2, hoehe: 1, breite: 2 }, 'weg');
    expect(mitGroesse(schema, 2, 4).beschriftungen).toEqual([]);
    expect(mitGroesse(schema, 3, 3).beschriftungen).toEqual([
      { zeile: 2, spalte: 2, hoehe: 1, breite: 1, text: 'weg' },
    ]);
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

  it('nimmt die Belegung beim Verschieben eines Blocks mit', () => {
    const { belegung } = verteileImRaum(schemata[1], ['a', 'b'], []);
    const verschoben = verschiebeBelegung(belegung, '94/E03', { zeile: 0, spalte: 1, hoehe: 1, breite: 2 }, 1, 0);
    expect(verschoben.find((p) => p.matrikelnummer === 'a')).toMatchObject({ zeile: 1, spalte: 1 });
    // Andere Räume bleiben unberührt.
    expect(verschiebeBelegung(belegung, '94/E01', { zeile: 0, spalte: 0, hoehe: 9, breite: 9 }, 1, 1)).toEqual(belegung);
  });

  it('überschreibt beim Verschieben, was am Zielplatz schon stand', () => {
    // Ein Tisch wird auf einen anderen geschoben: Danach gilt der bewegte
    // Eintrag – sonst hinge die Person an einem Platz, den es so nicht gibt.
    const { belegung } = verteileImRaum(schemata[1], ['a'], []);
    const verschoben = verschiebeBelegung(
      belegung,
      '94/E03',
      { zeile: 0, spalte: 1, hoehe: 1, breite: 1 },
      0,
      1,
    );
    const amZiel = verschoben.filter((p) => p.zeile === 0 && p.spalte === 2);
    expect(amZiel).toHaveLength(1);
    expect(amZiel[0].matrikelnummer).toBe('a');
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
      { raum: '94/E01', reservierteZeit: 'Gruppe 1' },
      { raum: '94/E03', reservierteZeit: 'Gruppe 2' },
    ];
    const { sitzplaetze } = erstelleRaumzuteilung(PERSONEN, raeume, {
      modus: 'sequential',
      plaetze: plaetzeJeRaum(schemata),
    });
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

describe('Raster als einzelne Dateien', () => {
  it('macht aus dem Raumnamen einen Dateinamen ohne Sonderzeichen', () => {
    expect(raumschemaDateiname('94/E01')).toBe('94_E01.csv');
    expect(raumschemaDateiname('Übungsraum 3')).toBe('UEbungsraum_3.csv');
    expect(raumschemaDateiname('')).toBe('raum.csv');
  });

  it('schreibt je Raum eine Datei, die sich wieder einlesen lässt', () => {
    const schemata = parseRaumschemata(SCHEMA_CSV);
    const dateien = raumschemaDateien(schemata);
    expect([...dateien.keys()]).toEqual(['94_E01.csv', '94_E03.csv']);
    expect(dateien.get('94_E01.csv')).toContain('Raum;94/E01');
    expect(dateien.get('94_E01.csv')).not.toContain('Raum;94/E03');
    expect(parseRaumschemaDateien([...dateien.values()])).toEqual(schemata);
  });

  it('lässt keine Datei die andere überschreiben', () => {
    const dateien = raumschemaDateien([leeresRaumschema('A/1', 1, 1), leeresRaumschema('A 1', 1, 1)]);
    expect([...dateien.keys()]).toEqual(['A_1.csv', 'A_1_2.csv']);
  });

  it('nimmt einen Raum nur einmal, auch wenn er in zwei Dateien steht', () => {
    // Eine alte Sammeldatei neben den Einzeldateien: sonst stünde derselbe
    // Raum zweimal im Editor.
    const schemata = parseRaumschemaDateien([SCHEMA_CSV, 'Raum;94/E01\nT;T\n']);
    expect(schemata.map((s) => s.raum)).toEqual(['94/E01', '94/E03']);
    expect(tischzellen(schemata[0])).toHaveLength(6);
  });
});

describe('Raum kopieren und umbenennen', () => {
  it('nimmt das Raster mit unter den neuen Namen', () => {
    const schema = parseRaumschemata(SCHEMA_CSV)[0];
    const kopie = kopiereRaumschema(schema, '94/E99');
    expect(kopie.raum).toBe('94/E99');
    expect(kopie.zellen).toEqual(schema.zellen);
    expect(kopie.beschriftungen).toEqual(schema.beschriftungen);
  });

  it('teilt keine Zeilen mit dem Original', () => {
    // Sonst änderte ein Strich im Duplikat auch den Raum, aus dem es kommt.
    const schema = leeresRaumschema('A', 2, 2);
    const kopie = kopiereRaumschema(schema, 'B');
    kopie.zellen[0][0] = 'tisch';
    expect(schema.zellen[0][0]).toBe('leer');
  });
});

describe('Reserveplätze im Raster', () => {
  it('liest `R` als dauerhaft freigehaltenen Tisch – ohne Sitzplatznummer', () => {
    const schema = parseRaumschemata('Raum;X\nT;R;T\n')[0];
    expect(schema.zellen[0]).toEqual(['tisch', 'reserve', 'tisch']);
    expect(tischzellen(schema)).toHaveLength(2);
    expect(reservezellen(schema)).toEqual([{ zeile: 0, spalte: 1 }]);
    // Nummeriert und belegt werden nur die Sitzplätze.
    expect([...sitzplatznummern([schema], 1001).keys()]).toEqual(['X|0|0', 'X|0|2']);
    const { belegung } = verteileImRaum(schema, ['a', 'b'], []);
    expect(belegung.map((p) => p.spalte)).toEqual([0, 2]);
  });

  it('schreibt Reserveplätze wieder als `R` heraus', () => {
    const schema = parseRaumschemata('Raum;X\nT;R\n')[0];
    expect(raumschemataToCsv([schema])).toContain('T;R');
  });
});

describe('Sitzverteilung mit größtmöglichem Abstand', () => {
  const frei = (zeilen: number, spalten: number) =>
    Array.from({ length: zeilen }, (_, z) =>
      Array.from({ length: spalten }, (_, s) => ({ zeile: z, spalte: s })),
    ).flat();

  it('setzt die ersten Personen in die Ecken', () => {
    const gewaehlt = plaetzeMitAbstand(frei(3, 3), [], 2);
    expect(gewaehlt).toHaveLength(2);
    // Zwei Plätze in einem 3×3-Raster: die beiden Ecken einer Zeile – zur
    // Seite ist der Abstand mehr wert als nach hinten.
    expect(Math.abs(gewaehlt[0].spalte - gewaehlt[1].spalte)).toBe(2);
  });

  it('hält Abstand zu denen, die schon sitzen', () => {
    const [platz] = plaetzeMitAbstand(
      [
        { zeile: 0, spalte: 1 },
        { zeile: 0, spalte: 4 },
      ],
      [{ zeile: 0, spalte: 0 }],
      1,
    );
    expect(platz).toEqual({ zeile: 0, spalte: 4 });
  });

  it('setzt lieber hintereinander als schräg daneben', () => {
    // Zur Wahl: zwei Reihen genau dahinter oder einmal schräg. Schräg ist
    // rechnerisch weiter weg, aber man sieht dem Vordermann in den Rücken –
    // deshalb gewinnt „hintereinander“.
    const [platz] = plaetzeMitAbstand(
      [
        { zeile: 2, spalte: 0 },
        { zeile: 1, spalte: 1 },
      ],
      [{ zeile: 0, spalte: 0 }],
      1,
    );
    expect(platz).toEqual({ zeile: 2, spalte: 0 });
  });

  it('verteilt eine ganze Reihe mit Lücken statt am Stück', () => {
    const schema = parseRaumschemata('Raum;X\nT;T;T;T;T;T;T\n')[0];
    const { belegung } = verteileImRaum(schema, ['a', 'b', 'c'], [], 'abstand');
    const besetzt = belegung.filter((p) => p.matrikelnummer !== '').map((p) => p.spalte).sort((a, b) => a - b);
    expect(besetzt).toEqual([0, 3, 6]);
  });
});
