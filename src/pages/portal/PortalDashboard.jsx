import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, FileCheck, AlertCircle, Mail, Phone, MapPin, Calendar } from 'lucide-react'
import { usePortalCustomer } from '@/hooks/usePortalCustomer'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Link } from 'react-router-dom'

export default function PortalDashboard() {
  const { customer, customerId, isLoading } = usePortalCustomer()

  const { data: contracts = [] } = useQuery({
    queryKey: ['portal-contracts', customerId],
    queryFn: () => base44.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId,
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['portal-applications', customerId],
    queryFn: () => base44.entities.Application.filter({ customer_id: customerId }),
    enabled: !!customerId,
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['portal-documents', customerId],
    queryFn: () => base44.entities.Document.filter({ customer_id: customerId })
      .then(docs => docs.filter(d => d.visible_in_portal !== false)),
    enabled: !!customerId,
  })

  if (isLoading) return <div className="flex items-center justify-center h-40 text-muted-foreground">Laden...</div>
  if (!customer) return null

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Guten Morgen'
    if (h < 18) return 'Guten Tag'
    return 'Guten Abend'
  }

  const activeContracts = contracts.filter(c => c.status === 'active')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{greeting()}, {customer.first_name} 👋</h1>
        <p className="text-muted-foreground mt-1">
          Heute ist der {format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/portal/vertraege">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Aktive Verträge</p>
                <p className="text-3xl font-bold">{activeContracts.length}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/portal/antraege">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-amber-400">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Anträge</p>
                <p className="text-3xl font-bold">{applications.length}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/portal/dokumente">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-emerald-400">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Dokumente</p>
                <p className="text-3xl font-bold">{documents.length}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Customer Info */}
      <Card>
        <CardHeader>
          <CardTitle>Meine Kontaktdaten</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {customer.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{customer.email}</span>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{customer.phone}</span>
            </div>
          )}
          {customer.mobile && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{customer.mobile} (Mobil)</span>
            </div>
          )}
          {customer.street && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{customer.street}, {customer.zip_code} {customer.city}</span>
            </div>
          )}
          {customer.birthdate && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{new Date(customer.birthdate).toLocaleDateString('de-CH')}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}