import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, AlertTriangle } from 'lucide-react'

export default function RenewalsActionPanel({ metrics }) {
  const renewalsByUrgency = useMemo(() => {
    const today = new Date()
    const critical = []
    const soon = []
    const upcoming = []

    metrics.contracts.forEach(c => {
      if (c.status !== 'active' || c.renewal_status === 'completed') return

      const endDate = new Date(c.end_date)
      const daysUntilEnd = Math.floor((endDate - today) / (1000 * 60 * 60 * 24))

      if (daysUntilEnd < 60) {
        critical.push({ ...c, daysUntilEnd })
      } else if (daysUntilEnd < 120) {
        soon.push({ ...c, daysUntilEnd })
      } else if (daysUntilEnd < 180) {
        upcoming.push({ ...c, daysUntilEnd })
      }
    })

    return {
      critical: critical.sort((a, b) => a.daysUntilEnd - b.daysUntilEnd),
      soon: soon.sort((a, b) => a.daysUntilEnd - b.daysUntilEnd),
      upcoming,
    }
  }, [metrics])

  return (
    <div className="space-y-4">
      {/* CRITICAL (< 60 days) */}
      {renewalsByUrgency.critical.length > 0 && (
        <Card className="border-l-4 border-l-red-500 bg-red-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-700 text-base">
              <AlertTriangle className="w-4 h-4" /> 🔴 Kritisch (&lt;60 Tage)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {renewalsByUrgency.critical.slice(0, 5).map(c => (
                <div key={c.id} className="flex justify-between items-center p-2 bg-white rounded border border-red-200">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{c.policy_number}</p>
                    <p className="text-xs text-muted-foreground">{c.customer_name}</p>
                  </div>
                  <Badge className="bg-red-100 text-red-700">{c.daysUntilEnd} Tage</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SOON (60-120 days) */}
      {renewalsByUrgency.soon.length > 0 && (
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-700 text-base">
              <Clock className="w-4 h-4" /> 🟡 Bald (60–120 Tage)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {renewalsByUrgency.soon.slice(0, 3).map(c => (
                <div key={c.id} className="flex justify-between items-center p-2 rounded border border-yellow-200">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{c.policy_number}</p>
                    <p className="text-xs text-muted-foreground">{c.customer_name}</p>
                  </div>
                  <Badge variant="outline">{c.daysUntilEnd} Tage</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SUMMARY */}
      {renewalsByUrgency.critical.length === 0 && renewalsByUrgency.soon.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-green-600">✓ Keine kritischen Verlängerungen</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-blue-50">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-700">
              <strong>Total Renewals:</strong> {renewalsByUrgency.critical.length} kritisch,{' '}
              {renewalsByUrgency.soon.length} bald
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}