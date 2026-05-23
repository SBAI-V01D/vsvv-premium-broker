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
  AlertTriangle, Zap, BarChart2, Building2, User
} from 'lucide-react'

import TodayDashboard from '@/components/dashboard/TodayDashboard'
import MoneyDashboard from '@/components/dashboard/MoneyDashboard'
import AiInsightsPanel from '@/components/intelligence/AiInsightsPanel'
import BirthdaySection from '@/components/customers/BirthdaySection'

// Operative KPI Tile
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

// Collapsible Finance Section
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

// Main
export default function Dashboard() {
  const navigate = useNavigate()
  const [selectedTask, setSelectedTask] = useState(null)
  const [formData, setFormData] = useState({ title: '', status: '', notes: '', due_date: '' })
  const queryClient = useQueryClient()

  // Dashboard Query Optimization — Cached Operational Snapshots
  const { data: tasks = [] } = useQuery({
    queryKey: ['dashboard_tasks'],
    queryFn: () => base44.entities.Task.filter({ status: ['open', 'in_progress'] }, '-due_date', 50), // Limit 50
    staleTime: 3 * 60 * 1000, // 3 Minuten cache
    refetchOnWindowFocus: false,
  })
  
  const { data: contracts = [] } = useQuery({
    queryKey: ['dashboard_contracts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAllContractsForDashboard', {})
      return res.data?.data || res.data || []
    },
    staleTime: 5 * 60 * 1000, // 5 Minuten cache
    refetchOnWindowFocus: false,
  })
  
  const { data: leads = [] } = useQuery({
    queryKey: ['dashboard_leads'],
    queryFn: async () => {
      const all = await base44.entities.Lead.list('-lead_score', 50) // Limit 50
      return all.filter(l => ['new', 'contacted', 'qualified'].includes(l.status))
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  
  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['dashboard_verkaufschancen'],
    queryFn: () => base44.entities.Verkaufschance.list('-created_date', 50), // Limit 50
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Neukunden ab 22.05.2026 — Optimized Query
  const { data: newCustomers = [] } = useQuery({
    queryKey: ['dashboard_new_customers'],
    queryFn: async () => {
      const all = await base44.entities.Customer.filter({ archived: false }, '-created_date', 20) // Limit 20
      const cutoff = new Date('2026-05-22')
      return all.filter(c => {
        const created = c.created_date ? new Date(c.created_date) : null
        return created && created >= cutoff
      }).slice(0, 3)
    },
    staleTime: 10 * 60 * 1000, // 10 Minuten cache
    refetchOnWindowFocus: false,
  })

  const today = new Date()
  const in30 = new Date(today); in30.setDate(today.getDate() + 30)
  const in360 = new Date(today); in360.setDate(today.getDate() + 360)

  const openTasks = tasks

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

  // Task mutations
  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.update(selectedTask.id, {
      status: data.status ?? selectedTask.status,
      notes: data.notes ?? selectedTask.notes,
      due_date: data.due_date ?? selectedTask.due_date,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); setSelectedTask(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); setSelectedTask(null) },
  })

  const handleTaskClick = (task) => {
    setSelectedTask(task)
    setFormData({ title: task.title || '', status: task.status, notes: task.notes || '', due_date: task.due_date || '' })
  }
  const handleTaskComplete = async (taskId) => {
    await base44.entities.Task.update(taskId, { status: 'completed', completion_date: new Date().toISOString().split('T')[0] })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  return (
    <div className="space-y-6 page-enter">

      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-h2 font-bold text-[hsl(var(--primary))] tracking-tight">Cockpit</h1>
          <p className="text-body-sm text-[hsl(var(--text-muted))] mt-0.5">
            {openTasks.length} offene Aufgaben · {hotLeads.length} heiße Leads
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => navigate('/kunden')}
            className="inline-flex items-center gap-1.5 text-body-sm font-medium px-3 py-1.5 rounded-md bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))/0.9] transition-colors"
          >
            <Building2 className="w-3.5 h-3.5" /> Neu
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
          {/* Optische Trennung: Blauer Strich */}
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
                onClick={() => navigate(`/kunden/${customer.id}`)}
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
                    <p className="text-[10px] text-[hsl(var(--text-muted))] truncate max-w-[120px]">
                      {customer.assigned_broker}
                    </p>
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
              <Button variant="destructive" size="sm" onClick={() => { if (confirm('Aufgabe löschen?')) deleteMutation.mutate(selectedTask.id) }}>
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
  )
}