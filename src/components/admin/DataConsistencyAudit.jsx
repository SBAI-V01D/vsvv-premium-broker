import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function DataConsistencyAudit() {
  const [audit, setAudit] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const runAudit = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await base44.functions.invoke('auditDataConsistency', {})
      setAudit(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!audit) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Datenkonsistenz-Audit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Führe ein umfassendes Audit der Datenkonsistenz durch:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
              <li>Dubletten in Kundendaten</li>
              <li>Verwaiste Datensätze (Orphans)</li>
              <li>Referentielle Integrität</li>
              <li>Archivierte & gelöschte Datensätze</li>
              <li>Testdaten im System</li>
              <li>Fehlende erforderliche Felder</li>
            </ul>
            <Button onClick={runAudit} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" /> Audit läuft...
                </>
              ) : (
                '🔍 Audit starten'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasIssues = audit.summary.total_issues > 0
  const hasCritical = audit.summary.critical > 0

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className={cn('border-l-4', hasCritical ? 'border-l-red-500' : hasIssues ? 'border-l-amber-500' : 'border-l-green-500')}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {hasCritical ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Datenkonsistenz: KRITISCH
                </>
              ) : hasIssues ? (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Datenkonsistenz: Probleme gefunden
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Datenkonsistenz: OK
                </>
              )}
            </CardTitle>
            <Button onClick={runAudit} variant="outline" size="sm">
              Neu prüfen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-2 rounded bg-muted">
              <p className="text-2xl font-bold">{audit.summary.total_customers}</p>
              <p className="text-xs text-muted-foreground">Kunden</p>
            </div>
            <div className="p-2 rounded bg-muted">
              <p className="text-2xl font-bold">{audit.summary.total_contracts}</p>
              <p className="text-xs text-muted-foreground">Verträge</p>
            </div>
            <div className="p-2 rounded bg-muted">
              <p className="text-2xl font-bold">{audit.summary.total_tasks}</p>
              <p className="text-xs text-muted-foreground">Aufgaben</p>
            </div>
            <div className="p-2 rounded bg-muted">
              <p className="text-2xl font-bold">{audit.summary.total_applications}</p>
              <p className="text-xs text-muted-foreground">Anträge</p>
            </div>
            <div className="p-2 rounded bg-muted">
              <p className="text-2xl font-bold">{audit.summary.total_advisors}</p>
              <p className="text-xs text-muted-foreground">Berater</p>
            </div>
            <div className={cn('p-2 rounded', hasCritical ? 'bg-red-50' : hasIssues ? 'bg-amber-50' : 'bg-green-50')}>
              <p className={cn('text-2xl font-bold', hasCritical ? 'text-red-600' : hasIssues ? 'text-amber-600' : 'text-green-600')}>
                {audit.summary.total_issues}
              </p>
              <p className="text-xs text-muted-foreground">Probleme</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues List */}
      {audit.issues.length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Gefundene Probleme ({audit.issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {audit.issues.map((issue, i) => (
              <div key={i} className="p-2 rounded border border-red-200 bg-white text-sm">
                ⚠️ {issue}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Detailed Checks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Duplicates */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Kundendubletten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="p-2 rounded bg-muted">
              <p className="text-xs text-muted-foreground">Total Kunden</p>
              <p className="text-lg font-bold">{audit.checks.customer_duplicates.total}</p>
            </div>
            <div className={cn('p-2 rounded', audit.checks.customer_duplicates.duplicates > 0 ? 'bg-red-50' : 'bg-green-50')}>
              <p className="text-xs text-muted-foreground">Dubletten</p>
              <p className={cn('text-lg font-bold', audit.checks.customer_duplicates.duplicates > 0 ? 'text-red-600' : 'text-green-600')}>
                {audit.checks.customer_duplicates.duplicates}
              </p>
            </div>
            {audit.checks.customer_duplicates.examples.length > 0 && (
              <div className="text-[10px] text-muted-foreground mt-2 space-y-1">
                {audit.checks.customer_duplicates.examples.map((ex, i) => (
                  <div key={i} className="p-1 rounded bg-white border">
                    {ex.email}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customers Missing Org */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Kunden ohne Org</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={cn('p-2 rounded', audit.checks.customer_missing_org.count > 0 ? 'bg-amber-50' : 'bg-green-50')}>
              <p className="text-xs text-muted-foreground">Fehlen organization_id</p>
              <p className={cn('text-lg font-bold', audit.checks.customer_missing_org.count > 0 ? 'text-amber-600' : 'text-green-600')}>
                {audit.checks.customer_missing_org.count}
              </p>
            </div>
            {audit.checks.customer_missing_org.examples.length > 0 && (
              <div className="text-[10px] text-muted-foreground space-y-1">
                {audit.checks.customer_missing_org.examples.map((ex, i) => (
                  <div key={i} className="p-1 rounded bg-white border truncate">
                    {ex.name} ({ex.id})
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contract Orphans */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Verwaiste Verträge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="p-2 rounded bg-muted">
              <p className="text-xs text-muted-foreground">Total Verträge</p>
              <p className="text-lg font-bold">{audit.checks.contract_orphans.total}</p>
            </div>
            <div className={cn('p-2 rounded', audit.checks.contract_orphans.orphaned > 0 ? 'bg-red-50' : 'bg-green-50')}>
              <p className="text-xs text-muted-foreground">Verwaist</p>
              <p className={cn('text-lg font-bold', audit.checks.contract_orphans.orphaned > 0 ? 'text-red-600' : 'text-green-600')}>
                {audit.checks.contract_orphans.orphaned}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Task Orphans */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Aufgabenprobleme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="p-2 rounded bg-muted">
              <p className="text-xs text-muted-foreground">Total Aufgaben</p>
              <p className="text-lg font-bold">{audit.checks.task_orphans.total}</p>
            </div>
            <div className={cn('p-2 rounded', audit.checks.task_orphans.orphaned > 0 ? 'bg-red-50' : 'bg-green-50')}>
              <p className="text-xs text-muted-foreground">Verwaist</p>
              <p className={cn('text-lg font-bold', audit.checks.task_orphans.orphaned > 0 ? 'text-red-600' : 'text-green-600')}>
                {audit.checks.task_orphans.orphaned}
              </p>
            </div>
            <div className={cn('p-2 rounded', audit.checks.task_orphans.missing_assignee > 0 ? 'bg-amber-50' : 'bg-green-50')}>
              <p className="text-xs text-muted-foreground">Keine Zuweisung</p>
              <p className={cn('text-lg font-bold', audit.checks.task_orphans.missing_assignee > 0 ? 'text-amber-600' : 'text-green-600')}>
                {audit.checks.task_orphans.missing_assignee}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Advisor References */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Berater-Referenzen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="p-2 rounded bg-muted">
              <p className="text-xs text-muted-foreground">Berater gesamt</p>
              <p className="text-lg font-bold">{audit.checks.advisor_references.total_advisors}</p>
            </div>
            <div className={cn('p-2 rounded', audit.checks.advisor_references.contracts_bad_broker > 0 ? 'bg-red-50' : 'bg-green-50')}>
              <p className="text-xs text-muted-foreground">Verträge ungültig</p>
              <p className={cn('text-lg font-bold', audit.checks.advisor_references.contracts_bad_broker > 0 ? 'text-red-600' : 'text-green-600')}>
                {audit.checks.advisor_references.contracts_bad_broker}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Archived/Deleted */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Archiviert & Gelöscht</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="p-2 rounded bg-muted">
              <p className="text-xs text-muted-foreground">Archivierte Kunden</p>
              <p className="text-lg font-bold">{audit.checks.archived_deleted.archived_customers}</p>
            </div>
            <div className="p-2 rounded bg-muted">
              <p className="text-xs text-muted-foreground">Gelöschte Aufgaben</p>
              <p className="text-lg font-bold">{audit.checks.archived_deleted.deleted_tasks}</p>
            </div>
          </CardContent>
        </Card>

        {/* Test Data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Testdaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={cn('p-2 rounded', audit.checks.test_data.test_customers > 0 ? 'bg-amber-50' : 'bg-green-50')}>
              <p className="text-xs text-muted-foreground">Test-Kunden</p>
              <p className={cn('text-lg font-bold', audit.checks.test_data.test_customers > 0 ? 'text-amber-600' : 'text-green-600')}>
                {audit.checks.test_data.test_customers}
              </p>
            </div>
            <div className={cn('p-2 rounded', audit.checks.test_data.test_tasks > 0 ? 'bg-amber-50' : 'bg-green-50')}>
              <p className="text-xs text-muted-foreground">Test-Aufgaben</p>
              <p className={cn('text-lg font-bold', audit.checks.test_data.test_tasks > 0 ? 'text-amber-600' : 'text-green-600')}>
                {audit.checks.test_data.test_tasks}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timestamp */}
      <div className="text-xs text-muted-foreground text-center p-2">
        Audit durchgeführt: {new Date(audit.timestamp).toLocaleString('de-CH')}
      </div>
    </div>
  )
}