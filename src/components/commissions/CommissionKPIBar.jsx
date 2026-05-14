import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Clock, CheckCircle2, AlertTriangle, BarChart2, AlertCircle } from 'lucide-react'
import { calcKPIs, formatCHF, formatPct } from '@/lib/commissionEngine'

export default function CommissionKPIBar({ entries, filteredEntries }) {
  // KPIs immer auf gesamtem (ungefilterten) Bestand für globale Konsistenz
  const global = useMemo(() => calcKPIs(entries), [entries])
  // Gefilterte KPIs für Periodenansicht
  const period = useMemo(() => calcKPIs(filteredEntries), [filteredEntries])

  const tiles = [
    {
      label: 'Erwartete Provision (Periode)',
      value: formatCHF(period.totalExpected),
      sub: `${period.nonCancelledCount} Einträge im Zeitraum`,
      icon: BarChart2,
      color: 'text-foreground',
      bg: '',
    },
    {
      label: 'Gesellschaftscourtage erhalten',
      value: formatCHF(period.totalReceived),
      sub: 'Berechnungsgrundlage (Periode)',
      icon: TrendingUp,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      label: 'Ausbezahlt (Periode)',
      value: formatCHF(period.totalPaid),
      sub: `${formatPct(period.payoutRate, 0)} Auszahlungsquote`,
      icon: CheckCircle2,
      color: 'text-green-700',
      bg: 'bg-green-50',
    },
    {
      label: 'Offener Restbetrag (Periode)',
      value: formatCHF(period.openAmount),
      sub: 'Noch nicht ausbezahlt',
      icon: Clock,
      color: period.openAmount > 0 ? 'text-amber-700' : 'text-green-700',
      bg: period.openAmount > 0 ? 'bg-amber-50' : 'bg-green-50',
    },
    {
      label: 'Storno-Risiko (ausstehend)',
      value: formatCHF(period.totalPending),
      sub: `${period.pendingCount} ausstehende Positionen`,
      icon: AlertTriangle,
      color: period.totalPending > 0 ? 'text-orange-700' : 'text-muted-foreground',
      bg: period.totalPending > 0 ? 'bg-orange-50' : '',
    },
    {
      label: 'Stornoquote (gesamt)',
      value: formatPct(global.stornoRate),
      sub: `${global.cancelledCount} storniert von ${global.count}`,
      icon: TrendingDown,
      color: global.stornoRate > 10 ? 'text-red-700' : global.stornoRate > 5 ? 'text-amber-700' : 'text-green-700',
      bg: global.stornoRate > 10 ? 'bg-red-50' : global.stornoRate > 5 ? 'bg-amber-50' : 'bg-green-50',
      warn: global.stornoRate > 10,
    },
  ]

  return (
    <div className="space-y-2">
      {global.overdueCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>{global.overdueCount} überfällige Positionen</strong> (eingereicht vor über 60 Tagen, noch nicht erhalten) ·
            Offen: <strong>{formatCHF(global.totalOverdue)}</strong>
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {tiles.map((t, i) => (
          <Card key={i} className={`${t.bg ? `border-0 ${t.bg}` : ''} ${t.warn ? 'ring-1 ring-red-300' : ''}`}>
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
    </div>
  )
}