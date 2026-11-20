# ChargeGeist

**▶ Jetzt spielen: https://emfau88.github.io/chargegeist-rework/**

Am besten auf dem Handy öffnen oder im Desktop-Browser die Handy-Ansicht nutzen. Die App ist auf Englisch und Deutsch und richtet sich nach der Sprache des Browsers. Umstellen kannst du das unter *Einstellungen*.

ChargeGeist ist ein Fokus-Timer mit Geist. Jede Fokusminute lädt deinen Begleiter auf. Jeden Tag gibt es einen Drop mit drei Stilkarten, von denen du eine behältst. Jeder Drop bringt außerdem einen Geisterfunken. Sind alle Funken da, kommt ein Kostümgeist zu dir, komplett so, wie sein Bausatz ihn zeigt. Keine Werbung, kein Konto, nichts verfällt.

## Schnell testen

Unter **Einstellungen → Prototyp-Werkzeuge** gibt es Abkürzungen für den Test:

- **Demo-Tempo:** 1 Sekunde zählt als 1 Minute, damit du nicht 25 Minuten warten musst.
- **25 Fokusminuten hinzufügen**, **Zum nächsten Tag springen**, **Einen Drop bekommen**
- **Plus aktiv** schaltet die Plus-Inhalte frei. Der Kauf ist im Prototyp nur simuliert.
- **Alle Stile und Geister freischalten**, um die ganze Sammlung zu sehen.
- **Einstieg neu starten** zeigt das Onboarding noch einmal.

Der Spielstand liegt nur im Browser (localStorage).

## Was drin ist

- **Fokus-Timer:** 5 bis 180 Minuten, Pause, Tags, ruhige Hintergrundgeräusche, Pausenvorschlag danach. Das Ergebnis baut sich nach der Sitzung Zeile für Zeile auf, ein erreichtes Tagesziel bekommt eine eigene Zeile, und ein Tipp überspringt den Ablauf.
- **6 Begleiter:** Volti, Ember oder Luna begleiten dich von Anfang an. Die anderen fünf kommen nach 3, 8, 15, 25 und 40 Fokusstunden dazu.
- **10 Kostümgeister**, zum Beispiel Kürbis-Pip, Ronin, Hazel und Kitsu. Sie kommen komplett mit Kostüm, sobald sie genug Geisterfunken haben (2 bis 5, je nach Seltenheit). Du wählst selbst, welchen Geist du gerade auflädst.
- **Stil statt Verkleidung:** 10 Auren (Partikel um den Geist), 9 Schimmer (die Farbe von Leuchten, Ladung und Funken) und 10 Talismane (ein kleiner Glücksbringer, der neben dem Geist schwebt). Jeder Geist trägt pro Art einen Stil, und die Form der Geister bleibt immer unverändert.
- **Tagesdrop:** 3 Stilkarten aufdecken, 1 behalten, dazu ein Geisterfunke. Rahmen und Fußband jeder Karte zeigen ihre Seltenheit, und bei einer epischen oder mythischen Karte dunkelt der Bildschirm ab. Auf hohen Bildschirmen steht die gewählte Karte danach groß über den beiden anderen. Die Chancen stehen offen in der App, und nach spätestens 10 Drops kommt etwas Episches oder Besseres. Doppelte Stile und Funken für schon volle Geister werden zu Wunschenergie.
- **Wunsch:** Jede Fokusminute bringt Wunschenergie. Damit holst du dir gezielt einen Stil.
- **Ladewoche und Wochenboss:** 5 aktive Tage pro Woche bringen einen Bonus-Drop. Wer das Wochenziel schafft, beruhigt den Boss, und der kommt zu dir. Ein verpasster Tag setzt nichts zurück.
- **Anfassen:** Tippen, Streicheln, Halten und Kitzeln. Gestreichelt schließt der Geist genießerisch die Augen und summt, gehalten wird er zusammengedrückt, gekitzelt kichert er und schlägt einen Salto. Senkrechtes Wischen scrollt weiter die Seite.
- **Bindung pro Geist:** Gemeinsame Fokusminuten (1 Herz pro 5 Minuten) und die Gesten (je 1 Herz am Tag) füllen die Bindung. Bei 10, 40, 100 und 250 Herzen steigt sie: Vertraut (er begrüßt dich mit seinem Spruch), Freund (er umarmt dich nach langem Streicheln), Bester Freund (Halten wird zum High-Five) und Seelenverwandt (goldener Rahmen). Herzen und Stufen sinken nie.
- **Lebendiger Himmel:** Der Standard-Himmel folgt der Tageszeit, Nebelschleier ziehen langsam, ab und zu fällt eine Sternschnuppe. Darunter liegt ein Tal zwischen Hügeln mit ein paar Tannen. Sonne und Mond gehen hinter den Hügeln auf und unter, und der Mond zeigt die Phase des echten. Im Fokus atmet ein Schein in der Farbe des Geists, ein wartender Drop schimmert golden, und nach einer Sitzung regnet es Funken. Die Bewegung ist abschaltbar und bei „Bewegung reduzieren“ aus.
- **Erfolge** mit Wunschenergie als Belohnung, dazu Statistiken und eine Monatskarte zum Teilen.
- **Plus (einmalig):** Hintergründe, Klangwelten, ausführliche Statistiken und der Unterstützer-Schimmer Herzlicht. Plus verkauft keine Drops, Geister oder Tempo.

Die Geister sind animierte Rigs aus Einzelteilen und werden mit WebGL gerendert. Sie atmen, blinzeln, jubeln und reagieren auf Gesten. Töne entstehen im Browser, ohne Audiodateien. Auren laufen als leichte SVG-Partikel, der Talisman folgt dem Geist mit etwas Verzögerung und weicht im Fokus dem Ladering aus.

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
| `app/src/rig/` | Geister-Rig: WebGL-Renderer, Animation, Talisman, Gesten-Erkennung |
| `app/src/fx/` | Auren (Partikel) und Schimmer (Farben) |
| `app/src/state/` | Spielstand und alle Aktionen |
| `app/src/logic/` | Drops, Fortschritt, Boss, Erfolge, Bindung, Tageszeit des Himmels |
| `app/tools/` | Import der Bausätze und Talismane, App-Icon, Screenshot-Skripte |
| `rig_input/` | Die Bausatz-Bögen als Vorlage |
| `rig_parts/` | Die daraus geschnittenen Einzelteile |
| `rig_tools/` | Python-Werkzeuge zum Schneiden und Prüfen der Teile |

Neue Bausätze übernehmen (aus dem Ordner `chargegeist_rework`):

```bash
python -I app/tools/import_kits.py rig_parts/kits rig_tools rig_parts app
```

Talismane neu schneiden (aus demselben Ordner):

```bash
python -I app/tools/import_charms.py rig_input/talismane_v1.png app
```
