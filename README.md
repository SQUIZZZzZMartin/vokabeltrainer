# Vokabeltrainer

Lernseite für Moritz' Englisch-LK-Vokabeln: Karteikarten, Auswahl und Paare – ohne Tippen.
Beim ersten Öffnen gibt man einmal den Vornamen ein (oder tippt einen schon vorhandenen Namen an);
das Gerät merkt sich den Namen. Der Fortschritt liegt in Firebase (Firestore) unter `learners/<name>/…`.
Ohne Firebase-Verbindung bleibt er im Browser.

## Einrichtung

### 1. Repo hochladen und GitHub Pages einschalten
```
git init -b main && git add -A && git commit -m "Vokabeltrainer"
gh repo create vokabeltrainer --public --source . --push
gh api -X POST repos/{owner}/vokabeltrainer/pages -f "source[branch]=main" -f "source[path]=/"
```

### 2. Firebase verbinden
1. Projekteinstellungen → Allgemein → Meine Apps → Web-App (`</>`) → Konfiguration kopieren → in `firebase-config.js` statt `null` einsetzen.
2. Authentication → Sign-in method → **Anonym** aktivieren.
3. Authentication → Einstellungen → Autorisierte Domains → `<account>.github.io` hinzufügen.
4. Firestore Database anlegen (Produktionsmodus, Standort Europa).
5. Firestore → Regeln: Inhalt von `firestore.rules` einsetzen (bei bestehenden Regeln nur den `learners`-Block ergänzen) → Veröffentlichen.
6. `git add -A && git commit -m "Firebase" && git push`

## Daten in Firestore
- `learners/<name>` – Anzeigename, zuletzt geübt
- `learners/<name>/progress/<wort-id>` – Fach (1–5), richtig/falsch, zuletzt geübt
- `learners/<name>/sessions/<id>` – jede Runde mit Datum, Liste, Modus und Ergebnis

Hinweis: Wer den Link kennt, kann die Seite benutzen und damit auch den Fortschritt unter einem Namen sehen
oder ändern. Es stehen dort nur Vornamen und Lernstände, nichts weiter.

## Neue Vokabelliste
PDF in den Ordner „Sprachlernapp“ legen und Jonas bitten, sie einzubauen.
Technisch: `lists/<name>.json` anlegen und als letzten Eintrag in `lists/index.json` eintragen –
die letzte Liste ist automatisch die voreingestellte. Fortschritt hängt an der `id` jedes Eintrags.
