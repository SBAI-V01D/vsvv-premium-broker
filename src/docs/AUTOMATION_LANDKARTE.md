# AUTOMATION LANDKARTE — Vollständige System-Analyse

**Stand:** 2026-05-18  
**Zweck:** Vollständige Transparenz über ALLE Automationen im System

---

## LEGENDE

| Spalte | Bedeutung |
|--------|-----------|
| **Trigger** | Wann feuert die Automation? |
| **Entities** | Welche Entities werden gelesen/geschrieben? |
| **Side Effects** | Was wird erstellt/geändert? |
| **Kritikalität** | 🔴 Kritisch | 🟡 Optional | ⚪ Legacy |
| **Risiko** | Race-Condition | Doppeltrigger | Cross-Update |

---

## 1. ENTITY AUTOMATIONS (Event-driven)

### 1.1 `onApplicationUpdate` (Application → Contract)
**ID:** `6a05f4074cc416422e103353`  
**Status:** ✅ ACTIVE  
**Trigger:** Application UPDATE (status change)  
**Funktion:** `functions/onApplicationUpdate.js`

| Aspekt | Details |
|--------|---------|
| **Trigger-Bedingung** | `custom_status` oder `status` ändert sich |
| **Events** | `accepted`, `approved`, `policiert`, `rejected`, `rueckfrage` |
| **Entities Read** | Application, Contract, Customer |
| **Entities Write** | Contract (create), Application (update), Task (create/update), CommissionEntry (create), StatusHistory (create), SystemLog (create), AuditLog (create) |
| **Guards** | ✅ `guardContractCreation` (verhindert Duplikate) |
| **Side Effects** | Contract-Erstellung, Provision-Erstellung, Task-Cleanup, Audit-Logging |
| **Kritikalität** | 🔴 **KRITISCH** — Haupt-Flow für Contract-Entstehung |
| **Risiko-Level** | 🟡 **MITTEL** — Guards vorhanden, aber komplexe Logik |
| **Race-Conditions** | ✅ Abgesichert durch `guardContractCreation` |
| **Laufzeit** | 187 Runs, 2 Errors (1% Error-Rate) |

**Probleme:**
- ❌ Sehr komplex (384 Zeilen)
- ❌ Viele Side Effects in einer Funktion
- ❌ Schwer zu testen

**Empfehlung:**
- ✅ Behalten, aber refaktorisieren (aufteilen in kleinere Funktionen)
- ✅ Audit-Logging ist bereits implementiert ✓

---

### 1.2 `syncCustomerStatusFromContracts` (Contract → Customer)
**ID:** `6a07832c558c3d3cab5b58a7`  
**Status:** ✅ ACTIVE  
**Trigger:** Contract CREATE  
**Funktion:** `functions/syncCustomerStatusFromContracts.js`

| Aspekt | Details |
|--------|---------|
| **Trigger-Bedingung** | Neuer Vertrag wird erstellt |
| **Entities Read** | Contract (alle), Customer (alle) |
| **Entities Write** | Customer (status = 'active') |
| **Side Effects** | Setzt Kundenstatus auf 'active' |
| **Kritikalität** | 🟡 **OPTIONAL** — Komfort-Funktion |
| **Risiko-Level** | 🔴 **HOCH** — Liest ALLE Contracts + Kunden (Performance!) |
| **Race-Conditions** | ❌ Keine Guards |
| **Laufzeit** | 61 Runs, 0 Errors |

**Probleme:**
- 🔴 **KRITISCH:** Liest gesamte Contract- + Customer-Tabelle (2000+ Records)
- 🔴 Ineffizient — könnte mit `customer_id` direkt updaten
- ❌ Admin-only Check vorhanden, aber ineffektiv

**Empfehlung:**
- 🔴 **SOFORT REFAKTOREN** — direkte Query auf `customer_id` aus Contract
- ❌ Nicht als Automation — lieber in `onApplicationUpdate` integrieren

---

### 1.3 `syncTaskOnContractActivation` (Contract → Task)
**ID:** `6a00e7286a8c38e0d92aa5c2`  
**Status:** ✅ ACTIVE  
**Trigger:** Contract UPDATE (status → active)  
**Funktion:** `functions/syncTaskOnContractActivation.js`

| Aspekt | Details |
|--------|---------|
| **Trigger-Bedingung** | `changed_fields` enthält 'status' + Status ist aktiv |
| **Entities Read** | Task (filtered by customer_id) |
| **Entities Write** | Task (status = 'completed') |
| **Side Effects** | Erledigt Workflow-Tasks automatisch |
| **Kritikalität** | 🟡 **OPTIONAL** — Komfort-Funktion |
| **Risiko-Level** | 🟢 **NIEDRIG** — Gezielte Query |
| **Race-Conditions** | ❌ Keine Guards |
| **Laufzeit** | 1 Run, 0 Errors |

**Probleme:**
- ❌ Unklar welche Task-Typen betroffen sind
- ❌ Keine Audit-Logs

**Empfehlung:**
- ✅ Behalten, aber Audit-Logging hinzufügen
- ✅ Task-Typen explizit definieren

---

### 1.4 `handleStornoOfAutomaticProvision` (Contract → Commission)
**ID:** `6a08c41b6fa1329f03a4bc04`  
**Status:** ✅ ACTIVE  
**Trigger:** Contract UPDATE (`cancel_date` gesetzt)  
**Funktion:** `functions/handleStornoOfAutomaticProvision.js`

| Aspekt | Details |
|--------|---------|
| **Trigger-Bedingung** | `cancel_date` wird gesetzt (vorher leer) |
| **Entities Read** | Contract, CommissionEntry |
| **Entities Write** | CommissionEntry (create storno) |
| **Side Effects** | Erstellt Storno-Provisionen |
| **Kritikalität** | 🔴 **KRITISCH** — Verhindert verwaiste Provisionen |
| **Risiko-Level** | 🟡 **MITTEL** — create() ohne Guard |
| **Race-Conditions** | ❌ Keine Guards gegen Doppel-Storno |
| **Laufzeit** | 0 Runs (nie gefeuert) |

**Probleme:**
- ❌ Erstellt Storno OHNE Prüfung ob bereits existiert
- ❌ Kein Audit-Logging
- ❌ Query nach `policy_id` — findet ALLE Provisionen, nicht nur automatische

**Empfehlung:**
- 🔴 **GUARD HINZUFÜGEN** — prüfe ob Storno bereits existiert
- ✅ Audit-Logging hinzufügen
- ✅ Query einschränken auf `created_automatically = true`

---

### 1.5 `createAutomaticProvisionOnActiveContract` (Contract → Commission)
**ID:** `6a08beeae678b81eae116b79`  
**Status:** ❌ **DEAKTIVIERT / ARCHIVIERT**  
**Trigger:** Contract UPDATE (status → active)  
**Funktion:** `functions/createAutomaticProvisionOnActiveContract.js`

| Aspekt | Details |
|--------|---------|
| **Trigger-Bedingung** | status = 'active' + changed_fields enthält 'status' |
| **Funktion** | NO-OP (deaktiviert) |
| **Grund** | Provisionen werden jetzt in `onApplicationUpdate` erstellt |
| **Risiko** | 🟢 **KEINS** — inaktiv |

**Empfehlung:**
- ✅ **LÖSCHEN** — nicht mehr benötigt

---

## 2. SCHEDULED AUTOMATIONS (Zeitgesteuert)

### 2.1 `checkPoliciesExpiry` (Täglich 06:30)
**ID:** `6a01c612300a5ddad0b6e46e`  
**Status:** ✅ ACTIVE  
**Zeitplan:** Täglich 06:30 UTC (04:30 CH-Zeit)  
**Funktion:** `functions/checkPoliciesExpiry.js`

| Aspekt | Details |
|--------|---------|
| **Trigger** | Scheduler (daily) |
| **Entities Read** | Contract (alle), Task (alle), Verkaufschance (alle) |
| **Entities Write** | Contract (status, process_status), Task (create), Verkaufschance (create) |
| **Side Effects** | Erstellt Tasks bei 90/60/30 Tagen, erstellt VS bei 30 Tagen |
| **Kritikalität** | 🔴 **KRITISCH** — Haupt-Renewal-Flow |
| **Risiko-Level** | 🟡 **MITTEL** — Anti-Duplikation vorhanden |
| **Race-Conditions** | ✅ Abgesichert durch `hasOpenTask()` + `hasOpenVerkaufschance()` |
| **Laufzeit** | 7 Runs, 0 Errors |

**Stärken:**
- ✅ Anti-Duplikation: `contract_id + task_type`
- ✅ Status-Progression nur vorwärts
- ✅ In-Memory Update für VS-Liste

**Probleme:**
- ❌ Liest ALLE Tasks + VS (Performance bei Skalierung)
- ❌ Keine Audit-Logs
- ❌ Komplexe Logik (209 Zeilen)

**Empfehlung:**
- ✅ Behalten, aber Audit-Logging hinzufügen
- ✅ Queries filtern (nur offene Tasks/VS)

---

### 2.2 `createFullBackup` (Täglich 00:00 UTC)
**ID:** `69ff6899006961adf79043b3`  
**Status:** ✅ ACTIVE  
**Zeitplan:** Täglich 22:00 CH-Zeit  
**Funktion:** `functions/createFullBackup.js`

| Aspekt | Details |
|--------|---------|
| **Trigger** | Scheduler (daily) |
| **Entities Read** | ALLE Entities |
| **Entities Write** | BackupLog |
| **Kritikalität** | 🔴 **KRITISCH** — Compliance |
| **Risiko-Level** | 🟢 **NIEDRIG** — Read-only |
| **Laufzeit** | 10 Runs, 0 Errors |

**Empfehlung:**
- ✅ Behalten ✓

---

### 2.3 `createLongTermBackup` (Wöchentlich Montag 02:00 UTC)
**ID:** `69ff6899006961adf79043b4`  
**Status:** ✅ ACTIVE  
**Zeitplan:** Montag 00:00 UTC (22:00 CH-Zeit Sonntag)  
**Funktion:** `functions/createLongTermBackup.js`

| Aspekt | Details |
|--------|---------|
| **Trigger** | Scheduler (weekly) |
| **Kritikalität** | 🔴 **KRITISCH** — Compliance (10 Jahre) |
| **Laufzeit** | 2 Runs, 0 Errors |

**Empfehlung:**
- ✅ Behalten ✓

---

### 2.4 `systemHealthCheck` (Stündlich)
**ID:** `6a0785e848adb49304b6dccc`  
**Status:** ✅ ACTIVE  
**Zeitplan:** Alle 60 Minuten  
**Funktion:** `functions/systemHealthCheck.js`

| Aspekt | Details |
|--------|---------|
| **Trigger** | Scheduler (hourly) |
| **Entities Read** | SystemLog, ErrorLog, BackupLog, etc. |
| **Entities Write** | SystemLog |
| **Kritikalität** | 🟡 **OPTIONAL** — Monitoring |
| **Laufzeit** | 74 Runs, 0 Errors |

**Empfehlung:**
- ✅ Behalten ✓
- ✅ Intervall prüfen (60min vs 24h)

---

## 3. ZUSAMMENFASSUNG

### Kritische Automationen (🔴)
1. ✅ `onApplicationUpdate` — Contract-Erstellung (GUARDS VORHANDEN)
2. ⚠️ `checkPoliciesExpiry` — Renewal-Tasks (ANTI-DUPLIKATION VORHANDEN)
3. ⚠️ `handleStornoOfAutomaticProvision` — Storno-Provisionen (**GUARD FEHLT**)
4. ⚠️ `syncCustomerStatusFromContracts` — Kundenstatus (**PERFORMANCE KRITISCH**)

### Deaktivierte Automationen (❌)
1. ✅ `createAutomaticProvisionOnActiveContract` — Bereit zur Löschung

### Performance-Kritisch (⚡)
1. 🔴 `syncCustomerStatusFromContracts` — Liest ALLE Contracts + Customers
2. 🟡 `checkPoliciesExpiry` — Liest ALLE Tasks + VS

### Audit-Logging Bedarf (📋)
Fehlt bei:
- ❌ `checkPoliciesExpiry`
- ❌ `handleStornoOfAutomaticProvision`
- ❌ `syncTaskOnContractActivation`
- ❌ `syncCustomerStatusFromContracts`

---

## 4. CLEANUP-EMPFEHLUNGEN

### SOFORT (Priorität 1)
1. ✅ **`createAutomaticProvisionOnActiveContract` LÖSCHEN** — nicht mehr benötigt
2. 🔴 **`handleStornoOfAutomaticProvision` GUARD HINZUFÜGEN** — Doppel-Storno verhindern
3. 🔴 **`syncCustomerStatusFromContracts` REFAKTOREN** — direkte Query statt Full-Table-Scan

### KURZFRISTIG (Priorität 2)
4. ✅ Audit-Logging für ALLE kritischen Automationen
5. ✅ Performance-Optimierung für `checkPoliciesExpiry` (gefilterte Queries)

### MITTELFRISTIG (Priorität 3)
6. ✅ `onApplicationUpdate` refaktorisieren (aufteilen in kleinere Funktionen)
7. ✅ Task-Typen explizit definieren in `syncTaskOnContractActivation`

---

## 5. RISIKO-MATRIX

| Automation | Race-Condition | Doppeltrigger | Performance | Data Integrity |
|------------|----------------|---------------|-------------|----------------|
| onApplicationUpdate | ✅ Gesichert | ✅ Gesichert | 🟡 Mittel | ✅ Hoch |
| checkPoliciesExpiry | ✅ Gesichert | ✅ Gesichert | 🟡 Mittel | ✅ Hoch |
| handleStornoOfAutomaticProvision | ❌ **UNGESICHERT** | ❌ **UNGESICHERT** | 🟢 Gut | ⚠️ Mittel |
| syncCustomerStatusFromContracts | ❌ Unkritisch | ❌ Unkritisch | 🔴 **KRITISCH** | ✅ Hoch |
| syncTaskOnContractActivation | ❌ Unkritisch | ❌ Unkritisch | 🟢 Gut | 🟡 Mittel |

---

## 6. NÄCHSTE SCHRITTE

1. **Cleanup:** Deaktivierte Automation löschen
2. **Guards:** Storno-Automation absichern
3. **Performance:** Customer-Status fixen
4. **Audit:** Logging für ALLE kritischen Flows
5. **Testing:** Test-Suite für kritische Pfade

---

**Gesamtzustand:** 🟡 **STABIL MIT VERBESSERUNGSBEDARF**

- ✅ Guards für Contract-Creation vorhanden
- ✅ Anti-Duplikation für Tasks vorhanden
- ⚠️ Storno-Automation ungesichert
- 🔴 Customer-Status Performance kritisch
- ❌ Audit-Logging unvollständig