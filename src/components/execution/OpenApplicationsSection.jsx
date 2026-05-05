import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText } from 'lucide-react'

export default function OpenApplicationsSection({ applications }) {
  const openApps = useMemo(() => {
    return applications
      .filter(a => a.status === 'submitted' || a.status === 'under_review')
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, 10)
  }, [applications])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-4 h-4" /> 📄 OFFENE ANTRÄGE
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {openApps.length === 0 ? (
          <p className="text-sm text-green-600">✓ Keine offenen Anträge</p>
        ) : (
          openApps.map(app => (
            <div key={app.id} className="p-2 rounded bg-blue-50 border border-blue-200">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-sm">{app.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{app.product || 'Product'}</p>
                </div>
                <Badge className="bg-blue-100 text-blue-700 ml-2">{app.status}</Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}