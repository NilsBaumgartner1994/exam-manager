import { istAusfuehrlich, melde, meldeAlle, sage, setzeAusfuehrlich } from '../src/ausgabe';
import { istVerbose, lieseArgumente } from '../src/argumente';

describe('Ausführliche Ausgabe', () => {
  const gesagt: string[] = [];
  let echt: typeof console.log;

  beforeEach(() => {
    gesagt.length = 0;
    echt = console.log;
    console.log = (text?: unknown) => {
      gesagt.push(String(text ?? ''));
    };
  });

  afterEach(() => {
    console.log = echt;
    setzeAusfuehrlich(false);
  });

  it('schweigt ohne --verbose und redet mit', () => {
    setzeAusfuehrlich(false);
    melde('gelesen: a.csv');
    meldeAlle(['b.csv', 'c.csv']);
    sage('7 Sitzplätze vergeben.');
    expect(gesagt).toEqual(['7 Sitzplätze vergeben.']);

    setzeAusfuehrlich(true);
    melde('gelesen: a.csv');
    meldeAlle(['b.csv', 'c.csv']);
    // Der Punkt trennt den Zwischenschritt vom Ergebnis.
    expect(gesagt.slice(1)).toEqual(['· gelesen: a.csv', '· b.csv', '· c.csv']);
    expect(istAusfuehrlich()).toBe(true);
  });

  it('erkennt --verbose in jeder Schreibweise', () => {
    expect(istVerbose(lieseArgumente(['--verbose']))).toBe(true);
    expect(istVerbose(lieseArgumente(['--ausfuehrlich']))).toBe(true);
    expect(istVerbose(lieseArgumente(['--projekt', 'x']))).toBe(false);
  });
});
