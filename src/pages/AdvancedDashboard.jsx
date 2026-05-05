import React, { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import AdvancedKPISection from '@/components/dashboard/AdvancedKPISection'
import OperativeSection from '@/components/dashboard/OperativeSection'
import FinanceSection from '@/components/dashboard/FinanceSection'
import AdvisorPerformanceCard from '@/components/dashboard/AdvisorPerformanceCard'
import AlertsPanel from '@/components/dashboard/AlertsPanel'
import DailyActionsPanel from '@/components/dashboard/DailyActionsPanel'
import PipelineSection from '@/components/dashboard/PipelineSection'
import RenewalsActionPanel from '@/components/dashboard/RenewalsActionPanel'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'

export default function AdvancedDashboard() {
  const [filterAdvisor, setFilterAdvisor] = useState('all')
  const [filterOrg, setFilterOrg] = useState('all')

  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.list(),
  })

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list(),
  })

  const metrics = useDashboardMetrics({
    advisor_id: filterAdvisor === 'all' ? null : filterAdvisor,
    organization_id: filterOrg === 'all' ? null : filterOrg,
  })

  return (
    <div className="space-y-6">
      {/* HEADER + FILTER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Cockpit 2.0</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Operative & Strategische Übersicht · {new Date().toLocaleDateString('de-CH')}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select value={filterOrg} onValueChange={setFilterOrg}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Organisation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Organisationen</SelectItem>
              {organizations.map(o => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterAdvisor} onValueChange={setFilterAdvisor}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Berater" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Berater</SelectItem>
              {advisors.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.firstname} {a.lastname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 🔥 1. HEUTE ZU TUN (OBERSTE PRIORITÄT) */}
      <DailyActionsPanel metrics={metrics} />

      {/* 📊 2. PIPELINE */}
      <div>
        <h2 className="text-lg font-bold mb-4">📊 Pipeline (wo steht das Geld?)</h2>
        <PipelineSection metrics={metrics} />
      </div>

      {/* ⏰ 3. VERTRAGSABLÄUFE (RENEWALS) */}
      <div>
        <h2 className="text-lg font-bold mb-4">⏰ Vertragsabläufe (Bestand = Geld)</h2>
        <RenewalsActionPanel metrics={metrics} />
      </div>

      {/* 📋 4. AUFGABEN */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📋 Aufgaben & Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-blue-50">
              <p className="text-xs text-muted-foreground">Offene Tasks</p>
              <p className="text-2xl font-bold text-blue-600">{metrics.tasks.open}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50">
              <p className="text-xs text-muted-foreground">Follow-ups</p>
              <p className="text-2xl font-bold text-amber-600">
                {metrics.tasks.open > 0 ? Math.ceil(metrics.tasks.open * 0.3) : 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50">
              <p className="text-xs text-muted-foreground">AI Generated</p>
              <p className="text-2xl font-bold text-green-600">Auto</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 👤 5. KUNDEN (ÜBERSICHT) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">👤 Kundenbestand</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{metrics.customers.total}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aktiv</p>
              <p className="text-2xl font-bold text-green-600">{metrics.customers.active}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Portal</p>
              <p className="text-2xl font-bold text-blue-600">{metrics.customers.portal}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 💰 6. FINANZEN (GANZ UNTEN – ERGEBNIS, NICHT AKTION) */}
      <div>
        <h2 className="text-lg font-bold mb-4">💰 Finanzen (Ergebnis)</h2>
        <FinanceSection metrics={metrics} />
      </div>
    </div>
  )
}