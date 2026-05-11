import React from 'react'
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { differenceInDays } from 'date-fns'

export default function HouseholdContractsCockpit({ contracts, familyMembers }) {
  const allCustomers = [{ isPrimary: true }, ...familyMembers]

  const getStatusColor = (contract) => {
    if (!contract.end_date) return { bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle2, label: 'stabil', color: 'text-green-700' }

    const daysUntilEnd = differenceInDays(new Date(contract.end_date), new Date())
    if (daysUntilEnd < 30) return { bg: 'bg-red-50', border: 'border-red-200', icon: AlertCircle, label: 'dringend', color: 'text-red-700' }
    if (daysUntilEnd < 90) return { bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock, label: 'baldiger Ablauf', color: 'text-amber-700' }
    return { bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle2, label: 'stabil', color: 'text-green-700' }
  }

  if (!contracts || contracts.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Keine Verträge im Haushalt
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-2 font-semibold text-xs">Person</th>
              <th className="text-left p-2 font-semibold text-xs">Sparte</th>
              <th className="text-left p-2 font-semibold text-xs">Gesellschaft</th>
              <th className="text-left p-2 font-semibold text-xs">Status</th>
              <th className="text-left p-2 font-semibold text-xs">Ablauf</th>
              <th className="text-center p-2 font-semibold text-xs w-12">📊</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => {
              const customer = allCustomers.find(c => c.id === contract.customer_id || (c.isPrimary && !contract.customer_id))
              const statusInfo = getStatusColor(contract)
              const StatusIcon = statusInfo.icon
              const daysUntilEnd = contract.end_date ? differenceInDays(new Date(contract.end_date), new Date()) : null

              return (
                <tr key={contract.id} className={`border-b hover:bg-muted/20 transition-colors ${statusInfo.bg}`}>
                  <td className="p-2 text-xs font-medium">
                    {customer?.first_name} {customer?.last_name}
                  </td>
                  <td className="p-2 text-xs">{contract.sparte || contract.insurance_type || '—'}</td>
                  <td className="p-2 text-xs">{contract.insurer || '—'}</td>
                  <td className="p-2">
                    <Badge variant={contract.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                      {contract.status === 'active' ? 'Aktiv' : contract.status === 'expired' ? 'Abgelaufen' : 'Inaktiv'}
                    </Badge>
                  </td>
                  <td className="p-2 text-xs">
                    {contract.end_date ? (
                      <span>
                        {new Date(contract.end_date).toLocaleDateString('de-CH')}
                        {daysUntilEnd !== null && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({daysUntilEnd > 0 ? `in ${daysUntilEnd}d` : 'abgelaufen'})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <div className="flex justify-center">
                      <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legende */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 text-red-600" /> ROT = dringend
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-amber-600" /> ORANGE = in 30 Tagen
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> GRÜN = stabil
        </div>
      </div>
    </div>
  )
}