import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'

export default function Documents() {
  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list('-created_date'),
  })

  const categoryLabels = {
    contract: 'Verträge',
    application: 'Anträge',
    identification: 'Ausweise',
    correspondence: 'Korrespondenz',
    other: 'Sonstiges',
  }

  const byCategory = {
    contract: documents.filter(d => d.category === 'contract'),
    application: documents.filter(d => d.category === 'application'),
    identification: documents.filter(d => d.category === 'identification'),
    correspondence: documents.filter(d => d.category === 'correspondence'),
    other: documents.filter(d => d.category === 'other'),
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dokumente</h1>
        <p className="text-muted-foreground mt-1">{documents.length} Dokumente insgesamt</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {Object.entries(byCategory).map(([cat, docs]) => (
          <Card key={cat}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{categoryLabels[cat]}</p>
                <p className="font-bold text-lg">{docs.length}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dokumente</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Dokumente vorhanden</p>
          ) : (
            <div className="space-y-2">
              {documents.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.customer_name}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{categoryLabels[d.category] || d.category}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}