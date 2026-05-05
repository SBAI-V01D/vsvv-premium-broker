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

      {/* 1. KPI SECTION (TOP) */}
      <div>
        <h2 className="text-lg font-bold mb-4">📊 KPI Überblick</h2>
        <AdvancedKPISection metrics={metrics} />
      </div>

      {/* 2. OPERATIVE SECTION */}
      <div>
        <h2 className="text-lg font-bold mb-4">🚀 Operative Bereiche</h2>
        <OperativeSection metrics={metrics} />
      </div>

      {/* 3. RENEWAL STATUS */}
      {metrics.contracts.filter(c => c.renewal_status !== 'completed').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🔄 Verlängerungen in Arbeit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.contracts
                .filter(c => c.renewal_status !== 'completed')
                .slice(0, 5)
                .map(c => (
                  <div key={c.id} className="flex justify-between items-center text-sm p-2 rounded bg-muted/30">
                    <span>{c.policy_number} - {c.customer_name}</span>
                    <Badge>{c.renewal_status}</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. FINANCE SECTION */}
      <div>
        <h2 className="text-lg font-bold mb-4">💰 Finanzbereich</h2>
        <FinanceSection metrics={metrics} />
      </div>

      {/* 5. ADVISOR PERFORMANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdvisorPerformanceCard advisors={metrics.advisors} />

        {/* PIPELINE STATUS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📦 Pipeline Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(metrics.pipeline).map(([stage, count]) => (
              <div key={stage} className="flex justify-between items-center text-sm">
                <span className="capitalize">{stage}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 6. ALERTS */}
      <div>
        <h2 className="text-lg font-bold mb-4">⚠️ Risiken & Alerts</h2>
        <AlertsPanel alerts={metrics.alerts} />
      </div>
    </div>
  )
}