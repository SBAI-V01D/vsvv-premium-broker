import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Clock, CheckCircle2, AlertTriangle, BarChart2 } from 'lucide-react'

function formatCHF(amount) {
  return (amount || 0).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })
}

export default function CommissionKPIBar({ entries, filteredEntries }) {
  const kpis = useMemo(() => {
    const active = filteredEntries.filter(e => e.status !== 'cancelled')
    const allActive = entries.filter(e => !e.archived && e.status !== 'cancelled')
    const cancelled = entries.filter(e => !e.archived && e.status === 'cancelled')
    const stornoRate = allActive.length > 0 ? (cancelled.length / (allActive.length + cancelled.length)) * 100 : 0

    const totalExpected = active.reduce((s, e) => s + (e.commission_amount || 0), 0)
    const totalPaid = filteredEntries.filter(e => e.status === 'paid').reduce((s, e) => s + (e.commission_amount || 0), 0)
    const totalReceived = filteredEntries.reduce((s, e) => s + (e.received_amount || 0), 0)
    const pendingRisk = filteredEntries.filter(e => e.status === 'pending').reduce((s, e) => s + (e.commission_amount || 0), 0)
    const openAmount = totalExpected - totalPaid
    const payoutRate = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0

    return { totalExpected, totalPaid, totalReceived, pendingRisk, openAmount, payoutRate, stornoRate, cancelledCount: cancelled.length }
  }, [entries, filteredEntries])

  const tiles = [
    {
      label: 'Erwartete Provision',
      value: formatCHF(kpis.totalExpected),
      sub: `${filteredEntries.filter(e => e.status !== 'cancelled').length} Einträge`,
      icon: BarChart2,
      color: 'text-foreground',
      bg: '',
    },
    {
      label: 'Gesellschaftscourtage erhalten',
      value: formatCHF(kpis.totalReceived),
      sub: 'Berechnungsgrundlage',
      icon: TrendingUp,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      label: 'Ausbezahlt',
      value: formatCHF(kpis.totalPaid),
      sub: `${kpis.payoutRate.toFixed(0)}% Auszahlungsquote`,
      icon: CheckCircle2,
      color: 'text-green-700',
      bg: 'bg-green-50',
    },
    {
      label: 'Offener Restbetrag',
      value: formatCHF(kpis.openAmount),
      sub: 'Noch nicht ausbezahlt',
      icon: Clock,
      color: kpis.openAmount > 0 ? 'text-amber-700' : 'text-green-700',
      bg: kpis.openAmount > 0 ? 'bg-amber-50' : 'bg-green-50',
    },
    {
      label: 'Storno-Risiko (offen)',
      value: formatCHF(kpis.pendingRisk),
      sub: 'Ausstehende Positionen',
      icon: AlertTriangle,
      color: kpis.pendingRisk > 0 ? 'text-orange-700' : 'text-muted-foreground',
      bg: kpis.pendingRisk > 0 ? 'bg-orange-50' : '',
    },
    {
      label: 'Stornoquote',
      value: `${kpis.stornoRate.toFixed(1)}%`,
      sub: `${kpis.cancelledCount} storniert`,
      icon: TrendingDown,
      color: kpis.stornoRate > 10 ? 'text-red-700' : kpis.stornoRate > 5 ? 'text-amber-700' : 'text-green-700',
      bg: kpis.stornoRate > 10 ? 'bg-red-50' : kpis.stornoRate > 5 ? 'bg-amber-50' : 'bg-green-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {tiles.map((t, i) => (
        <Card key={i} className={t.bg ? `border-0 ${t.bg}` : ''}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">{t.label}</p>
              <t.icon className={`w-4 h-4 ${t.color} flex-shrink-0`} />
            </div>
            <p className={`text-xl font-bold ${t.color} leading-tight`}>{t.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}