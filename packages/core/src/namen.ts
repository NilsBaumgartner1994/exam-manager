/** Umlaute für Sortierung/Vergleich normalisieren (ä→ae …), wie im Python-Original. */
export function normalizeName(name: string): string {
  return name
    .replace(/Ä/g, 'AE')
    .replace(/Ö/g, 'OE')
    .replace(/Ü/g, 'UE')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

/** Alphabetisch nach Nachname (normalisiert), wie in den echten Exporten. */
export function sortByNachname<T extends { nachname: string }>(personen: T[]): T[] {
  return [...personen].sort((a, b) =>
    normalizeName(a.nachname).toLowerCase().localeCompare(normalizeName(b.nachname).toLowerCase()),
  );
}
