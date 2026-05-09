import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Activity, User, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACTION_COLORS = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  archive: 'bg-amber-100 text-amber-700',
}

export default function AuditLogViewer() {
  const [filterAction, setFilterAction] = useState('all')
  const [filterEntity, setFilterEntity] = useState('all')
  const [searchUser, setSearchUser] = useState('')

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      try {
        return await base44.entities.AuditLog.list('-changed_at', 500);
      } catch {
        return [];
      }
    },
  })

  const filtered = auditLogs.filter(log => {
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterEntity !== 'all' && log.entity_type !== filterEntity) return false;
    if (searchUser && !log.changed_by.includes(searchUser)) return false;
    return true;
  });

  const entities = [...new Set(auditLogs.map(l => l.entity_type))];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Audit-Log
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger>
                <SelectValue placeholder="Aktion..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Aktionen</SelectItem>
                <SelectItem value="create">Erstellt</SelectItem>
                <SelectItem value="update">Aktualisiert</SelectItem>
                <SelectItem value="delete">Gelöscht</SelectItem>
                <SelectItem value="archive">Archiviert</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger>
                <SelectValue placeholder="Entity..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Entities</SelectItem>
                {entities.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Benutzer suchen..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
            />
          </div>

          {/* Log List */}
          {filtered.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground">
              Keine Audit-Einträge gefunden
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filtered.map((log, i) => (
                <div key={i} className="p-3 rounded border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn('text-xs', ACTION_COLORS[log.action] || 'bg-muted')}>
                          {log.action.toUpperCase()}
                        </Badge>
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          {log.entity_type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {log.entity_id}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{log.summary}</p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <div className="flex items-center gap-1 justify-end text-xs">
                        <User className="w-3 h-3" />
                        <span className="text-muted-foreground">{log.changed_by}</span>
                      </div>
                      <div className="flex items-center gap-1 justify-end text-xs">
                        <Calendar className="w-3 h-3" />
                        <span className="text-muted-foreground">
                          {new Date(log.changed_at).toLocaleString('de-CH')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Zeige {filtered.length} von {auditLogs.length} Einträgen
          </div>
        </CardContent>
      </Card>
    </div>
  )
}