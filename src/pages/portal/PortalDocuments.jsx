import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PortalDocuments() {
  const { data: user } = useQuery({
    queryKey: ['portal-user'],
    queryFn: () => base44.auth.me(),
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['portal-documents', user?.id],
    queryFn: () => base44.entities.Document.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
  })

  if (documents.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Meine Dokumente</h1>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Keine Dokumente vorhanden
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Meine Dokumente</h1>
      <div className="space-y-3">
        {documents.map(doc => (
          <Card key={doc.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{doc.name}</p>
                  <Badge variant="outline" className="text-xs mt-1 capitalize">{doc.category}</Badge>
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
    </div>
  )
}