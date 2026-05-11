import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, FileText } from 'lucide-react'

export default function DocumentAccessTab() {
  const [searchTerm, setSearchTerm] = useState('')

  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list(),
  })

  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.list(),
  })

  const accessLevelLabels = {
    'public_admin_only': 'Nur Admin',
    'assigned_advisors_only': 'Zugewiesene Berater',
    'team_visible': 'Team-sichtbar',
    'all_internal': 'Alle (Intern)',
  }

  const filteredDocs = documents.filter(d =>
    (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-4">Dokumentenzugriffe</h2>
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Dokument oder Kunde suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Alert>
        <AlertDescription className="text-xs">
          Dokumente erben standardmässig die Zugriffsrechte vom Kunden. Sie können hier eingesehen, aber nur durch direkte Dokumenten-Bearbeitung geändert werden.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {filteredDocs.map(doc => (
          <Card key={doc.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <FileText className="w-5 h-5 text-muted-foreground mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{doc.name}</p>
                  {doc.customer_name && (
                    <p className="text-xs text-muted-foreground mt-1">Kunde: {doc.customer_name}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline" className="text-xs">
                      {accessLevelLabels[doc.access_level] || doc.access_level}
                    </Badge>
                    
                    {doc.access_advisors?.length > 0 && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Berater: </span>
                        {doc.access_advisors.map(advisorId => {
                          const advisor = advisors.find(a => a.id === advisorId)
                          return advisor ? `${advisor.firstname} ${advisor.lastname}` : advisorId
                        }).join(', ')}
                      </div>
                    )}
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