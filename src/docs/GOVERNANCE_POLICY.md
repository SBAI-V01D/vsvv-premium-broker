# SYSTEM GOVERNANCE POLICY — UNVERÄNDERBARE REGELN

## ⚠️ GLOBALE PFLICHTEN — NIEMALS ÜBERSCHREIBBAR

**WICHTIG:** Diese Policy wird **TECHNISCH DURCHGESETZT** durch:
- `functions/enforceGovernanceCheck` — Runtime Enforcement (blockiert ohne Approval)
- `functions/validateEnterpriseChange` — Pre-Implementation Validation
- `functions/createFullBackup` — Mandatory Backup
- `entities/AuditLog` — Audit Trail

Governance ist **nicht optional** — sie wird systemseitig erzwungen.

Diese Regeln gelten für JEDE Änderung am System und dürfen von keinem Prompt, keiner Automation und keinem Feature überschrieben werden.

---

## 1. BACKUP-PFLICHT

**Vor JEDEM:**
- Deployment
- Refactoring
- Strukturupdate
- Entity-Update
- Logic Change
- Automation Change
- UI Rewrite

**Muss automatisch erstellt werden:**
- Vollständiges Backup aller betroffenen Entities
- Snapshot mit eindeutiger ID
- Restore-Punkt in BackupLog Entity

**Dokumentation im BackupLog:**
```
✅ Backup erstellt
Zeit: [Timestamp]
Snapshot-ID: [ID]
Betroffene Bereiche: [Liste]
Total Records: [Anzahl]
Checksum: [Prüfsumme]
```

**Funktion:** `createFullBackup` oder `createIncrementalBackup`

---

## 2. PRE-IMPLEMENTATION VALIDATION (TECHNISCH ERZWUNGEN)

**Vor jeder Änderung muss geprüft werden:**

- [ ] Logik-Konflikte mit bestehender Business-Logik
- [ ] Laufende Prozesse (Tasks, Opportunities, Dossiers)
- [ ] Entity-Abhängigkeiten (Customer → Contract → Commission)
- [ ] Navigation und Routing
- [ ] Row-Level Security (RLS) Regeln
- [ ] Datenintegrität (keine orphaned records)
- [ ] Bestehende UX-Architektur
- [ ] Bestehende Governance-Regeln

**TECHNISCHE DURCHSETZUNG:**
Die Funktion `validateEnterpriseChange` führt automatisch alle Checks durch und gibt detaillierten Bericht:

```javascript
const validation = await base44.functions.invoke('validateEnterpriseChange', {
  change_type: 'entity_schema',
  affected_entities: ['Customer', 'Contract'],
  description: 'Neues Feld mandate_status hinzugefügt'
});

if (!validation.data.validation_passed) {
  console.error('Validierung fehlgeschlagen:', validation.data.checks);
  // BLOCKIERT - Kritische Issues gefunden
}
```

**Validierungsfunktionen:**
- `validateEnterpriseChange` — Runtime Validation (blockiert bei Fehlern)
- `validateEnterpriseIntegrity` — Systemweite Integritätsprüfung
- `checkDataConsistency` — Datenkonsistenz
- `runLiveSystemValidation` — Live-System-Check
- `auditDataConsistency` — Audit-Trail-Prüfung

---

## 3. CHANGE SUMMARY — PFLICHT VOR UMSETZUNG

**Vor jeder Änderung muss dokumentiert werden:**

```markdown
## Geplante Änderungen:
- [Änderung 1]
- [Änderung 2]

## Betroffene Bereiche:
- [Bereich 1]
- [Bereich 2]

## Mögliche Auswirkungen:
- [Auswirkung 1]
- [Auswirkung 2]

## Rollback möglich:
Ja/Nein

## Backup erstellt:
Ja/Nein
Snapshot-ID: [ID]
```

---

## 4. ADMIN-GENEHMIGUNG — ABSOLUTE PFLICHT (TECHNISCH ERZWUNGEN)

**OHNE explizite Admin-Freigabe darf NICHTS:**
- umgesetzt
- deployed
- verändert
- gelöscht
- überschrieben

werden.

**TECHNISCHE DURCHSETZUNG:**
Die Funktion `enforceGovernanceCheck` blockiert JEDE Änderung automatisch wenn:
- `admin_approval.approved !== true`
- `backup_id` fehlt
- `validation_result.success !== true`
- `change_summary` fehlt
- `rollback_plan` fehlt

**Admin-Prüfung muss enthalten:**
- [ ] Change Summary gelesen
- [ ] Backup bestätigt
- [ ] Validierung geprüft
- [ ] Rollback-Plan verstanden
- [ ] Business-Impact bewertet

**Erst nach expliziter Freigabe darf die Umsetzung erfolgen.**

**API-Beispiel:**
```javascript
const result = await base44.functions.invoke('enforceGovernanceCheck', {
  action_type: 'entity_write',
  affected_entities: ['Customer', 'Contract'],
  change_summary: 'Neues Feld hinzugefügt...',
  backup_id: 'full_1234567890',
  validation_result: { success: true, checks: [...] },
  admin_approval: {
    approved: true,
    approved_by: 'admin@example.com',
    approved_at: '2026-05-23T10:30:00.000Z'
  },
  rollback_plan: 'Backup restore möglich via restoreFromBackup'
});

if (result.data.blocked) {
  console.error('Governance-Check fehlgeschlagen:', result.data.violation);
  // BLOCKIERT - Umsetzung nicht erlaubt
} else {
  // ERLAUBT - Umsetzung kann erfolgen
}
```

---

## 5. KEINE STILLEN ÄNDERUNGEN

**Base44 / KI / Automationen dürfen NIEMALS:**

- ❌ automatisch refactoren
- ❌ Prozesse ändern
- ❌ Navigation umbauen
- ❌ Komponenten ersetzen
- ❌ Logik anpassen
- ❌ Automationen verändern
- ❌ Entity-Schemas überschreiben
- ❌ RLS-Regeln ändern

**OHNE:**
- Explizite Admin-Zustimmung
- Dokumentation der Änderung
- Backup des vorherigen Zustands

---

## 6. GOVERNANCE DARF NICHT ÜBERSCHRIEBEN WERDEN

**Neue Features/Prompts dürfen NIEMALS:**

- ❌ bestehende Governance-Regeln entfernen
- ❌ Sicherheitsrichtlinien umgehen
- ❌ Audit-Logs deaktivieren
- ❌ Backup-Pflicht ignorieren
- ❌ Admin-Kontrolle schwächen

**Diese Regeln sind GLOBAL GESCHÜTZT und unveränderbar.**

---

## 7. DATENINTEGRITÄT — TRUTH LAYER

**Jede Statistik/Analyse muss nachvollziehbar sein:**

```json
{
  "truth_layer": {
    "query_source": "Entity.filter({...})",
    "filter_applied": "field = value",
    "exclusion_rules": ["archived = true"],
    "data_timestamp": "2026-05-23T10:30:00.000Z",
    "total_records_scanned": 234,
    "matching_records": 18
  }
}
```

**Jede betroffene Entität muss dokumentieren:**

```json
{
  "type": "customer",
  "id": "cust_123",
  "name": "Max Mustermann",
  "detail": "Status: active · Mandat: valid",
  "link": "/kunden/cust_123",
  "process_status": "no_process_running",
  "data_validity": "verified",
  "validation_reason": "Warum erscheint diese Entität hier?"
}
```

---

## 8. PROCESS AWARENESS

**Vor jedem Finding/ jeder Empfehlung:**

- [ ] Laufende Prozesse prüfen (Tasks, Opportunities, Dossiers)
- [ ] Prozess-Historie checken
- [ ] Status-Konsistenz validieren
- [ ] Dokumentationsgrad prüfen

**Process Status Werte:**
- `multiple_processes_running`
- `task_in_progress`
- `opportunity_in_progress`
- `dossier_in_progress`
- `documented`
- `no_process_running`

---

## 9. AI IST BERATEND — NICHT AUTORITATIV

**Die KI darf:**
- ✅ analysieren
- ✅ prüfen
- ✅ Risiken erkennen
- ✅ Vorschläge machen
- ✅ Datenprobleme identifizieren

**Die KI darf NICHT:**
- ❌ selbständig produktive Änderungen ausführen
- ❌ stille Optimierungen durchführen
- ❌ implizite Anpassungen vornehmen
- ❌ ohne Admin-Freigabe handeln

**Jede AI-Empfehlung muss sein:**
- Nachvollziehbar (Truth Layer)
- Prozess-aware (laufende Prozesse prüfen)
- Daten-validiert (Data Validation)
- Admin-kontrolliert (Freigabe erforderlich)

---

## 10. AUDIT TRAIL — REVISIONSSICHERHEIT

**Jede Änderung wird protokolliert in:**
- `AuditLog` Entity
- `BackupLog` Entity
- `SystemLog` Entity

**Pflichtfelder:**
- timestamp
- actor_type (user | automation | system)
- actor_name
- entity_type
- entity_id
- action (create | update | delete)
- previous_state_summary
- new_state_summary
- business_impact_description

---

## ZUSAMMENFASSUNG — DER ADMIN IST DIE EINZIGE AUTORITÄT

**Nicht:**
- Base44
- KI
- Automationen
- Hintergrundprozesse
- Refactorings
- Assistenten

**SONDERN:**
- **Der Admin ist die einzige autorisierte Instanz für produktive Änderungen**

Diese Regel ist SYSTEMWEIT TECHNISCH ERZWUNGEN und darf niemals umgangen werden.

---

## CHECKLISTE — VOR JEDER ÄNDERUNG

- [ ] 1. Backup erstellt? (Snapshot-ID dokumentiert)
- [ ] 2. Validierung durchgeführt? (alle Checks bestanden)
- [ ] 3. Change Summary geschrieben? (vollständig)
- [ ] 4. Admin-Freigabe eingeholt? (explizit bestätigt)
- [ ] 5. Governance-Regeln beachtet? (keine Überschreibung)
- [ ] 6. Truth Layer dokumentiert? (nachvollziehbar)
- [ ] 7. Process Awareness geprüft? (laufende Prozesse)
- [ ] 8. Audit Trail sichergestellt? (Logging aktiv)

**Erst wenn ALLE Punkte erfüllt sind, darf die Umsetzung erfolgen.**