import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

export default function PortalApplications() {
  const { data: user } = useQuery({
    queryKey: ['portal-user'],
    queryFn: () => base44.auth.me(),
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['portal-applications', user?.id],
    queryFn: () => base44.entities.Application.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
  })

  if (applications.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Meine Anträge</h1>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Keine Anträge vorhanden
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Meine Anträge</h1>
      <div className="space-y-4">
        {applications.map(app => (
          <Card key={app.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg">{app.insurance_type}</h3>
                    <Badge>{app.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{app.insurer}</p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Produkt</span>
                      <p className="font-medium">{app.product || '–'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Jahresprämie</span>
                      <p className="font-medium">CHF {app.estimated_premium_yearly?.toLocaleString('de-CH', { minimumFractionDigits: 0 }) || '–'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Startdatum</span>
                      <p className="font-medium">{app.requested_start_date ? format(new Date(app.requested_start_date), 'dd.MM.yyyy') : '–'}</p>
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