import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Clock, CheckCircle, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

const urgencyColor = (days) => {
  if (days === null) return 'text-gray-500'
  if (days <= 0) return 'text-red-700 font-bold'
  if (days <= 60) return 'text-red-600'
  if (days <= 120) return 'text-orange-600'
  return 'text-green-600'
}

const urgencyBg = (days) => {
  if (days === null) return 'bg-gray-50 border-gray-200'
  if (days <= 0) return 'bg-red-50 border-red-200'
  if (days <= 60) return 'bg-red-50 border-red-200'
  if (days <= 120) return 'bg-orange-50 border-orange-200'
  return 'bg-green-50 border-green-200'
}

export default function ExpiringContractsPanel({ contracts = [] }) {
  const navigate = useNavigate()

  // Filter & sort expiring contracts (within 365 days, active only, sorted by end_date ASC)
  const expiringList = useMemo(() => {
    const today = new Date()
    const in365 = new Date(today)
    in365.setDate(today.getDate() + 365)
    
    return contracts
      .filter(c => c.status === 'active' && c.end_date && new Date(c.end_date) <= in365)
      .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))
  }, [contracts])

  if (expiringList.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          ✓ Keine Vertragsabläufe vorhanden
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          Verträge laufen aus ({expiringList.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-0 px-6 pb-6">
        {expiringList.map((contract) => {
          const days = daysUntil(contract.end_date)
          const formatDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('de-CH')
          
          return (
            <div
              key={contract.id}
              className={cn(
                'p-3 rounded-lg border flex items-center justify-between cursor-pointer hover:shadow-sm transition-all',
                urgencyBg(days)
              )}
              onClick={() => navigate(`/vertraege`)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{contract.customer_name || '–'}</p>
                <p className="text-xs text-muted-foreground">{contract.insurer} · {contract.sparte || contract.insurance_type || '–'}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className={cn('text-xs font-bold', urgencyColor(days))}>
                    {days === null ? '–' : days <= 0 ? 'ABGELAUFEN' : `${days}T`}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(contract.end_date)}</p>
                </div>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Phone className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}