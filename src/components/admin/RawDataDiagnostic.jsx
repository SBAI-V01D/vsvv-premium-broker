import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

/**
 * ADMIN DIAGNOSTIC TOOL
 * Tests raw entity queries to verify database state.
 * Used during recovery to isolate visibility issues.
 */
export default function RawDataDiagnostic({ showOnly = false }) {
  const [refreshKey, setRefreshKey] = useState(0)

  // Raw entity counts
  const { data: customerCount = 0 } = useQuery({
    queryKey: ['raw-customers-count', refreshKey],
    queryFn: async () => {
      const all = await base44.entities.Customer.list('', 1000)
      return all?.length || 0
    },
  })

  const { data: contractCount = 0 } = useQuery({
    queryKey: ['raw-contracts-count', refreshKey],
    queryFn: async () => {
      const all = await base44.entities.Contract.list('', 1000)
      return all?.length || 0
    },
  })

  const { data: applicationCount = 0 } = useQuery({
    queryKey: ['raw-applications-count', refreshKey],
    queryFn: async () => {
      const all = await base44.entities.Application.list('', 1000)
      return all?.length || 0
    },
  })

  const { data: documentCount = 0 } = useQuery({
    queryKey: ['raw-documents-count', refreshKey],
    queryFn: async () => {
      const all = await base44.entities.Document.list('', 1000)
      return all?.length || 0
    },
  })

  // Check for missing organization_id
  const { data: customersWithoutOrg = 0 } = useQuery({
    queryKey: ['customers-no-org', refreshKey],
    queryFn: async () => {
      const all = await base44.entities.Customer.list('', 1000)
      return all?.filter(c => !c.organization_id)?.length || 0
    },
  })

  // Check archived customers
  const { data: archivedCount = 0 } = useQuery({
    queryKey: ['archived-customers', refreshKey],
    queryFn: async () => {
      const all = await base44.entities.Customer.list('', 1000)
      return all?.filter(c => c.archived)?.length || 0
    },
  })

  const handleRefresh = () => setRefreshKey(k => k + 1)

  if (showOnly) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 bg-slate-50 rounded border border-slate-200">
            <p className="text-xs text-muted-foreground">Kunden</p>
            <p className="text-lg font-bold">{customerCount}</p>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-200">
            <p className="text-xs text-muted-foreground">Verträge</p>
            <p className="text-lg font-bold">{contractCount}</p>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-200">
            <p className="text-xs text-muted-foreground">Anträge</p>
            <p className="text-lg font-bold">{applicationCount}</p>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-200">
            <p className="text-xs text-muted-foreground">Dokumente</p>
            <p className="text-lg font-bold">{documentCount}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="border-2 border-amber-300 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <AlertCircle className="w-5 h-5" />
          Rohdaten-Diagnose (Nur Admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white rounded border border-amber-200">
            <p className="text-xs text-muted-foreground">Kunden gesamt</p>
            <p className="text-2xl font-bold text-amber-900">{customerCount}</p>
          </div>
          <div className="p-3 bg-white rounded border border-amber-200">
            <p className="text-xs text-muted-foreground">Verträge gesamt</p>
            <p className="text-2xl font-bold text-amber-900">{contractCount}</p>
          </div>
          <div className="p-3 bg-white rounded border border-amber-200">
            <p className="text-xs text-muted-foreground">Anträge gesamt</p>
            <p className="text-2xl font-bold text-amber-900">{applicationCount}</p>
          </div>
          <div className="p-3 bg-white rounded border border-amber-200">
            <p className="text-xs text-muted-foreground">Dokumente gesamt</p>
            <p className="text-2xl font-bold text-amber-900">{documentCount}</p>
          </div>
        </div>

        <div className="p-3 bg-red-50 border border-red-300 rounded">
          <p className="text-xs font-semibold text-red-900">⚠️ Datenqualitätsprobleme</p>
          <ul className="text-xs text-red-700 mt-2 space-y-1">
            <li>• {customersWithoutOrg} Kunden ohne organization_id</li>
            <li>• {archivedCount} archivierte Kunden</li>
          </ul>
        </div>

        <Button variant="outline" size="sm" onClick={handleRefresh} className="w-full">
          <RefreshCw className="w-3 h-3 mr-2" /> Aktualisieren
        </Button>
      </CardContent>
    </Card>
  )
}