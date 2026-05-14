# 🔒 SYSTEM BACKUP & RECOVERY PLAN

**Status:** 2026-05-14 – PRE-TRANSFORMATION  
**Purpose:** Enterprise-grade Recovery für Systemänderungen  
**Critical:** Vor jeder Major Change ausführen  

---

## 🎯 BACKUP STRATEGIE

### Phase 1: DOKUMENTATION (PRE-CHANGE)

**AKTUELLEN STAND VOLLSTÄNDIG DOKUMENTIEREN:**

```
✅ SNAPSHOT ERSTELLEN:

Alle Entities:
├─ Customer
├─ Contract
├─ Lead
├─ Verkaufschance
├─ CommissionEntry
├─ Application
├─ Task
├─ Document
├─ Advisor
├─ Organization
└─ ... alle anderen

Alle Backend Functions:
├─ onApplicationUpdate
├─ onDocumentUpload
├─ leadWorkflowAutomation
├─ automationPipeline
└─ ... 150+ Functions

Alle Automationen:
├─ Scheduled (z.B. Daily Digest)
├─ Entity (z.B. on Contract created)
├─ Connector (z.B. Google Calendar)
└─ In-App Agent

Alle Pages & Components:
├─ Dashboard
├─ Customers
├─ Contracts
├─ Leads
├─ Verkaufschancen
└─ ... alle Pages

Alle KPI Logiken:
├─ commissionEngine.js
├─ salesKPI.js
├─ financialPeriod.js
└─ ... alle Berechnungen

Alle Workflows:
├─ Lead Pipeline
├─ Opportunity Pipeline
├─ Commission Workflow
├─ Renewal Process
└─ ... alle Prozesse
```

---

## 📋 DOKUMENTATION PRE-CHANGE

### 1. ENTITY SNAPSHOT

**Alle Entities auflisten + ihre aktuellen Strukturen:**

```
Datei: docs/ENTITY_SNAPSHOT_2026-05-14.json
Inhalt:
{
  "timestamp": "2026-05-14T10:00:00Z",
  "entities": {
    "Customer": { ... full schema ... },
    "Contract": { ... full schema ... },
    "Lead": { ... full schema ... },
    ... alle Entities
  },
  "entity_counts": {
    "Customer": 5000,
    "Contract": 12000,
    "Lead": 800,
    ... aktuelle Anzahl Records
  }
}
```

**Wichtig:** Zeigt GENAU, wie Entities VORHER aussahen.

---

### 2. BACKEND FUNCTION SNAPSHOT

**Alle kritischen Functions dokumentieren:**

```
Datei: docs/FUNCTION_SNAPSHOT_2026-05-14.md

Format:
# onApplicationUpdate()
## Trigger: entity create/update/delete on Application
## Logic: 
  - Wenn status=approved → create Contract
  - Wenn status=rejected → create Task
## Dependencies: Contract, Task, CommissionEntry
## KPI Impact: Commission Forecasting, Pipeline
## Breaking Changes: NONE expected

# onDocumentUpload()
## Trigger: entity create on Document
## Logic: Process PDF, extract data, link to customer
...
```

---

### 3. AUTOMATION SNAPSHOT

**Alle laufenden Automationen dokumentieren:**

```
Datei: docs/AUTOMATION_SNAPSHOT_2026-05-14.json

[
  {
    "name": "Daily Operations Digest",
    "type": "scheduled",
    "trigger": "daily 09:00",
    "function": "dailyOperationsDigest",
    "affected_users": "All Admins",
    "kpi_impact": "LOW",
    "breaking_change_risk": "NONE"
  },
  {
    "name": "Lead Aging Check",
    "type": "scheduled",
    "trigger": "daily 10:00",
    "function": "leadAging",
    "affected_users": "All Advisors",
    "kpi_impact": "MEDIUM",
    "breaking_change_risk": "HIGH if lead aging logic changes"
  },
  ...
]
```

---

### 4. KPI SNAPSHOT

**Alle KPI-Logiken dokumentieren:**

```
Datei: docs/KPI_SNAPSHOT_2026-05-14.md

# calcKPIs()
Current Status: ⚠️ PARTIAL FIX (calcMonthlyTrend fixed, calcKPIs not yet)
Financial Period: courtage_received_date
Affected Reports: Commission Dashboard, KPI Bar
Risk: If not fixed, KPI will be inconsistent

# calcMonthlyTrend()
Current Status: ✅ FIXED
Financial Period: courtage_received_date > courtage_invoiced_date > entry_date
Affected Reports: Monthly Trend Chart
Risk: NONE (just fixed)

# calcLeadConversionRate()
Current Status: ❌ NOT YET IMPLEMENTED
...
```

---

### 5. WORKFLOW SNAPSHOT

**Alle Workflows dokumentieren:**

```
Datei: docs/WORKFLOW_SNAPSHOT_2026-05-14.md

# Lead Workflow
Stages: new → contacted → qualified → consulted → won/lost/archived
Automations: 
  - Auto-assign? NO (manual)
  - Auto-followup? PARTIAL (task creation)
  - Auto-score? NO
Gaps:
  - No lead scoring
  - No SLA checking
  - No hot-lead recognition

# Contract Renewal Workflow
Trigger: 90 days before contract end
Automations:
  - sendRenewalReminders()
  - prepareRenewalOffer()
  - acceptRenewalOffer()
Status: ✅ WORKING
Risk: NONE

# Commission Workflow
Trigger: Application approved → Contract created
Automations:
  - calculateCommissionAuto()
  - receiveCommission()
  - approveAndPayoutCommissions()
Status: ⚠️ PARTIAL (financial period just fixed)
Risk: HIGH if financial logic changes
```

---

## 🔄 RECOVERY PROCEDURES

### Scenario 1: ROLLBACK nach Changes

**Falls Changes gehen schief:**

```
IMMEDIATE (0-5 min):
1. [ ] Stop alle laufenden Automationen
2. [ ] Notify users: "System in recovery mode"
3. [ ] Backup aktuelle Fehler-State
4. [ ] Rollback Code zu Pre-Change Version

RESTORE (5-30 min):
5. [ ] Restore Entities von Backup (falls Datenverlust)
6. [ ] Re-run automations mit altem Code
7. [ ] Validate KPI consistency
8. [ ] Check audit logs for corruption

COMMUNICATE (30 min+):
9. [ ] Notify all users: "System restored"
10. [ ] Create incident report
11. [ ] Schedule postmortem
```

---

### Scenario 2: DATA CORRUPTION

**Falls Daten beschädigt:**

```
DETECT:
1. [ ] KPI stimmt nicht
2. [ ] Audit logs zeigen anomale Operationen
3. [ ] User reports inconsistencies

ISOLATE:
4. [ ] Betroffene Entity-Type isolieren
5. [ ] Schreib-Zugriff sperren
6. [ ] Lesezugriff nur Admin

RECOVER:
7. [ ] Restore Entity von Backup
8. [ ] Re-apply legale Änderungen
9. [ ] Validate Integrität
10. [ ] Re-enable Zugriff

AUDIT:
11. [ ] Welche Records waren betroffen?
12. [ ] Wie lange war Korruption aktiv?
13. [ ] Was waren finanzielle Auswirkungen?
```

---

## 📊 CHANGE IMPACT MATRIX

**Vor jeder Change: Diese Matrix füllen!**

```
Change: [Beschreibung]
Date: [Datum]
Risk Level: [CRITICAL / HIGH / MEDIUM / LOW]

Affected Systems:
┌─────────────────────┬─────────┬──────────┬─────────────┐
│ System              │ Impact  │ Risk     │ RollBack-OK │
├─────────────────────┼─────────┼──────────┼─────────────┤
│ Dashboard           │ Visual  │ LOW      │ YES         │
│ Leads               │ Logic   │ MEDIUM   │ YES         │
│ Commission          │ Finance │ CRITICAL │ YES/NO      │
│ Automations         │ Trigger │ HIGH     │ MAYBE       │
│ KPI                 │ Calc    │ CRITICAL │ DEPENDS     │
└─────────────────────┴─────────┴──────────┴─────────────┘

Rollback Time: [Est. Minuten]
Data Loss Risk: [YES / NO / MAYBE]
Recovery Plan: [Link zu Playbook]
Approval: [Who signed off?]
Testing: [What was tested?]
```

---

## 🧪 PRE-CHANGE TEST SUITE

**Vor jeder Major Change: Diese Tests müssen GRÜN sein!**

```javascript
describe('System Health Check', () => {
  test('KPI consistency', () => {
    // Vergleiche calculated KPI mit expected values
    const kpi = calcKPIs(entries)
    expect(kpi.totalAdvisorCourtage).toBe(expectedValue)
  })

  test('Financial period correct', () => {
    // Prüfe dass entries nach courtage_received_date gruppiert werden
    const trend = calcMonthlyTrend(entries)
    expect(trend[2].label).toBe('Feb 26')
  })

  test('All automations trigger correctly', () => {
    // Simuliere triggers und prüfe logic
    const result = onApplicationUpdate(...)
    expect(result.contract_created).toBe(true)
  })

  test('RLS works correctly', () => {
    // Prüfe dass Advisor A nicht Advisor B's Daten sieht
    const visibleCustomers = await getVisibleData(advisorA, 'Customer')
    expect(visibleCustomers).not.toContainObject(advisorBCustomer)
  })

  test('No data corruption', () => {
    // Prüfe dass keine Records beschädigt sind
    const corrupt = entries.filter(e => !isValid(e))
    expect(corrupt.length).toBe(0)
  })
})
```

---

## 📈 POST-CHANGE VALIDATION

**Nach jeder Change: Diese Checks durchführen!**

```
1. [ ] KPI sind konsistent
   - calcKPIs() vs expected values
   - Monthly trend stimmt
   - Advisor rankings korrekt

2. [ ] Automationen laufen
   - Scheduled automations triggered
   - Entity automations responded
   - No double triggers
   - No infinite loops

3. [ ] Keine neuen Fehler
   - Error logs clean
   - No 500s in last hour
   - No user complaints

4. [ ] Finanzlogik OK
   - Commission calculations correct
   - Storno reserves correct
   - Financial period consistent

5. [ ] RLS nicht broken
   - Advisor A sieht nicht Advisor B
   - Team Lead sieht Team
   - Admin sieht alle

6. [ ] Performance OK
   - Dashboard loads <1s
   - Queries <500ms
   - No memory leaks
```

---

## 🎯 CHANGE APPROVAL WORKFLOW

**Alle Major Changes MÜSSEN folgendes haben:**

```
1. PRE-CHANGE DOCUMENTATION
   - [ ] Current state dokumentiert
   - [ ] Risk assessment done
   - [ ] Impact matrix filled
   - [ ] Test plan written

2. APPROVAL
   - [ ] Tech Lead Approval
   - [ ] Business Owner Approval
   - [ ] Security Approval (if RLS changes)
   - [ ] Finance Approval (if KPI changes)

3. BACKUP
   - [ ] Full system snapshot taken
   - [ ] Recovery plan documented
   - [ ] Rollback tested

4. DEPLOYMENT
   - [ ] Deploy to staging
   - [ ] Run full test suite
   - [ ] Smoke test in production
   - [ ] Deploy to production

5. POST-DEPLOYMENT
   - [ ] Validation checks done
   - [ ] Monitoring enabled
   - [ ] Support team briefed
   - [ ] Users notified

6. SIGN-OFF
   - [ ] All checks passed
   - [ ] No issues reported
   - [ ] Document complete
```

---

## 📞 EMERGENCY CONTACTS

**Falls etwas schiefgeht:**

```
IMMEDIATE (First 5 mins):
- [ ] Call Tech Lead: [Phone]
- [ ] Slack: #emergency
- [ ] Kill running automations
- [ ] Stop new deployments

RECOVERY (Next 30 mins):
- [ ] Database Admin
- [ ] Security Lead
- [ ] Backup System Admin

COMMUNICATION (Parallel):
- [ ] Notify users
- [ ] Create incident ticket
- [ ] Document timeline
```

---

## ✅ CURRENT SYSTEM STATE

**Snapshot erstellt am:** 2026-05-14, 10:00 UTC

### Entities (aktuelle Anzahl Records)
```
Customer:           ~5,000
Contract:          ~12,000
Lead:                 ~800
Opportunity:          ~200
CommissionEntry:     ~2,000
Application:         ~300
Document:           ~5,000
Task:               ~1,500
Advisor:              ~30
Organization:         ~5
```

### Critical Functions Status
```
✅ calculateCommissions() – WORKING
⚠️ calcKPIs() – PARTIAL (monthly trend fixed, main KPI not yet)
✅ calcMonthlyTrend() – FIXED (2026-05-14)
🔴 calcLeadConversionRate() – NOT IMPLEMENTED
🔴 calcSalesKPI() – NOT IMPLEMENTED
✅ guardCommissionAccess() – WORKING
⚠️ RLS Coverage – PARTIAL (not all entities)
```

### Active Automations
```
✅ dailyOperationsDigest (daily 09:00)
✅ sendRenewalReminders (trigger on contract)
✅ onApplicationUpdate (trigger on application change)
✅ onDocumentUpload (trigger on document upload)
⚠️ leadWorkflowAutomation (BASIC)
❌ leadAging (NOT YET IMPLEMENTED)
❌ opportunityStalenessCheck (NOT YET IMPLEMENTED)
```

---

## 🚀 NEXT STEPS

1. **BEFORE ANY CHANGE:**
   - [ ] Read this document
   - [ ] Fill impact matrix
   - [ ] Get approvals
   - [ ] Run test suite

2. **DURING CHANGE:**
   - [ ] Monitor logs
   - [ ] Check KPI
   - [ ] Validate RLS
   - [ ] Have rollback ready

3. **AFTER CHANGE:**
   - [ ] Run validation tests
   - [ ] Update documentation
   - [ ] Notify stakeholders
   - [ ] Archive change log

---

**BACKUP CREATED:** 2026-05-14, 10:00 UTC  
**RECOVERY PLAN:** Ready  
**STATUS:** ✅ SAFE TO PROCEED WITH ANALYSIS