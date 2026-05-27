/**
 * Dashboard — Broker Command Center
 * Operative Priorität: Leads · Renewals · Opportunities · Tasks · Risks
 * Finance: sekundär / einklappbar
 */
import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  ChevronDown, ChevronUp, ChevronRight,
  TrendingUp, Target, RefreshCw,
  AlertTriangle, Zap, BarChart2, Building2, User, Plus, Loader2
} from 'lucide-react'

import TodayDashboard from '@/components/dashboard/TodayDashboard'
import GlobalSearch from '@/components/layout/GlobalSearch'
import MoneyDashboard from '@/components/dashboard/MoneyDashboard'
import AiInsightsPanel from '@/components/intelligence/AiInsightsPanel'
import BirthdaySection from '@/components/customers/BirthdaySection'

function KpiTile({ label, value, sub, icon: Icon, colorClass, bgClass, borderClass, onClick, urgent }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-1 p-4 rounded-xl border transition-all text-left',
        'hover:shadow-card-md hover:scale-[1.015] active:scale-[0.99]',
        bgClass, borderClass
      )}
    >
      {urgent && (
        <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
      )}
      <div className="flex items-center gap-2 mb-0.5">
        <Icon className={cn('w-3.5 h-3.5 shrink-0', colorClass)} />
        <span className="text-label text-slate-500 truncate">{label}</span>
      </div>
      <p className={cn('text-[28px] font-bold leading-none tracking-tight', colorClass)}>{value}</p>
      {sub && <p className="text-caption text-slate-400 mt-0.5">{sub}</p>}
    </button>
  )
}

function FinanceSection({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-[hsl(var(--border-subtle))] overflow-hidden bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
      >
        <BarChart2 className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-[13px] font-semibold text-slate-600 flex-1 text-left">Finanzen &amp; Reporting</span>
        <span className="text-caption text-slate-400 mr-2">Provisionen · Courtagen · Pipeline</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-[hsl(var(--border-subtle))] p-4">
          {children}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [selectedTask, setSelectedTask] = useState(null)
  const [formData, setFormData] = useState({ title: '', status: '', notes: '', due_date: '' })
  const [quickTask, setQuickTask] = useState('')
  const queryClient = useQueryClient()

  const { data: tasks = [] } = useQuery({
    queryKey: ['dashboard_tasks'],
    queryFn: () => base44.entities.Task.filter({ status: ['open', 'in_progress'] }, '-due_date', 50),
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['dashboard_contracts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAllContractsForDashboard', {})
      return res.data?.data || res.data || []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: leads = [] } = useQuery({
    queryKey: ['dashboard_leads'],
    queryFn: async () => {
      const all = await base44.entities.Lead.list('-lead_score', 50)
      return all.filter(l => ['new', 'contacted', 'qualified'].includes(l.status))
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['dashboard_verkaufschancen'],
    queryFn: () => base44.entities.Verkaufschance.list('-created_date', 50),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: newCustomers = [] } = useQuery({
    queryKey: ['dashboard_new_customers'],
    queryFn: async () => {
      const all = await base44.entities.Customer.filter({ archived: false }, '-created_date', 20)
      const cutoff = new Date('2026-05-22')
      return all.filter(c => {
        const created = c.created_date ? new Date(c.created_date) : null
        return created && created >= cutoff
      }).slice(0, 3)
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: criticalIncidents = [] } = useQuery({
    queryKey: ['dashboard_critical_incidents'],
    queryFn: async () => {
      const all = await base44.entities.EnterpriseIncident.list('-detected_at', 50)
      return all.filter(i =>
        ['open', 'investigating', 'in_progress'].includes(i.status) &&
        ['critical', 'blocking'].includes(i.severity)
      )
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const today = new Date()
  const in30 = new Date(today); in30.setDate(today.getDate() + 30)
  const in360 = new Date(today); in360.setDate(today.getDate() + 360)

  const openTasks = tasks

  const expiredContracts = useMemo(() =>
    contracts.filter(c => {
      if (!c.end_date || c.end_date.startsWith('9999')) return false
      if (c.exclude_from_renewal_statistics) return false
      const d = new Date(c.end_date + 'T00:00:00')
      return d < today && !['cancelled', 'archived'].includes(c.status)
    }), [contracts])

  const expiringContracts = useMemo(() =>
    contracts.filter(c => {
      if (!c.end_date) return false
      const d = new Date(c.end_date + 'T00:00:00')
      return d <= in360 && !c.end_date.startsWith('9999')
    }), [contracts])

  const renewalIn30 = useMemo(() =>
    contracts.filter(c => {
      if (!c.end_date) return false
      const d = new Date(c.end_date + 'T00:00:00')
      return d <= in30 && d > today && !c.end_date.startsWith('9999')
    }), [contracts])

  const activeLeads = leads
  const hotLeads = useMemo(() =>
    leads.filter(l => l.status === 'qualified' || (l.lead_score || 0) >= 60),
    [leads])

  const openVerkaufschancen = useMemo(() =>
    verkaufschancen.filter(v => !['gewonnen', 'verloren'].includes(v.status)),
    [verkaufschancen])

  const urgentRenewal = renewalIn30.filter(c => {
    const d = Math.ceil((new Date(c.end_date) - today) / 86400000)
    return d <= 7
  }).length

  const createTaskMutation = useMutation({
    mutationFn: (title) => base44.entities.Task.create({ title, task_type: 'general', priority: 'medium', status: 'open' }),
    onSuccess: (newTask) => {
      queryClient.setQueryData(['dashboard_tasks'], (old = []) => [newTask, ...old]);
      queryClient.setQueryData(['tasks'], (old = []) => old ? [newTask, ...old] : undefined);
      setQuickTask('');
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.update(selectedTask.id, {
      status: data.status ?? selectedTask.status,
      notes: data.notes ?? selectedTask.notes,
      due_date: data.due_date ?? selectedTask.due_date,
    }),
    onSuccess: (updated) => {
      const updater = (old = []) => old.map(t => t.id === updated.id ? updated : t);
      queryClient.setQueryData(['dashboard_tasks'], (old = []) =>
        updated.status === 'completed'
          ? old.filter(t => t.id !== updated.id)
          : updater(old)
      );
      queryClient.setQueryData(['tasks'], (old) => old ? updater(old) : undefined);
      setSelectedTask(null);
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData(['dashboard_tasks'], (old = []) => old.filter(t => t.id !== id));
      queryClient.setQueryData(['tasks'], (old) => old ? old.filter(t => t.id !== id) : undefined);
      setSelectedTask(null);
    },
  })

  const handleTaskClick = (task) => {
    setSelectedTask(task)
    setFormData({ title: task.title || '', status: task.status, notes: task.notes || '', due_date: task.due_date || '' })
  }
  const handleTaskComplete = async (taskId) => {
    await base44.entities.Task.update(taskId, { status: 'completed', completion_date: new Date().toISOString().split('T')[0] })
    queryClient.setQueryData(['dashboard_tasks'], (old = []) => old.filter(t => t.id !== taskId));
    queryClient.setQueryData(['tasks'], (old) => old ? old.map(t => t.id === taskId ? { ...t, status: 'completed' } : t) : undefined);
  }

  return (
    <div className="page-enter flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[hsl(var(--primary))] tracking-tight">Cockpit</h1>
              <p className="text-xs text-muted-foreground">{openTasks.length} offene Aufgaben · {hotLeads.length} heiße Leads</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="w-64 hidden sm:block">
              <GlobalSearch collapsed={false} />
            </div>
            <button
              onClick={() => navigate('/kunden')}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex-shrink-0"
            >
              <Building2 className="w-3.5 h-3.5" /> Neuer Kunde
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Critical Incident Banner */}
        {criticalIncidents.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-rose-50 border border-rose-300 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse mt-1.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-rose-800">
                {criticalIncidents.length} kritische{criticalIncidents.length !== 1 ? ' Incidents' : 'r Incident'} offen
                {criticalIncidents.some(i => i.sla_status === 'breached') && (
                  <span className="ml-2 text-[10px] font-bold px-2 py-0.5 bg-rose-600 text-white rounded-full">
                    SLA ÜBERSCHRITTEN
                  </span>
                )}
              </p>
              <p className="text-xs text-rose-700 mt-0.5 truncate">
                {criticalIncidents[0]?.title}{criticalIncidents.length > 1 ? ` + ${criticalIncidents.length - 1} weitere` : ''}
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/admin/enterprise-control-center'}
              className="text-xs font-semibold text-rose-700 hover:text-rose-900 whitespace-nowrap underline"
            >
              Jetzt beheben →
            </button>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile
            label="Abgelaufen"
            value={expiredContracts.length}
            sub={expiredContracts.length > 0 ? 'sofort handeln' : 'keine'}
            icon={AlertTriangle}
            colorClass={expiredContracts.length > 0 ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--text-muted))]'}
            bgClass={expiredContracts.length > 0 ? 'bg-rose-50' : 'bg-[hsl(var(--surface-0))]'}
            borderClass={expiredContracts.length > 0 ? 'border-rose-200' : 'border-[hsl(var(--border-subtle))]'}
            urgent={expiredContracts.length > 0}
            onClick={() => navigate('/vertragsablaeufe')}
          />
          <KpiTile
            label="30d Renewal"
            value={renewalIn30.length}
            sub={urgentRenewal > 0 ? `${urgentRenewal} krit.` : 'demnächst'}
            icon={RefreshCw}
            colorClass={urgentRenewal > 0 ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--text-heading))]'}
            bgClass={urgentRenewal > 0 ? 'bg-[hsl(var(--destructive))/0.08]' : 'bg-[hsl(var(--surface-0))]'}
            borderClass="border-[hsl(var(--border-subtle))]"
            urgent={urgentRenewal > 0}
            onClick={() => navigate('/vertragsablaeufe')}
          />
          <KpiTile
            label="Hot Leads"
            value={hotLeads.length}
            sub={`${activeLeads.length} aktiv`}
            icon={Zap}
            colorClass="text-[hsl(var(--primary))]"
            bgClass="bg-[hsl(var(--primary))/0.08]"
            borderClass="border-[hsl(var(--border-subtle))]"
            onClick={() => navigate('/leads')}
          />
          <KpiTile
            label="Offerten"
            value={openVerkaufschancen.length}
            sub={`${openVerkaufschancen.filter(v => v.status === 'kunde_entscheidet').length} ready`}
            icon={Target}
            colorClass="text-[hsl(var(--info))]"
            bgClass="bg-[hsl(var(--info))/0.08]"
            borderClass="border-[hsl(var(--border-subtle))]"
            onClick={() => navigate('/verkaufschancen')}
          />
          <KpiTile
            label="Neu"
            value={activeLeads.filter(l => l.status === 'new').length}
            sub="unbearbeitet"
            icon={Target}
            colorClass="text-[hsl(var(--success))]"
            bgClass="bg-[hsl(var(--success))/0.08]"
            borderClass="border-[hsl(var(--border-subtle))]"
            onClick={() => navigate('/leads')}
          />
          <KpiTile
            label="Total"
            value={expiringContracts.length}
            sub="365d"
            icon={RefreshCw}
            colorClass="text-[hsl(var(--text-muted))]"
            bgClass="bg-[hsl(var(--surface-2))]"
            borderClass="border-[hsl(var(--border-subtle))]"
            onClick={() => navigate('/vertragsablaeufe')}
          />
        </div>

        {/* Quick Task Creation */}
        <div className="flex gap-2">
          <input
            type="text"
            value={quickTask}
            onChange={e => setQuickTask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && quickTask.trim()) createTaskMutation.mutate(quickTask.trim()) }}
            placeholder="Schnellaufgabe erstellen... (Enter)"
            className="flex-1 h-9 text-sm border border-border rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button
            size="sm"
            disabled={!quickTask.trim() || createTaskMutation.isPending}
            onClick={() => createTaskMutation.mutate(quickTask.trim())}
            className="h-9 gap-1.5"
          >
            {createTaskMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Aufgabe
          </Button>
        </div>

        {/* Operative Content */}
        <TodayDashboard
          openTasks={openTasks}
          expiringContracts={expiringContracts}
          contracts={contracts}
          activeLeads={activeLeads}
          verkaufschancen={openVerkaufschancen}
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onTaskComplete={handleTaskComplete}
        />

        {/* Neukunden Section */}
        {newCustomers.length > 0 && (
          <div className="bg-white rounded-xl border border-[hsl(var(--border-subtle))]/40 p-5 relative">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[hsl(var(--primary))]" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <Target className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[hsl(var(--primary))]">Neukunden</h2>
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Alle Kunden ab 22.05.2026</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/neukunden')}
                className="text-[11px] font-semibold text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]/80 inline-flex items-center gap-1"
              >
                Alle anzeigen <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid gap-3">
              {newCustomers.map(customer => (
                <button
                  key={customer.id}
                  onClick={() => navigate(`/kunden/${customer.id}/360`)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[hsl(var(--border-subtle))]/30 bg-[hsl(var(--surface-1))] hover:bg-[hsl(var(--surface-2))] hover:border-[hsl(var(--border-subtle))]/50 transition-all text-left group"
                >
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                    customer.customer_type === 'business'
                      ? 'bg-[hsl(var(--primary))/0.1] border border-[hsl(var(--primary))/0.2]'
                      : 'bg-blue-50 border border-blue-200'
                  )}>
                    {customer.customer_type === 'business' ? (
                      <Building2 className="w-4 h-4 text-[hsl(var(--primary))]" />
                    ) : (
                      <User className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[hsl(var(--text-heading))] truncate group-hover:text-[hsl(var(--primary))] transition-colors">
                      {customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()}
                    </p>
                    <p className="text-[10px] text-[hsl(var(--text-muted))]">
                      {customer.customer_type === 'business' ? 'Unternehmen' : 'Privatkunde'} · {new Date(customer.created_date).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    {customer.assigned_broker && (
                      <p className="text-[10px] text-[hsl(var(--text-muted))] truncate max-w-[120px]">{customer.assigned_broker}</p>
                    )}
                    <span className={cn(
                      'text-[9px] font-medium px-2 py-0.5 rounded-full',
                      ['valid'].includes(customer.mandate_status)
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    )}>
                      {customer.mandate_status || 'pending'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Geburtstage */}
        <BirthdaySection />

        {/* AI Intelligence Panel */}
        <AiInsightsPanel />

        {/* Finance & Reporting */}
        <FinanceSection>
          <MoneyDashboard />
        </FinanceSection>

        {/* Task Edit Dialog */}
        <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null) }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedTask?.title || 'Aufgabe'}</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <div className="space-y-4">
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Pendent</SelectItem>
                      <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                      <SelectItem value="completed">Erledigt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fälligkeitsdatum</Label>
                  <Input type="date" value={formData.due_date || ''} onChange={e => setFormData(p => ({ ...p, due_date: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Notizen</Label>
                  <Textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className="mt-1" rows={3} />
                </div>
              </div>
            )}
            <DialogFooter className="flex justify-between">
              {selectedTask?.id && (
                <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(selectedTask.id)}>
                  Löschen
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setSelectedTask(null)}>Abbrechen</Button>
                <Button onClick={() => { if (selectedTask?.id) updateMutation.mutate(formData) }} disabled={updateMutation.isPending}>Speichern</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}