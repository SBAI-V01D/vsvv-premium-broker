import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'

export default function RenewalWidget() {
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-end_date'),
  })

  const renewalData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return contracts
      .filter(c => c.status === 'active' && c.renewal_status !== 'completed')
      .map(c => {
        const endDate = new Date(c.end_date)
        const daysUntilEnd = Math.floor((endDate - today) / (1000 * 60 * 60 * 24))

        let priority = 'low'
        if (daysUntilEnd < 60) priority = 'high'
        else if (daysUntilEnd < 120) priority = 'medium'

        return { ...c, daysUntilEnd, priority }
      })
      .filter(c => c.daysUntilEnd < 180) // Nur Verträge die in nächsten 6 Monaten ablaufen
      .sort((a, b) => a.daysUntilEnd - b.daysUntilEnd)
      .slice(0, 5)
  }, [contracts])

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'border-red-500 bg-red-50'
      case 'medium':
        return 'border-yellow-500 bg-yellow-50'
      default:
        return 'border-blue-500 bg-blue-50'
    }
  }

  const getPriorityLabel = (priority, days) => {
    if (priority === 'high') return `🔴 Wichtig (${days} Tage)`
    if (priority === 'medium') return `🟡 Bald (${days} Tage)`
    return `🟢 Später (${days} Tage)`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4" /> Verträge laufen aus (Top 5)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {renewalData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine ausstehenden Verlängerungen</p>
        ) : (
          <div className="space-y-2">
            {renewalData.map(contract => (
              <div key={contract.id} className={`p-2.5 rounded-lg border-l-4 ${getPriorityColor(contract.priority)}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{contract.policy_number}</p>
                    <p className="text-xs text-muted-foreground">{contract.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{getPriorityLabel(contract.priority, contract.daysUntilEnd)}</p>
                    <p className="text-xs text-muted-foreground">{contract.end_date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}