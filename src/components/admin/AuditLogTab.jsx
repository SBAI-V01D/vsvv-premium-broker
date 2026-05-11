import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'

export default function AuditLogTab() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAction, setFilterAction] = useState('all')

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      const result = await base44.entities.AuditLog.list(null, 200);
      return result.sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))
    },
  })

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      (log.changed_by || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.summary || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesAction = filterAction === 'all' || log.action === filterAction
    return matchesSearch && matchesAction
  })

  const getActionColor = (action) => {
    switch(action) {
      case 'create': return 'bg-green-100 text-green-700'
      case 'update': return 'bg-blue-100 text-blue-700'
      case 'delete': return 'bg-red-100 text-red-700'
      case 'archive': return 'bg-yellow-100 text-yellow-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getActionLabel = (action) => {
    const labels = {
      'create': 'Erstellt',
      'update': 'Geändert',
      'delete': 'Gelöscht',
      'archive': 'Archiviert',
    }
    return labels[action] || action
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-4">Audit-Log</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Alle Änderungen an Zugriffsrechten, Benutzern und Zuweisungen werden hier protokolliert.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Aktionen</SelectItem>
            <SelectItem value="create">Erstellt</SelectItem>
            <SelectItem value="update">Geändert</SelectItem>
            <SelectItem value="delete">Gelöscht</SelectItem>
            <SelectItem value="archive">Archiviert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              Keine Audit-Einträge gefunden.
            </CardContent>
          </Card>
        ) : (
          filteredLogs.map((log, idx) => (
            <Card key={idx}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getActionColor(log.action)}>
                        {getActionLabel(log.action)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.changed_at).toLocaleDateString('de-CH')} {new Date(log.changed_at).toLocaleTimeString('de-CH')}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{log.summary || `${log.entity_type} ${log.entity_id}`}</p>
                    <p className="text-xs text-muted-foreground mt-1">durch {log.changed_by}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}