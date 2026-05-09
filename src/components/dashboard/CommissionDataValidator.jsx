import React, { useMemo } from 'react'
import { AlertCircle, CheckCircle2, TrendingUp, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { 
  syncApplicationCommission, 
  detectDuplicateCommissions,
  validateCommissionEntry 
} from '@/lib/commissionSync'

export default function CommissionDataValidator({ 
  applications = [], 
  commissionEntries = [], 
  contracts = [] 
}) {
  // Validate all commission entries
  const validationResults = useMemo(() => {
    const results = {
      valid: 0,
      invalid: 0,
      issues: [],
      issuesByType: {},
    }

    commissionEntries.forEach(entry => {
      const validation = validateCommissionEntry(entry)
      if (validation.isValid) {
        results.valid++
      } else {
        results.invalid++
        validation.issues.forEach(issue => {
          results.issuesByType[issue] = (results.issuesByType[issue] || 0) + 1
          if (results.issues.length < 5) {
            results.issues.push({ entry: entry.id, issue, policy: entry.policy_number })
          }
        })
      }
    })

    return results
  }, [commissionEntries])

  // Detect duplicate commissions
  const duplicates = useMemo(() => {
    return detectDuplicateCommissions(commissionEntries)
  }, [commissionEntries])

  // Check application-commission sync
  const appSyncStatus = useMemo(() => {
    const statuses = {
      synced: 0,
      mismatched: 0,
      noCommissions: 0,
      issues: [],
    }

    applications.forEach(app => {
      const sync = syncApplicationCommission(app, commissionEntries)
      if (sync.status === 'synced') {
        statuses.synced++
      } else if (sync.status === 'mismatched') {
        statuses.mismatched++
        if (statuses.issues.length < 3) {
          statuses.issues.push({
            app: app.id,
            insurer: app.insurer,
            expected: sync.expected,
            actual: sync.actual,
            variance: sync.variance,
          })
        }
      } else {
        statuses.noCommissions++
      }
    })

    return statuses
  }, [applications, commissionEntries])

  // Summary metrics
  const summary = {
    hasIssues: validationResults.invalid > 0 || duplicates.length > 0 || appSyncStatus.mismatched > 0,
    issueCount: validationResults.invalid + duplicates.length + appSyncStatus.mismatched,
    health: validationResults.invalid === 0 && duplicates.length === 0 && appSyncStatus.mismatched === 0 ? 'healthy' : 'warning',
  }

  return (
    <div className="space-y-3">
      {/* Overall Health */}
      <Card className={cn('border', summary.health === 'healthy' ? 'border-green-200 bg-green-50/30' : 'border-orange-200 bg-orange-50/30')}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Provisionsdaten-Integrität</CardTitle>
            {summary.health === 'healthy' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-orange-600" />
            )}
          </div>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          {summary.health === 'healthy' ? (
            <p className="text-green-700 font-medium">
              ✓ Alle Provisionsdaten sind korrekt synchronisiert
            </p>
          ) : (
            <p className="text-orange-700 font-medium">
              ⚠️ {summary.issueCount} Problem{summary.issueCount > 1 ? 'e' : ''} erkannt
            </p>
          )}
          
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-orange-100/50">
            <div className="text-center">
              <p className="font-bold text-foreground">{validationResults.valid}</p>
              <p className="text-[10px] text-muted-foreground">Gültig</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-orange-600">{validationResults.invalid}</p>
              <p className="text-[10px] text-muted-foreground">Fehler</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-orange-600">{duplicates.length}</p>
              <p className="text-[10px] text-muted-foreground">Duplikate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Issues */}
      {validationResults.invalid > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              Validierungsfehler ({validationResults.invalid})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            {Object.entries(validationResults.issuesByType).map(([issue, count]) => (
              <div key={issue} className="flex justify-between items-center p-1.5 rounded bg-orange-100/40">
                <span className="text-muted-foreground">{issue}</span>
                <span className="font-semibold text-orange-700">{count}</span>
              </div>
            ))}
            {validationResults.issues.length > 0 && (
              <div className="mt-2 p-2 rounded bg-orange-100/30 border border-orange-200/50">
                <p className="font-semibold mb-1">Beispiele:</p>
                {validationResults.issues.slice(0, 3).map((issue, idx) => (
                  <p key={idx} className="text-[10px] text-muted-foreground">
                    • {issue.policy || issue.entry}: {issue.issue}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Duplicate Commissions */}
      {duplicates.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-red-600" />
              Doppelte Provisionen ({duplicates.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            {duplicates.slice(0, 3).map((dup, idx) => (
              <div key={idx} className="p-2 rounded bg-red-100/40 border border-red-200/50">
                <div className="flex justify-between">
                  <span className="font-mono text-[9px] text-muted-foreground">{dup.policy_id}</span>
                  <span className="font-semibold text-red-700">{dup.count} Einträge</span>
                </div>
                <p className="text-muted-foreground mt-1">
                  Gesamtbetrag: CHF {dup.totalAmount.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Application-Commission Sync */}
      {appSyncStatus.mismatched > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              Synchronisierungsprobleme ({appSyncStatus.mismatched})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            {appSyncStatus.issues.map((issue, idx) => (
              <div key={idx} className="p-2 rounded bg-amber-100/40 border border-amber-200/50">
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-amber-900">{issue.insurer}</span>
                  <span className="text-amber-700 font-semibold">±{issue.variance}%</span>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Erwartet: CHF {issue.expected.toFixed(2)}</span>
                  <span>Aktuell: CHF {issue.actual.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Success state */}
      {summary.health === 'healthy' && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Alle Provisionsdaten sind korrekt und synchronisiert
        </div>
      )}
    </div>
  )
}