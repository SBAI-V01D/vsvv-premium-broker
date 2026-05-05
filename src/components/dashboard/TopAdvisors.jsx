import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy } from 'lucide-react'

export default function TopAdvisors({ advisors, organizations, commissionEntries, contracts }) {
  const advisorStats = advisors.map(a => {
    const org = organizations.find(o => o.id === a.organization_id)
    const provision = commissionEntries
      .filter(ce => ce.broker_email === a.email)
      .reduce((sum, ce) => sum + (ce.gross_commission || 0), 0)
    const policenCount = contracts.filter(c => c.assigned_broker === a.email && c.status === 'active').length
    return {
      id: a.id,
      name: `${a.firstname} ${a.lastname}`,
      org: org?.name || '–',
      provision,
      policenCount,
    }
  })
    .sort((a, b) => b.provision - a.provision)
    .slice(0, 5)

  const medals = ['🥇', '🥈', '🥉', '4.', '5.']

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" /> Top Berater
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {advisorStats.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Keine Berater vorhanden</p>
        ) : (
          <div className="divide-y">
            {advisorStats.map((a, idx) => (
              <div key={a.id} className="px-6 py-3 flex items-center gap-3">
                <span className="text-base w-6 text-center">{medals[idx]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.org}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-primary">CHF {a.provision.toLocaleString('de-CH', { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-muted-foreground">{a.policenCount} Policen</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}