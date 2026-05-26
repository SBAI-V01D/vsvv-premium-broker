# Protected Core Architecture
## Enterprise Governance Platform — Schutzklassifizierung

**Version:** 1.0  
**Erstellt:** 2026-05-26  
**Status:** AKTIV — Pflichtlektüre vor jeder Architekturänderung

---

## Zweck

Dieses Dokument definiert welche Bereiche der Plattform **niemals automatisch durch KI-Prompts, Automationen oder unkontrollierte Änderungen modifiziert** werden dürfen.

Das System hat Enterprise-Niveau erreicht. Ab diesem Punkt gilt:

> **Architektur ist wichtiger als Features.**

---

## 🔴 PROTECTED CORE — Niemals automatisch modifizieren

### Approval Engine
- `AdvisoryDossier.advisor_approved`
- `AdvisoryDossier.approval_history`
- `AdvisoryDossier.approved_at / approved_by`
- `PdfExportLog` (immutable by design)
- Funktion: `repairApprovalMetadata`

**Regel:** Approval-Logik darf nur durch explizite Admin-Aktion geändert werden. Niemals durch Automation oder KI-Batch.

---

### Audit Trail & Event Bus
- Entity: `AuditLog` — **WRITE-ONLY, nie löschen**
- Funktion: `auditLogWrite` — Schema v1.0+ eingefroren
- Entity-Automationen: Contract/Customer/Dossier/CommissionEntry → auditLogWrite

**Regel:** AuditLog-Einträge sind unveränderlich. Schema-Erweiterungen via `audit_schema_version` versionieren. Niemals bestehende Felder umbenennen.

---

### Governance Score Engine
- Funktion: `snapshotGovernanceScore` — Domain-Weights und 4-Klassen-Matrix
- Entity: `GovernanceScoreSnapshot`
- Gewichtungen: `{ compliance: 0.25, tenant_integrity: 0.20, audit_trail: 0.20, ai_reliability: 0.15, incident_health: 0.10, data_quality: 0.10 }`

**Regel:** Gewichtungen nur nach schriftlicher Entscheidung ändern. Jede Änderung erzeugt neuen Snapshot-Vergleich.

---

### Incident Intelligence Engine
- Entity: `EnterpriseIncident` — `validation_run_id` als Kategorie-Schlüssel (idempotent)
- 4-Klassen-Matrix: Production (12) / Governance (5) / Technical Debt (2) / Advisory (0.8)
- Caps: Production 50, Governance 25, TechDebt 10, Advisory 3
- Funktionen: `correlateIncidents`, `validateGovernanceCompliance`, `checkRelationshipIntegrity`

**Regel:** Caps und Klassen-Zuordnungen nicht ohne Begründung ändern. Sie bestimmen den Governance Score direkt.

---

### Tenant Isolation
- Pflichtfeld `organization_id` auf: Customer, Contract, Application, CommissionEntry, AdvisoryDossier, AiFinding, EnterpriseIncident
- RLS-Regeln in: `entities/Contract.json`, `entities/Application.json`

**Regel:** RLS niemals ohne Admin-Freigabe ändern. `organization_id` darf nie entfernt oder optional werden.

---

### Financial Logic
- Funktion: `guardDoublePayment`, `guardPeriodClosed`, `closePerio`
- Entities: `CommissionEntry.is_paid`, `FinancePeriod.closed`
- Storno-Kette: `is_storno` → `storno_reference_id` → Original-Buchung

**Regel:** Storno-Buchungen niemals ohne bidirektionale Referenz erstellen. Abgeschlossene Perioden niemals automatisch öffnen.

---

### Permission System
- `lib/rbac.js` — Rollen und Labels
- RLS in Entity-JSON-Schemas
- `guardRoleAccess`, `guardDataAccess`

**Regel:** Rollen nur nach explizitem Admin-Request ändern. Niemals durch Feature-Prompts.

---

## 🟡 CONTROLLED EXTENSIONS — Nur mit Review erlaubt

Diese Bereiche können erweitert, aber nicht umgebaut werden:

| Bereich | Erlaubte Änderung | Verbotene Änderung |
|---|---|---|
| Entity Schemas | Neue optionale Felder hinzufügen | Required-Felder entfernen |
| Governance Rules | Neue Regeln (draft) hinzufügen | Bestehende active-Regeln löschen |
| Dashboard | Neue Tabs/Widgets | Bestehende KPI-Berechnungen ändern |
| Incident Categories | Neue Kategorie hinzufügen | Bestehende Category-Keys umbenennen |
| AuditLog Schema | Neue Felder ergänzen | Bestehende Felder umbenennen/entfernen |

---

## 🟢 FREE EXTENSION ZONES — KI-Änderungen erlaubt

- UI-Komponenten (pages/, components/)
- Neue Backend-Funktionen (neue Files in functions/)
- Neue Entity-Typen (neue Schemas in entities/)
- Dokumentation (docs/)
- Email-Templates
- Dashboard-Widgets (rein visuell)

---

## Pflichtsequenz für kritische Governance-Operationen

```
1. repairApprovalMetadata      → Approval-Metadaten reparieren
2. governanceRecovery          → Änderungshistorien rekonstruieren
3. correlateIncidents          → Incidents gruppieren
4. validateGovernanceCompliance → Root-Cause-Incidents erzeugen
5. checkRelationshipIntegrity  → Ghost References prüfen
6. snapshotGovernanceScore     → Score mit bereinigten Daten berechnen
```

---

## Versionierung

Änderungen an diesem Dokument erfordern:
- Datum + Autor im Commit-Message
- Begründung warum Protected-Status geändert wurde
- Snapshot des Governance Scores vor/nach

---

*Zuletzt aktualisiert: 2026-05-26 — Enterprise Governance Hardening Phase 1*