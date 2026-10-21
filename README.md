# Vokabeltrainer

Lernseite für Moritz' Englisch-LK-Vokabeln: Karteikarten, Auswahl und Paare – ohne Tippen.
Der Fortschritt wird nach Google-Anmeldung in Firebase (Firestore) gespeichert, sonst nur im Browser.

## Einrichtung

### 1. Repo hochladen und GitHub Pages einschalten
```
cd "<dieser Ordner>"
git init -b main && git add -A && git commit -m "Vokabeltrainer"
gh repo create vokabeltrainer --public --source . --push
gh api -X POST repos/{owner}/vokabeltrainer/pages -f "source[branch]=main" -f "source[path]=/"
```
Die Seite erscheint nach 1–2 Minuten unter `https://<account>.github.io/vokabeltrainer/`.

### 2. Firebase verbinden
1. Firebase-Konsole → dein Projekt → **Projekteinstellungen → Allgemein → Meine Apps** → Web-App hinzufügen (`</>`), falls noch keine da ist.
2. Den angezeigten `firebaseConfig`-Block in **firebase-config.js** statt `null` einsetzen.
3. **Authentication → Anmeldemethode → Google** aktivieren.
4. **Authentication → Einstellungen → Autorisierte Domains** → `<account>.github.io` hinzufügen.
5. **Firestore Database** anlegen (falls noch nicht vorhanden).
6. **Firestore → Regeln**: Inhalt von `firestore.rules` einfügen, die beiden E-Mail-Adressen eintragen, **Veröffentlichen**.
7. `firebase-config.js` committen und pushen.

## Daten in Firestore
- `learners/moritz/progress/<wort-id>` – Fach (1–5), richtig/falsch, zuletzt geübt
- `learners/moritz/sessions/<id>` – jede Runde mit Datum, Modus und Ergebnis

## Neue Vokabelliste
Die PDF in den Ordner „Sprachlernapp“ legen und Jonas bitten, sie einzubauen.
Technisch: `lists/<name>.json` anlegen und in `lists/index.json` eintragen. Jeder Eintrag hat
`id`, `cat`, `en` und je nach Art `basic`, `de`, `note`, `ex`, `gap`, `type`.
Fortschritt hängt an der `id` – bestehende ids nicht umbenennen.
