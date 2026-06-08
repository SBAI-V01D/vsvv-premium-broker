# KKV CRM — Local Setup Guide

## Schnellstart (3 Schritte)

```bash
# 1. Script ausführbar machen
chmod +x setup.sh

# 2. Setup starten (installiert alles automatisch)
./setup.sh

# 3. Dev-Server starten
cd kkv-crm && npm run dev
```

## Was das Script macht

| Schritt | Aktion |
|---------|--------|
| 1 | Prüft Node.js 18+ und Git |
| 2 | Erstellt Vite + React Projektstruktur |
| 3 | Installiert alle 40+ npm Pakete |
| 4 | Konfiguriert Tailwind CSS mit Design Tokens |
| 5 | Erstellt Vite Config mit `@/` Alias |
| 6 | Schreibt `index.css` (Premium Light Blue Enterprise) |
| 7 | Erstellt 7 Core Entity Schemas |
| 8 | Erstellt `App.jsx` Router Shell |
| 9 | Erstellt `.env` Template |
| 10 | Git init + Initial Commit |
| 11 | Azure DevOps Remote hinzufügen |
| 12 | Push nach Azure |

## Nach dem Setup

### Source Code hinzufügen
Da Base44 ~300 Dateien hat, empfehlen wir:

```
Base44 Dashboard → Settings → GitHub Sync
→ GitHub Repo verbinden
→ git clone https://github.com/dein/repo
→ cp -r repo/src/* kkv-crm/src/
→ git add . && git commit -m "feat: add all source files"
→ git push azure main
```

### Azure DevOps Token erneuern
Falls der Push fehlschlägt:
1. Gehe zu: https://dev.azure.com/swissbotsai/_usersSettings/tokens
2. Erstelle neues PAT mit "Code (Read & Write)" Berechtigung
3. Ersetze `TOKEN` in der AZURE_REMOTE Variable
4. `git push -u azure main`

## Projektstruktur

```
kkv-crm/
├── src/
│   ├── api/base44Client.js      ← Base44 SDK
│   ├── App.jsx                  ← Router (40+ Routes)
│   ├── main.jsx                 ← Entry Point
│   ├── index.css                ← Design Tokens
│   ├── pages/                   ← ~40 Pages
│   │   └── portal/              ← Kunden-Portal
│   ├── components/              ← ~100+ Components
│   ├── entities/                ← 29 JSON Schemas
│   ├── functions/               ← ~150 Deno Functions
│   ├── agents/                  ← AI Agents
│   ├── lib/                     ← Utils, Hooks, Context
│   └── hooks/                   ← Custom React Hooks
├── docs/
│   ├── REBUILD_COMPLETE.md      ← Vollständige Doku
│   └── DATABASE_EXPORT.json     ← Alle 29 Entity Schemas
├── tailwind.config.js
├── vite.config.js
├── package.json
└── .env                         ← ⚠️ Ausfüllen!
```

## Wichtige Konfiguration (.env)

```env
VITE_BASE44_APP_ID=deine_app_id_hier
```

Die App ID findest du in: Base44 Dashboard → Settings → App ID

## Dependencies Übersicht

| Kategorie | Pakete |
|-----------|--------|
| Core | React 18, React DOM, React Router v6 |
| UI | shadcn/ui, Radix UI (15+ Komponenten), Lucide Icons |
| State | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Data | xlsx, date-fns, lodash, moment |
| PDF | jsPDF |
| AI/ML | Base44 SDK (InvokeLLM integriert) |
| Animation | Framer Motion |
| Maps | React Leaflet |
| DnD | @hello-pangea/dnd |
| 3D | Three.js |

## Vollständige Dokumentation

- **docs/REBUILD_COMPLETE.md** — Alle Entities, Functions, Routes, Automations
- **docs/DATABASE_EXPORT.json** — Alle 29 Entity Schemas als JSON
- **pages/ChatExport** → `/chat-export` — Chat-Verlauf mit Projekt-History