import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { AlertCircle, Info, AlertTriangle, Zap, CheckCircle2, Trash2, RefreshCw } from 'lucide-react'

const LEVEL_CONFIG = {
  info:     { label: 'Info',     icon: Info,         bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  warn:     { label: 'Warnung',  icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-700',  border: 'border-amber-200' },
  error:    { label: 'Fehler',   icon: AlertCircle,   bg: 'bg-red-50',   text: 'text-red-700',    border: 'border-red-200' },
  critical: { label: 'Kritisch', icon: Zap,           bg: 'bg-red-100',  text: 'text-red-900',    border: 'border-red-400' },
}

const STATUS_CONFIG = {
  pending:    { label: 'Ausstehend',  color: 'bg-amber-100 text-amber-700' },
  processing: { label: 'Verarbeitung', color: 'bg-blue-100 text-blue-700' },
  done:       { label: 'Erledigt',    color: 'bg-green-100 text-green-700' },
  failed:     { label: 'Fehlge­schlagen', color: 'bg-red-100 text-red-700' },
}

function LogRow({ log, onResolve }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info
  const Icon = cfg.icon

  return (
    <div className={`border rounded-lg mb-2 ${cfg.border} ${log.resolved ? 'opacity-50' : ''}`}>
      <div
        className={`flex items-start gap-3 p-3 cursor-pointer ${cfg.bg} rounded-lg`}
        onClick={() => setExpanded(e => !e)}
      >
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
            <span className="text-xs text-muted-foreground bg-white/70 px-2 py-0.5 rounded-full">{log.source}</span>
            {log.resolved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Behoben</span>}
          </div>
          <p className="text-sm font-medium mt-0.5 truncate">{log.message}</p>
          <p className="text-xs text-muted-foreground">{new Date(log.created_date).toLocaleString('de-CH')}</p>
        </div>
        {!log.resolved && (
          <Button
            size="sm" variant="outline"
            className="flex-shrink-0 h-7 text-xs"
            onClick={e => { e.stopPropagation(); onResolve(log.id) }}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" /> Beheben
          </Button>
        )}
      </div>
      {expanded && log.details && (
        <div className="p-3 border-t bg-white rounded-b-lg">
          <pre className="text-xs text-slate-600 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">{log.details}</pre>
        </div>
      )}
    </div>
  )
}

export default function SystemLogs() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [filterLevel, setFilterLevel] = useState('all')
  const [filterResolved, setFilterResolved] = useState('open')
  const [search, setSearch] = useState('')

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['systemLogs'],
    queryFn: () => base44.entities.SystemLog.list('-created_date', 200),
  })

  const { data: queue = [] } = useQuery({
    queryKey: ['automationQueue'],
    queryFn: () => base44.entities.AutomationQueue.list('-created_date', 100),
  })

  const resolveMutation = useMutation({
    mutationFn: id => base44.entities.SystemLog.update(id, { resolved: true }),
    onSuccess: () => qc.invalidateQueries(['systemLogs']),
  })

  const deleteResolvedMutation = useMutation({
    mutationFn: async () => {
      const resolved = logs.filter(l => l.resolved)
      await Promise.all(resolved.map(l => base44.entities.SystemLog.delete(l.id)))
    },
    onSuccess: () => qc.invalidateQueries(['systemLogs']),
  })

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="font-semibold">Kein Zugriff</p>
          <p className="text-sm text-muted-foreground">Nur Admins können System-Logs einsehen.</p>
        </div>
      </div>
    )
  }

  const filteredLogs = logs.filter(l => {
    if (filterLevel !== 'all' && l.level !== filterLevel) return false
    if (filterResolved === 'open' && l.resolved) return false
    if (filterResolved === 'resolved' && !l.resolved) return false
    if (search && !l.message?.toLowerCase().includes(search.toLowerCase()) && !l.source?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts = {
    error: logs.filter(l => (l.level === 'error' || l.level === 'critical') && !l.resolved).length,
    warn: logs.filter(l => l.level === 'warn' && !l.resolved).length,
    queueFailed: queue.filter(q => q.status === 'failed').length,
    queuePending: queue.filter(q => q.status === 'pending').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System-Logs</h1>
          <p className="text-muted-foreground mt-1">Fehler, Warnungen & Automation-Queue</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Aktualisieren
          </Button>
          {logs.some(l => l.resolved) && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteResolvedMutation.mutate()}>
              <Trash2 className="w-4 h-4 mr-2" /> Behobene löschen
            </Button>
          )}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Offene Fehler', value: counts.error, color: 'border-l-red-500 bg-red-50', textColor: 'text-red-700' },
          { label: 'Warnungen', value: counts.warn, color: 'border-l-amber-500 bg-amber-50', textColor: 'text-amber-700' },
          { label: 'Queue Fehlgeschl.', value: counts.queueFailed, color: 'border-l-red-400 bg-red-50', textColor: 'text-red-600' },
          { label: 'Queue Ausstehend', value: counts.queuePending, color: 'border-l-blue-500 bg-blue-50', textColor: 'text-blue-700' },
        ].map(k => (
          <Card key={k.label} className={`border-l-4 ${k.color}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
              <p className={`text-3xl font-extrabold ${k.textColor}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LOGS */}
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Input placeholder="Suche..." value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
                <Select value={filterLevel} onValueChange={setFilterLevel}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Level</SelectItem>
                    <SelectItem value="critical">Kritisch</SelectItem>
                    <SelectItem value="error">Fehler</SelectItem>
                    <SelectItem value="warn">Warnung</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterResolved} onValueChange={setFilterResolved}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="open">Offen</SelectItem>
                    <SelectItem value="resolved">Behoben</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground ml-auto">{filteredLogs.length} Einträge</span>
              </div>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Laden...</p>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Keine Einträge gefunden</p>
                </div>
              ) : filteredLogs.map(log => (
                <LogRow key={log.id} log={log} onResolve={id => resolveMutation.mutate(id)} />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* AUTOMATION QUEUE */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Automation Queue</CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {queue.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">Keine Jobs</p>
              ) : queue.slice(0, 50).map(job => {
                const sc = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending
                return (
                  <div key={job.id} className="px-4 py-3 border-b last:border-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-foreground">{job.job_type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.color}`}>{sc.label}</span>
                    </div>
                    {job.error_message && <p className="text-xs text-red-600 truncate">{job.error_message}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(job.created_date).toLocaleString('de-CH')}</p>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}