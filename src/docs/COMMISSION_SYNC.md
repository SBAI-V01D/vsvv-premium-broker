# Commission Data Synchronization Guide

## Overview

Commission data is synchronized between:
- **Insurance Applications** (estimated commissions)
- **CommissionEntry Records** (actual commissions)
- **Dashboard Metrics** (displayed statistics)

This ensures real-time accuracy and prevents lost or duplicated data.

## Data Flow

### 1. Application → CommissionEntry

When an application status changes to **accepted** (angenommen, policiert, approved):
1. Application commission is calculated: `premium_yearly × commission_rate / 100`
2. System creates a `CommissionEntry` record linked to:
   - `linked_contract_id` (the insurance policy)
   - `advisor_id` (responsible broker)
   - `customer_id` (policyholder)
   - `organization_id` (operating unit)

### 2. CommissionEntry → Dashboard

Dashboard metrics auto-refresh when CommissionEntry data changes:
- **MTD Commissions** = entries for current month
- **Total Commission** = sum of active entries (excluding cancelled/storno)
- **Pending** = commissions not yet received
- **Forecast** = calculated from active contracts × commission_rate

## Key Functions

### `lib/commissionSync.js`

**calculateApplicationCommission(application)**
- Computes expected commission from application data
- Handles both yearly and monthly premiums
- Rounding to 2 decimal places

**validateCommissionEntry(entry)**
- Checks for required fields: policy_id, advisor_id, organization_id, customer_id, amount
- Returns validation status + issues list

**syncApplicationCommission(app, allCommissions)**
- Compares application estimate vs. actual CommissionEntry records
- Allows 2% variance (rounding tolerance)
- Returns sync status: synced | mismatched | no_commissions

**detectDuplicateCommissions(entries)**
- Finds multiple commission records for the same policy
- Flags as issue if count > 1 (excluding stornos)
- Returns duplicate groups with totals

**recalculateDashboardCommissions(entries, contracts)**
- Refreshes all dashboard commission metrics
- Called when data changes
- Returns: total, pending, received, mtd, forecast

### Backend Functions

**syncCommissionOnApplicationUpdate**
- Triggered when application status → accepted
- Creates CommissionEntry if needed
- Validates sync between app estimate and commission record
- Updates advisor KPIs

**validateCommissionDataIntegrity** (admin only)
- Comprehensive integrity check
- Detects: invalid entries, duplicates, mismatches, orphans
- Returns detailed report for diagnostics

## Dashboard Integration

### CommissionDataValidator Component

Located: `components/dashboard/CommissionDataValidator`

Displays in diagnostic tab:
- Overall health status
- Validation errors (missing fields)
- Duplicate detection
- Application-commission sync issues
- Example problems with details

### sharedData Object

The main dashboard passes commission metrics to all tabs:
```javascript
{
  commissionMetrics,      // Calculated metrics (total, pending, mtd, forecast)
  totalCommissionEarned,  // Total commission amount
  pendingCommissions,     // Not yet received
  commissionValidation,   // Integrity check results
}
```

## Troubleshooting

### Issue: Commission appears in application but not on dashboard

1. Check if application is in accepted status
2. Run `validateCommissionDataIntegrity` function
3. Look for sync mismatch in CommissionDataValidator
4. Verify `linked_contract_id` is set on application

### Issue: Duplicate commissions shown

1. Open diagnostic tab → CommissionDataValidator
2. Look for "Doppelte Provisionen" section
3. Check if both have same policy_id
4. If one is a storno/reversal, mark `is_storno = true`
5. If unintended duplicate, delete one entry and sync again

### Issue: Dashboard metrics not updating

1. Verify commissionEntries data is fetched: check React Query cache
2. Run integrity validator to detect missing links
3. Check if new entries have required fields (advisor_id, organization_id, etc.)
4. Force refresh: clear browser cache or refresh page

### Issue: Application commission doesn't match CommissionEntry amount

1. Open diagnostic tab
2. Look for "Synchronisierungsprobleme" (sync issues)
3. Compare expected vs. actual amounts
4. Check commission_rate on both records
5. Recalculate if rate differs more than 2%

## Data Model Relationships

```
Application
├─ customer_id → Customer
├─ organization_id → Organization
├─ advisor_id → Advisor
├─ linked_contract_id → Contract
├─ commission_rate (%)
└─ estimated_premium_yearly (CHF)
       ↓ (when accepted)
CommissionEntry
├─ policy_id → Contract
├─ customer_id → Customer
├─ advisor_id → Advisor
├─ organization_id → Organization
├─ commission_amount (CHF)
└─ status (pending|received|paid|cancelled)
```

## Best Practices

1. **Always set commission_rate on applications** before accepting
2. **Verify organization_id and advisor_id** on all entries
3. **Monitor CommissionDataValidator** in diagnostic tab weekly
4. **Run validateCommissionDataIntegrity** after bulk operations
5. **Never manually delete** CommissionEntry without marking storno
6. **Keep audit trail** - status changes tracked in StatusHistory

## Mobile Considerations

- Dashboard auto-refreshes when CommissionEntry records change
- Mobile view shows abbreviated metrics with same data accuracy
- Diagnostic tab available on all devices for troubleshooting
- Sync works offline-first via React Query caching

## Performance

- Commission calculations memoized (useMemo)
- Dashboard metrics recalculate only when data changes
- Large datasets (1000+ commissions) still performant due to filtering
- Real-time updates via React Query invalidation

## Future Enhancements

- Automated duplicate detection and cleanup
- Commission approval workflow with audit trail
- Advanced reconciliation against insurer invoices
- ML-based anomaly detection for suspicious entries