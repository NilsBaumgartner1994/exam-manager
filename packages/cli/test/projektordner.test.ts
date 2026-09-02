import { join } from 'path';
import { Projekt } from '../src/projektordner';

const BEISPIELPROJEKT = join(__dirname, '..', '..', '..', 'Beispielprojekt');

describe('Projektordner auf der Platte', () => {
  const projekt = new Projekt(BEISPIELPROJEKT);

  it('erkennt dieselben Rollen wie die App', () => {
    expect(projekt.eine('notenliste')?.pfad).toBe('0_Input_Vips_Notenliste/Notenliste.csv');
    expect(projekt.eine('hisExport')?.pfad).toBe(
      '0_Input_Klausuranmeldungen/klausuranmeldungen_beispiel.xlsx',
    );
    expect(projekt.alle('zulassungsbestand')).toHaveLength(2);
    // Je Raum eine Raster-Datei – der Ordner ist die Raumliste.
    expect(projekt.alle('raumschema').map((datei) => datei.pfad)).toEqual([
      'Raeume/01_E01.csv',
      'Raeume/66_E33.csv',
      'Raeume/94_E01.csv',
      'Raeume/94_E03.csv',
      'Raeume/94_E06.csv',
    ]);
  });

  it('nimmt bei mehreren Dateien die alphabetisch erste', () => {
    expect(projekt.eine('zulassungsbestand')?.pfad).toBe('Zulassungen/pv2025_zulassungen.csv');
  });

  it('kennt den Zielpfad eines Ergebnisses', () => {
    expect(projekt.ziel('teilnehmer', 'allowedStudents.csv')).toBe(
      join(BEISPIELPROJEKT, '3_Klausur_Teilnehmende_Export', 'allowedStudents.csv'),
    );
  });
});
