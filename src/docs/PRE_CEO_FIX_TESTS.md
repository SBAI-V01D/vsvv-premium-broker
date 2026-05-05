# 🧪 **PRE CEO FIX – STABILISIERUNGSTESTS**

---

## ✅ **TEST 1: Doppelte Auszahlung verhindern**

### Setup:
```
1. Erstelle Commission (status=earned, received_date=gestern, is_paid=false)
2. Rufe guardDoublePayment() auf
→ RESULT: safe=true
3. Executeextend executePayoutTransfers()
→ RESULT: commission.is_paid=true
4. Versuche erneut auszuzahlen
→ RESULT: ❌ BLOCKED (is_paid=true)
```

### Expected:
- ✅ Erste Auszahlung: erfolgreich
- ✅ Zweite Auszahlung: BLOCKED

---

## ✅ **TEST 2: Portal – Nur eigene Daten sichtbar**

### Setup:
```
1. Customer A mit Policy 1
2. Customer B mit Policy 2
3. Customer B (Portal) versucht Policy 1 zu lesen
   → guardPortalAccess({
       entity_type: 'Contract',
       entity_id: Policy1.id,
       app_user_customer_id: B.id
     })
→ RESULT: allowed=false
```

### Expected:
- ✅ Kunde sieht nur Daten mit eigenem customer_id
- ✅ Cross-Customer-Access: BLOCKED

---

## ✅ **TEST 3: Upload ohne Kunde blockiert**

### Setup:
```
1. Upload Dokument (customer_id=NULL)
2. automationPipeline() prüft stage=customer_mapped
   → customer_id IS NULL
   → BLOCK application_created
→ RESULT: ❌ Application creation blocked
```

### Expected:
- ✅ Pipeline wartet bis Kunde gesetzt
- ✅ Keine verwaiste Applications

---

## ✅ **TEST 4: Pipeline Status sichtbar**

### Setup:
```
1. Upload Dokument
2. Prüfe document.processing_stage in UI
   → uploaded → parsed → entities_detected → customer_mapped → application_created → policy_created
→ RESULT: Alle Stages sichtbar
```

### Expected:
- ✅ User sieht Progress: "Datenextraktion... Kundenmatching... Antrag erstellen..."
- ✅ Keine Black-Box

---

## ✅ **TEST 5: Periodenabschluss – Keine Änderungen nach Abschluss**

### Setup:
```
1. closePeriod({month: "2026-05-01"})
   → period.status = closed
2. Versuche Commission zu ändern (entry_date=2026-05-15)
   → guardPeriodClosed({entry_date: "2026-05-15"})
   → period.status = closed
→ RESULT: ❌ BLOCKED
```

### Expected:
- ✅ Offen Periode: änderbar
- ✅ Geschlossene Periode: immutable
- ✅ Audit Trail: locked

---

## ✅ **TEST 6: Duplicate Policy Check**

### Setup:
```
1. Customer mit aktiver Police (product="KVG")
2. Versuche neue Police mit gleicherproduct zu erstellen
   → guardDuplicatePolicy({
       customer_id: X,
       product: "KVG"
     })
→ RESULT: allowed=false
```

### Expected:
- ✅ 1x aktive Police pro Produkt pro Kunde
- ✅ Doppelzahlung verhindert

---

## ✅ **TEST 7: Pipeline Stuck Detection**

### Setup:
```
1. Document stuck in processing_stage für > 30 Minuten
2. guardPipelineStuck({document_id, timeout_minutes: 30})
   → minutes_elapsed > 30
→ RESULT: stuck=true
```

### Expected:
- ✅ Admin sieht: "Document hängt fest (entities_detected)"
- ✅ Manual Retry angeboten

---

## ✅ **TEST 8: KPI Updates**

### Setup:
```
1. Erstelle 3 Commissions für Advisor A
   - comm1: 1000 CHF (status=earned)
   - comm2: 500 CHF (status=paid)
   - comm3: 300 CHF (status=pending)
2. updateKPIAdvisor({advisor_id: A})
3. Prüfe: advisor.total_commission, paid_commission, open_commission
→ RESULT:
   - total: 1800 (earned+paid+pending)
   - paid: 500
   - open: 1300
```

### Expected:
- ✅ total_commission = 1800
- ✅ paid_commission = 500
- ✅ open_commission = 1300

---

## 🚀 **DEPLOYMENT CHECKLIST**

- [ ] Entities aktualisiert: CommissionEntry.is_paid, FinancePeriod, Advisor KPIs, Customer KPIs
- [ ] 5 Guard Functions deployed: guardDoublePayment, guardPeriodClosed, guardDuplicatePolicy, guardPortalAccess, guardPipelineStuck
- [ ] 2 KPI Functions deployed: updateKPIAdvisor, updateKPICustomer
- [ ] 1 Period-Management Function: closePeriod
- [ ] executePayoutTransfers + cancelPolicy aktualisiert
- [ ] Tests 1–8 durchgeführt
- [ ] CEO hat Signoff gegeben

---

## 📊 **POST-DEPLOYMENT MONITORING**

```plaintext
- guardDoublePayment: Call Count (target: 0 blocks/week)
- guardPeriodClosed: Call Count (target: every month 1x close)
- guardPortalAccess: Blocks Count (target: 0 blocks for valid users)
- updateKPIAdvisor: Recalc Time (target: < 1s)
- guardPipelineStuck: Stuck Count (target: < 1 stuck doc/week)
```

---