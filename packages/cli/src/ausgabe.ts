/**
 * Was auf den Bildschirm geht – und was nur mit `--verbose`.
 *
 * Die normale Ausgabe ist das Ergebnis: die Tabelle, die Zahl darunter, die
 * geschriebenen Dateien. `--verbose` legt den Weg dorthin daneben: welche
 * Datei woher kam, was übersprungen wurde und wie sich die Zahlen aufteilen.
 * Beides steht bewusst in derselben Spur (`stdout`) und in der Reihenfolge, in
 * der es passiert – wer mitliest, will sehen, **wann** eine Datei gelesen
 * wurde, nicht nur dass.
 *
 * Der Schalter liegt hier als Zustand des Programms, nicht als Parameter durch
 * jede Funktion: Ein Befehl entscheidet nicht, ob er ausführlich ist, das
 * entscheidet der Aufruf – und `melde()` steht in Funktionen, die sonst nichts
 * mit Argumenten zu tun haben (`lieseQuelle`).
 */

let ausfuehrlich = false;

/** Ausführliche Meldungen an- oder abschalten (einmal beim Start). */
export function setzeAusfuehrlich(an: boolean): void {
  ausfuehrlich = an;
}

/** Läuft der Aufruf mit `--verbose`? */
export function istAusfuehrlich(): boolean {
  return ausfuehrlich;
}

/** Ergebnis – steht immer da. */
export function sage(text = ''): void {
  console.log(text);
}

/**
 * Zwischenschritt – steht nur mit `--verbose` da. Der Punkt am Anfang trennt
 * die Erklärung vom Ergebnis, ohne eine zweite Spalte aufzumachen.
 */
export function melde(text: string): void {
  if (ausfuehrlich) console.log(`· ${text}`);
}

/** Mehrere Zwischenschritte auf einmal (spart das `if` beim Aufrufer). */
export function meldeAlle(zeilen: string[]): void {
  for (const zeile of zeilen) melde(zeile);
}
