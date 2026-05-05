import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'

export default function RenewalExecutionSection({ contracts }) {
  const renewalsToHandle = useMemo(() => {
    const today = new Date()
    return contracts
      .filter(c => c.status === 'active' && c.end_date)
      .map(c => {
        const daysLeft = Math.floor((new Date(c.end_date) - today) / (1000 * 60 * 60 * 24))
        return { ...c, daysLeft }
      })
      .filter(c => c.daysLeft > 0 && c.daysLeft <= 90 && c.renewal_status !== 'completed')
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 10)
  }, [contracts])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="w-4 h-4" /> ⏰ VERTRÄGE ZU BEARBEITEN
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {renewalsToHandle.length === 0 ? (
          <p className="text-sm text-green-600">✓ Keine Verlängerungen anstehend</p>
        ) : (
          renewalsToHandle.map(c => (
            <div key={c.id} className={`p-2 rounded border-l-4 ${c.daysLeft < 30 ? 'border-l-red-500 bg-red-50' : 'border-l-yellow-500 bg-yellow-50'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-sm">{c.policy_number}</p>
                  <p className="text-xs text-muted-foreground">{c.customer_name}</p>
                </div>
                <Badge className={c.daysLeft < 30 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}>
                  {c.daysLeft} days
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}