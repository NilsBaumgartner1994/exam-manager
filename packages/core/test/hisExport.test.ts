import readXlsxFile from 'read-excel-file/node';
import { lies, pfad } from './fixtures';
import { anmeldungenToCsv, parseHisRows } from '../src';

describe('HIS-Export (Screen 3)', () => {
  it('wandelt check.xlsx in dieselben Anmeldungen wie das Python-Skript (check.csv)', async () => {
    const rows = await readXlsxFile(pfad.checkXlsx);
    const anmeldungen = parseHisRows(rows);
    expect(anmeldungen).toHaveLength(8);
    expect(anmeldungenToCsv(anmeldungen)).toBe(lies(pfad.checkCsv));
  });

  it('meldet einen fehlenden Kopf verständlich', () => {
    expect(() => parseHisRows([['irgendwas'], ['anderes']])).toThrow(/HIS-Export/);
  });
});
