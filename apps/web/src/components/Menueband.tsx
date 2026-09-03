import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { oeffneDateiDialog } from '../files';
import { useResponsiveLayout } from '../responsive';
import { colors, radius, spacing } from '../theme';
import { useModalEbene } from './ModalHost';
import { ohneBrowserGeste, useZiehGeste } from './ZiehGeste';

/**
 * Ein Eintrag in einem Menü.
 *
 * Die Menüs sind **Daten**, keine Bausteine: Ein Screen beschreibt, was es zu
 * tun gibt, und das Menüband entscheidet, ob daraus am Rechner ein
 * herunterklappendes Menü wird oder auf dem Handy eine Schublade. Zwei
 * Darstellungen aus zwei Sätzen Knöpfe zusammenzusetzen hieße, jede Aktion
 * zweimal hinzuschreiben.
 */
export type MenuEintrag =
  /** Der Regelfall: etwas tun. `gewaehlt` setzt das Häkchen davor. */
  | {
      art: 'aktion';
      titel: string;
      /** Zweite Zeile, kleiner – wozu das gut ist oder warum es gerade nicht geht. */
      hinweis?: string;
      onWaehlen: () => void;
      gewaehlt?: boolean;
      deaktiviert?: boolean;
      testID?: string;
    }
  /** Ein Häkchen zum Umlegen – das Menü bleibt danach offen (mehrere nacheinander). */
  | {
      art: 'schalter';
      titel: string;
      hinweis?: string;
      wert: boolean;
      onChange: (wert: boolean) => void;
      testID?: string;
    }
  /** Dateiauswahl des Browsers – „… laden“. */
  | {
      art: 'datei';
      titel: string;
      hinweis?: string;
      accept?: string;
      mehrere?: boolean;
      onDateien: (dateien: File[]) => void;
      testID?: string;
    }
  /**
   * Ein Element der Palette: antippen wählt das Werkzeug, ziehen legt es
   * direkt auf einer Zelle des Raumplans ab (in der Schublade nur antippen –
   * dort liegt das Menü über dem Plan).
   */
  | {
      art: 'ziehbar';
      titel: string;
      hinweis?: string;
      gewaehlt?: boolean;
      onWaehlen: () => void;
      onZiehen: (x: number, y: number) => void;
      onAblegen: (x: number, y: number) => void;
      testID?: string;
    }
  /**
   * Ein Untermenü: Beim Überfahren klappt rechts daneben eine zweite Liste auf
   * (auf dem Handy geht die Schublade eine Ebene tiefer). So steht „als CSV
   * oder als PDF?“ dort, wo die Frage aufkommt – am Namen der Liste –, statt
   * jede Liste zweimal ins Menü zu schreiben.
   */
  | {
      art: 'unter';
      titel: string;
      hinweis?: string;
      deaktiviert?: boolean;
      eintraege: (MenuEintrag | null | false)[];
      testID?: string;
    }
  /** Trennlinie, mit optionaler Überschrift für die Gruppe darunter. */
  | { art: 'trenner'; titel?: string };

export interface MenuGruppe {
  /** Der Name im Menüband: „Datei“, „Werkzeuge“, „Räume“. */
  titel: string;
  /** Was gerade gilt – steht klein hinter dem Titel („Räume · 94/E01“). */
  wert?: string;
  /**
   * Ein Menü, das auf ein Problem hinweist – rot hinterlegt („⚠ 2 ohne
   * Platz“). Es steht im Band und nicht in einer Meldung, die man wegscrollt:
   * Wer einen besetzten Platz freihält, soll die Folge sehen, bis sie behoben
   * ist, und im Menü gleich den Weg dorthin finden.
   */
  warnung?: boolean;
  /** `null`/`false` wird übergangen, damit Einträge bedingt sein dürfen. */
  eintraege: (MenuEintrag | null | false)[];
  testID?: string;
}

/** Breite eines herunterklappenden Menüs. */
const MENU_BREITE = 300;

/**
 * Das Menüband einer Arbeitsfläche – die Menüleiste einer Tabellenkalkulation.
 *
 * Vorher standen alle Aktionen als Knöpfe nebeneinander im Kopf des Screens.
 * Das waren in Schritt 4 über dreißig Stück in vier Zeilen: Der Plan, um den
 * es geht, bekam den Rest. Jetzt steht dort **eine** Zeile mit den Namen der
 * Menüs, und was dazugehört, klappt darunter auf – wie „Datei“ in Word oder
 * Excel.
 *
 * Zwei Darstellungen, eine Beschreibung:
 * - **Am Rechner** (breites Fenster) klappt das Menü unter seinem Namen auf.
 *   Ist eines offen, wechselt das Überfahren des nächsten Namens dorthin, wie
 *   man es von einer Menüleiste erwartet.
 * - **Auf dem Handy** öffnet das Burger-Zeichen eine Schublade: erst die Liste
 *   der Menüs, ein Tippen geht eine Ebene tiefer, „Zurück“ wieder herauf. Ein
 *   herunterklappendes Menü neben dem Finger wäre dort weder zu treffen noch
 *   zu lesen.
 *
 * Gezeichnet wird beides in die Modal-Ebene der App-Shell (`ModalHost`), nicht
 * in den Kopf: Sonst läge das aufgeklappte Menü *hinter* dem Arbeitsbereich –
 * beide sind Geschwister, und der spätere gewinnt.
 */
export function Menueleiste({ menus, testID }: { menus: MenuGruppe[]; testID?: string }) {
  const { isCompact } = useResponsiveLayout();
  return isCompact ? (
    <Schublade menus={menus} testID={testID} />
  ) : (
    <Menuezeile menus={menus} testID={testID} />
  );
}

/** Die Einträge eines Menüs (oder Untermenüs) ohne die weggelassenen. */
function eintraegeVon(menu: { eintraege: (MenuEintrag | null | false)[] }): MenuEintrag[] {
  return menu.eintraege.filter((eintrag): eintrag is MenuEintrag => !!eintrag);
}

/** Ein Untermenü aus einer Liste heraussuchen. */
type UnterMenu = Extract<MenuEintrag, { art: 'unter' }>;
function unterMenu(eintraege: MenuEintrag[], titel: string): UnterMenu | undefined {
  return eintraege.find(
    (eintrag): eintrag is UnterMenu => eintrag.art === 'unter' && eintrag.titel === titel,
  );
}

/** Am Rechner: eine Zeile mit Menünamen, darunter klappt eines auf. */
function Menuezeile({ menus, testID }: { menus: MenuGruppe[]; testID?: string }) {
  const [offen, setzeOffen] = useState<string | null>(null);
  const [ort, setzeOrt] = useState<{ links: number; oben: number; hoehe: number } | null>(null);
  /**
   * Läuft gerade ein Zug aus der Palette heraus? Dann lässt das Menü keine
   * Zeiger mehr an sich heran (`pointerEvents`), damit die Zelle unter dem
   * Finger gefunden wird – `document.elementFromPoint` übergeht nur, was
   * keine Zeiger annimmt, und sonst läge das Menü im Weg.
   */
  const [zieht, setzeZieht] = useState(false);
  /** Das offene Untermenü: sein Titel und wo es hingehört. */
  const [unter, setzeUnter] = useState<{ titel: string; oben: number; links: number } | null>(null);
  const leiste = useRef<View>(null);
  const blatt = useRef<View>(null);
  const unterBlatt = useRef<View>(null);
  const knoepfe = useRef<Record<string, View | null>>({});

  const schliessen = () => {
    setzeUnter(null);
    setzeOffen(null);
  };

  const oeffne = (menu: MenuGruppe) => {
    const knoten = knoepfe.current[menu.titel] as unknown as HTMLElement | null;
    const kasten = knoten?.getBoundingClientRect();
    if (kasten) {
      const oben = Math.round(kasten.bottom + 2);
      setzeOrt({
        // Am rechten Rand rutscht das Menü nach links, statt hinauszuragen.
        links: Math.round(
          Math.max(spacing.xs, Math.min(kasten.left, window.innerWidth - MENU_BREITE - spacing.sm)),
        ),
        oben,
        hoehe: Math.max(120, Math.round(window.innerHeight - oben - spacing.md)),
      });
    }
    setzeUnter(null);
    setzeOffen(menu.titel);
  };

  /**
   * Ein Untermenü aufklappen – rechts neben der Zeile, an der es hängt. Ist
   * dort kein Platz mehr, klappt es nach links auf: Ein Menü, das halb aus dem
   * Fenster ragt, ist keins.
   */
  const oeffneUnter = (titel: string, zeileOben: number) => {
    if (!ort) return;
    const rechts = ort.links + MENU_BREITE + 4;
    const passt = rechts + MENU_BREITE <= window.innerWidth - spacing.sm;
    setzeUnter({
      titel,
      oben: Math.max(spacing.xs, Math.min(zeileOben, window.innerHeight - 160)),
      links: passt ? rechts : Math.max(spacing.xs, ort.links - MENU_BREITE - 4),
    });
  };

  // Daneben tippen, Escape oder eine Größenänderung schließen das Menü. Kein
  // Deckel über dem Bildschirm: Der verdeckte sonst den Raumplan und finge
  // das Ablegen eines Elements ab.
  useEffect(() => {
    if (offen === null) return;
    const enthaelt = (behaelter: View | null, ziel: Node | null) =>
      !!ziel && !!(behaelter as unknown as HTMLElement | null)?.contains(ziel);
    const gedrueckt = (ereignis: PointerEvent) => {
      const ziel = ereignis.target as Node | null;
      if (
        enthaelt(leiste.current, ziel) ||
        enthaelt(blatt.current, ziel) ||
        enthaelt(unterBlatt.current, ziel)
      ) {
        return;
      }
      schliessen();
    };
    const getippt = (ereignis: KeyboardEvent) => {
      if (ereignis.key === 'Escape') schliessen();
    };
    document.addEventListener('pointerdown', gedrueckt, true);
    window.addEventListener('keydown', getippt);
    window.addEventListener('resize', schliessen);
    return () => {
      document.removeEventListener('pointerdown', gedrueckt, true);
      window.removeEventListener('keydown', getippt);
      window.removeEventListener('resize', schliessen);
    };
  }, [offen]);

  const offenesMenu = menus.find((menu) => menu.titel === offen) ?? null;

  const offeneEintraege = offenesMenu ? eintraegeVon(offenesMenu) : [];
  const offenesUnter = unter ? unterMenu(offeneEintraege, unter.titel) : undefined;

  const menuBlatt = useModalEbene(
    offenesMenu && ort ? (
      <>
        <View
          ref={blatt}
          style={[styles.blatt, { left: ort.links, top: ort.oben, maxHeight: ort.hoehe }]}
          pointerEvents={zieht ? 'none' : 'auto'}
          testID={offenesMenu.testID ? `${offenesMenu.testID}-blatt` : undefined}
        >
          <ScrollView style={styles.blattScroll} contentContainerStyle={styles.blattInhalt}>
            {offeneEintraege.map((eintrag, index) => (
              <MenuZeile
                key={schluessel(eintrag, index)}
                eintrag={eintrag}
                schliessen={schliessen}
                ziehtGerade={setzeZieht}
                unterOffen={unter?.titel === eintrag.titel}
                onUnter={oeffneUnter}
                onZeileUeberfahren={() => {
                  // Überfährt man eine andere Zeile, schließt das Untermenü –
                  // wie in einer Menüleiste, in der immer eines offen ist.
                  if (eintrag.art !== 'unter') setzeUnter(null);
                }}
              />
            ))}
          </ScrollView>
        </View>
        {offenesUnter && unter ? (
          <View
            ref={unterBlatt}
            style={[
              styles.blatt,
              { left: unter.links, top: unter.oben, maxHeight: ort.hoehe },
            ]}
            testID={offenesUnter.testID ? `${offenesUnter.testID}-blatt` : undefined}
          >
            <ScrollView style={styles.blattScroll} contentContainerStyle={styles.blattInhalt}>
              {eintraegeVon(offenesUnter).map((eintrag, index) => (
                <MenuZeile
                  key={schluessel(eintrag, index)}
                  eintrag={eintrag}
                  schliessen={schliessen}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </>
    ) : null,
  );

  return (
    <View ref={leiste} style={styles.zeile} testID={testID}>
      {menus.map((menu) => (
        <Pressable
          key={menu.titel}
          ref={(knoten) => {
            knoepfe.current[menu.titel] = knoten;
          }}
          accessibilityRole="button"
          onPress={() => (offen === menu.titel ? schliessen() : oeffne(menu))}
          // Ist ein Menü offen, folgt es dem Zeiger – wie in einer Menüleiste.
          onHoverIn={() => {
            if (offen !== null && offen !== menu.titel) oeffne(menu);
          }}
          style={({ pressed }) => [
            styles.name,
            menu.warnung && styles.nameWarnung,
            offen === menu.titel && styles.nameOffen,
            pressed && styles.gedrueckt,
          ]}
          testID={menu.testID}
        >
          <Text
            style={[
              styles.nameText,
              menu.warnung && styles.nameTextWarnung,
              offen === menu.titel && styles.nameTextOffen,
            ]}
          >
            {menu.titel}
          </Text>
          {menu.wert ? (
            <Text
              style={[styles.wert, offen === menu.titel && styles.wertOffen]}
              numberOfLines={1}
            >
              {menu.wert}
            </Text>
          ) : null}
          <Text style={[styles.pfeil, offen === menu.titel && styles.nameTextOffen]}>▾</Text>
        </Pressable>
      ))}
      {menuBlatt}
    </View>
  );
}

/**
 * Auf dem Handy: ein Burger-Zeichen, dahinter die Schublade mit den Menüs.
 *
 * Zwei Ebenen – erst die Menüs, dann deren Einträge. Alles auf einmal wäre bei
 * dreißig Aktionen eine Liste, durch die niemand scrollen will.
 */
function Schublade({ menus, testID }: { menus: MenuGruppe[]; testID?: string }) {
  const [offen, setzeOffen] = useState(false);
  /**
   * Der Weg, den wir gegangen sind: erst das Menü, dann ggf. ein Untermenü.
   * Leer ist die oberste Ebene. Ein Pfad statt eines Titels, weil „Datei →
   * Aushang → als PDF“ drei Ebenen sind.
   */
  const [pfad, setzePfad] = useState<string[]>([]);

  const schliessen = () => {
    setzeOffen(false);
    setzePfad([]);
  };

  useEffect(() => {
    if (!offen) return;
    const getippt = (ereignis: KeyboardEvent) => {
      if (ereignis.key === 'Escape') schliessen();
    };
    window.addEventListener('keydown', getippt);
    return () => window.removeEventListener('keydown', getippt);
  }, [offen]);

  /** Was auf der aktuellen Ebene steht – dem Pfad entlang aufgeschlagen. */
  const ebene = (() => {
    if (pfad.length === 0) return null;
    const menu = menus.find((eintrag) => eintrag.titel === pfad[0]);
    if (!menu) return null;
    let titel = menu.titel;
    let eintraege = eintraegeVon(menu);
    for (const stufe of pfad.slice(1)) {
      const tiefer = unterMenu(eintraege, stufe);
      if (!tiefer) break;
      titel = tiefer.titel;
      eintraege = eintraegeVon(tiefer);
    }
    return { titel, eintraege };
  })();
  /** Was gerade gilt, steht neben dem Burger – sonst wäre es hinter ihm versteckt. */
  const stand = menus
    .map((eintrag) => eintrag.wert)
    .filter((wert): wert is string => !!wert)
    .join(' · ');

  const schubladeBlatt = useModalEbene(
    offen ? (
      <View style={styles.schubladeEbene}>
        <View style={styles.schublade} testID="menue-schublade">
          <View style={styles.schubladeKopf}>
            {ebene ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setzePfad((alt) => alt.slice(0, -1))}
                testID="menue-zurueck"
              >
                <Text style={styles.zurueck}>‹ Zurück</Text>
              </Pressable>
            ) : null}
            <Text style={styles.schubladeTitel} numberOfLines={1}>
              {ebene ? ebene.titel : 'Menü'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={schliessen}
              testID="menue-schliessen"
            >
              <Text style={styles.zurueck}>Schließen</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.schubladeScroll} contentContainerStyle={styles.blattInhalt}>
            {ebene
              ? ebene.eintraege.map((eintrag, index) =>
                  // Ein Untermenü führt eine Ebene tiefer, statt aufzuklappen:
                  // Neben dem Finger wäre für ein zweites Blatt kein Platz.
                  eintrag.art === 'unter' ? (
                    <Pressable
                      key={schluessel(eintrag, index)}
                      accessibilityRole="button"
                      disabled={eintrag.deaktiviert}
                      onPress={() => setzePfad((alt) => [...alt, eintrag.titel])}
                      style={({ pressed }) => [
                        styles.eintrag,
                        eintrag.deaktiviert && styles.deaktiviert,
                        pressed && styles.gedrueckt,
                      ]}
                      testID={eintrag.testID}
                    >
                      <Text style={styles.haken} />
                      <View style={styles.eintragText}>
                        <Text style={styles.eintragTitel}>{eintrag.titel}</Text>
                        {eintrag.hinweis ? (
                          <Text style={styles.eintragHinweis}>{eintrag.hinweis}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.pfeil}>›</Text>
                    </Pressable>
                  ) : (
                    <MenuZeile
                      key={schluessel(eintrag, index)}
                      eintrag={eintrag}
                      schliessen={schliessen}
                    />
                  ),
                )
              : menus.map((eintrag) => (
                  <Pressable
                    key={eintrag.titel}
                    accessibilityRole="button"
                    onPress={() => setzePfad([eintrag.titel])}
                    style={({ pressed }) => [
                      styles.eintrag,
                      eintrag.warnung && styles.nameWarnung,
                      pressed && styles.gedrueckt,
                    ]}
                    testID={eintrag.testID}
                  >
                    <View style={styles.eintragText}>
                      <Text style={[styles.eintragTitel, eintrag.warnung && styles.nameTextWarnung]}>
                        {eintrag.titel}
                      </Text>
                      {eintrag.wert ? (
                        <Text style={styles.eintragHinweis}>{eintrag.wert}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.pfeil}>›</Text>
                  </Pressable>
                ))}
          </ScrollView>
        </View>
        {/* Daneben tippen schließt – die Fläche liegt hinter der Schublade. */}
        <Pressable
          style={styles.freiflaeche}
          onPress={schliessen}
          testID="menue-schublade-hintergrund"
        />
      </View>
    ) : null,
  );

  return (
    <View style={styles.zeile} testID={testID}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setzePfad([]);
          setzeOffen(true);
        }}
        style={({ pressed }) => [styles.name, pressed && styles.gedrueckt]}
        testID="menue-burger"
      >
        <Text style={styles.burger}>☰</Text>
        <Text style={styles.nameText}>Menü</Text>
      </Pressable>
      {stand ? (
        <Text style={styles.stand} numberOfLines={1}>
          {stand}
        </Text>
      ) : null}
      {schubladeBlatt}
    </View>
  );
}

/** Schlüssel für die Liste – Trenner haben keinen eigenen Namen. */
function schluessel(eintrag: MenuEintrag, index: number): string {
  return eintrag.art === 'trenner' ? `trenner-${index}` : `${eintrag.art}-${eintrag.titel}`;
}

/**
 * Eine Zeile im aufgeklappten Menü.
 *
 * Links die Spalte für das Häkchen – auch bei den Einträgen ohne, damit die
 * Beschriftungen untereinander stehen und ein Häkchen nichts verrutschen
 * lässt. Nach der Wahl schließt das Menü; nur ein Häkchen lässt es offen, weil
 * man dort selten genau eines umlegt.
 */
function MenuZeile({
  eintrag,
  schliessen,
  ziehtGerade,
  unterOffen,
  onUnter,
  onZeileUeberfahren,
}: {
  eintrag: MenuEintrag;
  schliessen: () => void;
  /** Meldet einen laufenden Zug aus der Palette (nur im aufgeklappten Menü). */
  ziehtGerade?: (laeuft: boolean) => void;
  /** Klappt das Untermenü dieser Zeile gerade auf? */
  unterOffen?: boolean;
  /** Untermenü öffnen – mit der Oberkante dieser Zeile im Fenster. */
  onUnter?: (titel: string, zeileOben: number) => void;
  /** Der Zeiger ist über dieser Zeile (schließt ein fremdes Untermenü). */
  onZeileUeberfahren?: () => void;
}) {
  if (eintrag.art === 'trenner') {
    return (
      <View style={styles.trenner}>
        {eintrag.titel ? <Text style={styles.trennerTitel}>{eintrag.titel}</Text> : null}
      </View>
    );
  }

  if (eintrag.art === 'unter') {
    return (
      <UnterZeile eintrag={eintrag} offen={!!unterOffen} onOeffnen={onUnter} />
    );
  }

  if (eintrag.art === 'ziehbar' && ziehtGerade) {
    return (
      <ZiehZeile eintrag={eintrag} schliessen={schliessen} ziehtGerade={ziehtGerade} />
    );
  }

  const gewaehlt =
    eintrag.art === 'schalter'
      ? eintrag.wert
      : eintrag.art === 'aktion' || eintrag.art === 'ziehbar'
        ? !!eintrag.gewaehlt
        : false;
  const deaktiviert = eintrag.art === 'aktion' && !!eintrag.deaktiviert;

  const waehlen = () => {
    switch (eintrag.art) {
      case 'schalter':
        // Bleibt offen: Wer die Anzeige einstellt, legt meist mehrere um.
        eintrag.onChange(!eintrag.wert);
        return;
      case 'datei':
        schliessen();
        oeffneDateiDialog({
          accept: eintrag.accept,
          mehrere: eintrag.mehrere,
          onDateien: eintrag.onDateien,
        });
        return;
      default:
        schliessen();
        eintrag.onWaehlen();
    }
  };

  return (
    <Pressable
      accessibilityRole={eintrag.art === 'schalter' ? 'checkbox' : 'button'}
      accessibilityState={{ checked: gewaehlt, disabled: deaktiviert }}
      disabled={deaktiviert}
      onPress={waehlen}
      onHoverIn={onZeileUeberfahren}
      style={({ pressed }) => [
        styles.eintrag,
        deaktiviert && styles.deaktiviert,
        pressed && styles.gedrueckt,
      ]}
      testID={eintrag.testID}
    >
      <Text style={styles.haken}>{gewaehlt ? '✓' : ''}</Text>
      <View style={styles.eintragText}>
        <Text style={[styles.eintragTitel, gewaehlt && styles.eintragTitelAktiv]}>
          {eintrag.titel}
        </Text>
        {eintrag.hinweis ? <Text style={styles.eintragHinweis}>{eintrag.hinweis}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * Die Zeile, an der ein Untermenü hängt: Überfahren (oder Antippen) klappt es
 * rechts daneben auf, das Pfeilzeichen sagt, dass es weitergeht – wie das
 * „Speichern unter“ eines Textprogramms.
 *
 * Sie meldet ihre Lage im Fenster, denn das Untermenü wird in die Modal-Ebene
 * gezeichnet und muss wissen, auf welcher Höhe es stehen soll.
 */
function UnterZeile({
  eintrag,
  offen,
  onOeffnen,
}: {
  eintrag: UnterMenu;
  offen: boolean;
  onOeffnen?: (titel: string, zeileOben: number) => void;
}) {
  const zeile = useRef<View>(null);
  const oeffnen = () => {
    if (eintrag.deaktiviert) return;
    const knoten = zeile.current as unknown as HTMLElement | null;
    const kasten = knoten?.getBoundingClientRect();
    onOeffnen?.(eintrag.titel, Math.round(kasten?.top ?? 0));
  };
  return (
    <Pressable
      ref={zeile}
      accessibilityRole="button"
      accessibilityState={{ expanded: offen, disabled: !!eintrag.deaktiviert }}
      disabled={eintrag.deaktiviert}
      onPress={oeffnen}
      onHoverIn={oeffnen}
      style={({ pressed }) => [
        styles.eintrag,
        eintrag.deaktiviert && styles.deaktiviert,
        offen && styles.eintragOffen,
        pressed && styles.gedrueckt,
      ]}
      testID={eintrag.testID}
    >
      <Text style={styles.haken} />
      <View style={styles.eintragText}>
        <Text style={[styles.eintragTitel, offen && styles.eintragTitelAktiv]}>
          {eintrag.titel}
        </Text>
        {eintrag.hinweis ? <Text style={styles.eintragHinweis}>{eintrag.hinweis}</Text> : null}
      </View>
      <Text style={styles.pfeil}>›</Text>
    </Pressable>
  );
}

/**
 * Ein Element der Palette als Menüzeile: antippen wählt das Werkzeug, ziehen
 * legt es auf einer Zelle ab. Während des Zuges macht sich das Menü für
 * Zeiger durchlässig (`ziehtGerade`) – sonst fände das Ablegen unter dem
 * Finger nur das Menü und nicht den Plan darunter.
 */
function ZiehZeile({
  eintrag,
  schliessen,
  ziehtGerade,
}: {
  eintrag: Extract<MenuEintrag, { art: 'ziehbar' }>;
  schliessen: () => void;
  ziehtGerade: (laeuft: boolean) => void;
}) {
  const geste = useZiehGeste({
    onTippen: () => {
      schliessen();
      eintrag.onWaehlen();
    },
    onZiehen: (x, y) => {
      ziehtGerade(true);
      eintrag.onZiehen(x, y);
    },
    onAblegen: (x, y) => {
      ziehtGerade(false);
      schliessen();
      eintrag.onAblegen(x, y);
    },
  });

  return (
    <View
      ref={geste.ref}
      accessibilityRole="button"
      accessibilityState={{ checked: !!eintrag.gewaehlt }}
      style={[styles.eintrag, geste.zieht && styles.zieht, ohneBrowserGeste]}
      testID={eintrag.testID}
      {...geste.handler}
    >
      <Text style={styles.haken}>{eintrag.gewaehlt ? '✓' : ''}</Text>
      <View style={styles.eintragText}>
        <Text style={[styles.eintragTitel, eintrag.gewaehlt && styles.eintragTitelAktiv]}>
          {eintrag.titel}
        </Text>
        {eintrag.hinweis ? <Text style={styles.eintragHinweis}>{eintrag.hinweis}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zeile: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  name: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    maxWidth: '60%',
  },
  nameOffen: { backgroundColor: colors.primary },
  /** Ein Menü, das auf ein Problem hinweist – rot, aber lesbar. */
  nameWarnung: { backgroundColor: colors.dangerBg },
  nameTextWarnung: { color: colors.danger, fontWeight: '700' },
  gedrueckt: { opacity: 0.7 },
  nameText: { fontSize: 14, fontWeight: '600', color: colors.text },
  nameTextOffen: { color: colors.primaryText },
  wert: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  wertOffen: { color: colors.primaryText },
  pfeil: { fontSize: 12, color: colors.textMuted },
  burger: { fontSize: 18, color: colors.text, lineHeight: 20 },
  stand: { flexShrink: 1, fontSize: 13, color: colors.textMuted },

  /** Das aufgeklappte Menü – in der Modal-Ebene, deshalb absolut im Fenster. */
  blatt: {
    position: 'absolute',
    width: MENU_BREITE,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    // Unter einem Blatt (Zellinfo, Vorlage) – das gehört immer nach vorn.
    zIndex: 5,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)',
  },
  blattScroll: { flexGrow: 0, flexShrink: 1 },
  blattInhalt: { paddingVertical: spacing.xs / 2 },

  eintrag: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  deaktiviert: { opacity: 0.4 },
  zieht: { opacity: 0.6 },
  haken: { width: 14, fontSize: 13, fontWeight: '700', color: colors.primary, lineHeight: 19 },
  eintragText: { flex: 1, gap: 1 },
  eintragTitel: { fontSize: 14, color: colors.text, lineHeight: 19 },
  /** Die Zeile, deren Untermenü gerade offen ist. */
  eintragOffen: { backgroundColor: colors.background },
  eintragTitelAktiv: { fontWeight: '700', color: colors.primary },
  eintragHinweis: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },

  trenner: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  trennerTitel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },

  /** Die Schublade liegt links, die Freifläche daneben – wie ein Drawer. */
  schubladeEbene: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 5,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  schublade: {
    width: '86%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  schubladeKopf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  schubladeTitel: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  /** Füllt die Schublade und scrollt darin – „Werkzeuge“ ist länger als der Bildschirm. */
  schubladeScroll: { flex: 1, minHeight: 0 },
  zurueck: { fontSize: 14, fontWeight: '600', color: colors.primary },
  freiflaeche: { flex: 1 },
});
