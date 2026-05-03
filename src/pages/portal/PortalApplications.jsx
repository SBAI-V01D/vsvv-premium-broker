import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { usePortalCustomer, fetchPortalApplications } from '@/hooks/usePortalCustomer'
import { getSparteLabel } from '@/lib/insuranceSparten'

const STATUS_COLORS = {
  angenommen: 'bg-green-100 text-green-700',
  policiert: 'bg-green-100 text-green-700',
  approved: 'bg-green-100 text-green-700',
  eingereicht: 'bg-blue-100 text-blue-700',
  submitted: 'bg-blue-100 text-blue-700',
  in_bearbeitung: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  draft: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-700',
  abgelehnt: 'bg-red-100 text-red-700',
}

export default function PortalApplications() {
  const { customer, customerId, isLoading } = usePortalCustomer()

  const { data: applications = [], isLoading: loadingApps } = useQuery({
    queryKey: ['portal-applications', customerId],
    queryFn: () => fetchPortalApplications(customerId),
    enabled: !!customerId,
    staleTime: 30_000,
  })

  if (isLoading || loadingApps) {
    return <div className="flex items-center justify-center h-40 text-muted-foreground">Laden...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Meine Anträge</h1>
      {applications.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Keine Anträge vorhanden
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map(app => {
            const statusKey = app.custom_status || app.status
            const premiumMonthly = app.estimated_premium_monthly
            const premiumYearly = app.estimated_premium_yearly || (premiumMonthly ? Math.round(premiumMonthly * 12) : null)
            return (
              <Card key={app.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-lg">{app.insurer || '–'}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[statusKey] || 'bg-muted text-muted-foreground'}`}>
                          {statusKey}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {getSparteLabel(app.sparte || app.insurance_type) || app.insurance_type}
                        {app.product && ` · ${app.product}`}
                      </p>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        {premiumMonthly && (
                          <div>
                            <p className="text-muted-foreground text-xs">Monatsprämie</p>
                            <p className="font-medium">CHF {premiumMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</p>
                          </div>
                        )}
                        {premiumYearly && (
                          <div>
                            <p className="text-muted-foreground text-xs">Jahresprämie</p>
                            <p className="font-medium">CHF {premiumYearly.toLocaleString('de-CH', { minimumFractionDigits: 0 })}</p>
                          </div>
                        )}
                        {app.contract_start_date && (
                          <div>
                            <p className="text-muted-foreground text-xs">Startdatum</p>
                            <p className="font-medium">{format(new Date(app.contract_start_date), 'dd.MM.yyyy')}</p>
                          </div>
                        )}
                      </div>

                      {(app.sparte_data?.franchise || app.sparte_data?.model) && (
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          {app.sparte_data.franchise && <span>Franchise: CHF {app.sparte_data.franchise}</span>}
                          {app.sparte_data.model && <span>Modell: {app.sparte_data.model}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}