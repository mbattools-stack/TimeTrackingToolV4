# TimeTrack

Einfaches Zeiterfassungs-Tool. Keine Datenbank, kein Backend – alles läuft im Browser via `localStorage`.

## Features

- **Nutzer-Erkennung** – Name wird lokal gespeichert, Daten bleiben beim nächsten Besuch erhalten
- **Projekte** – Erstellen, bearbeiten, archivieren, löschen (farbcodiert)
- **One-Click Timer** – Projekt antippen → Timer läuft. Nochmal → stoppt
- **Persistenter Timer** – Startzeit wird gespeichert, Timer läuft bei Reload/Tab-Wechsel weiter
- **Tagesübersicht** – Alle Einträge + Gesamtzeit
- **Wochenübersicht** – Balkendiagramm (Mo–So) + Aufschlüsselung nach Projekt
- **Manuelle Eingabe** – Zeiten nachträglich erfassen
- **CSV-Export** – Wochendaten als Excel-kompatible CSV
- **Responsive** – Desktop + Smartphone
- **Dark Theme** – Augenfreundlich

## Deployment

### Auf Netlify via GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/DEIN-USER/timetrack.git
git push -u origin main
```

In Netlify:
1. **Add new site → Import an existing project → GitHub**
2. Repository auswählen
3. Build settings: **kein Build Command**, Publish Directory: `/`
4. Deploy

Fertig. Keine Config, keine API-Keys, keine Umgebungsvariablen.

## Projektstruktur

```
timetracker/
├── index.html      # HTML-Struktur
├── style.css       # Styling (Dark, Industrial-Warm)
├── app.js          # Komplette App-Logik
├── netlify.toml    # Netlify Routing
└── README.md
```

## Technologie

- **Vanilla HTML/CSS/JS** – kein Framework, kein Build-Step
- **localStorage** – Browser-native Persistenz
- **Google Fonts** – IBM Plex Sans/Mono, Anybody

## Hinweis

Daten liegen im Browser des jeweiligen Geräts. Bei Cache-Löschung oder Browser-Wechsel gehen die Daten verloren. Für teamweites Tracking oder geräteübergreifende Synchronisierung wäre eine Datenbank-Lösung (z.B. Supabase) nötig.
