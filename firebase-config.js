// Firebase-Zugang für den Vokabeltrainer.
// So füllst du das aus (siehe README.md, Schritt 2):
// Firebase-Konsole → Projekteinstellungen → Allgemein → „Meine Apps“ → Web-App → „SDK-Einrichtung und -Konfiguration“ → „Konfiguration“.
// Den dort angezeigten Block firebaseConfig = { … } hier einsetzen, statt null.
// Diese Werte sind für Web-Apps gedacht und dürfen öffentlich im Repo stehen; geschützt wird die Datenbank über die Regeln (firestore.rules).

export const firebaseConfig = null;

// Unter diesem Namen liegt der Fortschritt in Firestore: learners/<LEARNER_ID>/…
export const LEARNER_ID = "moritz";
