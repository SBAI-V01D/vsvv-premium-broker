import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { History, Search, Download } from 'lucide-react'

function formatDateTime(dateStr) {
  if (!dateStr) return '–'
  return new Date(dateStr).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })
}

const PAGE_SIZE = 25

export default function AuditLogDialog({ open, onClose, auditLogs }) {
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterUser, setFilterUser] = useState('all')
  const [page, setPage] = useState(1)

  const uniqueUsers = useMemo(() =>
    [...new Set(auditLogs.map(l => l.changed_by).filter(Boolean))],
    [auditLogs])

  const filtered = useMemo(() => {
    return auditLogs.filter(log => {
      const matchSearch = !search.trim() || (log.summary || '').toLowerCase().includes(search.toLowerCase()) || (log.changed_by || '').toLowerCase().includes(search.toLowerCase())
      const matchAction = filterAction === 'all' || log.action === filterAction
      const matchUser = filterUser === 'all' || log.changed_by === filterUser
      return matchSearch && matchAction && matchUser
    })
  }, [auditLogs, search, filterAction, filterUser])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleExport = () => {
    const headers = ['Zeitstempel', 'Benutzer', 'Aktion', 'Beschreibung']
    const rows = filtered.map(l => [formatDateTime(l.changed_at), l.changed_by || '', l.action || '', l.summary || ''])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'audit_log_provisionen.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const actionColors = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
    archive: 'bg-amber-100 text-amber-700',
    restore: 'bg-purple-100 text-purple-700',
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Audit Log – Provisionen
            <span className="text-sm font-normal text-muted-foreground ml-1">({auditLogs.length} Einträge total)</span>
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 border-b pb-3">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Beschreibung, Benutzer..." className="pl-8 h-8 text-sm" />
          </div>
          <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(1) }}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Alle Aktionen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Aktionen</SelectItem>
              <SelectItem value="create">Erstellt</SelectItem>
              <SelectItem value="update">Bearbeitet</SelectItem>
              <SelectItem value="archive">Archiviert</SelectItem>
              <SelectItem value="delete">Gelöscht</SelectItem>
            </SelectContent>
          </Select>
          {uniqueUsers.length > 1 && (
            <Select value={filterUser} onValueChange={v => { setFilterUser(v); setPage(1) }}>
              <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="Alle Benutzer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Benutzer</SelectItem>
                {uniqueUsers.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" className="h-8" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1 -mx-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b bg-muted/40">
                <th className="text-left py-2 px-3 font-semibold whitespace-nowrap">Zeitstempel</th>
                <th className="text-left py-2 px-3 font-semibold">Benutzer</th>
                <th className="text-left py-2 px-3 font-semibold">Aktion</th>
                <th className="text-left py-2 px-3 font-semibold">Beschreibung</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-8 text-muted-foreground">Keine Einträge gefunden</td></tr>
              ) : paginated.map(log => (
                <tr key={log.id} className="border-b hover:bg-muted/20">
                  <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">{formatDateTime(log.changed_at)}</td>
                  <td className="py-2 px-3 truncate max-w-[120px]">{log.changed_by || '–'}</td>
                  <td className="py-2 px-3">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${actionColors[log.action] || 'bg-gray-100 text-gray-700'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{log.summary || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t text-sm">
            <span className="text-muted-foreground text-xs">{filtered.length} Einträge · Seite {page} von {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                return (
                  <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm"
                    className="w-8" onClick={() => setPage(p)}>{p}</Button>
                )
              })}
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <p className="text-xs text-muted-foreground flex-1">Alle Einträge sind unveränderbar protokolliert.</p>
          <Button variant="outline" onClick={onClose}>Schliessen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}