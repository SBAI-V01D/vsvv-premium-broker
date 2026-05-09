import React from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

const fmtChf = (n) => n >= 1000
  ? `CHF ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  : `CHF ${Math.round(n)}`

export default function OperativeKPIStrip({ 
  activeCustomers = 0,
  activeLeads = 0,
  openTasks = 0,
  expiringContracts = 0,
  totalMonthlyPremium = 0,
  yearlyCommissionForecast = 0,
}) {
  const navigate = useNavigate()

  const kpis = [
    { label: 'Aktive Kunden', value: activeCustomers, color: 'text-blue-600', path: '/kunden', highlight: false },
    { label: 'Leads', value: activeLeads, color: 'text-violet-600', path: '/leads', highlight: false },
    { label: 'Offene Aufgaben', value: openTasks, color: openTasks > 5 ? 'text-red-600' : 'text-amber-600', path: '/aufgaben', highlight: openTasks > 5 },
    { label: 'Ablaufende Verträge', value: expiringContracts, color: expiringContracts > 0 ? 'text-red-600' : 'text-muted-foreground', path: '/vertraege', highlight: expiringContracts > 0 },
    { label: 'Monthly Premium', value: fmtChf(totalMonthlyPremium), color: 'text-emerald-600', path: '/vertraege', highlight: false },
    { label: 'Commission Forecast/Y', value: fmtChf(yearlyCommissionForecast), color: 'text-teal-600', path: '/provisionen-courtagen', highlight: false },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-muted/30 p-3 rounded-lg">
      {kpis.map((kpi) => (
        <button
          key={kpi.label}
          onClick={() => navigate(kpi.path)}
          className={cn(
            'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all hover:shadow-sm',
            kpi.highlight
              ? 'bg-red-50 border-red-200 shadow-sm'
              : 'bg-white border-border hover:border-primary/50'
          )}
        >
          <span className={cn('text-base font-bold', kpi.color)}>{kpi.value}</span>
          <span className="text-[10px] text-muted-foreground text-center leading-tight">{kpi.label}</span>
        </button>
      ))}
    </div>
  )
}