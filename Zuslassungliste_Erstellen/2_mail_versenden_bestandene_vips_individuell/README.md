# 2. Studierende über ihre Zulassung informieren

## Liste aller Teilnehmenden mit Zulassung erstellen

Nimmt den Stud.IP-Export, prüft jede Person gegen den kompletten
Zulassungsbestand (`../../Zulassungen`) und liefert alle, die eine Zulassung
haben – neu erworben oder aus einem früheren Jahr:

```bash
python3 1_erstelle_liste_mit_zulassung_aus_teilnehmer_liste.py \
  --teilnehmende Teilnehmendenexport_Beispielveranstaltung.csv \
  --zulassungen ./../../Zulassungen \
  --out-ohne-mail ./mitZulassungOhneMail.csv \
  --out-mit-mail ./mitZulassungMitMail.csv
```

Zwischenergebnis ist `search.csv` (alle Teilnehmenden als Suchschlüssel);
Lehrende und Tutor:innen stehen dort ohne Matrikelnummer und finden deshalb
keine Treffer.

## Option A: Mail über Apple Mail

```bash
python3 sendMail.py \
  --csv mitZulassungMitMail.csv \
  --vorlage mailVorlage.md \
  --title "Zulassung für <Veranstaltung>" \
  --sender_email absender@example.org \
  --veranstaltung "<Veranstaltung>"
```

In `mailVorlage.md` stehen die Platzhalter `${Vorname}`, `${Nachname}` und
`${Veranstaltung}`. Die Grußformel vor dem Versand anpassen.

## Option B: Stud.IP „Klausureinsicht“

Jede Person sieht dabei nur ihr eigenes Schreiben: Das Werkzeug gibt genau die
Datei frei, deren **Dateiname der Matrikelnummer entspricht**. Deshalb heißt
jedes PDF `<Matrikelnummer>.pdf` – der Name ist die Zuordnung.

1. **Unsichtbaren Dateiordner anlegen** und den Zugriff auf „Zugriff auf
   Dateien per Link“ setzen. Sichtbar zeigte der Ordner jeder Person die
   Schreiben aller anderen, also die Matrikelnummern des ganzen Kurses.
2. **PDFs erzeugen** (eine Datei je Person):
   ```bash
   python3 2_b_studip_klausureinsicht_zulassung.py \
     --mitZulassungMitMail ./mitZulassungMitMail.csv \
     --output ./studipKlausurzulassungPdfs
   ```
   Dasselbe tun die Web-App (Schritt 2) und `yarn 2_zulassung … --out <Ordner>`.
3. **Die Dateien in den unsichtbaren Ordner hochladen.**
4. **Werkzeug „Klausureinsicht“ aktivieren** und seinen Reiter in der
   Verwaltung umbenennen: „Klausur Zulassung“ (für die Sitzpläne aus Schritt 4
   entsprechend „Klausur Sitzplatz“).
5. **Im Werkzeug den Ordner auswählen**, in dem die PDFs liegen.
6. **Rundmail** schreiben, dass die Zulassung dort einsehbar ist (siehe
   `../3_rundmail_an_alle`).
