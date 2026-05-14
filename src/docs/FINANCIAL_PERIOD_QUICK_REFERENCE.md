# 📋 QUICK REFERENCE: Financial Period Mapping

**TL;DR für Developers:**

---

## ❌ FALSCH

```javascript
// DON'T: Nutze created_at für Finanzlogik!
entries.filter(e => {
  const date = new Date(e.created_at)  // ❌ FALSCH
  return date >= start && date <= end
})

// DON'T: Nutze entry_date ohne Fallback
entries.filter(e => {
  const date = new Date(e.entry_date)  // ❌ Unzureichend
  return date >= start && date <= end
})
```

---

## ✅ RICHTIG

```javascript
// DO: Nutze getFinancialPeriodDate()
import { getFinancialPeriodDate } from '@/lib/financialPeriod'

entries.filter(e => {
  const financialDate = getFinancialPeriodDate(e, 'courtage')  // ✅ RICHTIG
  return financialDate >= start && financialDate <= end
})

// DO: Nutze filterByFinancialPeriod()
import { filterByFinancialPeriod } from '@/lib/financialPeriod'

const filtered = entries.filter(e => 
  filterByFinancialPeriod(e, start, end, 'courtage')  // ✅ RICHTIG
)
```

---

## 📦 API Reference

### `getFinancialPeriodDate(entry, type)`
```javascript
// entry = CommissionEntry object
// type = 'courtage' oder 'provision'
// returns = Date object oder null

const date = getFinancialPeriodDate(entry, 'courtage')
if (date) {
  console.log(date)  // 2026-02-28T00:00:00
}
```

**Priority:**
1. `courtage_received_date` (Falls vorhanden)
2. `courtage_invoiced_date` (Falls vorhanden)
3. `entry_date` (Fallback)

---

### `filterByFinancialPeriod(entry, start, end, type)`
```javascript
// Prüfe ob entry in Periode fällt
const inPeriod = filterByFinancialPeriod(entry, feb1, feb28, 'courtage')
// returns = true/false
```

---

### `groupByFinancialPeriod(entries, type)`
```javascript
// Gruppiere Entries nach Finanzdatum
const grouped = groupByFinancialPeriod(entries, 'courtage')
// returns = { 'Feb 2026': [...], 'Mar 2026': [...] }

Object.entries(grouped).forEach(([month, entries]) => {
  console.log(`${month}: ${entries.length} Einträge`)
})
```

---

### `calcMonthlyValue(entries, date, fieldName, type)`
```javascript
// Berechne Monatswert basierend auf Finanzdatum
const februaryCourtage = calcMonthlyValue(
  entries, 
  new Date(2026, 1),  // February
  'advisor_courtage_amount',
  'courtage'
)
// returns = 12345.67 (CHF)
```

---

### `validateFinancialPeriod(entry)`
```javascript
// Prüfe ob Entry korrekt periodisiert ist
const warnings = validateFinancialPeriod(entry)
if (warnings.length > 0) {
  console.warn('⚠️', warnings)
  // ['Courtage-Datum (Feb 2026) ≠ Erfassungs-Datum (Mai 2026)']
}
```

---

## 🔄 Migration Checklist

### Wenn Du Code mit Finanzlogik schreibst:

- [ ] Nutze `getFinancialPeriodDate()` statt `created_at`
- [ ] Nutze `filterByFinancialPeriod()` statt `entry_date` Filter
- [ ] Prüfe: Ist `courtage_received_date` oder `provision_received_date` gesetzt?
- [ ] Falls nicht: Fallback zu `entry_date`
- [ ] Teste: Verschobene Einträge (Mai erfasst, Februar Datum) funktionieren?

---

## ⚙️ In CommissionEngine.js verwenden

```javascript
// ALTE LOGIK (FALSCH)
const me = active.filter(e => {
  const ed = new Date(e.entry_date)
  return ed.getFullYear() === year && (ed.getMonth() + 1) === month
})

// NEUE LOGIK (RICHTIG)
const me = active.filter(e => {
  const courtageDate = getFinancialPeriodDate(e, 'courtage')
  if (courtageDate && courtageDate >= periodStart && courtageDate <= periodEnd) return true
  
  const provisionDate = getFinancialPeriodDate(e, 'provision')
  if (provisionDate && provisionDate >= periodStart && provisionDate <= periodEnd) return true
  
  return false
})
```

---

## 🎯 Bei KPI-Berechnung

**REGEL:** Benutze IMMER `getFinancialPeriodDate()`, wenn:
- Du Entries nach Periode filterst
- Du Monatswerte berechnest
- Du Trends zeigst
- Du KPIs exportierst
- Du Trendprognosen machst

**AUSNAHMEN:**
- Audit-Log: Hier kann `created_at` sinnvoll sein
- Daten-Lineage: `created_at` dokumentiert Erfassungszeitpunkt

---

## 🧪 Testing

```javascript
describe('Financial Period', () => {
  test('Shifted entry appears in correct financial month', () => {
    const entry = {
      created_at: '2026-05-14T10:00:00',  // Erfasst in Mai
      courtage_received_date: '2026-02-28',  // Aber Finanzdatum Februar
      advisor_courtage_amount: 1000,
    }

    // MUSS in Februar sein
    const feb = filterByFinancialPeriod(
      entry,
      new Date(2026, 1, 1),
      new Date(2026, 2, 0),
      'courtage'
    )
    expect(feb).toBe(true)

    // DARF NICHT in Mai sein
    const may = filterByFinancialPeriod(
      entry,
      new Date(2026, 4, 1),
      new Date(2026, 5, 0),
      'courtage'
    )
    expect(may).toBe(false)
  })
})
```

---

## 📊 Häufige Fehler

| Fehler | Symptom | Fix |
|--------|---------|-----|
| `created_at` verwendet | Mai-KPI zu hoch | Nutze `getFinancialPeriodDate()` |
| Kein Fallback | Crash wenn `courtage_received_date` NULL | Nutze Priority: received > invoiced > entry |
| Falsches Feld für Provision | Feb-Provision fehlt | Nutze `provision_received_date`, nicht `courtage_received_date` |
| Keine Validierung | Falsche Periodisierung unbemerkt | Nutze `validateFinancialPeriod()` |

---

## 🔗 Links

- **Implementation:** `lib/financialPeriod.js`
- **Integration:** `lib/commissionEngine.js`
- **Full Docs:** `docs/FINANCIAL_PERIOD_CORRECTION.md`
- **Compliance:** `docs/SECURITY_COMPLIANCE_CHECKLIST.md`

---

**Letzte Änderung:** 2026-05-14  
**Aktuell:** ✅ Gültig