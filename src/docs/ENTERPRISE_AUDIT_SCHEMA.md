# ENTERPRISE AUDIT SCHEMA — Architecture Design

**Stand:** 2026-05-18  
**Version:** 0.1 (DRAFT)  
**Status:** 📝 ZUR DISKUSSION

---

## PHILOSOPHIE

### NICHT: Event-Logging
```
❌ "Contract 123 updated at 2026-05-18T10:00:00Z"
```

### SONDERN: Process Intelligence
```
✅ "Contract 123 transitioned from 'active' → 'cancelled' 
    triggered by onApplicationUpdate automation,
    guard 'no_existing_storno' evaluated and ALLOWED,
    side effect: CommissionEntry 456 created (storno),
    process chain: contract_lifecycle_001"
```

---

## ZIELE

Das Audit-System muss beantworten können:

1. **WAS** ist passiert? (create/update/delete/block/retry)
2. **WARUM** ist es passiert? (Trigger, Prozess, Guard, Business-Regel)
3. **WER/WAS** hat es ausgelöst? (User/Automation/Scheduler/Engine)
4. **AUF WELCHE** Entity? (Contract/Application/Task/Commission/Customer)
5. **WELCHE FOLGEN** entstanden? (created/blocked/updated/skipped/archived)
6. **WAR ES ERLAUBT?** (allowed/blocked/warning/conflict/anomaly)

---

## SCHEMA — CORE STRUKTUR

```javascript
{
  // ─────────────────────────────────────────────────────
  // 1. IDENTIFICATION (Eindeutige IDs für Korrelation)
  // ─────────────────────────────────────────────────────
  
  "audit_id": "audit_6a08c41b6fa1329f03a4bc04_001",
  // Format: audit_{automation_id}_{sequence} oder audit_manual_{timestamp}_{random}
  // Zweck: Eindeutige Identifikation jedes Audit-Events
  
  "correlation_id": "corr_contract_lifecycle_789_20260518T100000Z",
  // Format: corr_{process_type}_{entity_id}_{timestamp}
  // Zweck: Verknüpft ALLE Events eines Prozess-Flusses (über Automationen hinweg)
  // Beispiel: Application → Contract → Commission → Task teilen correlation_id
  
  "process_id": "contract_lifecycle_001",
  // Format: {lifecycle_type}_{sequence}
  // Zweck: Identifiziert den spezifischen Prozess-Instanz (z.B. "dieser Renewal-Prozess")
  
  "parent_process_id": "renewal_pipeline_2026_05",
  // Format: {parent_lifecycle}_{period}
  // Zweck: Hierarchie (z.B. contract_lifecycle_001 ist Teil von renewal_pipeline_2026_05)
  
  // ─────────────────────────────────────────────────────
  // 2. TIMESTAMP & PERFORMANCE (Timing & Dauer)
  // ─────────────────────────────────────────────────────
  
  "timestamp": "2026-05-18T10:00:00.000Z",
  // ISO 8601, UTC
  // Zweck: Exakter Zeitpunkt des Events
  
  "execution_duration_ms": 42,
  // Millisekunden
  // Zweck: Performance-Monitoring, Engpässe erkennen
  
  "retry_count": 0,
  // Anzahl Wiederholungen (wenn Retry-Logic existiert)
  // Zweck: Fehleranalyse, Instabilität erkennen
  
  // ─────────────────────────────────────────────────────
  // 3. TRIGGER CONTEXT (Was hat es ausgelöst?)
  // ─────────────────────────────────────────────────────
  
  "trigger_type": "automation" | "user" | "scheduler" | "webhook" | "system",
  // automation = Entity Automation (onApplicationUpdate, etc.)
  // user = Manuelle UI-Aktion
  // scheduler = Scheduled Automation (checkPoliciesExpiry, etc.)
  // webhook = Externer Trigger (später: Connector-Events)
  // system = Interne System-Events (Backup, Health-Check)
  
  "trigger_source": "onApplicationUpdate",
  // Name der Automation, Function, oder UI-Page
  // Beispiele: "onApplicationUpdate", "CommissionsAndCourtage UI", "checkPoliciesExpiry"
  
  "trigger_event_type": "update" | "create" | "delete" | "scheduled" | "manual",
  // Entity Event: create/update/delete
  // Scheduler Event: scheduled
  // User Action: manual
  
  // ─────────────────────────────────────────────────────
  // 4. PROCESS CONTEXT (Welcher Business-Prozess?)
  // ─────────────────────────────────────────────────────
  
  "lifecycle_type": "contract_lifecycle" | "application_lifecycle" | "commission_lifecycle" | "renewal_lifecycle" | "task_lifecycle",
  // Welcher Lifecycle wird ausgeführt?
  // Wichtig für Lifecycle-Tracking und Prozess-Analyse
  
  "workflow_stage": "approved_to_contract" | "cancellation_storno" | "renewal_notice" | "task_completion",
  // Konkrete Stage innerhalb des Lifecycles
  // Beispiele:
  //   - contract_lifecycle: "neu → pruefung_offen → erledigt"
  //   - commission_lifecycle: "expected → invoiced → earned → paid → storno"
  
  "process_name": "Automatic Contract Creation on Application Approval",
  // Menschlich-lesbare Beschreibung des Prozesses
  // Beispiel: "Storno-Provision Creation on Contract Cancellation"
  
  // ─────────────────────────────────────────────────────
  // 5. GUARD & DECISION CONTEXT (Welche Entscheidung?)
  // ─────────────────────────────────────────────────────
  
  "guard_evaluated": "no_existing_storno",
  // Name des Guards (wenn vorhanden)
  // Beispiele: "no_existing_storno", "contract_exists_by_source", "not_already_cancelled"
  
  "guard_result": "allowed" | "blocked" | "warning" | "conflict" | "anomaly",
  // allowed = Guard hat Operation freigegeben
  // blocked = Guard hat Operation blockiert (präventiv)
  // warning = Operation erlaubt, aber Auffälligkeit erkannt
  // conflict = Konflikt erkannt (z.B. Race-Condition)
  // anomaly = Ungewöhnliches Muster erkannt (später: ML-basiert)
  
  "guard_reason": "contract_exists_by_source",
  // Konkrete Begründung der Entscheidung
  // Beispiele:
  //   - "contract_exists_by_source" (Storno-Guard)
  //   - "customer_already_active" (Customer-Sync-Guard)
  //   - "no_existing_storno" (Storno-Guard)
  
  "decision": "create" | "update" | "delete" | "skip" | "block" | "retry" | "archive",
  // Was wurde entschieden?
  // create = Neue Entity erstellt
  // update = Entity aktualisiert
  // delete = Entity gelöscht
  // skip = Operation übersprungen (idempotent)
  // block = Operation blockiert (Guard)
  // retry = Operation wird wiederholt
  // archive = Entity archiviert (soft delete)
  
  "decision_reason": "Application status changed to 'approved', triggering automatic contract creation",
  // Menschlich-lesbare Begründung der Entscheidung
  
  // ─────────────────────────────────────────────────────
  // 6. ENTITY CONTEXT (Welche Entities betroffen?)
  // ─────────────────────────────────────────────────────
  
  "primary_entity": {
    "type": "Contract",
    "id": "6a08c41b6fa1329f03a4bc04",
    "policy_number": "K-12345"
  },
  // Die primär betroffene Entity
  
  "related_entities": [
    {
      "type": "CommissionEntry",
      "id": "456",
      "relationship": "storno_created_for"
    },
    {
      "type": "Application",
      "id": "789",
      "relationship": "source_application"
    }
  ],
  // Verknüpfte Entities (Side Effects, Quellen, Targets)
  // relationship beschreibt die Verbindung
  
  "affected_entity_ids": ["6a08c41b6fa1329f03a4bc04", "456", "789"],
  // Flat list für einfaches Filtering/Querying
  // Alle betroffenen Entities (primary + related)
  
  // ─────────────────────────────────────────────────────
  // 7. STATE TRANSITION (Welche Zustandsänderung?)
  // ─────────────────────────────────────────────────────
  
  "state_transition": {
    "field": "status",
    "old_value": "active",
    "new_value": "cancelled",
    "state_machine": "contract_lifecycle"
  },
  // Nur wenn State-Change stattfand
  // field: Welches Feld änderte sich?
  // old_value: Vorheriger Wert
  // new_value: Neuer Wert
  // state_machine: Welcher State-Machine gehört das Feld?
  
  "state_history": [
    { "field": "status", "old": "active", "new": "cancelled", "timestamp": "2026-05-18T10:00:00Z" },
    { "field": "process_status", "old": "pruefung_offen", "new": "erledigt", "timestamp": "2026-05-18T10:00:01Z" }
  ],
  // Historie aller State-Changes (für komplexe Transitions)
  // Ermöglicht Replay des gesamten Prozess-Flusses
  
  // ─────────────────────────────────────────────────────
  // 8. SIDE EFFECTS (Welche Folgen entstanden?)
  // ─────────────────────────────────────────────────────
  
  "side_effects": [
    {
      "entity_type": "CommissionEntry",
      "action": "create",
      "entity_id": "456",
      "description": "Storno-Provision erstellt für ursprüngliche Provision 123"
    },
    {
      "entity_type": "SystemLog",
      "action": "create",
      "entity_id": "789",
      "description": "Audit-Log entry created"
    }
  ],
  // Alle sekundären Aktionen (create/update/delete)
  // Wichtig für Impact-Analyse und Korrelation
  
  "side_effect_count": {
    "create": 2,
    "update": 0,
    "delete": 0,
    "skip": 0
  },
  // Aggregierte Counts für schnelles Monitoring
  
  // ─────────────────────────────────────────────────────
  // 9. BUSINESS IMPACT (Welche geschäftliche Relevanz?)
  // ─────────────────────────────────────────────────────
  
  "business_impact": {
    "type": "financial" | "compliance" | "customer_experience" | "operational" | "risk",
    "severity": "critical" | "high" | "medium" | "low" | "info",
    "financial_impact_chf": 1250.00,
    "description": "Verhinderte Doppel-Storno-Auszahlung (CHF 1,250.00)"
  },
  // type: Art der Auswirkung
  // severity: Kritikalität
  // financial_impact_chf: Finanzielle Relevanz (wenn zutreffend)
  // description: Menschlich-lesbare Beschreibung
  
  "risk_level": "low" | "medium" | "high" | "critical",
  // Risiko-Level der Operation
  // critical = Finanzielle Integrität, Compliance
  // high = Kunden-Relevanz, Revenue
  // medium = Operative Prozesse
  // low = Komfort, Monitoring
  
  // ─────────────────────────────────────────────────────
  // 10. METADATA (Zusätzliche Informationen)
  // ─────────────────────────────────────────────────────
  
  "user_email": "p.adam@vsvv.ch",
  // Nur wenn user-getriggert (trigger_type="user")
  
  "automation_id": "6a08c41b6fa1329f03a4bc04",
  // Nur wenn automation-getriggert (trigger_type="automation")
  
  "scheduled_job_id": "6a01c612300a5ddad0b6e46e",
  // Nur wenn scheduler-getriggert (trigger_type="scheduler")
  
  "ip_address": "192.168.1.100",
  // Nur wenn user-getriggert (Security-Audit)
  
  "version": "1.0",
  // Schema-Version (für zukünftige Migrationen)
  
  "tags": ["storno", "financial", "guard_blocked", "commission"],
  // Freie Tags für flexible Kategorisierung
  
  "custom_metadata": {
    "storno_reference_id": "123",
    "storno_war_ausbezahlt": true,
    "storno_rueckforderungsbetrag": 1250.00
  }
  // Prozess-spezifische Zusatzdaten
  // Flexibel erweiterbar ohne Schema-Änderung
}
```

---

## USE CASES — Was das Schema beantworten können muss

### Use Case 1: Guard-Hit-Rate monitoren
**Frage:** "Wie oft hat der Storno-Guard Doppel-Storni verhindert?"

```javascript
// Query
{
  "guard_evaluated": "no_existing_storno",
  "guard_result": "blocked",
  "timestamp": { "$gte": "2026-05-01" }
}

// Response
{
  "total_blocked": 3,
  "financial_impact_chf": 3750.00,
  "prevented_duplicates": ["123", "456", "789"]
}
```

---

### Use Case 2: Lifecycle-Transition nachvollziehen
**Frage:** "Welche States durchlief Contract 123?"

```javascript
// Query
{
  "primary_entity.id": "123",
  "state_transition": { "$exists": true }
}

// Response (State-History)
[
  { "timestamp": "2026-01-15T10:00:00Z", "field": "status", "old": "neu", "new": "pruefung_offen" },
  { "timestamp": "2026-01-16T14:30:00Z", "field": "status", "old": "pruefung_offen", "new": "erledigt" },
  { "timestamp": "2026-05-18T10:00:00Z", "field": "status", "old": "active", "new": "cancelled" }
]
```

---

### Use Case 3: Process Chain korrelieren
**Frage:** "Welche Events gehören zum gleichen Renewal-Prozess?"

```javascript
// Query
{
  "correlation_id": "corr_renewal_123_20260518",
  "process_id": "renewal_lifecycle_001"
}

// Response (alle Events der Kette)
[
  { "process_name": "Renewal Notice Created", "timestamp": "2026-05-01T06:30:00Z" },
  { "process_name": "Task Created", "timestamp": "2026-05-01T06:30:01Z" },
  { "process_name": "Offer Prepared", "timestamp": "2026-05-15T09:00:00Z" },
  { "process_name": "Offer Sent", "timestamp": "2026-05-16T10:00:00Z" },
  { "process_name": "Customer Accepted", "timestamp": "2026-05-18T14:00:00Z" }
]
```

---

### Use Case 4: Anomalie erkennen
**Frage:** "Gibt es ungewöhnlich viele Contract-Creates in kurzer Zeit?"

```javascript
// Query
{
  "decision": "create",
  "primary_entity.type": "Contract",
  "timestamp": { "$gte": "2026-05-18T09:00:00Z", "$lte": "2026-05-18T10:00:00Z" }
}

// Response
{
  "count": 15,
  "normal_average": 3,
  "anomaly_detected": true,
  "anomaly_score": 5.0
}
```

---

### Use Case 5: Financial Impact reporten
**Frage:** "Wie viel CHF wurden durch Guards geschützt diesen Monat?"

```javascript
// Query
{
  "guard_result": "blocked",
  "business_impact.type": "financial",
  "timestamp": { "$gte": "2026-05-01" }
}

// Response
{
  "total_protected_chf": 12500.00,
  "blocked_count": 8,
  "guards": [
    { "name": "no_existing_storno", "protected_chf": 8750.00 },
    { "name": "contract_exists_by_source", "protected_chf": 3750.00 }
  ]
}
```

---

## ENTITY LIFECYCLES — Zu trackende Prozesse

### 1. Contract Lifecycle
```
neu → pruefung_offen → kunde_kontaktieren → verlaengerung_vorbereiten → beratung_erfolgt → erledigt
                                                              ↓
                                                          expired/cancelled
```

**Zu trackende Events:**
- Status-Transitions
- Renewal-Notice (90/60/30 Tage)
- Task-Creation
- Verkaufschance-Creation
- Cancellation + Storno

---

### 2. Application Lifecycle
```
new → in_progress → waiting → approved → contracted
                      ↓
                  rejected
```

**Zu trackende Events:**
- Status-Transitions
- Contract-Creation (bei approved)
- Commission-Expectation (bei approved)
- Task-Creation (bei waiting/rejected)

---

### 3. Commission Lifecycle
```
expected → invoiced → received → earned → paid
                              ↓
                          storno
```

**Zu trackende Events:**
- Status-Transitions
- Payment-Events
- Storno-Events (mit Guard-Checks)
- Split-Events

---

### 4. Renewal Lifecycle
```
early → contact → offer → negotiation → renewed
                                  ↓
                                lost
```

**Zu trackende Events:**
- Stage-Transitions
- Offer-Creation
- Customer-Contact
- Acceptance/Rejection

---

### 5. Task Lifecycle
```
open → in_progress → completed
```

**Zu trackende Events:**
- Status-Transitions
- Automation-Completion (bei Contract-Activation)
- Due-Date-Events

---

## IMPLEMENTATION PRIORITIES

### Phase 1: Core Schema (WOCHEN 1)
- [ ] `auditLogWrite` Function um Core-Felder erweitern
- [ ] `audit_id`, `correlation_id`, `process_id` generieren
- [ ] `trigger_type`, `trigger_source` dokumentieren
- [ ] `decision`, `guard_result` integrieren
- [ ] In `onApplicationUpdate` integrieren
- [ ] In `handleStornoOfAutomaticProvision` integrieren

### Phase 2: Guard-Monitoring (WOCHEN 2)
- [ ] `logGuardEvaluation` Function erstellen
- [ ] `guard_evaluated`, `guard_result`, `guard_reason` tracken
- [ ] `business_impact.financial_impact_chf` berechnen
- [ ] In allen Guards integrieren

### Phase 3: Lifecycle-Tracking (WOCHEN 3)
- [ ] `state_transition`, `state_history` implementieren
- [ ] Contract-Lifecycle als erstes modellieren
- [ ] Application-Lifecycle modellieren
- [ ] Commission-Lifecycle modellieren

### Phase 4: Side-Effects & Correlation (WOCHEN 4)
- [ ] `side_effects` Array implementieren
- [ ] `correlation_id` über Automationen hinweg teilen
- [ ] `related_entities` dokumentieren
- [ ] Process-Chains nachvollziehbar machen

### Phase 5: Admin Dashboard (WOCHEN 5-6)
- [ ] Audit-Log Viewer UI
- [ ] Guard-Hit-Rate Widget
- [ ] Lifecycle-Transition Timeline
- [ ] Financial-Impact Report
- [ ] CSV-Export

---

## OFFENE FRAGEN — Zur Diskussion

### 1. Schema-Komplexität
**Frage:** Ist das Schema zu komplex für den Start?

**Option A:** Vollständig implementieren (alle Felder)
- Vorteil: Zukunftssicher, alle Use Cases abgedeckt
- Nachteil: Höhere initiale Komplexität

**Option B:** Minimal starten (Core-Felder), erweitern
- Vorteil: Schnellere Implementierung
- Nachteil: Spätere Migration nötig

**Empfehlung:** Option A — Schema ist die DNA, später teuer zu ändern.

---

### 2. Correlation-ID Generierung
**Frage:** Wie generieren wir `correlation_id` konsistent?

**Option A:** Zentraler Generator (`generateCorrelationId()`)
- Vorteil: Einheitliches Format, wiederverwendbar
- Nachteil: Zusätzliche Function

**Option B:** Jede Automation generiert selbst
- Vorteil: Dezentral, flexibel
- Nachteil: Inkonsistenzen möglich

**Empfehlung:** Option A — Zentrale Konsistenz ist wichtiger.

---

### 3. Storage & Querying
**Frage:** Wie speichern/queryen wir effizient?

**Option A:** AuditLog Entity (Base44)
- Vorteil: Einfach, Base44-Features
- Nachteil: Performance bei großen Mengen?

**Option B:** Externer Log-Service (später)
- Vorteil: Skalierbar, spezialisiert
- Nachteil: Komplexität, Kosten

**Empfehlung:** Option A für Start, Option B bei Scale.

---

### 4. Guard-Monitoring als eigenes Schema?
**Frage:** Sollen Guard-Hits separat gespeichert werden?

**Option A:** Im AuditLog integriert (wie oben)
- Vorteil: Einheitliches Schema, Korrelation einfach
- Nachteil: AuditLog wird größer

**Option B:** Eigenes `GuardLog` Entity
- Vorteil: Spezialisiert, effizient querybar
- Nachteil: Zwei Synchronisationspunkte

**Empfehlung:** Option A — Integration ist eleganter.

---

## NÄCHSTE SCHRITTE

### 1. Schema finalisieren (DIESER SCHRITT)
- [ ] Feedback zu diesem Design
- [ ] Offene Fragen klären
- [ ] Schema versionieren (v1.0)

### 2. Implementation planen (NÄCHSTER SCHRITT)
- [ ] `auditLogWrite` Function erweitern
- [ ] Helper-Functions erstellen (`generateCorrelationId`, etc.)
- [ ] Migration-Plan für existierende Logs

### 3. Pilot-Integration (PHASE 1)
- [ ] In `onApplicationUpdate` integrieren
- [ ] In `handleStornoOfAutomaticProvision` integrieren
- [ ] Test-Cases definieren

### 4. Rollout (PHASE 2-5)
- [ ] Alle Automationen erweitern
- [ ] Dashboard erstellen
- [ ] Monitoring einrichten

---

**Stand:** 2026-05-18  
**Version:** 0.1 (DRAFT)  
**Status:** 📝 ZUR DISKUSSION