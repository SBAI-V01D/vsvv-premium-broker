import React, { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Clock, FileWarning, RefreshCw, Target, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function AutoAISummary({ customer, contracts = [], applications = [], documents = [], tasks = [] }) {
  const summary = useMemo(() => {
    // Active contracts
    const activeContracts = contracts.filter(c => 
      (c.customer_id === customer.id || c.primary_customer_id === customer.id) && 
      c.status === 'active'
    )

    // Expiring contracts (next 90 days)
    const today = new Date()
    const in90 = new Date(today); in90.setDate(today.getDate() + 90)
    const expiringContracts = activeContracts.filter(c => {
      if (!c.end_date) return false
      const end = new Date(c.end_date)
      return end <= in90 && end >= today
    })

    // Open tasks
    const openTasks = tasks.filter(t => 
      t.customer_id === customer.id && 
      ['open', 'in_progress', 'waiting'].includes(t.status)
    )

    // Missing documents
    const missingDocs = activeContracts.filter(c => !c.policy_document_url).length

    // Coverage gaps
    const REQUIRED_SPARTEN = ['kvg', 'haftpflicht_privat']
    const coveredSparten = new Set(
      activeContracts.map(c => c.sparte || c.insurance_type).filter(Boolean)
    )
    const coverageGaps = REQUIRED_SPARTEN.filter(s => !coveredSparten.has(s))

    // Pending applications
    const pendingApps = applications.filter(a =>
      (a.customer_id === customer.id || a.primary_customer_id === customer.id) &&
      !['approved', 'rejected', 'policiert', 'angenommen'].includes(a.custom_status || a.status)
    )

    return {
      activeContracts: activeContracts.length,
      expiringCount: expiringContracts.length,
      openTasks: openTasks.length,
      missingDocs,
      coverageGaps: coverageGaps.length,
      pendingApps: pendingApps.length,
      totalPremium: activeContracts.reduce((s, c) => s + (c.premium_yearly || 0), 0),
    }
  }, [customer, contracts, applications, documents, tasks])

  const metrics = [
    { label: 'Aktive Verträge', value: summary.activeContracts, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Abläufe nächste 90d', value: summary.expiringCount, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', alert: summary.expiringCount > 0 },
    { label: 'Offene Aufgaben', value: summary.openTasks, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50', alert: summary.openTasks > 0 },
    { label: 'Fehlende Dokumente', value: summary.missingDocs, icon: FileWarning, color: 'text-red-600', bg: 'bg-red-50', alert: summary.missingDocs > 0 },
    { label: 'Coverage-Lücken', value: summary.coverageGaps, icon: AlertTriangle, color: 'text-pink-600', bg: 'bg-pink-50', alert: summary.coverageGaps > 0 },
    { label: 'Anträge ausstehend', value: summary.pendingApps, icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-50', alert: summary.pendingApps > 0 },
  ]

  return (
    <Card className="border-blue-100 bg-blue-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          🤖 Automatische Kundenübersicht
          {(summary.expiringCount + summary.openTasks + summary.missingDocs + summary.coverageGaps + summary.pendingApps) > 0 && (
            <Badge className="ml-auto bg-red-100 text-red-700">
              {summary.expiringCount + summary.openTasks + summary.missingDocs + summary.coverageGaps + summary.pendingApps} zu beachten
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Key metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {metrics.map(m => {
            const Icon = m.icon
            return (
              <div key={m.label} className={cn('p-2 rounded-lg border', m.bg, m.alert && 'border-red-300')}>
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', m.color)} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground truncate">{m.label}</p>
                    <p className={cn('text-sm font-bold', m.color)}>{m.value}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Revenue */}
        {summary.totalPremium > 0 && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Jahresprämien aktiver Verträge:</span>
              <span className="font-bold text-emerald-700">
                CHF {summary.totalPremium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {(summary.expiringCount > 0 || summary.coverageGaps > 0 || summary.missingDocs > 0) && (
          <div className="pt-2 border-t border-border space-y-1 text-xs">
            {summary.expiringCount > 0 && (
              <p className="text-orange-700 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> {summary.expiringCount} Verträge laufen bald ab
              </p>
            )}
            {summary.coverageGaps > 0 && (
              <p className="text-pink-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> {summary.coverageGaps} Versicherungslücken vorhanden
              </p>
            )}
            {summary.missingDocs > 0 && (
              <p className="text-red-700 flex items-center gap-1.5">
                <FileWarning className="w-3 h-3" /> {summary.missingDocs} Policen ohne Dokumente
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}