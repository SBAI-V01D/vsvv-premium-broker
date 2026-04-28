import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

export default function PortalContracts() {
  const { data: user } = useQuery({
    queryKey: ['portal-user'],
    queryFn: () => base44.auth.me(),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['portal-contracts', user?.id],
    queryFn: () => base44.entities.Contract.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
  })

  if (contracts.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Meine Verträge</h1>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Keine Verträge vorhanden
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Meine Verträge</h1>
      <div className="space-y-4">
        {contracts.map(contract => (
          <Card key={contract.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg">{contract.insurance_type}</h3>
                    <Badge>{contract.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{contract.insurer}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Policen-Nr.</span>
                      <p className="font-medium">{contract.policy_number || '–'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Monatsprämie</span>
                      <p className="font-medium">CHF {contract.premium_monthly?.toLocaleString('de-CH', { minimumFractionDigits: 2 }) || '–'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vertragsbeginn</span>
                      <p className="font-medium">{contract.start_date ? format(new Date(contract.start_date), 'dd.MM.yyyy') : '–'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vertragsende</span>
                      <p className="font-medium">{contract.end_date ? format(new Date(contract.end_date), 'dd.MM.yyyy') : 'Unbefristet'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}