# Auto-Provision: Enterprise Edge Case Tests

**Datum:** 2026-05-16  
**Priorität:** KRITISCH (Production-relevant)

---

## 📋 Test-Szenarien

### ✅ Test 1: Status-Wechsel-Sequenzen

| Szenario | Aktion | Erwartung | Status |
|----------|--------|-----------|--------|
| **T1.1** Neu → Aktiv | Vertrag: `pending` → `active` | Provision erstellt | ✅ Implementiert |
| **T1.2** Aktiv → Aktiv (kein Wechsel) | Trigger mit gleichem Status | Provision NICHT doppelt | ✅ changed_fields Guard |
| **T1.3** Aktiv → Storniert | Status wird `cancelled`, cancel_date gesetzt | **Storno-Provision erstellt** | ✅ handleStornoOfAutomaticProvision |
| **T1.4** Storniert → Aktiv | Reaktivierung nach Storno | Nur neue Provision, keine Duplikate | ⚠️ Duplikatschutz via policy_id |
| **T1.5** Archiviert → (keine Updates) | Archivierte Verträge | Keine Auto-Provisionen | ⚠️ Filter erforderlich |

---

### ✅ Test 2: Vertragsänderungen während offene Provision

| Szenario | Aktion | Erwartung | Status |
|----------|--------|-----------|--------|
| **T2.1** Gesellschaft geändert | insurer wechselt während Provision pending | Provision bleibt, Notiz hinzufügen | ⚠️ **NEEDS GUARD** |
| **T2.2** Produkt geändert | sparte/product_category geändert | Provision unverändert | ⚠️ **NEEDS AUDIT** |
| **T2.3** Kunde geändert | customer_id geändert | **FEHLER** (Data Integrity!) | ⚠️ **NEEDS LOCK** |
| **T2.4** Premium erhöht | premium_yearly geändert | Provision unverändert (noch ausstehend) | ✅ Korrekt |
| **T2.5** Berater geändert | advisor_id geändert | Provision berät Audit Trail | ⚠️ **NEEDS LOG** |

---

### ✅ Test 3: Family-Member / Mehrfachverträge

| Szenario | Setup | Erwartung | Status |
|----------|-------|-----------|--------|
| **T3.1** Ein Kunde, 2 Verträge | Customer mit 2 aktiven Contracts | 2 separate Provisionen | ✅ policy_id Isolation |
| **T3.2** Hauptkunde + Familienmember | Customer + 2 Family Members, je 1 Vertrag | 3 separate Provisionen korrekt zugeordnet | ⚠️ **NEEDS VALIDATION** |
| **T3.3** Vertrag-Migration auf Familie | Vertrag wird zu Family-Member | Neue Provision für Family-Member | ⚠️ **NEEDS TEST** |
| **T3.4** Familie mit mehreren Gesellschaften | Same customer, unterschiedliche Insurers | Alle Provisionen korrekt getrennt? | ⚠️ **CRITICAL** |

---

### ✅ Test 4: Dashboard-KPI Logik

| Berechnung | Logik | Erwartung | Status |
|-------------|-------|-----------|--------|
| **KPI Open Provisions** | Nur `provision_status = 'pending'` + NOT archived | Zählt Auto-Provisions korrekt? | ⚠️ **VERIFY** |
| **KPI Expected Income** | Sum pending + archived Auto-Provisions | Duplikate bei Storno? | ⚠️ **CRITICAL** |
| **Forecast** | Linear trend Auto-Provisions | Stornos in Calculation? | ⚠️ **CRITICAL** |
| **Advisor KPI** | Commission per Advisor | Auto-Provisions von System Automation zählen? | ⚠️ **DECISION** |

---

### ✅ Test 5: Storno + Auto-Provision Lifecycle

```
Vertrag aktiv (T=0)
→ Provision erstellt: ID=PRO-001
→ Advisor ergänzt Beträge: CHF 500 Brutto
→ Status → earned
→ Payment transfer initiiert

Vertrag storniert (T=30d)
→ handleStornoOfAutomaticProvision triggert
→ Storno-Provision erstellt: ID=STORNO-001, Reference: PRO-001
→ Audit Trail zeigt beide
→ Zahlung reversiert?  ⚠️ NEEDS GUARD
```

| Phase | Status | Test | Result |
|-------|--------|------|--------|
| Provision erstellt | ✅ | Grundfall | Bekannt funktioniert |
| Storno-Auslöser | ✅ | cancel_date-Guard | Neu implementiert |
| Storno-Provision | ✅ | Reference korrekt | Neu implementiert |
| Audit-Trail | ✅ | Beide visible | Neu implementiert |
| **Payment Reversal** | ⚠️ | **CRITICAL** | **NOT IMPLEMENTED** |

---

## 🔴 KRITISCHE GAPS (Must-Fix vor Production)

### Gap 1: Vertragsänderungen während offene Provision
**Problem:** Wenn Gesellschaft/Produkt sich ändert, wird Provision nicht aktualisiert  
**Szenario:** 
```
Provision: insurer=Allianz, sparte=KVG, pending
Vertrag-Update: insurer→AXA, sparte→VVG
Provision bleibt: Allianz, KVG ← FALSCH
```

**Lösung:** Integrity Guard auf Contract-Update
```deno
// In createAutomaticProvisionOnActiveContract
if (changedFields includes insurer/sparte/product) {
  AND offene Provision existiert
  → Audit-Log: "Vertrag geändert, Provision-Audit erforderlich"
  → Flag: needs_review = true
}
```

---

### Gap 2: Duplikate bei aktiv→storniert→aktiv
**Problem:** Wenn Vertrag reaktiviert wird, können 2 Provisionen entstehen  
**Szenario:**
```
T=0: Vertrag active → Provision PRO-001 erstellt
T=30: Vertrag cancelled → Storno STORNO-001 erstellt
T=60: Vertrag reactived → Provision PRO-002 oder Duplikat?
```

**Lösung:** Duplikatschutz auf policy_id + provision_status Filter verschärfen
```deno
// Filter muss explizit ausschließen
existingProvisions = filter({
  policy_id,
  provision_status: ['ausstehend', 'pending'],  ← NO storno/cancelled
  is_storno: false,  ← Explizit
  archived: false
})
```

---

### Gap 3: Family Member Zuordnung
**Problem:** 2 Familienmitglieder mit eigenem Vertrag → Provision kann verwechselt werden  
**Szenario:**
```
Customer: John Doe
  - John (ID=C-001) | Contract ID=CT-001
  - Jane (ID=C-002, family=C-001) | Contract ID=CT-002

Auto-Provision erstellt für CT-001:
  customer_id=C-001, customer_name="John Doe"  ✅ Korrekt

Auto-Provision erstellt für CT-002:
  customer_id=C-002, customer_name="Jane Doe"  ✅ Korrekt (wenn in Vertrag erfasst)

ABER: Was wenn Vertrag auf Hauptkunde zeigt?
  Contract: customer_id=C-001 (John), is_family_member=false
  Jane hat KEINE Provision, obwohl Jane-Vertrag
  → Provisionen vermischt?
```

**Lösung:** Explizit prüfen auf primary_customer_id vs customer_id
```deno
// Nutze IMMER den Vertrags-customer_id, nicht primary
const effectiveCustomerId = contractData.customer_id || contractData.primary_customer_id
// Und Flag primary für Audit-Trails
```

---

### Gap 4: Dashboard-KPI und Forecast
**Problem:** Auto-Provisions ändern KPI-Berechnung, Forecast wird falsch  

**Aktuell:**
```javascript
KPI("expected_income") = sum(provision_status = pending)
```

**Mit Auto-Provision:**
```javascript
KPI("expected_income") = sum(provision_status = pending)
  + sum(auto_provision, provision_status = pending)  ← DOPPEL?
```

**Lösung:** KPI-Logik explizit getrennt halten
```javascript
KPI("pending_manual") = sum(provision_status = pending, created_automatically = false)
KPI("pending_auto") = sum(provision_status = pending, created_automatically = true)
KPI("total_pending") = pending_manual + pending_auto

forecast = trend(pending_manual)  // Nur manuelle, Auto-Provision sind neue Quelle
```

---

### Gap 5: Advisor-KPI
**Problem:** Sollten Auto-Provisionen im Advisor-KPI gezählt werden?

**Frage:** 
- Advisor XY hat 5 Verträge aktiv
- 5 Auto-Provisionen entstehen
- Zählt das zu Advisor-KPI "5 neue Provisionen" oder nicht?

**Empfehlung:**
```
Nein, nicht in KPI zählen.
Grund: Advisor hat nicht selbst eingetragen

Aber: Zeige in UI "5 erwartete Provisionen" getrennt an
```

---

## 🧪 Test-Execution Plan

### Phase 1: Unit Tests (Funktionen isoliert)
```bash
1. createAutomaticProvisionOnActiveContract
   ✅ Korrekte Trigger (status=active)
   ✅ Duplikatschutz
   ✅ Customer-Validierung
   ✅ Storno-Check

2. handleStornoOfAutomaticProvision
   ✅ Storno-Erstellung
   ✅ Reference korrekt
   ✅ Audit-Log

3. Duplikatschutz verschärfen
   ⚠️ policy_id + is_storno Filter
   ⚠️ Reaktivierung nach Storno
```

### Phase 2: Integration Tests (Automation + DB)
```bash
1. Status-Sequenzen
   pending → active → cancelled → active

2. Vertragsänderungen
   Gesellschaft/Produkt während Provision pending

3. Family Members
   Mehrere Kunden, mehrere Verträge
```

### Phase 3: KPI Validation
```bash
1. Dashboard-Berechnungen
2. Forecast-Logik
3. Advisor-KPI-Filter
```

---

## ✅ Empfehlung: Sofort-Fixes

### Fix 1: handleStornoOfAutomaticProvision
**Status:** ✅ Implementiert  
**Aktion:** Automation hinzufügen für Contract-Update mit cancel_date

### Fix 2: Duplikatschutz verschärfen
```javascript
// In createAutomaticProvisionOnActiveContract Zeile 75-82
const existingProvisions = await base44.asServiceRole.entities.CommissionEntry.filter({
  policy_id: contractId,
  is_storno: false,  // ← ADD THIS
  archived: false
});

const hasOpenProvision = existingProvisions.some(e => 
  (e.provision_status === 'ausstehend' || e.provision_status === 'pending') &&
  !e.archived &&
  !e.is_storno  // ← ADD THIS (redundant aber explizit)
);
```

### Fix 3: KPI-Filter in CommissionKPIBar
```javascript
// Trennung in Berechnung
const kpis = {
  manual_provision: entries.filter(e => !e.created_automatically),
  auto_provision: entries.filter(e => e.created_automatically),
  total: entries
}
```

---

## 📊 Test-Checklist vor Go-Live

- [ ] Unit: Alle 5 Basis-Funktionen getestet
- [ ] Integration: Status-Sequenzen T1.1–T1.5
- [ ] Gap 1: Vertragsänderungen während Provision
- [ ] Gap 2: Duplikat-Schutz bei Reaktivierung
- [ ] Gap 3: Family Members korrekt zugeordnet
- [ ] Gap 4: KPI-Berechnung separat nach Manual/Auto
- [ ] Gap 5: Advisor-KPI Filter korrekt (wenn relevant)
- [ ] Storno-Automation hinzufügen
- [ ] Audit-Trail für alle Auto-Aktionen
- [ ] CSV-Export korrekt (Auto-Badge anzeigen)