// Firebase-Zugang für den Vokabeltrainer.
// So füllst du das aus (siehe README.md, Schritt 2):
// Firebase-Konsole → Projekteinstellungen → Allgemein → „Meine Apps“ → Web-App → „SDK-Einrichtung und -Konfiguration“ → „Konfiguration“.
// Den dort angezeigten Block firebaseConfig = { … } hier einsetzen, statt null.
// Diese Werte sind für Web-Apps gedacht und dürfen öffentlich im Repo stehen; geschützt wird die Datenbank über die Regeln (firestore.rules).

export const firebaseConfig = {
  apiKey: "AIzaSyB-EDADz0xyUgBIgnTnMd67af0jrz2zYbQ",
  authDomain: "vokabeltrainer-9b971.firebaseapp.com",
  projectId: "vokabeltrainer-9b971",
  storageBucket: "vokabeltrainer-9b971.firebasestorage.app",
  messagingSenderId: "4350569218",
  appId: "1:4350569218:web:db2ac91432bd77aba4f01b"
};

// Unter diesem Namen liegt der Fortschritt in Firestore: learners/<LEARNER_ID>/…
export const LEARNER_ID = "moritz";
