import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, FileText, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `vor ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `vor ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `vor ${days}d`
}

export default function ActivityFeed({ customers = [], contracts = [], commissionEntries = [] }) {
  const navigate = useNavigate()

  const items = [
    ...customers.slice(0, 10).map(c => ({
      type: 'customer',
      id: c.id,
      label: `${c.first_name} ${c.last_name}`,
      sub: 'Neuer Kunde',
      ts: c.created_date,
      icon: User,
      color: 'bg-blue-100 text-blue-600',
      path: `/kunden/${c.id}`,
    })),
    ...contracts.slice(0, 10).map(c => ({
      type: 'contract',
      id: c.id,
      label: `${c.insurer} – ${c.insurance_type || c.product || ''}`,
      sub: 'Neue Police',
      ts: c.created_date,
      icon: FileText,
      color: 'bg-green-100 text-green-600',
      path: `/vertraege`,
    })),
    ...commissionEntries.slice(0, 10).map(ce => ({
      type: 'commission',
      id: ce.id,
      label: `CHF ${(ce.gross_commission || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}`,
      sub: `Provision – ${ce.insurer || ''}`,
      ts: ce.created_date,
      icon: Wallet,
      color: 'bg-amber-100 text-amber-600',
      path: `/provisionen-courtagen`,
    })),
  ]
    .filter(i => i.ts)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, 12)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Letzte Aktivitäten</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Keine Aktivitäten</p>
        ) : (
          <div className="divide-y max-h-72 overflow-y-auto">
            {items.map((item, idx) => {
              const Icon = item.icon
              return (
                <div
                  key={idx}
                  className="px-6 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => item.path && navigate(item.path)}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(item.ts)}</span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}