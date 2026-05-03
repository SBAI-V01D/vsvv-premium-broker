import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePortalCustomer } from '@/hooks/usePortalCustomer'

const CATEGORY_LABELS = {
  police: 'Police',
  rechnung: 'Rechnung',
  schadenfall: 'Schadenfall',
  vertrag: 'Vertrag',
  schaden: 'Schaden',
  ausweis: 'Ausweis',
  korrespondenz: 'Korrespondenz',
  contract: 'Vertrag',
  application: 'Antrag',
  identification: 'Ausweis',
  correspondence: 'Korrespondenz',
  other: 'Sonstiges',
  sonstiges: 'Sonstiges',
}

const CATEGORY_COLORS = {
  police: 'bg-blue-50 text-blue-700',
  rechnung: 'bg-green-50 text-green-700',
  schadenfall: 'bg-red-50 text-red-700',
  vertrag: 'bg-indigo-50 text-indigo-700',
  contract: 'bg-indigo-50 text-indigo-700',
  ausweis: 'bg-purple-50 text-purple-700',
  identification: 'bg-purple-50 text-purple-700',
  korrespondenz: 'bg-amber-50 text-amber-700',
  correspondence: 'bg-amber-50 text-amber-700',
  sonstiges: 'bg-slate-100 text-slate-600',
  other: 'bg-slate-100 text-slate-600',
}

export default function PortalDocuments() {
  const { customer, customerId, isLoading } = usePortalCustomer()

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['portal-documents', customerId],
    queryFn: () => base44.entities.Document.filter({ customer_id: customerId })
      .then(docs => docs.filter(d => d.visible_in_portal !== false)),
    enabled: !!customerId,
  })

  if (isLoading || loadingDocs) {
    return <div className="flex items-center justify-center h-40 text-muted-foreground">Laden...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Meine Dokumente</h1>
      {documents.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Keine Dokumente vorhanden
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => (
            <Card key={doc.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{doc.name}</p>
                    <div className="flex flex-wrap gap-2 mt-1 items-center">
                      {doc.category && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[doc.category] || 'bg-muted text-muted-foreground'}`}>
                          {CATEGORY_LABELS[doc.category] || doc.category}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {doc.created_date ? new Date(doc.created_date).toLocaleDateString('de-CH') : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                    <ExternalLink className="w-4 h-4" /> Öffnen
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}