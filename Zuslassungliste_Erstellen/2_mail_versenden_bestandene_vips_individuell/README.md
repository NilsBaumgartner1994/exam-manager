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

- Plugin „Klausureinsicht“ aktivieren und Reiter in der Verwaltung zu
  „Klausur Zulassung“ umbenennen.
- Unsichtbaren Dateiordner anlegen, Zugriff auf Dateien per Link.
- PDFs erzeugen (eine Datei `<Matrikelnummer>.pdf` je Person):
  ```bash
  python3 2_b_studip_klausureinsicht_zulassung.py \
    --mitZulassungMitMail ./mitZulassungMitMail.csv \
    --output ./studipKlausurzulassungPdfs
  ```
- Die Dateien in den unsichtbaren Ordner hochladen.
- Rundmail schreiben, dass die Zulassung dort einsehbar ist (siehe `../3_rundmail_an_alle`).
