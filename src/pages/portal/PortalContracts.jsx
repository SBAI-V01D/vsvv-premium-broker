import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { usePortalCustomer } from '@/hooks/usePortalCustomer'
import { getSparteLabel } from '@/lib/insuranceSparten'

const STATUS_LABELS = {
  active: 'Aktiv',
  aktiv: 'Aktiv',
  cancelled: 'Gekündigt',
  gekuendigt: 'Gekündigt',
  paused: 'Pausiert',
  expired: 'Abgelaufen',
}

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  aktiv: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  gekuendigt: 'bg-red-100 text-red-700',
  paused: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-gray-100 text-gray-600',
}

export default function PortalContracts() {
  const { customer, customerId, isLoading } = usePortalCustomer()

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['portal-contracts', customerId],
    queryFn: () => base44.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId,
  })

  if (isLoading || loadingContracts) {
    return <div className="flex items-center justify-center h-40 text-muted-foreground">Laden...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Meine Verträge</h1>
      {contracts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Keine Verträge vorhanden
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {contracts.map(contract => (
            <Card key={contract.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-lg">{contract.insurer || contract.provider}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[contract.status] || 'bg-muted text-muted-foreground'}`}>
                        {contract.custom_status || STATUS_LABELS[contract.status] || contract.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {getSparteLabel(contract.sparte || contract.insurance_type) || contract.insurance_type}
                      {contract.product && ` · ${contract.product}`}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Policen-Nr.</p>
                        <p className="font-medium">{contract.policy_number || '–'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Monatsprämie</p>
                        <p className="font-medium">
                          {contract.premium_monthly
                            ? `CHF ${contract.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`
                            : '–'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Jahresprämie</p>
                        <p className="font-medium">
                          {contract.premium_yearly
                            ? `CHF ${contract.premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`
                            : '–'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Vertragsbeginn</p>
                        <p className="font-medium">
                          {contract.start_date ? format(new Date(contract.start_date), 'dd.MM.yyyy') : '–'}
                        </p>
                      </div>
                    </div>

                    {(contract.sparte_data?.franchise || contract.sparte_data?.model) && (
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        {contract.sparte_data.franchise && <span>Franchise: CHF {contract.sparte_data.franchise}</span>}
                        {contract.sparte_data.model && <span>Modell: {contract.sparte_data.model}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}