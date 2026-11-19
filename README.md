# ChargeGeist

**▶ Jetzt spielen: https://emfau88.github.io/chargegeist-rework/**

Am besten auf dem Handy öffnen oder im Desktop-Browser die Handy-Ansicht nutzen. Die App ist auf Englisch und Deutsch und richtet sich nach der Sprache des Browsers. Umstellen kannst du das unter *Einstellungen*.

ChargeGeist ist ein Fokus-Timer mit Geist. Jede Fokusminute lädt deinen Begleiter auf. Jeden Tag gibt es einen Drop mit drei Kostümteilen, von denen du eins behältst. Ein komplettes Outfit bringt einen neuen Geist. Keine Werbung, kein Konto, nichts verfällt.

## Schnell testen

Unter **Einstellungen → Prototyp-Werkzeuge** gibt es Abkürzungen für den Test:

- **Demo-Tempo:** 1 Sekunde zählt als 1 Minute, damit du nicht 25 Minuten warten musst.
- **25 Fokusminuten hinzufügen**, **Zum nächsten Tag springen**, **Einen Drop bekommen**
- **Plus aktiv** schaltet die Plus-Inhalte frei. Der Kauf ist im Prototyp nur simuliert.
- **Alle Teile und Geister freischalten**, um die ganze Garderobe zu sehen.
- **Einstieg neu starten** zeigt das Onboarding noch einmal.

Der Spielstand liegt nur im Browser (localStorage).

## Was drin ist

- **Fokus-Timer:** 5 bis 180 Minuten, Pause, Tags, ruhige Hintergrundgeräusche, Pausenvorschlag danach.
- **6 Begleiter:** Volti, Ember oder Luna begleiten dich von Anfang an. Die anderen fünf kommen nach 3, 8, 15, 25 und 40 Fokusstunden dazu.
- **10 Kostümgeister** mit eigenem Outfit, zum Beispiel Kürbis-Pip, Ronin, Hazel und Kitsu.
- **25 Kostümteile:** Hüte, Kragen, Brillen, Schwänze, Laterne und Sense. Begleiter können sie anziehen, eins pro Stelle.
- **Tagesdrop:** 3 Karten aufdecken, 1 behalten. Die Chancen stehen offen in der App, und nach spätestens 10 Drops kommt etwas Episches oder Besseres.
- **Wunsch:** Jede Fokusminute bringt Wunschenergie. Damit holst du dir gezielt ein Teil.
- **Ladewoche und Wochenboss:** 5 aktive Tage pro Woche bringen einen Bonus-Drop. Wer das Wochenziel schafft, beruhigt den Boss, und der kommt zu dir. Ein verpasster Tag setzt nichts zurück.
- **Erfolge** mit Wunschenergie als Belohnung, dazu Statistiken und eine Monatskarte zum Teilen.
- **Plus (einmalig):** Hintergründe, Klangwelten, ausführliche Statistiken und ein Unterstützer-Abzeichen. Plus verkauft keine Teile, Geister oder Tempo.

Die Geister sind animierte Rigs aus Einzelteilen und werden mit WebGL gerendert. Sie atmen, blinzeln, jubeln und reagieren auf Antippen. Kostümteile werden mit dem Körper verformt oder hängen an den Händen.

## Lokal starten

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npx vitest run     # Tests
npm run build      # Produktions-Build nach app/dist
```

Jeder Push auf `main` baut die App und veröffentlicht sie über GitHub Actions auf GitHub Pages (`.github/workflows/pages.yml`).

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `app/` | Die Web-App (Vite, Preact, TypeScript) |
| `app/src/rig/` | Geister-Rig: WebGL-Renderer, Animation, Kostümteile |
| `app/src/state/` | Spielstand und alle Aktionen |
| `app/src/logic/` | Drops, Fortschritt, Boss, Erfolge |
| `app/tools/` | Import der Bausätze, App-Icon, Screenshot-Skript |
| `rig_input/` | Die Bausatz-Bögen als Vorlage |
| `rig_parts/` | Die daraus geschnittenen Einzelteile |
| `rig_tools/` | Python-Werkzeuge zum Schneiden und Prüfen der Teile |

Neue Bausätze übernehmen (aus dem Ordner `chargegeist_rework`):

```bash
python -I app/tools/import_kits.py rig_parts/kits rig_tools rig_parts app
```
