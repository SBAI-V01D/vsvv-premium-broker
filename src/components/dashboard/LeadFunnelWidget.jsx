import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, ArrowRight } from 'lucide-react'

const STAGES = [
  { key: 'new',       label: 'Neu',        color: 'bg-gray-400' },
  { key: 'contacted', label: 'Kontaktiert', color: 'bg-blue-400' },
  { key: 'qualified', label: 'Qualifiziert',color: 'bg-purple-400' },
  { key: 'converted', label: 'Konvertiert', color: 'bg-green-500' },
  { key: 'lost',      label: 'Verloren',    color: 'bg-red-400' },
]

export default function LeadFunnelWidget({ leads = [] }) {
  const navigate = useNavigate()

  const counts = STAGES.reduce((acc, s) => {
    acc[s.key] = leads.filter(l => l.status === s.key).length
    return acc
  }, {})

  const total = leads.length
  const convRate = total > 0 ? ((counts.converted / total) * 100).toFixed(1) : '0.0'
  const activeLeads = (counts.new || 0) + (counts.contacted || 0) + (counts.qualified || 0)

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/leads')}>
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="text-sm flex items-center gap-2 text-slate-900">
          <TrendingUp className="w-4 h-4 text-green-600" />
          Lead Funnel
          <ArrowRight className="w-3 h-3 ml-auto text-slate-400" />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {/* Mini Funnel Bar */}
        {total > 0 && (
          <div className="flex rounded-full overflow-hidden h-2 gap-0.5">
            {STAGES.map(s => {
              const pct = (counts[s.key] / total) * 100
              return pct > 0 ? (
                <div
                  key={s.key}
                  className={`${s.color} transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${s.label}: ${counts[s.key]}`}
                />
              ) : null
            })}
          </div>
        )}

        {/* Stage counts */}
        <div className="grid grid-cols-5 gap-1 text-center">
          {STAGES.map(s => (
            <div key={s.key}>
              <p className="text-base font-bold">{counts[s.key]}</p>
              <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* KPIs */}
        <div className="flex justify-between pt-1 border-t border-slate-100 text-xs text-muted-foreground">
          <span>Aktiv: <strong className="text-foreground">{activeLeads}</strong></span>
          <span>Conversion: <strong className="text-green-600">{convRate}%</strong></span>
          <span>Total: <strong className="text-foreground">{total}</strong></span>
        </div>
      </CardContent>
    </Card>
  )
}