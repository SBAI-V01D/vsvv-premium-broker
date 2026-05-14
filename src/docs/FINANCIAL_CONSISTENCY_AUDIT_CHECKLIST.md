# 🔍 FINANCIAL CONSISTENCY AUDIT CHECKLIST

**Date:** 2026-05-14  
**Phase:** POST-FIX VALIDATION  
**Purpose:** Ensure ALL components use centralized financial period logic  

---

## 📋 COMPONENT AUDIT – Which use calcKPIsForPeriod()?

### Dashboard Components

| Component | File | Uses calcKPIs? | Status | Notes |
|-----------|------|---------------|--------|-------|
| KPI Bar | `components/commissions/CommissionKPIBar.jsx` | ✅ YES | **VERIFIED** | Line 47-48: `useMemo(() => calcKPIs(entries))` |
| KPI Bar Period | `components/commissions/CommissionKPIBar.jsx` | ✅ YES | **VERIFIED** | Line 48: `useMemo(() => calcKPIs(filteredEntries))` |
| Broker Stats | `pages/CommissionsAndCourtage.jsx` | ⚠️ PARTIAL | **NEEDS FIX** | Lines 271-289: Manual iteration instead of calcKPIs |
| Broker Table Agg | `components/commissions/CommissionTablePaginated.jsx` | ⚠️ PARTIAL | **NEEDS FIX** | Calculates aggregates per page manually |
| BI Intelligence | `components/commissions/CommissionIntelligenceTab.jsx` | ✅ YES | **CHECK** | Uses calcMonthlyTrend (financial dates OK) |
| Storno Analysis | `components/commissions/CommissionsAndCourtage.jsx` | ⚠️ PARTIAL | **NEEDS CHECK** | Line 462: `stornoEntries.reduce()` |

### Export Components

| Component | File | Uses calcKPIs? | Status | Notes |
|-----------|------|---------------|--------|-------|
| CSV Export | `lib/commissionEngine.js:458-507` | ✅ YES | **VERIFIED** | Uses `generateCSV(filteredEntries)` correctly |
| CSV Totals | `pages/CommissionsAndCourtage.jsx` | ⚠️ NEEDS CHECK | **AUDIT** | Does CSV row sum = KPI total? |
| PDF Export | – | ❌ NONE | **MISSING** | No PDF export currently |
| Excel Export | – | ❌ NONE | **MISSING** | No Excel export currently |

### Filter/Period Components

| Component | File | Period Filter | Status | Notes |
|-----------|------|----------------|--------|-------|
| PeriodSelector | `components/commissions/PeriodSelector.jsx` | Line 76 | ✅ CORRECT | Outputs `{start, end}` dates |
| Period Filter Logic | `pages/CommissionsAndCourtage.jsx` | Lines 263-268 | ✅ CORRECT | Uses `getFinancialPeriodDate()` logic |
| Pagination | `components/commissions/CommissionTablePaginated.jsx` | Line 40+ | ⚠️ CHECK | Pagination with filtered data = correct? |

### Aggregation Components

| Component | File | Aggregation Type | Status | Notes |
|-----------|------|------------------|--------|-------|
| Monthly Trend | `lib/commissionEngine.js:293-339` | Financial dates | ✅ VERIFIED | Uses courtage_received_date priority |
| Storno Dimension | `lib/commissionEngine.js:273-290` | Status-based | ✅ VERIFIED | Not date-dependent |
| KPI Totals | `lib/commissionEngine.js:202-269` | Central | ✅ VERIFIED | New calcKPIsForPeriod() |

---

## 🔴 CRITICAL ISSUES FOUND

### ⚠️ Issue #1: Broker Table Manual Aggregation

**Location:** `pages/CommissionsAndCourtage.jsx` lines 271-289

**Current Code:**
```javascript
const brokerStats = useMemo(() => {
  const map = {}
  activeEntries.forEach(e => {
    const ne = normalizeLegacyEntry(e)
    const key = ne.advisor_id || '–'
    if (!map[key]) map[key] = { ... }
    map[key].advisorCourtage += ne.advisor_courtage_amount || 0  // ❌ Direct sum
    ...
  })
  return Object.values(map)
}, [activeEntries])
```

**Problem:**
- Uses manual iteration instead of `calcKPIs()`
- Doesn't validate storno logic
- May diverge from KPI bar totals
- Doesn't apply consistency checks

**Fix Required:**
```javascript
// Option A: Use calcKPIs for verification
const globalKpi = useMemo(() => calcKPIs(activeEntries), [activeEntries])
const brokerStats = useMemo(() => {
  // Calculate per-broker but validate against global
  // ...
  return Object.values(map)
}, [activeEntries])
// Assert: brokerStats.sum ≈ globalKpi.totalAdvisorCourtage
```

### ⚠️ Issue #2: CSV Totals Verification

**Location:** `pages/CommissionsAndCourtage.jsx` line 307

**Current Code:**
```javascript
downloadCSV(generateCSV(filteredEntries), ...)
```

**Problem:**
- CSV contains raw data rows
- User must manually sum to verify KPI
- No automated total row in CSV
- Potential for discrepancies

**Fix Required:**
Add totals row at end of CSV:
```javascript
function generateCSVWithTotals(entries) {
  const kpi = calcKPIs(entries)
  const csv = generateCSV(entries)
  const totalsRow = [
    'TOTALE', '', '', '', '', '',
    kpi.totalCourtageReceived.toFixed(2),
    // ... other totals
  ]
  return csv + '\n' + totalsRow.join(';')
}
```

### ⚠️ Issue #3: Storno Banner Calculation

**Location:** `pages/CommissionsAndCourtage.jsx` line 362

**Current Code:**
```javascript
formatCHF(stornoEntries.reduce((s, e) => {
  const ne = normalizeLegacyEntry(e)
  return s + (ne.advisor_courtage_amount || 0)
}, 0))
```

**Problem:**
- Manual reduce instead of using calcStornoByDimension
- May diverge from BI storno analysis

**Fix Required:**
```javascript
const stornoAnalysis = useMemo(() => calcStornoByDimension(filteredEntries, 'advisor_id'), [filteredEntries])
const totalStornoLoss = stornoAnalysis.reduce((s, b) => s + b.commissionLost, 0)
```

---

## 🧪 REGRESSION TEST PLAN

### Test Case 1: Entry Created May, Financial Date February

```
Setup:
  entry = {
    created_at: 2026-05-14
    entry_date: 2026-05-14
    courtage_received_date: 2026-02-28
    advisor_courtage_amount: 500
  }

Expected:
  calcKPIsForPeriod(entries, Feb1, Feb28) → includes entry (500)
  calcKPIsForPeriod(entries, May1, May31) → excludes entry (0)
  calcMonthlyTrend(entries) → Feb has 500, May has 0

Actual Result: [TEST PENDING]
```

### Test Case 2: Broker Table ≠ KPI Bar

```
Setup:
  5 entries, 2 advisors
  
Expected:
  KPI Bar: totalAdvisorCourtage = 1500
  Broker Table Sum: sum of all advisor.advisorCourtage = 1500
  CSV Total Row: 1500
  BI Chart Sum: 1500
  
All must be identical ±0.01 (rounding tolerance)

Actual Result: [TEST PENDING]
```

### Test Case 3: Storno Consistency

```
Setup:
  10 entries, 2 cancelled (total 200 CHF)
  
Expected:
  KPI: cancelledCount = 2, stornoRate = 20%
  Storno Banner: commissionLost = 200
  Storno Tab: rate = 20%
  BI Chart: storno rate = 20%
  
All must match

Actual Result: [TEST PENDING]
```

### Test Case 4: Reserve Logic

```
Setup:
  Courtage 1000, Storno 10%
  
Expected:
  Brutto: 1000
  Reserve: 100
  Netto: 900
  
  KPI: totalAdvisorCourtage = 1000
        totalCourtageReserve = 100
        totalCourtagePayout = 900
  
  CSV: matches above
  Dashboard: matches above

Actual Result: [TEST PENDING]
```

### Test Case 5: Period Boundary

```
Setup:
  Entry with courtage_received_date = 2026-02-28 23:59:59
  Period: Feb 1 00:00:00 to Feb 28 23:59:59
  
Expected:
  Should be included (date is within boundary)
  
Actual Result: [TEST PENDING]
```

---

## 📊 VALIDATION CHECKLIST

### ✅ Mandatory Validations (Go-Live Blockers)

- [ ] **TEST 4.1:** KPI Bar = Broker Table totals (identical ±0.01)
- [ ] **TEST 3.1:** CSV totals = KPI totals (with totals row)
- [ ] **TEST 1.1:** Period filtering works (May created ≠ Feb financial)
- [ ] **TEST C:** Storno: Brutto - Reserve = Netto (all consistent)
- [ ] **TEST D:** Monthly aggregation (no double-count)
- [ ] **Hardcoded Dates:** No `created_at` in financial calculations
- [ ] **RLS:** Financial filters don't leak cross-tenant data
- [ ] **Export:** CSV/PDF/Excel use same totals as KPI

### ⚠️ High Priority (Before Analytics)

- [ ] Performance: calcKPIsForPeriod() < 100ms for 10k entries
- [ ] Re-renders: KPI bar doesn't re-calculate on unrelated changes
- [ ] Memoization: useMemo dependencies are correct
- [ ] Pagination: Page totals + global totals = consistent
- [ ] BI Charts: Trends use same data as KPI

### 📋 Medium Priority (Before Lead/Opportunity)

- [ ] Documentation: Financial period logic documented
- [ ] Legacy Code: All `entry_date` for finance removed
- [ ] Regression Tests: Automated, CI/CD integrated
- [ ] Advisor KPI: Individual advisor totals = sum of their entries

---

## 🔧 FIX PRIORITY

### Priority 1 (BLOCKING – This Week)

```
1. Fix Broker Table aggregation
   - Use calcKPIs for validation
   - Ensure = KPI Bar totals
   Effort: 1 hour

2. Add CSV totals row
   - calcKPIs-based totals
   - Validates against KPI
   Effort: 30 min

3. Write regression tests
   - Test Case 1-5 above
   - Automated validation
   Effort: 2 hours
```

### Priority 2 (IMPORTANT – Before Analytics)

```
4. Fix Storno banner
   - Use calcStornoByDimension
   Effort: 30 min

5. Performance audit
   - calcKPIsForPeriod benchmarks
   Effort: 1 hour

6. Memoization review
   - dependencies correct?
   Effort: 1 hour
```

### Priority 3 (BEFORE FEATURES)

```
7. RLS complete audit
   - Finance filters don't leak
   Effort: 4 hours

8. Documentation
   - Financial period logic
   Effort: 2 hours
```

---

## ✅ SIGN-OFF CRITERIA

**System is ready for RLS audit when:**

```
✅ All Priority 1 fixes done
✅ All regression tests GREEN
✅ KPI = Broker = CSV = BI (identical)
✅ No hardcoded dates in financial logic
✅ Performance validated
```

**System is ready for features when:**

```
✅ All above + Priority 2 done
✅ RLS audit complete
✅ No cross-tenant leaks
✅ Documentation complete
```

---

**Next Step:** Run Regression Tests → Fix Issues → Validate Consistency