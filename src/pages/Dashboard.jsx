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
  ChevronRight, ChevronDown, ChevronUp,
  TrendingUp, Target, RefreshCw, CheckSquare,
  AlertTriangle, Zap, BarChart2, Building2
} from 'lucide-react'

import TodayDashboard from '@/components/dashboard/TodayDashboard'
import MoneyDashboard from '@/components/dashboard/MoneyDashboard'

// ── Operative KPI Tile ────────────────────────────────────────────────────────
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

// ── Collapsible Finance Section ───────────────────────────────────────────────
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

// ── Greeting ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend'
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [selectedTask, setSelectedTask] = useState(null)
  const [formData, setFormData] = useState({ title: '', status: '', notes: '', due_date: '' })
  const queryClient = useQueryClient()

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.filter({ status: ['open', 'in_progress'] }, '-due_date', 100)
  })
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAllContractsForDashboard', {})
      return res.data?.data || res.data || []
    }
  })
  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const all = await base44.entities.Lead.list('-lead_score', 100)
      return all.filter(l => ['new', 'contacted', 'qualified'].includes(l.status))
    }
  })
  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['verkaufschancen'],
    queryFn: () => base44.entities.Verkaufschance.list('-created_date', 100)
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

  const overdueCount = openTasks.filter(t => t.due_date && new Date(t.due_date) < today).length
  const urgentRenewal = renewalIn30.filter(c => {
    const d = Math.ceil((new Date(c.end_date) - today) / 86400000)
    return d <= 7
  }).length

  const urgentCount = overdueCount + urgentRenewal +
    openVerkaufschancen.filter(v => v.status === 'kunde_entscheidet').length

  // ── Task mutations ────────────────────────────────────────────────────────
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
    <div className="space-y-5 page-enter">

      {/* ── Command Center Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-label text-slate-400 mb-0.5">
            {new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-h1 font-bold tracking-tight">{getGreeting()}</h1>
          {urgentCount > 0 && (
            <p className="text-body-sm text-amber-700 font-semibold mt-1">
              {urgentCount} dringende Aktion{urgentCount > 1 ? 'en' : ''} ausstehend
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => navigate('/leads')}
            className="inline-flex items-center gap-1.5 text-body-sm font-medium px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" /> Neuer Lead
          </button>
          <button
            onClick={() => navigate('/verkaufschancen')}
            className="inline-flex items-center gap-1.5 text-body-sm font-medium px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-slate-50 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5" /> Opportunity
          </button>
          <button
            onClick={() => navigate('/kunden')}
            className="inline-flex items-center gap-1.5 text-body-sm font-medium px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-slate-50 transition-colors"
          >
            <Building2 className="w-3.5 h-3.5" /> Neuer Kunde
          </button>
        </div>
      </div>

      {/* ── Urgent Alert ──────────────────────────────────────────────────── */}
      {urgentCount > 0 && (
        <button
          onClick={() => document.getElementById('urgent-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-rose-50/80 border border-rose-200/70 hover:bg-rose-50 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
          <span className="text-body-sm font-semibold text-rose-800 flex-1 text-left">
            {urgentCount} dringende Aktion{urgentCount > 1 ? 'en' : ''} · sofort handeln
          </span>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <ChevronRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        </button>
      )}

      {/* ── Operative KPI Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile
          label="Renewal in 30d"
          value={renewalIn30.length}
          sub={urgentRenewal > 0 ? `${urgentRenewal} kritisch` : 'fällig bald'}
          icon={RefreshCw}
          colorClass="text-amber-700"
          bgClass="bg-amber-50/70"
          borderClass="border-amber-200/60"
          urgent={urgentRenewal > 0}
          onClick={() => navigate('/vertragsablaeufe')}
        />
        <KpiTile
          label="Hot Leads"
          value={hotLeads.length}
          sub={`${activeLeads.length} total aktiv`}
          icon={Zap}
          colorClass="text-violet-700"
          bgClass="bg-violet-50/60"
          borderClass="border-violet-200/50"
          onClick={() => navigate('/leads')}
        />
        <KpiTile
          label="Opportunities"
          value={openVerkaufschancen.length}
          sub={`${openVerkaufschancen.filter(v => v.status === 'kunde_entscheidet').length} entscheidungsreif`}
          icon={Target}
          colorClass="text-blue-700"
          bgClass="bg-blue-50/60"
          borderClass="border-blue-200/50"
          onClick={() => navigate('/verkaufschancen')}
        />
        <KpiTile
          label="Offene Tasks"
          value={openTasks.length}
          sub={overdueCount > 0 ? `${overdueCount} überfällig` : 'alles pünktlich'}
          icon={CheckSquare}
          colorClass={overdueCount > 0 ? 'text-rose-700' : 'text-slate-700'}
          bgClass={overdueCount > 0 ? 'bg-rose-50/60' : 'bg-slate-50/60'}
          borderClass={overdueCount > 0 ? 'border-rose-200/60' : 'border-slate-200/50'}
          urgent={overdueCount > 0}
          onClick={() => navigate('/aufgaben')}
        />
        <KpiTile
          label="Neue Leads"
          value={activeLeads.filter(l => l.status === 'new').length}
          sub="noch nicht kontaktiert"
          icon={Target}
          colorClass="text-emerald-700"
          bgClass="bg-emerald-50/60"
          borderClass="border-emerald-200/50"
          onClick={() => navigate('/leads')}
        />
        <KpiTile
          label="Vertragsabläufe"
          value={expiringContracts.length}
          sub="in 360 Tagen"
          icon={RefreshCw}
          colorClass="text-slate-700"
          bgClass="bg-slate-50/60"
          borderClass="border-slate-200/50"
          onClick={() => navigate('/vertragsablaeufe')}
        />
      </div>

      {/* ── Operative Content ─────────────────────────────────────────────── */}
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

      {/* ── Finance & Reporting (collapsible / sekundär) ──────────────────── */}
      <FinanceSection>
        <MoneyDashboard />
      </FinanceSection>

      {/* ── Task Edit Dialog ───────────────────────────────────────────────── */}
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