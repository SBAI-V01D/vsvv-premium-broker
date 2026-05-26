# AI Autonomous Execution Policy
**Version:** 1.0 | **Gilt für:** Alle KI-gestützten Änderungen in diesem Projekt

---

## Grundprinzip

Wenn der Benutzer einen klaren Implementierungsauftrag gibt:
1. Relevante Dateien lesen
2. Root Cause analysieren
3. Änderung **direkt umsetzen**
4. Nur bei destruktiven Risiken nachfragen
5. Ergebnis kurz reporten

**Kein Zwischenstopp. Kein "Ich werde jetzt…". Keine Bestätigungsschleife.**

---

## AUTO EXECUTE — Keine Rückfrage erforderlich

Diese Änderungen werden **sofort und ohne Bestätigung** umgesetzt:

### UI & Frontend
- Layouts, Darstellungen, Farben, Abstände
- Konsistenz zwischen Modulen (z.B. Verträge-Ansicht angleichen)
- Responsive Design, Mobile-Optimierung
- Komponenten erstellen, refactoren, extrahieren
- Neue Felder in Formularen hinzufügen
- Ladeanimationen, Empty States, Fehlermeldungen

### Performance & Code-Qualität
- React.memo, useMemo, useCallback
- Query-Optimierungen (staleTime, caching)
- Refactoring: große Dateien aufteilen, doppelten Code eliminieren
- Import-Optimierungen

### Datenerweiterungen (additiv)
- Neue Felder zu bestehenden Entities hinzufügen
- Neue optionale Properties im Schema
- Neue Enum-Werte ergänzen
- Index- / Hilfsfelder

### Governance & Monitoring (additiv)
- Neue AuditLog-Einträge hinzufügen
- Incident-Kategorien erweitern
- Governance-Regeln ergänzen (nicht ändern)
- Logging verbessern
- Neue Validierungen hinzufügen

### Backend-Funktionen (neue, additive)
- Neue Backend-Funktionen erstellen
- Bestehende Funktionen um neue Features erweitern (ohne Kernlogik zu ändern)
- Report-Funktionen, Analyse-Funktionen

### Dokumente & Konfiguration
- Docs erstellen und aktualisieren
- Neue Automations einrichten
- Email-Templates

---

## REQUIRES CONFIRMATION — Rückfrage obligatorisch

Diese Änderungen **erfordern explizite Bestätigung** vor der Umsetzung:

### Datenverlust-Risiko
- Entity-Felder löschen (bestehende Daten gehen verloren)
- Entity-Typen ändern (z.B. string → number)
- Bestehende Enum-Werte entfernen
- Bulk-Delete-Operationen

### Sicherheit & Zugriff
- RLS-Regeln ändern (read/write/delete Berechtigungen)
- Rollen-Logik ändern (admin, broker, assistenz)
- Tenant-Isolation-Logik (organization_id Checks)
- Auth-Flows, Login, Session-Management

### Finanzlogik
- Provisionsberechnungen ändern
- Auszahlungslogik
- Stornoberechnungen
- Buchungslogik (AccountingEntry, Payout)

### Protected Core (siehe PROTECTED_CORE_ARCHITECTURE.md)
- Approval Engine
- Audit-Trail-Struktur
- Governance Score Berechnung
- PDF-Integritäts-Mechanismus

### Destruktive Migrationen
- Bestehende Felder umbenennen
- Entity-Relationen grundlegend ändern
- Datenbank-Schema-Brüche

---

## Risiko-Bewertungsmatrix

| Änderungstyp | Risiko | Aktion |
|---|---|---|
| UI-Anpassung | Niedrig | Auto Execute |
| Neues Feld hinzufügen | Niedrig | Auto Execute |
| Formular erweitern | Niedrig | Auto Execute |
| Performance-Fix | Niedrig | Auto Execute |
| Refactoring | Niedrig | Auto Execute |
| Neue Backend-Funktion | Mittel | Auto Execute |
| Bestehendes Feld ändern | Mittel | Auto Execute (wenn non-breaking) |
| RLS-Regel ändern | Hoch | Confirmation Required |
| Feld löschen | Hoch | Confirmation Required |
| Finanzlogik ändern | Kritisch | Confirmation Required |
| Auth ändern | Kritisch | Confirmation Required |

---

## Read → Plan → Execute Workflow

```
1. Dateien lesen (parallel, effizient)
2. Root Cause identifizieren
3. Änderungsplan intern erstellen
4. Änderungen direkt umsetzen
5. Kurzes Ergebnis-Report (1-2 Sätze)
```

**NICHT:**
- Nach dem Lesen warten
- Plan "ankündigen" und auf Bestätigung warten
- Entschuldigungen für klare Aufträge

---

## Anti-Permission-Loop Regeln

**Nicht erneut nachfragen wenn:**
- Ein klarer Implementierungsauftrag vorliegt
- Die Aktion im angeforderten Scope liegt
- Keine destruktive Änderung stattfindet
- Der Benutzer bereits einmal bestätigt hat

**Das eliminiert:**
- "Entschuldigung für unaufgeforderte Änderungen…"
- "Darf ich die Datei lesen?" (immer erlaubt)
- Mehrfache Bestätigungsanfragen für dasselbe Thema

---

## Confidence-Based Execution

Die KI bewertet jede Änderung nach:

1. **Reversibilität** — Kann es rückgängig gemacht werden?
2. **Scope** — Liegt es im angefragten Bereich?
3. **Datenverlust** — Gehen bestehende Daten verloren?
4. **Security Impact** — Betrifft es Zugriff oder Berechtigungen?

→ Nur wenn 3 oder 4 = JA → Confirmation Required

---

## Dieses Projekt: Spezifische Regeln

### Immer Auto Execute
- Alle Änderungen in `/pages/`, `/components/` (UI)
- Neue Felder in `entities/*.json` (additiv)
- Neue Docs in `/docs/`
- Neue Backend-Funktionen in `/functions/`
- Sidebar, Navigation, Layout

### Immer Confirmation Required
- Änderungen an `rls` in Entity-Schemas
- Änderungen an `functions/guardDataAccess`, `guardCommissionAccess`, `guardRoleAccess`
- Änderungen an Finanzfunktionen (`calculateCommissions`, `executePayoutTransfers`, etc.)
- Löschen von Entity-Feldern die bereits Daten enthalten

---

*Erstellt: 2026-05-26 | Projekt: Swiss Broker Platform*