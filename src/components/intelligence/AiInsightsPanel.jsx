/**
 * AI Intelligence Panel v1
 * Read-only, advisory, explainable. No auto-actions.
 * "AI is advisory, not authoritative."
 */
import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { Brain, ChevronRight, AlertTriangle, RefreshCw, Users, TrendingUp, CheckSquare, X, ChevronDown, ChevronUp, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// ── Severity config ────────────────────────────────────────────────────────
const SEVERITY = {
  critical: { label: 'Kritisch', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' },
  warning:  { label: 'Warnung',  color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  info:     { label: 'Hinweis',  color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-200',  dot: 'bg-blue-400' },
}

// ── Task creation dialog ───────────────────────────────────────────────────
function CreateTaskDialog({ insight, open, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(null)

  // Initialize form when dialog opens
  React.useEffect(() => {
    if (open && insight?.taskSuggestion) {
      setForm({ ...insight.taskSuggestion })
    }
  }, [open, insight])

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['ai_tasks'] })
      onSuccess()
      onClose()
    },
  })

  if (!form) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Plus className="w-4 h-4 text-violet-500" />
            Aufgabe aus Insight erstellen
          </DialogTitle>
          <p className="text-[11px] text-slate-400 mt-1">Vorausgefüllt durch KI-Insight — bitte prüfen und bestätigen.</p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Insight context */}
          <div className="px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-snug">
            <span className="font-semibold text-slate-700">Insight:</span> {insight.title}
          </div>

          <div>
            <Label className="text-[12px]">Aufgabentitel</Label>
            <Input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="mt-1 text-[13px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[12px]">Priorität</Label>
              <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                <SelectTrigger className="mt-1 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Dringend</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="low">Niedrig</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px]">Fällig bis</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                className="mt-1 text-[13px]"
              />
            </div>
          </div>

          <div>
            <Label className="text-[12px]">Typ</Label>
            <Select value={form.task_type} onValueChange={v => setForm(p => ({ ...p, task_type: v }))}>
              <SelectTrigger className="mt-1 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="renewal">Renewal</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="consultation">Beratung</SelectItem>
                <SelectItem value="onboarding">Onboarding</SelectItem>
                <SelectItem value="general">Allgemein</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.notes && (
            <div className="text-[11px] text-slate-500 bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
              <span className="font-semibold text-blue-700">Empfehlung:</span> {form.notes}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Abbrechen</Button>
          <Button
            size="sm"
            onClick={() => createMutation.mutate(form)}
            disabled={createMutation.isPending || !form.title}
            className="gap-1.5"
          >
            {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Aufgabe erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Single insight card ────────────────────────────────────────────────────
function InsightCard({ insight, onDismiss, onCreateTask }) {
  const navigate = useNavigate()
  const sev = SEVERITY[insight.severity] || SEVERITY.info

  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-lg border', sev.bg, sev.border)}>
      <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', sev.dot)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-[12px] font-semibold leading-snug', sev.color)}>{insight.title}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{insight.reason}</p>
        {insight.recommendation && (
          <p className="text-[11px] text-slate-600 mt-1 italic">{insight.recommendation}</p>
        )}
        <p className="text-[10px] text-slate-400 mt-1">Datenbasis: {insight.dataBasis}</p>

        {/* Action row */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {insight.link && (
            <button
              onClick={() => navigate(insight.link)}
              className={cn('inline-flex items-center gap-1 text-[11px] font-medium', sev.color, 'hover:underline')}
            >
              {insight.linkLabel || 'Öffnen'} <ChevronRight className="w-3 h-3" />
            </button>
          )}
          {insight.taskSuggestion && (
            <button
              onClick={() => onCreateTask(insight)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700 hover:underline border border-violet-200 bg-white/70 rounded px-2 py-0.5 transition-colors"
            >
              <Plus className="w-3 h-3" />
              {insight.taskSuggestion.buttonLabel || 'Aufgabe erstellen'}
            </button>
          )}
        </div>
      </div>
      <button
        onClick={() => onDismiss(insight.id)}
        className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors mt-0.5"
        title="Ausblenden"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Category header ────────────────────────────────────────────────────────
function CategorySection({ icon: Icon, label, color, insights, dismissed, onDismiss, onCreateTask }) {
  const visible = insights.filter(i => !dismissed.has(i.id))
  if (!visible.length) return null
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={cn('w-3.5 h-3.5', color)} />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{visible.length}</span>
      </div>
      <div className="space-y-2">
        {visible.map(i => (
          <InsightCard key={i.id} insight={i} onDismiss={onDismiss} onCreateTask={onCreateTask} />
        ))}
      </div>
    </div>
  )
}

// ── Suggested due date helper ──────────────────────────────────────────────
function daysFromNow(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AiInsightsPanel() {
  const [dismissed, setDismissed] = useState(new Set())
  const [collapsed, setCollapsed] = useState(false)
  const [taskInsight, setTaskInsight] = useState(null)
  const [taskCreated, setTaskCreated] = useState(false)

  const { data: customers = [] } = useQuery({
    queryKey: ['ai_customers'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, '-updated_date', 300),
    staleTime: 5 * 60 * 1000,
  })
  const { data: contracts = [] } = useQuery({
    queryKey: ['ai_contracts'],
    queryFn: () => base44.entities.Contract.filter({ archived: false }, '-end_date', 300),
    staleTime: 5 * 60 * 1000,
  })
  const { data: tasks = [] } = useQuery({
    queryKey: ['ai_tasks'],
    queryFn: () => base44.entities.Task.filter({ status: ['open', 'in_progress'] }, '-due_date', 200),
    staleTime: 5 * 60 * 1000,
  })
  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['ai_verkaufschancen'],
    queryFn: () => base44.entities.Verkaufschance.list('-updated_date', 100),
    staleTime: 5 * 60 * 1000,
  })

  const today = new Date()

  const insights = useMemo(() => {
    const list = []
    const primaryCustomers = customers.filter(c => !c.is_family_member)

    // ── 1. RENEWAL ───────────────────────────────────────────────────────
    const in14 = new Date(today); in14.setDate(today.getDate() + 14)
    const in30 = new Date(today); in30.setDate(today.getDate() + 30)
    const in90 = new Date(today); in90.setDate(today.getDate() + 90)

    const expiring14 = contracts.filter(c => {
      if (!c.end_date || c.end_date.startsWith('9999')) return false
      const d = new Date(c.end_date)
      return d > today && d <= in14 && c.status === 'active'
    })
    const expiring30 = contracts.filter(c => {
      if (!c.end_date || c.end_date.startsWith('9999')) return false
      const d = new Date(c.end_date)
      return d > in14 && d <= in30 && c.status === 'active'
    })
    const expiring90NoRenewal = contracts.filter(c => {
      if (!c.end_date || c.end_date.startsWith('9999')) return false
      const d = new Date(c.end_date)
      return d > in30 && d <= in90 && c.status === 'active' &&
        (!c.renewal_status || c.renewal_status === 'none')
    })

    if (expiring14.length > 0) {
      list.push({
        id: 'renewal_critical',
        category: 'renewal',
        severity: 'critical',
        title: `${expiring14.length} Vertrag${expiring14.length > 1 ? 'e' : ''} läuft in ≤14 Tagen aus`,
        reason: expiring14.map(c => `${c.customer_name || '–'} · ${c.insurer} · ${new Date(c.end_date).toLocaleDateString('de-CH')}`).slice(0, 3).join('; '),
        recommendation: 'Sofortiger Kundenkontakt erforderlich. Renewal-Offerte vorbereiten.',
        dataBasis: `${expiring14.length} aktive Verträge mit Ablaufdatum ≤14 Tage`,
        link: '/vertragsablaeufe',
        linkLabel: 'Vertragsabläufe',
        taskSuggestion: {
          buttonLabel: 'Renewal-Aufgabe erstellen',
          title: `Renewal: ${expiring14.length} Vertrag${expiring14.length > 1 ? 'e' : ''} ablaufend ≤14 Tage`,
          priority: 'urgent',
          task_type: 'renewal',
          due_date: daysFromNow(3),
          notes: `KI-Insight: ${expiring14.length} Verträge laufen in ≤14 Tagen aus. Kunden kontaktieren und Renewal-Offerte vorbereiten.`,
        },
      })
    }
    if (expiring30.length > 0) {
      list.push({
        id: 'renewal_warning',
        category: 'renewal',
        severity: 'warning',
        title: `${expiring30.length} Vertrag${expiring30.length > 1 ? 'e' : ''} läuft in 15–30 Tagen aus`,
        reason: expiring30.map(c => `${c.customer_name || '–'} · ${c.insurer}`).slice(0, 3).join('; '),
        recommendation: 'Renewal-Gespräch einplanen.',
        dataBasis: `${expiring30.length} aktive Verträge mit Ablaufdatum 15–30 Tage`,
        link: '/vertragsablaeufe',
        linkLabel: 'Vertragsabläufe',
        taskSuggestion: {
          buttonLabel: 'Renewal-Aufgabe erstellen',
          title: `Renewal vorbereiten: ${expiring30.length} Vertrag${expiring30.length > 1 ? 'e' : ''} in 15–30 Tagen`,
          priority: 'high',
          task_type: 'renewal',
          due_date: daysFromNow(7),
          notes: `KI-Insight: Renewal-Gespräch mit Kunden einplanen.`,
        },
      })
    }
    if (expiring90NoRenewal.length > 0) {
      list.push({
        id: 'renewal_no_action',
        category: 'renewal',
        severity: 'info',
        title: `${expiring90NoRenewal.length} Vertrag${expiring90NoRenewal.length > 1 ? 'e' : ''} in 31–90 Tagen ohne Renewal-Status`,
        reason: 'Kein Renewal-Prozess gestartet.',
        recommendation: 'Renewal-Pipeline starten.',
        dataBasis: `Ablauf in 31–90 Tagen, renewal_status = none`,
        link: '/vertragsablaeufe',
        linkLabel: 'Vertragsabläufe',
        taskSuggestion: {
          buttonLabel: 'Renewal-Pipeline starten',
          title: `Renewal-Prozess starten: ${expiring90NoRenewal.length} Vertrag${expiring90NoRenewal.length > 1 ? 'e' : ''}`,
          priority: 'medium',
          task_type: 'renewal',
          due_date: daysFromNow(14),
          notes: `KI-Insight: Renewal-Pipeline für ${expiring90NoRenewal.length} Verträge ohne Status initiieren.`,
        },
      })
    }

    // ── 2. DATENQUALITÄT ─────────────────────────────────────────────────
    const noAdvisor = primaryCustomers.filter(c => !c.advisor_id && !c.primary_advisor_id)
    const noMandate = primaryCustomers.filter(c => ['invalid', 'expired', 'pending'].includes(c.mandate_status))
    const noEmail = primaryCustomers.filter(c => !c.email)

    if (noAdvisor.length > 0) {
      list.push({
        id: 'dq_no_advisor',
        category: 'dataquality',
        severity: noAdvisor.length > 5 ? 'critical' : 'warning',
        title: `${noAdvisor.length} Kund${noAdvisor.length > 1 ? 'en' : 'e'} ohne zugewiesenen Berater`,
        reason: noAdvisor.slice(0, 3).map(c => `${c.first_name} ${c.last_name}`).join(', '),
        recommendation: 'Berater zuweisen, um Verantwortung sicherzustellen.',
        dataBasis: `${primaryCustomers.length} Primärkunden analysiert`,
        link: '/kunden',
        linkLabel: 'Kunden öffnen',
        taskSuggestion: {
          buttonLabel: 'Zuweisung-Task erstellen',
          title: `Berater zuweisen: ${noAdvisor.length} Kund${noAdvisor.length > 1 ? 'en' : 'e'} ohne Berater`,
          priority: noAdvisor.length > 5 ? 'high' : 'medium',
          task_type: 'general',
          due_date: daysFromNow(7),
          notes: `KI-Insight: ${noAdvisor.length} Kunden haben keinen Berater. Zuweisung prüfen und sicherstellen.`,
        },
      })
    }
    if (noMandate.length > 0) {
      list.push({
        id: 'dq_mandate',
        category: 'dataquality',
        severity: noMandate.length > 10 ? 'critical' : 'warning',
        title: `${noMandate.length} Kund${noMandate.length > 1 ? 'en' : 'e'} mit ungültigem/ausstehendem Mandat`,
        reason: 'Mandat ist Grundlage für Beratungsauftrag und Compliance.',
        recommendation: 'Mandatsanfrage versenden oder Mandat erneuern.',
        dataBasis: `mandate_status: invalid | expired | pending`,
        link: '/kunden',
        linkLabel: 'Kunden öffnen',
        taskSuggestion: {
          buttonLabel: 'Mandats-Task erstellen',
          title: `Mandat erneuern: ${noMandate.length} Kund${noMandate.length > 1 ? 'en' : 'e'}`,
          priority: 'high',
          task_type: 'follow_up',
          due_date: daysFromNow(5),
          notes: `KI-Insight: ${noMandate.length} Kunden mit ungültigem Mandat. Mandatsanfrage versenden.`,
        },
      })
    }
    if (noEmail.length > 0) {
      list.push({
        id: 'dq_no_email',
        category: 'dataquality',
        severity: 'info',
        title: `${noEmail.length} Kund${noEmail.length > 1 ? 'en' : 'e'} ohne E-Mail-Adresse`,
        reason: 'Keine E-Mail → kein digitaler Kontakt, keine Kampagnen möglich.',
        recommendation: 'E-Mail-Adresse bei nächstem Kontakt erfassen.',
        dataBasis: `${primaryCustomers.length} Primärkunden analysiert`,
        link: '/kunden',
        linkLabel: 'Kunden öffnen',
        taskSuggestion: {
          buttonLabel: 'Daten-Task erstellen',
          title: `E-Mail-Adressen erfassen: ${noEmail.length} Kund${noEmail.length > 1 ? 'en' : 'e'}`,
          priority: 'low',
          task_type: 'general',
          due_date: daysFromNow(30),
          notes: `KI-Insight: ${noEmail.length} Kunden ohne E-Mail. Bei nächstem Kontakt erfassen.`,
        },
      })
    }

    // ── 3. CROSS-SELLING ──────────────────────────────────────────────────
    const activeContracts = contracts.filter(c => c.status === 'active')
    const customerContractTypes = {}
    activeContracts.forEach(c => {
      if (!customerContractTypes[c.customer_id]) customerContractTypes[c.customer_id] = new Set()
      customerContractTypes[c.customer_id].add((c.sparte || c.insurance_type || '').toLowerCase())
    })

    const noHealthContract = primaryCustomers.filter(c => {
      const types = customerContractTypes[c.id] || new Set()
      return types.size > 0 && !Array.from(types).some(t => t.includes('health') || t.includes('kk') || t.includes('kranken'))
    })
    if (noHealthContract.length > 0) {
      list.push({
        id: 'cs_no_health',
        category: 'crossselling',
        severity: 'info',
        title: `${noHealthContract.length} Kund${noHealthContract.length > 1 ? 'en' : 'e'} ohne Krankenkasse/KK-Vertrag`,
        reason: 'Kunden mit Verträgen, aber ohne Krankenversicherung im System.',
        recommendation: 'Cross-Selling-Gespräch: KK-Offerte anbieten.',
        dataBasis: `Aktive Verträge ohne Sparte KK/health`,
        link: '/kunden',
        linkLabel: 'Kunden öffnen',
        taskSuggestion: {
          buttonLabel: 'Beratungs-Task erstellen',
          title: `KK Cross-Selling: ${noHealthContract.length} Kund${noHealthContract.length > 1 ? 'en' : 'e'} ansprechen`,
          priority: 'medium',
          task_type: 'consultation',
          due_date: daysFromNow(21),
          notes: `KI-Insight: ${noHealthContract.length} Kunden ohne KK-Vertrag. KK-Offerte aktiv ansprechen.`,
        },
      })
    }

    const withFamilyMembers = primaryCustomers.filter(c =>
      customers.some(fm => fm.primary_customer_id === c.id)
    )
    const householdsWithMissing = withFamilyMembers.filter(c => {
      const familyIds = [c.id, ...customers.filter(fm => fm.primary_customer_id === c.id).map(fm => fm.id)]
      const allTypes = new Set()
      familyIds.forEach(id => {
        (customerContractTypes[id] || new Set()).forEach(t => allTypes.add(t))
      })
      return allTypes.size > 0 && allTypes.size < 3
    })
    if (householdsWithMissing.length > 0) {
      list.push({
        id: 'cs_household',
        category: 'crossselling',
        severity: 'info',
        title: `${householdsWithMissing.length} Haushalt${householdsWithMissing.length > 1 ? 'e' : ''} mit Cross-Selling-Potenzial`,
        reason: 'Haushalte mit Familienmitgliedern haben weniger als 3 Versicherungssparten.',
        recommendation: 'Gesamtbetrachtung Haushalt: fehlende Sparten aktiv ansprechen.',
        dataBasis: `Haushalte mit Familienmitgliedern analysiert`,
        link: '/kunden',
        linkLabel: 'Kunden öffnen',
        taskSuggestion: {
          buttonLabel: 'Haushalts-Task erstellen',
          title: `Haushaltsberatung: ${householdsWithMissing.length} Haushalt${householdsWithMissing.length > 1 ? 'e' : ''} mit Potenzial`,
          priority: 'medium',
          task_type: 'consultation',
          due_date: daysFromNow(30),
          notes: `KI-Insight: Haushalte mit Cross-Selling-Potenzial. Gesamtbetrachtung Haushalt planen.`,
        },
      })
    }

    // ── 4. PRODUKTIVITÄT ──────────────────────────────────────────────────
    const now = Date.now()
    const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date).getTime() < now)
    if (overdueTasks.length > 0) {
      list.push({
        id: 'prod_overdue_tasks',
        category: 'productivity',
        severity: overdueTasks.length > 5 ? 'critical' : 'warning',
        title: `${overdueTasks.length} überfällige Aufgabe${overdueTasks.length > 1 ? 'n' : ''}`,
        reason: overdueTasks.slice(0, 3).map(t => t.title).join('; '),
        recommendation: 'Offene Tasks priorisieren oder abschliessen.',
        dataBasis: `Tasks mit due_date < heute`,
        link: '/aufgaben',
        linkLabel: 'Tasks öffnen',
        // No task suggestion for overdue tasks — they already exist
      })
    }

    const staleDays = 14
    const staleThreshold = new Date(today); staleThreshold.setDate(today.getDate() - staleDays)
    const staleOpportunities = verkaufschancen.filter(v => {
      if (['gewonnen', 'verloren'].includes(v.status)) return false
      return !v.updated_date || new Date(v.updated_date) < staleThreshold
    })
    if (staleOpportunities.length > 0) {
      list.push({
        id: 'prod_stale_opps',
        category: 'productivity',
        severity: 'warning',
        title: `${staleOpportunities.length} Verkaufschance${staleOpportunities.length > 1 ? 'n' : ''} ohne Aktivität seit >${staleDays} Tagen`,
        reason: staleOpportunities.slice(0, 3).map(v => v.title || v.customer_name || '–').join(', '),
        recommendation: 'Status prüfen und nächste Aktion definieren.',
        dataBasis: `Offene Verkaufschancen, letzte Änderung vor >${staleDays} Tagen`,
        link: '/verkaufschancen',
        linkLabel: 'Verkaufschancen',
        taskSuggestion: {
          buttonLabel: 'Follow-up-Task erstellen',
          title: `Follow-up: ${staleOpportunities.length} stagnierende Verkaufschance${staleOpportunities.length > 1 ? 'n' : ''}`,
          priority: 'medium',
          task_type: 'follow_up',
          due_date: daysFromNow(3),
          notes: `KI-Insight: ${staleOpportunities.length} Verkaufschancen ohne Aktivität >${staleDays} Tage. Status prüfen und nächste Aktion setzen.`,
        },
      })
    }

    return list
  }, [customers, contracts, tasks, verkaufschancen])

  const handleDismiss = (id) => setDismissed(prev => new Set([...prev, id]))
  const handleCreateTask = (insight) => setTaskInsight(insight)

  const renewal = insights.filter(i => i.category === 'renewal')
  const dataquality = insights.filter(i => i.category === 'dataquality')
  const crossselling = insights.filter(i => i.category === 'crossselling')
  const productivity = insights.filter(i => i.category === 'productivity')

  const visibleCount = insights.filter(i => !dismissed.has(i.id)).length

  if (insights.length === 0) return null

  return (
    <>
      <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-card overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
        >
          <Brain className="w-4 h-4 text-violet-500 shrink-0" />
          <span className="text-[13px] font-semibold text-slate-700 flex-1 text-left">
            AI Intelligence
          </span>
          {visibleCount > 0 && (
            <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
              {visibleCount} Hinweis{visibleCount > 1 ? 'e' : ''}
            </span>
          )}
          <span className="text-caption text-slate-400 mr-1">Advisory only · keine Auto-Aktionen</span>
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-slate-400" />
            : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </button>

        {!collapsed && visibleCount > 0 && (
          <div className="border-t border-[hsl(var(--border-subtle))] p-4 space-y-5">
            <CategorySection icon={RefreshCw} label="Renewal" color="text-rose-500" insights={renewal} dismissed={dismissed} onDismiss={handleDismiss} onCreateTask={handleCreateTask} />
            <CategorySection icon={AlertTriangle} label="Datenqualität" color="text-amber-500" insights={dataquality} dismissed={dismissed} onDismiss={handleDismiss} onCreateTask={handleCreateTask} />
            <CategorySection icon={TrendingUp} label="Cross-Selling" color="text-blue-500" insights={crossselling} dismissed={dismissed} onDismiss={handleDismiss} onCreateTask={handleCreateTask} />
            <CategorySection icon={CheckSquare} label="Produktivität" color="text-slate-500" insights={productivity} dismissed={dismissed} onDismiss={handleDismiss} onCreateTask={handleCreateTask} />
          </div>
        )}

        {!collapsed && visibleCount === 0 && (
          <div className="border-t border-[hsl(var(--border-subtle))] px-5 py-4 text-center text-[12px] text-slate-400">
            Alle Hinweise ausgeblendet · Seite neu laden um zurückzusetzen
          </div>
        )}
      </div>

      {/* Task creation dialog */}
      <CreateTaskDialog
        insight={taskInsight}
        open={!!taskInsight}
        onClose={() => setTaskInsight(null)}
        onSuccess={() => setTaskCreated(true)}
      />
    </>
  )
}