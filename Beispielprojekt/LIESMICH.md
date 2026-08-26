# Beispiel-Projektordner

So sieht ein Projektordner für den [Exam Manager](../README.md) aus. Auf der
Startseite der App „Projektordner auswählen“ anklicken und diesen Ordner
wählen – die Schritte holen sich ihre Eingaben dann von selbst.

**Der Ordner entscheidet.** Eine Datei wird nur gelesen, wenn sie im
vorgesehenen Ordner mit der passenden Endung liegt; alles andere zeigt die App
als „nicht zugeordnet“ an und rührt es nicht an.

| Ordner | Dateien | Was hineingehört |
|---|---|---|
| 0_Input_Klausuranmeldungen/ | *.xlsx | Anmeldungen zur Klausur, wie sie das Prüfungsamt schickt |
| 0_Input_Kurs_Teilnehmer_Studip_Liste/ | *.csv | Teilnehmendenexport der Veranstaltung aus Stud.IP |
| 0_Input_Vips_Notenliste/ | *.csv | Notenliste aus VIPS mit den Punkten der Aufgabenblätter |
| Zulassungen/ | *zulassungen*.csv | je Jahr eine Liste der Zugelassenen |
| Raeume/ | *.csv | Räume und ihre leeren Raster, jedes Jahr wiederverwendbar |
| 2_Zulassungs_PDFs_Export/ | *.pdf | erzeugte Zulassungs-PDFs (Schritt 2) |
| 3_Klausur_Teilnehmende_Export/ | *.csv | Angemeldete mit und ohne Zulassung (Schritt 3, optional) |
| 4_Raumzuteilung_Export/ | *.csv | Sitzplan und Raumbelegung (Schritt 4) |

Die Export-Ordner füllt die App. Der Browser darf nicht auf die Festplatte
zurückschreiben – deshalb gibt es auf jedem Screen „Aktualisiertes Projekt
herunterladen“: die ZIP entpacken und den eigenen Ordner damit ersetzen.

## Nur erfundene Daten

Dieser Ordner gehört zum öffentlichen Beispiel-Datensatz des Repos (siehe
README). Ein echter Projektordner enthält Personendaten und hat in einem
öffentlichen Repository nichts verloren.

Erzeugt von `tools/build_sample_project.py` – nicht von Hand bearbeiten.
