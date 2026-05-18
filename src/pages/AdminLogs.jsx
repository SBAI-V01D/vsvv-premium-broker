import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Search, Shield, AlertTriangle, CheckCircle, XCircle, Clock, 
  FileText, Activity, TrendingUp, Filter, Download 
} from 'lucide-react'
import { format } from 'date-fns'

const ACTION_COLORS = {
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  delete: 'bg-rose-50 text-rose-700 border-rose-200',
  automation: 'bg-purple-50 text-purple-700 border-purple-200',
  guard: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
}

const GUARD_RESULT_COLORS = {
  allowed: 'bg-emerald-100 text-emerald-800',
  blocked: 'bg-red-100 text-red-800',
  skipped: 'bg-amber-100 text-amber-800',
}

export default function AdminLogs() {
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterGuardResult, setFilterGuardResult] = useState('all')
  const [filterEntityType, setFilterEntityType] = useState('all')
  const [period, setPeriod] = useState('7d')

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['auditLogs', period],
    queryFn: () => base44.entities.AuditLog.list('-changed_at', 1000),
    staleTime: 5_000,
  })

  // Parse details JSON
  const parsedLogs = useMemo(() => {
    return auditLogs.map(log => {
      try {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {})
        return { ...log, details }
      } catch {
        return { ...log, details: {} }
      }
    })
  }, [auditLogs])

  // Filter
  const filteredLogs = useMemo(() => {
    return parsedLogs.filter(log => {
      const searchStr = `${log.summary} ${log.entity_type} ${log.entity_id} ${log.changed_by} ${log.details.source || ''}`.toLowerCase()
      const matchSearch = !search.trim() || searchStr.includes(search.toLowerCase())
      const matchAction = filterAction === 'all' || log.action === filterAction
      const matchGuardResult = filterGuardResult === 'all' || log.details.guard_result === filterGuardResult
      const matchEntityType = filterEntityType === 'all' || log.entity_type === filterEntityType
      
      // Period filter
      const logDate = new Date(log.changed_at)
      const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 365
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - daysAgo)
      const matchPeriod = logDate >= cutoff

      return matchSearch && matchAction && matchGuardResult && matchEntityType && matchPeriod
    })
  }, [parsedLogs, search, filterAction, filterGuardResult, filterEntityType, period])

  // KPIs
  const kpis = useMemo(() => {
    const total = filteredLogs.length
    const creates = filteredLogs.filter(l => l.action === 'create').length
    const updates = filteredLogs.filter(l => l.action === 'update').length
    const guardHits = filteredLogs.filter(l => l.details.guard_result).length
    const guardBlocked = filteredLogs.filter(l => l.details.guard_result === 'blocked').length
    const errors = filteredLogs.filter(l => l.action === 'error' || l.details.error_details).length
    const avgDuration = filteredLogs
      .filter(l => l.details.duration_ms)
      .reduce((s, l) => s + (l.details.duration_ms || 0), 0) / (filteredLogs.filter(l => l.details.duration_ms).length || 1)

    return { total, creates, updates, guardHits, guardBlocked, errors, avgDuration }
  }, [filteredLogs])

  // Guard-Stats
  const guardStats = useMemo(() => {
    const stats = {}
    filteredLogs.filter(l => l.details.guard_result).forEach(log => {
      const key = log.details.guard_reason || 'unknown'
      if (!stats[key]) {
        stats[key] = { reason: key, allowed: 0, blocked: 0, skipped: 0, total: 0 }
      }
      stats[key][log.details.guard_result]++
      stats[key].total++
    })
    return Object.values(stats).sort((a, b) => b.total - a.total)
  }, [filteredLogs])

  // Automation-Stats
  const automationStats = useMemo(() => {
    const stats = {}
    filteredLogs.filter(l => l.details.source).forEach(log => {
      const key = log.details.source
      if (!stats[key]) {
        stats[key] = { source: key, triggers: 0, creates: 0, updates: 0, guards: 0, errors: 0 }
      }
      stats[key].triggers++
      if (log.action === 'create') stats[key].creates++
      if (log.action === 'update') stats[key].updates++
      if (log.details.guard_result) stats[key].guards++
      if (log.action === 'error' || log.details.error_details) stats[key].errors++
    })
    return Object.values(stats).sort((a, b) => b.triggers - a.triggers)
  }, [filteredLogs])

  const exportCSV = () => {
    const headers = ['Datum', 'Aktion', 'Entität', 'ID', 'User', 'Summary', 'Source', 'Guard', 'Dauer (ms)']
    const rows = filteredLogs.map(log => [
      format(new Date(log.changed_at), 'dd.MM.yyyy HH:mm'),
      log.action,
      log.entity_type,
      log.entity_id,
      log.changed_by,
      log.summary,
      log.details.source || '',
      log.details.guard_result || '',
      log.details.duration_ms || '',
    ])
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Audit Trail & Guard-Monitoring
            {!isLoading && <span className="text-muted-foreground text-sm font-normal ml-2">· {filteredLogs.length} Einträge</span>}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Nachvollziehbarkeit · Guard-Hits · Automation-Triggers
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button onClick={exportCSV} variant="outline" size="sm">
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard label="Einträge" value={kpis.total} icon={FileText} color="text-slate-700" />
        <KpiCard label="Creates" value={kpis.creates} icon={CheckCircle} color="text-emerald-700" />
        <KpiCard label="Updates" value={kpis.updates} icon={Activity} color="text-blue-700" />
        <KpiCard label="Guard-Hits" value={kpis.guardHits} icon={Shield} color="text-amber-700" />
        <KpiCard label="Blocked" value={kpis.guardBlocked} icon={XCircle} color="text-red-700" />
        <KpiCard label="Errors" value={kpis.errors} icon={AlertTriangle} color="text-rose-700" />
        <KpiCard label="Ø Dauer" value={`${Math.round(kpis.avgDuration)}ms`} icon={Clock} color="text-purple-700" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche (Summary, Entity, User...)" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Aktion" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Aktionen</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="automation">Automation</SelectItem>
            <SelectItem value="guard">Guard</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterGuardResult} onValueChange={setFilterGuardResult}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Guard" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Guards</SelectItem>
            <SelectItem value="allowed">Allowed</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEntityType} onValueChange={setFilterEntityType}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Entität" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Entitäten</SelectItem>
            <SelectItem value="Application">Application</SelectItem>
            <SelectItem value="Contract">Contract</SelectItem>
            <SelectItem value="Customer">Customer</SelectItem>
            <SelectItem value="CommissionEntry">Commission</SelectItem>
            <SelectItem value="Task">Task</SelectItem>
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-28 h-9 text-sm"><SelectValue placeholder="Periode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">24h</SelectItem>
            <SelectItem value="7d">7 Tage</SelectItem>
            <SelectItem value="30d">30 Tage</SelectItem>
            <SelectItem value="90d">90 Tage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="logs">
        <TabsList className="flex-wrap h-auto gap-0.5">
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          <TabsTrigger value="guards">Guard-Stats</TabsTrigger>
          <TabsTrigger value="automations">Automationen</TabsTrigger>
        </TabsList>

        {/* Audit Logs */}
        <TabsContent value="logs" className="mt-4">
          <div className="rounded-xl border bg-card shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-3 px-4 font-semibold">Datum</th>
                  <th className="text-left py-3 px-4 font-semibold">Aktion</th>
                  <th className="text-left py-3 px-4 font-semibold hidden md:table-cell">Entität</th>
                  <th className="text-left py-3 px-4 font-semibold">Summary</th>
                  <th className="text-left py-3 px-4 font-semibold hidden lg:table-cell">User</th>
                  <th className="text-left py-3 px-4 font-semibold hidden lg:table-cell">Source</th>
                  <th className="text-left py-3 px-4 font-semibold">Guard</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-8 text-muted-foreground">Keine Logs gefunden</td></tr>
                ) : filteredLogs.map(log => (
                  <tr key={log.id} className="border-b hover:bg-muted/30">
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.changed_at), 'dd.MM.yyyy HH:mm')}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={ACTION_COLORS[log.action] || 'bg-slate-100'}>{log.action}</Badge>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className="text-xs font-mono">{log.entity_type}</span>
                      {log.entity_id && <span className="text-[10px] text-muted-foreground ml-1">{log.entity_id.slice(0, 8)}</span>}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-xs truncate max-w-xs">{log.summary}</p>
                      {log.details.trigger_reason && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{log.details.trigger_reason}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell text-xs">{log.changed_by}</td>
                    <td className="py-3 px-4 hidden lg:table-cell text-xs">
                      {log.details.source || '–'}
                    </td>
                    <td className="py-3 px-4">
                      {log.details.guard_result ? (
                        <Badge className={GUARD_RESULT_COLORS[log.details.guard_result] || 'bg-slate-100'}>
                          {log.details.guard_result}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">–</span>
                      )}
                      {log.details.guard_reason && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px]">
                          {log.details.guard_reason}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Guard Stats */}
        <TabsContent value="guards" className="mt-4 space-y-4">
          {guardStats.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Keine Guard-Hits gefunden</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {guardStats.map((stat, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                      <span>{stat.reason}</span>
                      <Badge>{stat.total} Hits</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 text-xs">
                      <Badge className="bg-emerald-100 text-emerald-800">Allowed: {stat.allowed}</Badge>
                      <Badge className="bg-red-100 text-red-800">Blocked: {stat.blocked}</Badge>
                      <Badge className="bg-amber-100 text-amber-800">Skipped: {stat.skipped}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Automation Stats */}
        <TabsContent value="automations" className="mt-4">
          <div className="rounded-xl border bg-card shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-3 px-4 font-semibold">Automation</th>
                  <th className="text-right py-3 px-4 font-semibold">Triggers</th>
                  <th className="text-right py-3 px-4 font-semibold">Creates</th>
                  <th className="text-right py-3 px-4 font-semibold">Updates</th>
                  <th className="text-right py-3 px-4 font-semibold">Guards</th>
                  <th className="text-right py-3 px-4 font-semibold">Errors</th>
                </tr>
              </thead>
              <tbody>
                {automationStats.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-8 text-muted-foreground">Keine Automation-Daten</td></tr>
                ) : automationStats.map((stat, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="py-3 px-4 font-mono text-xs">{stat.source}</td>
                    <td className="text-right py-3 px-4 font-semibold">{stat.triggers}</td>
                    <td className="text-right py-3 px-4 text-emerald-700">{stat.creates}</td>
                    <td className="text-right py-3 px-4 text-blue-700">{stat.updates}</td>
                    <td className="text-right py-3 px-4 text-amber-700">{stat.guards}</td>
                    <td className="text-right py-3 px-4 text-red-700">{stat.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, color }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2">
        {Icon && <Icon className={`w-4 h-4 ${color}`} />}
        <div>
          <p className="text-[10px] text-muted-foreground">{label}</p>
          <p className="text-sm font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}