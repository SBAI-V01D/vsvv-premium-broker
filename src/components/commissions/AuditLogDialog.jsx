import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { History, Search, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDateTime, downloadCSV } from '@/lib/commissionEngine'

const PAGE_SIZE = 25

const ACTION_COLORS = {
  create:  'bg-green-100 text-green-700',
  update:  'bg-blue-100 text-blue-700',
  delete:  'bg-red-100 text-red-700',
  archive: 'bg-amber-100 text-amber-700',
  restore: 'bg-purple-100 text-purple-700',
}

function DiffRow({ label, oldVal, newVal }) {
  if (oldVal === newVal || (oldVal === undefined && newVal === undefined)) return null
  return (
    <tr className="text-xs border-b">
      <td className="py-1 pr-2 text-muted-foreground font-medium whitespace-nowrap">{label}</td>
      <td className="py-1 pr-2 text-red-600 line-through truncate max-w-[100px]">{String(oldVal ?? '–')}</td>
      <td className="py-1 text-green-700 font-medium truncate max-w-[100px]">{String(newVal ?? '–')}</td>
    </tr>
  )
}

function AuditDiffPanel({ log }) {
  const old_ = log.old_values || {}
  const new_ = log.new_values || {}
  const keys = [...new Set([...Object.keys(old_), ...Object.keys(new_)])]
    .filter(k => old_[k] !== new_[k])
    .slice(0, 10)

  if (keys.length === 0) return null

  const LABELS = {
    status: 'Status', commission_amount: 'Provision (CHF)', received_amount: 'Courtage erhalten',
    commission_percentage: 'Berateranteil %', premium_yearly: 'Jahresprämie', insurer: 'Gesellschaft',
    advisor_name: 'Berater', customer_name: 'Kunde', entry_date: 'Datum', archived: 'Archiviert',
  }

  return (
    <div className="mt-1.5 ml-4 pl-3 border-l-2 border-muted">
      <table className="w-full">
        <thead><tr className="text-xs text-muted-foreground">
          <th className="text-left pb-1 pr-2">Feld</th>
          <th className="text-left pb-1 pr-2">Vorher</th>
          <th className="text-left pb-1">Nachher</th>
        </tr></thead>
        <tbody>
          {keys.map(k => <DiffRow key={k} label={LABELS[k] || k} oldVal={old_[k]} newVal={new_[k]} />)}
        </tbody>
      </table>
    </div>
  )
}

function AuditLogRow({ log }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = Object.keys(log.old_values || {}).length > 0 || Object.keys(log.new_values || {}).length > 0

  return (
    <>
      <tr className="border-b hover:bg-muted/20">
        <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">{formatDateTime(log.changed_at)}</td>
        <td className="py-2 px-3 truncate max-w-[100px]">{log.changed_by || '–'}</td>
        <td className="py-2 px-3">
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
            {log.action}
          </span>
        </td>
        <td className="py-2 px-3 text-muted-foreground max-w-xs truncate">{log.summary || '–'}</td>
        <td className="py-2 px-2 w-8">
          {hasDetails && (
            <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </td>
      </tr>
      {expanded && hasDetails && (
        <tr className="bg-muted/10">
          <td colSpan="5" className="px-3 pb-2">
            <AuditDiffPanel log={log} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function AuditLogDialog({ open, onClose, auditLogs }) {
  const [search, setSearch]           = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterUser, setFilterUser]   = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo]     = useState('')
  const [page, setPage]               = useState(1)

  const uniqueUsers = useMemo(() =>
    [...new Set(auditLogs.map(l => l.changed_by).filter(Boolean))],
    [auditLogs])

  const filtered = useMemo(() => {
    return auditLogs.filter(log => {
      const matchSearch = !search.trim() ||
        (log.summary    || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.changed_by || '').toLowerCase().includes(search.toLowerCase())
      const matchAction = filterAction === 'all' || log.action === filterAction
      const matchUser   = filterUser   === 'all' || log.changed_by === filterUser
      const logDate     = log.changed_at ? new Date(log.changed_at) : null
      const matchFrom   = !filterDateFrom || (logDate && logDate >= new Date(filterDateFrom))
      const matchTo     = !filterDateTo   || (logDate && logDate <= new Date(filterDateTo + 'T23:59:59'))
      return matchSearch && matchAction && matchUser && matchFrom && matchTo
    })
  }, [auditLogs, search, filterAction, filterUser, filterDateFrom, filterDateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleExport = () => {
    const headers = ['Zeitstempel', 'Benutzer', 'Aktion', 'Beschreibung']
    const rows    = filtered.map(l => [formatDateTime(l.changed_at), l.changed_by || '', l.action || '', l.summary || ''])
    const csv     = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    downloadCSV(csv, 'audit_log_courtagen_provisionen.csv')
  }

  const resetFilters = () => {
    setSearch(''); setFilterAction('all'); setFilterUser('all')
    setFilterDateFrom(''); setFilterDateTo(''); setPage(1)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Audit Log – Courtagen & Provisionen
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
          <Input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(1) }}
            className="w-36 h-8 text-sm" title="Von Datum" />
          <Input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(1) }}
            className="w-36 h-8 text-sm" title="Bis Datum" />
          <Button variant="outline" size="sm" className="h-8" onClick={resetFilters}>
            Reset
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1 -mx-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b bg-muted/40">
                <th className="text-left py-2 px-3 font-semibold whitespace-nowrap">Zeitstempel</th>
                <th className="text-left py-2 px-3 font-semibold">Benutzer</th>
                <th className="text-left py-2 px-3 font-semibold">Aktion</th>
                <th className="text-left py-2 px-3 font-semibold">Beschreibung</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-8 text-muted-foreground">Keine Einträge gefunden</td></tr>
              ) : paginated.map(log => <AuditLogRow key={log.id} log={log} />)}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t text-sm">
            <span className="text-muted-foreground text-xs">{filtered.length} Einträge · Seite {page} von {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(1)}>«</Button>
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                return (
                  <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm"
                    className="w-8" onClick={() => setPage(p)}>{p}</Button>
                )
              })}
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <p className="text-xs text-muted-foreground flex-1">
            Alle Einträge sind unveränderbar protokolliert. Klick auf › für Feldvergleich (alt/neu).
          </p>
          <Button variant="outline" onClick={onClose}>Schliessen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}