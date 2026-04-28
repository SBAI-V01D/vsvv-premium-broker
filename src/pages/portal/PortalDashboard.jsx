import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, FileCheck, AlertCircle } from 'lucide-react'

export default function PortalDashboard() {
  const { data: user } = useQuery({
    queryKey: ['portal-user'],
    queryFn: () => base44.auth.me(),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['portal-contracts', user?.email],
    queryFn: () => base44.entities.Contract.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['portal-applications', user?.email],
    queryFn: () => base44.entities.Application.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['portal-documents', user?.email],
    queryFn: () => base44.entities.Document.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
  })

  const activeContracts = contracts.filter(c => c.status === 'active')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Willkommen {user?.full_name}</h1>
        <p className="text-muted-foreground mt-1">Dein persönliches Kundenportal</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aktive Verträge</p>
              <p className="text-2xl font-bold">{activeContracts.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center">
              <FileCheck className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Anträge</p>
              <p className="text-2xl font-bold">{applications.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dokumente</p>
              <p className="text-2xl font-bold">{documents.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kontaktinformationen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Name:</span> {user?.full_name}</div>
          <div><span className="text-muted-foreground">E-Mail:</span> {user?.email}</div>
        </CardContent>
      </Card>
    </div>
  )
}