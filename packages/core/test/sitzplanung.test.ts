/**
 * Die Verteilung in zwei Schritten: erst die Plätze wählen, dann die Personen
 * zuordnen. Geprüft wird beides getrennt – die Platzwahl an kleinen Rastern,
 * bei denen sich von Hand nachrechnen lässt, wo der nächste Platz liegen muss.
 */
import {
  belegungToCsv,
  parseBelegung,
  parseRaumschemata,
  planeSitzplan,
  Platzbelegung,
  raumfuellungAus,
  setzeNotiz,
  sitzplatznummern,
  waehlePlaetze,
  Zulassung,
} from '../src';

const PERSONEN: Zulassung[] = [
  { nachname: 'Archi', vorname: 'Archimedes', matrikelnummer: '1000001', email: 'a@test.de' },
  { nachname: 'Bohr', vorname: 'Niels', matrikelnummer: '1000002', email: 'b@test.de' },
  { nachname: 'Curie', vorname: 'Marie', matrikelnummer: '1000003', email: 'c@test.de' },
  { nachname: 'Darwin', vorname: 'Charles', matrikelnummer: '1000004', email: 'd@test.de' },
];

/** Eine Reihe mit fünf Tischen – gut zum Nachrechnen der Abstände. */
const REIHE = parseRaumschemata('Raum;Reihe\nT;T;T;T;T\n');
/** Zwei Räume mit je vier Tischen (zwei Reihen à zwei). */
const ZWEI_RAEUME = parseRaumschemata('Raum;A\nT;T\nT;T\nRaum;B\nT;T\nT;T\n');
const A_UND_B = [
  { raum: 'A', reservierteZeit: 'Gruppe 1' },
  { raum: 'B', reservierteZeit: 'Gruppe 1' },
];

describe('Plätze wählen (vor den Personen)', () => {
  it('setzt den zweiten Platz so weit weg wie möglich', () => {
    const gewaehlt = waehlePlaetze(REIHE, [], 2);
    expect(gewaehlt.map((p) => p.spalte)).toEqual([0, 4]);
  });

  it('füllt danach die Lücken – immer die größte zuerst', () => {
    expect(waehlePlaetze(REIHE, [], 3).map((p) => p.spalte)).toEqual([0, 4, 2]);
    expect(waehlePlaetze(REIHE, [], 5).map((p) => p.spalte)).toEqual([0, 4, 2, 1, 3]);
  });

  it('nimmt ohne Abstand schlicht die Lesereihenfolge', () => {
    const gewaehlt = waehlePlaetze(REIHE, [], 3, { sitzverteilung: 'lesereihenfolge' });
    expect(gewaehlt.map((p) => p.spalte)).toEqual([0, 1, 2]);
  });

  it('füllt die Räume nacheinander, bis einer voll ist', () => {
    const gewaehlt = waehlePlaetze(ZWEI_RAEUME, [], 5, { fuellung: 'nacheinander' });
    expect(gewaehlt.map((p) => p.raum)).toEqual(['A', 'A', 'A', 'A', 'B']);
  });

  it('füllt gleichmäßig immer dort, wo prozentual am meisten frei ist', () => {
    const gewaehlt = waehlePlaetze(ZWEI_RAEUME, [], 4, { fuellung: 'gleichmaessig' });
    expect(gewaehlt.map((p) => p.raum)).toEqual(['A', 'B', 'A', 'B']);
  });

  it('lässt freigehaltene Plätze aus und hält Abstand zu den Festgesetzten', () => {
    const bestehend: Platzbelegung[] = [
      // Ganz links sitzt jemand fest, ganz rechts ist der Tisch gesperrt.
      { raum: 'Reihe', zeile: 0, spalte: 0, matrikelnummer: '1000001', reserviert: false, vorgabe: true },
      { raum: 'Reihe', zeile: 0, spalte: 4, matrikelnummer: '', reserviert: true, vorgabe: false },
    ];
    const gewaehlt = waehlePlaetze(REIHE, bestehend, 2);
    expect(gewaehlt.map((p) => p.spalte)).toEqual([3, 1]);
  });
});

describe('Personen zuordnen (nach der Platzwahl)', () => {
  it('ordnet der Reihe nach zu: alphabetisch aufsteigende Sitzplatznummern', () => {
    const { sitzplaetze, ohnePlatz, nummern } = planeSitzplan(
      PERSONEN,
      [{ raum: 'Reihe', reservierteZeit: '' }],
      REIHE,
    );
    expect(ohnePlatz).toHaveLength(0);
    expect(sitzplaetze.map((s) => s.nachname)).toEqual(['Archi', 'Bohr', 'Curie', 'Darwin']);
    // Nummeriert wird, wo jemand sitzt: Der leere Tisch (Spalte 3) bekommt
    // keine Nummer, die Sitzenden dafür 1001 bis 1004 in Lesereihenfolge.
    expect(sitzplaetze.map((s) => s.sitzplatznummer)).toEqual([1001, 1002, 1003, 1004]);
    expect(nummern.get('Reihe|0|3')).toBeUndefined();
  });

  it('nummeriert auf Wunsch jeden Tisch, auch den leeren', () => {
    const { sitzplaetze, nummern } = planeSitzplan(
      PERSONEN,
      [{ raum: 'Reihe', reservierteZeit: '' }],
      REIHE,
      [],
      { nummerierung: 'alle' },
    );
    expect(nummern.get('Reihe|0|3')).toBe(1004);
    expect(sitzplaetze.map((s) => s.sitzplatznummer)).toEqual([1001, 1002, 1003, 1005]);
  });

  it('trägt Raum und Zeit des Einsatzes in jeden Sitzplatz ein', () => {
    const { sitzplaetze, raeume } = planeSitzplan(PERSONEN, A_UND_B, ZWEI_RAEUME);
    expect(new Set(sitzplaetze.map((s) => s.raum))).toEqual(new Set(['A']));
    expect(sitzplaetze[0].zeitUndRaum).toBe('Gruppe 1 - A');
    expect(raeume.map((r) => `${r.schluessel}: ${r.belegt}/${r.plaetze}`)).toEqual([
      'A: 4/4',
      'B: 0/4',
    ]);
  });

  it('lässt eine Vorgabe liegen und verteilt den Rest neu', () => {
    const erst = planeSitzplan(PERSONEN, [{ raum: 'Reihe', reservierteZeit: '' }], REIHE);
    // Darwin wird von Hand auf den ersten Tisch gesetzt und festgehalten.
    const vonHand = erst.belegung.map((platz) =>
      platz.spalte === 0
        ? { ...platz, matrikelnummer: '1000004', vorgabe: true }
        : platz.matrikelnummer === '1000004'
          ? { ...platz, matrikelnummer: '' }
          : platz,
    );
    const neu = planeSitzplan(PERSONEN, [{ raum: 'Reihe', reservierteZeit: '' }], REIHE, vonHand);
    const darwin = neu.sitzplaetze.find((s) => s.nachname === 'Darwin');
    expect(darwin?.sitzplatznummer).toBe(1001);
    expect(neu.ohnePlatz).toHaveLength(0);
    // Alle übrigen sitzen weiterhin auf eigenen Plätzen.
    expect(new Set(neu.sitzplaetze.map((s) => s.sitzplatznummer)).size).toBe(4);
  });

  it('setzt niemanden auf einen Platz mit Nachricht', () => {
    const leer = planeSitzplan([], [{ raum: 'Reihe', reservierteZeit: '' }], REIHE);
    const gesperrt = setzeNotiz(leer.belegung, 'Reihe', 0, 2, 'Tisch wackelt');
    const { belegung, sitzplaetze, nummern } = planeSitzplan(
      PERSONEN,
      [{ raum: 'Reihe', reservierteZeit: '' }],
      REIHE,
      gesperrt,
    );
    const mitte = belegung.find((platz) => platz.spalte === 2);
    expect(mitte).toMatchObject({ reserviert: true, matrikelnummer: '', notiz: 'Tisch wackelt' });
    // Vier Personen, aber nur vier freie Tische: Der gesperrte bleibt leer und
    // bekommt deshalb auch keine Nummer.
    expect(nummern.get('Reihe|0|2')).toBeUndefined();
    expect(belegung.filter((platz) => platz.matrikelnummer !== '')).toHaveLength(4);

    // Die Nachricht überlebt den Weg durch die Belegungs-CSV.
    const wieder = parseBelegung(belegungToCsv(belegung, sitzplaetze, sitzplatznummern(REIHE, 1001)));
    expect(wieder.find((platz) => platz.spalte === 2)?.notiz).toBe('Tisch wackelt');
  });

  it('meldet, wer keinen Platz mehr bekommt', () => {
    const eng = parseRaumschemata('Raum;Eng\nT;T\n');
    const { sitzplaetze, ohnePlatz } = planeSitzplan(PERSONEN, [{ raum: 'Eng', reservierteZeit: '' }], eng);
    expect(sitzplaetze.map((s) => s.nachname)).toEqual(['Archi', 'Bohr']);
    expect(ohnePlatz.map((p) => p.nachname)).toEqual(['Curie', 'Darwin']);
  });

  it('rechnet zweimal dasselbe aus', () => {
    const a = planeSitzplan(PERSONEN, A_UND_B, ZWEI_RAEUME, [], { fuellung: 'gleichmaessig' });
    const b = planeSitzplan(PERSONEN, A_UND_B, ZWEI_RAEUME, [], { fuellung: 'gleichmaessig' });
    expect(a.belegung).toEqual(b.belegung);
    expect(a.sitzplaetze).toEqual(b.sitzplaetze);
  });
});

describe('Wörter für die Raumfüllung', () => {
  it('liest die deutschen Wörter und die englischen der ersten Fassung', () => {
    expect(raumfuellungAus('nacheinander')).toBe('nacheinander');
    expect(raumfuellungAus('Gleichmaessig')).toBe('gleichmaessig');
    expect(raumfuellungAus('sequential')).toBe('nacheinander');
    expect(raumfuellungAus('balanced')).toBe('gleichmaessig');
    expect(raumfuellungAus('irgendwas')).toBeNull();
  });
});
