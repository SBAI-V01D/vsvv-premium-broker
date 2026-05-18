# AUTOMATION-LANDKARTE — Enterprise System

**Stand:** 2026-05-18  
**Version:** 1.0  
**Status:** ✅ VOLLSTÄNDIG DOKUMENTIERT

---

## LEGENDE

### Kritikalität
- 🔴 **KRITISCH** — Finanzielle Integrität, Compliance, Datenverlust
- 🟡 **WICHTIG** — Operative Prozesse, Kundenexperience
- 🟢 **OPTIONAL** — Komfort, Monitoring
- ⚪ **LEGACY** — Zum Löschen markiert
- ⚠️ **GEFÄHRLICH** — Risiko für Side Effects

### Risiko-Level
- **Race-Condition** — Mehrere Trigger können kollidieren
- **Doppeltrigger** — Gleiche Aktion kann mehrfach feuern
- **Rekursiv** — Kann sich selbst triggern
- **Create-Risiko** — Erstellt Entities (Duplikate möglich)
- **Statusloop** — Status kann oszillieren
- **Cross-Update** — Updated mehrere Entities

### Guard-Status
- ✅ **Guard vorhanden** — Präventive Checks implementiert
- ✅ **Idempotent** — Doppeltrigger sicher
- ✅ **Deterministisch** — Immer gleiches Ergebnis
- ✅ **Atomar** — Un teilbare Operation
- ❌ **Kein Guard** — Ungesichert

### Source of Truth
- **Application** = Ursprung (Antrag)
- **Contract** = Operative Wahrheit (Vertrag)
- **Renewal** = Lifecycle (Verlängerung)
- **Task** = Workflow (Aufgabe)
- **Commission** = Folgeobjekt (Provision)
- **Customer** = Stammdaten

---

## ENTITY AUTOMATIONS (6)

---

### 1. `onApplicationUpdate` — Application → Contract Creation

**ID:** `6a05f4074cc416422e103353`  
**Trigger:** Entity Update (`Application`)  
**Event Types:** `update`  
**Status:** 🟢 ACTIVE (187 Runs, 2 Failures)

#### Side Effects:
- ✅ **create** `Contract` (bei Annahme)
- ✅ **update** `Application.linked_contract_id`
- ✅ **create** `CommissionEntry` (erwartete Provision)
- ✅ **create** `Task` (bei Rückfrage/Vorbehalt)
- ✅ **update** `Task` (verknüpfte Tasks auf completed)
- ✅ **create** `SystemLog`
- ✅ **create** `StatusHistory`
- ✅ **invoke** `auditLogWrite`

#### Kritikalität: 🔴 **KRITISCH**
- Erstellt Verträge aus Anträgen
- Finanzielle Folgen (Provisionen)
- Compliance-relevant (Status-Historie)

#### Risiko-Level:
- ⚠️ **Create-Risiko** — Contract-Erstellung
- ⚠️ **Cross-Update** — Application + Contract + Task + Commission

#### Guard-Status:
- ✅ **Guard vorhanden** — `guardContractCreation()` (atomare Prüfung VOR create)
- ✅ **Idempotent** — Prüft `source_application_id` + `linked_contract_id`
- ✅ **Deterministisch** — Status-Transitionen klar definiert
- ✅ **Atomar** — Guard prüft BEFORE create

#### Source of Truth:
- **Application** = Ursprung
- **Contract** = Folgeobjekt

#### Abhängigkeiten:
- `auditLogWrite` (Backend Function)
- `Contract` Entity (create)
- `CommissionEntry` Entity (create)
- `Task` Entity (create/update)

#### Notes:
- Guards verhindern Race-Conditions (Doppel-Erstellung)
- Nur bei ACCEPTED_STATUSES
- Organization-ID Fallback auf Customer

---

### 2. `handleStornoOfAutomaticProvision` — Contract Cancellation → Storno

**ID:** `6a08c41b6fa1329f03a4bc04`  
**Trigger:** Entity Update (`Contract`)  
**Event Types:** `update`  
**Trigger Conditions:**
- `changed_fields` contains `cancel_date`
- `old_data.cancel_date` is empty
- `data.cancel_date` is not empty

**Status:** 🟢 ACTIVE (0 Runs — neu)

#### Side Effects:
- ✅ **create** `CommissionEntry` (Storno-Eintrag)
- ✅ **invoke** `auditLogWrite`
- ✅ **create** `SystemLog`

#### Kritikalität: 🔴 **KRITISCH**
- Finanzielle Integrität (Provisions-Rückforderung)
- Compliance (Storno-Dokumentation)
- Vertrauen (Berater-Provisionen)

#### Risiko-Level:
- ⚠️ **Create-Risiko** — Storno-Einträge
- ⚠️ **Cross-Update** — CommissionEntry + AuditLog

#### Guard-Status:
- ✅ **Guard vorhanden** — 3 Guards:
  1. `no_existing_storno` — Verhindert Doppel-Storni
  2. `not_already_cancelled` — Prüft Status
  3. `track_paid_status` — Markiert ausbezahlte Provisionen
- ✅ **Idempotent** — Prüft existente Storni
- ✅ **Deterministisch** — Klare Bedingungen
- ✅ **Atomar** — Guard BEFORE create

#### Source of Truth:
- **Contract** = Trigger (cancel_date)
- **Commission** = Folgeobjekt (Storno)

#### Abhängigkeiten:
- `auditLogWrite` (Backend Function)
- `CommissionEntry` Entity (create)

#### Notes:
- NEU (2026-05-18) mit Guards refaktoriert
- Verhindert finanzielle Doppelbuchungen
- Audit-Trail für jede Storno-Operation

---

### 3. `syncCustomerStatusFromContracts` — Contract Create → Customer Active

**ID:** `6a07832c558c3d3cab5b58a7`  
**Trigger:** Entity Create (`Contract`)  
**Event Types:** `create`  
**Status:** 🟢 ACTIVE (61 Runs, 0 Failures)

#### Side Effects:
- ✅ **update** `Customer.status` → `active`

#### Kritikalität: 🟡 **WICHTIG**
- Kunden-Stammdaten
- Reporting (aktive vs. inaktive Kunden)

#### Risiko-Level:
- ✅ **Kein Create-Risiko** — Nur Update
- ✅ **Kein Cross-Update** — Nur Customer

#### Guard-Status:
- ✅ **Idempotent** — Skip wenn bereits `active`
- ✅ **Deterministisch** — Einzelner Customer aus Event
- ✅ **Atomar** — Direct Query (O(1))

#### Source of Truth:
- **Contract** = Trigger (neuer Vertrag)
- **Customer** = Stammdaten

#### Abhängigkeiten:
- `Customer` Entity (get + update)

#### Notes:
- 2026-05-18 REFAKTORED: O(n + m) → O(1)
- Kein Full-Table-Scan mehr
- Performance-kritisch optimiert

---

### 4. `syncTaskOnContractActivation` — Contract Status → Task Completion

**ID:** `6a00e7286a8c38e0d92aa5c2`  
**Trigger:** Entity Update (`Contract`)  
**Event Types:** `update`  
**Trigger Conditions:**
- `changed_fields` contains `status`

**Status:** 🟢 ACTIVE (1 Run, 0 Failures)

#### Side Effects:
- ✅ **update** `Task.status` → `completed` (für workflow tasks)

#### Kritikalität: 🟢 **OPTIONAL**
- Workflow-Automatisierung
- Komfort (manuelle Erledigung entfällt)

#### Risiko-Level:
- ✅ **Kein Create-Risiko** — Nur Update
- ⚠️ **Cross-Update** — Multiple Tasks

#### Guard-Status:
- ❌ **Kein Guard** — Keine Prüfung auf Doppeltrigger
- ✅ **Idempotent** — Setzt nur auf `completed`
- ✅ **Deterministisch** — Klare Task-Typen
- ⚠️ **Nicht Atomar** — Bulk Update ohne Guard

#### Source of Truth:
- **Contract** = Trigger (Status → active)
- **Task** = Workflow

#### Abhängigkeiten:
- `Task` Entity (filter + bulk update)

#### Notes:
- Vervollständigt Contract-Lifecycle
- Audit-Logging fehlt (Phase 2)
- Geringes Risiko (nur Task-Completion)

---

### 5. `syncCommissionOnApplicationUpdate` — Application → Commission Sync

**ID:** (nicht in Liste — existiert als Function)  
**Trigger:** Entity Update (`Application`)  
**Event Types:** `update`  
**Status:** 🟡 **INAKTIV?** (nicht in Automation-Liste)

#### Side Effects:
- ✅ **update** `CommissionEntry` (Sync bei Application-Änderung)

#### Kritikalität: 🟡 **WICHTIG**
- Provisionen synchron halten
- Datenkonsistenz

#### Risiko-Level:
- ⚠️ **Cross-Update** — CommissionEntry

#### Guard-Status:
- ❓ **Unklar** — Function existiert, Automation nicht gelistet

#### Source of Truth:
- **Application** = Trigger
- **Commission** = Folgeobjekt

#### Notes:
- Function existiert: `syncCommissionOnApplicationUpdate`
- Automation NICHT in Liste — manuell getriggert?
- Prüfung erforderlich (Phase 2A)

---

### 6. `syncCommissionOnPolicyChange` — Contract → Commission Sync

**ID:** (nicht in Liste — existiert als Function)  
**Trigger:** Entity Update (`Contract`)  
**Event Types:** `update`  
**Status:** 🟡 **INAKTIV?** (nicht in Automation-Liste)

#### Side Effects:
- ✅ **update** `CommissionEntry` (Sync bei Contract-Änderung)

#### Kritikalität: 🟡 **WICHTIG**
- Provisionen synchron halten
- Datenkonsistenz

#### Risiko-Level:
- ⚠️ **Cross-Update** — CommissionEntry

#### Guard-Status:
- ❓ **Unklar** — Function existiert, Automation nicht gelistet

#### Source of Truth:
- **Contract** = Trigger
- **Commission** = Folgeobjekt

#### Notes:
- Function existiert: `syncCommissionOnPolicyChange`
- Automation NICHT in Liste — manuell getriggert?
- Prüfung erforderlich (Phase 2A)

---

## SCHEDULED AUTOMATIONS (5)

---

### 7. `checkPoliciesExpiry` — Daily Contract Lifecycle Check

**ID:** `6a01c612300a5ddad0b6e46e`  
**Trigger:** Scheduled (Daily, 04:30 UTC)  
**Schedule:** `repeat_interval=1, repeat_unit=days, start_time=04:30`  
**Status:** 🟢 ACTIVE (7 Runs, 0 Failures)

#### Side Effects:
- ✅ **update** `Contract.status` → `expired` (abgelaufen)
- ✅ **update** `Contract.process_status` (Lifecycle-Progression)
- ✅ **create** `Task` (Ablauf-Aufgaben: 90/60/30 Tage)
- ✅ **create** `Verkaufschance` (bei 30-Tage-Frist)
- ✅ **create** `SystemLog`

#### Kritikalität: 🔴 **KRITISCH**
- Renewal-Pipeline (Umsatz-Relevanz)
- Compliance (abgelaufene Verträge)
- Kundenexperience (rechtzeitige Kontaktaufnahme)

#### Risiko-Level:
- ⚠️ **Create-Risiko** — Tasks + Verkaufschancen
- ⚠️ **Cross-Update** — Contract + Task + Verkaufschance
- ⚠️ **Full-Table-Scan** — Liest ALLE Contracts (Performance!)

#### Guard-Status:
- ✅ **Idempotent** — Prüft existente Tasks/Verkaufschancen
- ✅ **Deterministisch** — Klare Datums-Logik
- ❌ **Kein Guard** — Keine atomare Prüfung VOR create
- ⚠️ **Performance-Risiko** — Full-Scan aller Contracts

#### Source of Truth:
- **Contract** = Lifecycle (Ablaufdaten)
- **Task** = Workflow (Ablauf-Management)
- **Verkaufschance** = Sales (Renewal-Oppertunity)

#### Abhängigkeiten:
- `Contract` Entity (filter + update)
- `Task` Entity (create)
- `Verkaufschance` Entity (create)

#### Notes:
- Täglicher Job (04:30 UTC = 06:30 CET)
- Anti-Duplikation für Tasks/Verkaufschancen
- **Audit-Logging fehlt** (Phase 2)
- Performance: Full-Scan akzeptabel für daily Job

---

### 8. `createFullBackup` — Daily Full Backup

**ID:** `69ff6899006961adf79043b3`  
**Trigger:** Scheduled (Daily, 22:00 UTC)  
**Schedule:** `repeat_interval=1, repeat_unit=days, start_time=22:00`  
**Status:** 🟢 ACTIVE (10 Runs, 0 Failures)

#### Side Effects:
- ✅ **create** `BackupLog`
- ✅ **create** Private Files (Backup-Daten)

#### Kritikalität: 🔴 **KRITISCH**
- Compliance (Aufbewahrungspflicht)
- Disaster Recovery
- Datenintegrität

#### Risiko-Level:
- ✅ **Kein Create-Risiko** — Backup ist Copy
- ✅ **Kein Cross-Update** — Nur BackupLog

#### Guard-Status:
- ✅ **Idempotent** — Daily Backup
- ✅ **Deterministisch** — Full Snapshot
- ✅ **Atomar** — Backup-Transaction

#### Source of Truth:
- **All Entities** = Snapshot

#### Abhängigkeiten:
- `BackupLog` Entity (create)
- Private File Storage

#### Notes:
- 30 Tage Retention
- Compliance-relevant
- 100% Success-Rate (10/10)

---

### 9. `createLongTermBackup` — Weekly Archive

**ID:** `69ff6899006961adf79043b4`  
**Trigger:** Scheduled (Weekly, Monday 00:00 UTC)  
**Schedule:** `repeat_unit=weeks, repeat_on_days=[1], start_time=00:00`  
**Status:** 🟢 ACTIVE (2 Runs, 0 Failures)

#### Side Effects:
- ✅ **create** `BackupLog` (mit `compliance_tags`)
- ✅ **create** Private Files (Archive)

#### Kritikalität: 🔴 **KRITISCH**
- Compliance (10 Jahre Aufbewahrung)
- Audit-Sicherheit
- Langzeit-Archivierung

#### Risiko-Level:
- ✅ **Kein Create-Risiko** — Archive ist Copy
- ✅ **Kein Cross-Update** — Nur BackupLog

#### Guard-Status:
- ✅ **Idempotent** — Weekly Archive
- ✅ **Deterministisch** — Full Snapshot
- ✅ **Atomar** — Backup-Transaction

#### Source of Truth:
- **All Entities** = Snapshot

#### Abhängigkeiten:
- `BackupLog` Entity (create)
- Private File Storage

#### Notes:
- 10 Jahre Retention (Compliance)
- Monday 00:00 UTC = Monday 02:00 CET
- 100% Success-Rate (2/2)

---

### 10. `createIncrementalBackup` — 15-Minute Incremental

**ID:** `69ff6899006961adf79043b5` (vermutet)  
**Trigger:** Scheduled (Every 15 Minutes)  
**Schedule:** `repeat_interval=15, repeat_unit=minutes`  
**Status:** 🟢 ACTIVE (888 Runs, 1 Failure)

#### Side Effects:
- ✅ **create** `BackupLog` (incremental)
- ✅ **create** Private Files (Changes only)

#### Kritikalität: 🟡 **WICHTIG**
- Recovery Point Objective (RPO)
- Minimale Datenverluste

#### Risiko-Level:
- ✅ **Kein Create-Risiko** — Incremental Copy
- ✅ **Kein Cross-Update** — Nur BackupLog

#### Guard-Status:
- ✅ **Idempotent** — 15-Minute Window
- ✅ **Deterministisch** — Only changes since last backup
- ✅ **Atomar** — Backup-Transaction

#### Source of Truth:
- **All Entities** = Changes only

#### Abhängigkeiten:
- `BackupLog` Entity (create)
- Private File Storage

#### Notes:
- 888 Runs, 1 Failure (99.9% Success-Rate)
- Only last 15 minutes of data
- Performance-kritisch (häufigste Automation)

---

### 11. `systemHealthCheck` — Hourly System Monitoring

**ID:** `6a0785e848adb49304b6dccc`  
**Trigger:** Scheduled (Every 60 Minutes)  
**Schedule:** `repeat_interval=60, repeat_unit=hours`  
**Status:** 🟢 ACTIVE (75 Runs, 0 Failures)

#### Side Effects:
- ✅ **create** `SystemLog` (Health Status)
- ✅ **invoke** diverse Validation Functions

#### Kritikalität: 🟡 **WICHTIG**
- System-Observability
- Frühwarnsystem
- Performance-Monitoring

#### Risiko-Level:
- ✅ **Kein Create-Risiko** — Nur Logs
- ✅ **Kein Cross-Update** — Nur SystemLog

#### Guard-Status:
- ✅ **Idempotent** — Hourly Check
- ✅ **Deterministisch** — Health Metrics
- ✅ **Atomar** — Check-Transaction

#### Source of Truth:
- **System** = Health Status

#### Abhängigkeiten:
- `SystemLog` Entity (create)
- Diverse Validation Functions

#### Notes:
- 100% Success-Rate (75/75)
- Every 60 Minutes
- Covered: Security, Functionality, Performance, Backup

---

## DECOMMISSIONED (1)

---

### 12. `createAutomaticProvisionOnActiveContract` — GELÖSCHT ✅

**ID:** `6a08beeae678b81eae116b79` (gelöscht)  
**Trigger:** Entity Create (`Contract`)  
**Status:** ❌ **DECOMMISSIONED** (2026-05-18)

#### Reason for Decommission:
- Function war NO-OP (deaktiviert seit 2026-05-16)
- Provisionen werden jetzt in `onApplicationUpdate` erstellt
- 0 Runs in Historie
- Potenzielles Risiko für Doppeltrigger

#### Replacement:
- `onApplicationUpdate` erstellt Provisionen bei Annahme
- Guards verhindern Doppel-Erstellung

#### Notes:
- ✅ Function gelöscht
- ✅ Automation gelöscht
- ✅ Kein totes Risiko mehr

---

## ZUSAMMENFASSUNG

### Automation Count:
- **Entity:** 6 (4 aktiv, 2 unklar)
- **Scheduled:** 5 (alle aktiv)
- **Decommissioned:** 1

### Kritikalität:
- 🔴 **KRITISCH:** 5 (Finanzen, Compliance, Lifecycle)
- 🟡 **WICHTIG:** 4 (Sync, Monitoring, Backup)
- 🟢 **OPTIONAL:** 1 (Task-Completion)

### Guard-Status:
- ✅ **Guards vorhanden:** 3 (Storno, Contract-Creation, Customer-Sync)
- ❌ **Keine Guards:** 2 (Task-Completion, Policy-Expiry)
- ❓ **Unklar:** 2 (Commission-Sync Functions)

### Audit-Logging:
- ✅ **Mit Audit-Log:** 3 (onApplicationUpdate, handleStorno, syncCustomerStatus)
- ❌ **Ohne Audit-Log:** 3 (syncTaskOnContractActivation, checkPoliciesExpiry, ??)

### Performance:
- ✅ **O(1) Queries:** 2 (syncCustomerStatus, handleStorno)
- ⚠️ **Full-Table-Scan:** 1 (checkPoliciesExpiry — akzeptabel für daily)

---

## PHASE 2A — NÄCHSTE SCHRITTE

### 1. Commission-Sync Automations klären
- [ ] `syncCommissionOnApplicationUpdate` — Automation erstellen?
- [ ] `syncCommissionOnPolicyChange` — Automation erstellen?
- [ ] Guards implementieren?
- [ ] Audit-Logging hinzufügen?

### 2. Audit-Logging vervollständigen
- [ ] `syncTaskOnContractActivation` — Audit-Logs
- [ ] `checkPoliciesExpiry` — Audit-Logs (Renewal-Entscheidungen)
- [ ] Einheitliches Format für alle

### 3. Guard-Monitoring Dashboard
- [ ] Admin-View: Guard-Hits, Skipped, Errors
- [ ] Metriken: Hit-Rate, Error-Rate
- [ ] CSV-Export für Compliance

### 4. Source-of-Truth Map finalisieren
- [ ] Application → Contract → Renewal → Task → Commission
- [ ] Lifecycle-Regeln dokumentieren
- [ ] Cross-Update-Abhängigkeiten visualisieren

---

**Stand:** 2026-05-18  
**Version:** 1.0  
**Status:** ✅ VOLLSTÄNDIG