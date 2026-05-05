import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Users, FileText, Wallet, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function AdvancedKPISection({ metrics }) {
  const kpis = [
    {
      label: 'Kunden',
      value: metrics.customers.total,
      sub: `${metrics.customers.active} aktiv`,
      icon: Users,
      color: 'bg-blue-50 border-l-blue-500',
    },
    {
      label: 'Aktive Verträge',
      value: metrics.policies.active,
      sub: `${metrics.policies.renewalDue} zur Verlängerung`,
      icon: FileText,
      color: 'bg-green-50 border-l-green-500',
    },
    {
      label: 'Anträge ausstehend',
      value: metrics.applications.inProgress,
      sub: `${metrics.applications.new} Neu`,
      icon: AlertCircle,
      color: 'bg-amber-50 border-l-amber-500',
    },
    {
      label: 'Gesamtprämie',
      value: `CHF ${(metrics.premium.total / 1000).toFixed(0)}K`,
      sub: 'Aktive Policies',
      icon: TrendingUp,
      color: 'bg-purple-50 border-l-purple-500',
    },
    {
      label: 'Provisionen',
      value: `CHF ${(metrics.commission.total / 1000).toFixed(0)}K`,
      sub: `CHF ${(metrics.commission.open / 1000).toFixed(0)}K offen`,
      icon: Wallet,
      color: 'bg-red-50 border-l-red-500',
    },
    {
      label: 'Lead-Conversion',
      value: `${metrics.leads.conversionRate}%`,
      sub: `${metrics.leads.converted}/${metrics.leads.total} konvertiert`,
      icon: CheckCircle2,
      color: 'bg-indigo-50 border-l-indigo-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <Card key={kpi.label} className={`border-l-4 ${kpi.color}`}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-2">{kpi.sub}</p>
                </div>
                <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}