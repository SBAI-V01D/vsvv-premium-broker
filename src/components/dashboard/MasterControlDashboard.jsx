import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Users, Target, TrendingUp, Wallet, RefreshCw, CheckSquare,
  FileWarning, ShieldAlert, ChevronDown, ChevronRight,
  AlertTriangle, Clock, ArrowRight, Star, FileText,
  ListTodo, Activity, Zap, Eye, X, Building2, Phone, Mail
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtChf = (n) => n >= 1000
  ? `CHF ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  : `CHF ${Math.round(n)}`

const fmtDate = (d) => {
  if (!d) return '–'
  const dt = new Date(d + 'T00:00:00Z')
  return `${String(dt.getUTCDate()).padStart(2, '0')}.${String(dt.getUTCMonth() + 1).padStart(2, '0')}.${dt.getUTCFullYear()}`
}

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
  return diff
}

const urgencyColor = (days) => {
  if (days === null) return 'text-muted-foreground'
  if (days <= 0) return 'text-red-600'
  if (days <= 14) return 'text-red-500'
  if (days <= 30) return 'text-orange-500'
  if (days <= 60) return 'text-amber-500'
  return 'text-emerald-600'
}

// ── Section Wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon: Icon, count, accent = 'bg-slate-400', children, defaultOpen = true, badge, badgeClass }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors"
      >
        <span className={`w-1 h-5 rounded-full flex-shrink-0 ${accent}`} />
        {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {count !== undefined && (
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold ml-1', badgeClass || 'bg-muted text-muted-foreground')}>
            {count}
          </span>
        )}
        {badge && <span className="ml-1">{badge}</span>}
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground ml-auto flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

// ── KPI Strip ────────────────────────────────────────────────────────────────
function KpiStrip({ data }) {
  const navigate = useNavigate()
  const {
    activeCustomers, activeLeads, totalMonthlyPremium, yearlyCommissionForecast,
    expiringContracts, openTasks, contractsWithoutDoc, customersWithCriticalGaps,
  } = data

  const kpis = [
    { label: 'Aktive Kunden', value: activeCustomers.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', path: '/kunden' },
    { label: 'Offene Leads', value: activeLeads.length, icon: Target, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', path: '/leads' },
    { label: 'Monatseinnahmen', value: fmtChf(totalMonthlyPremium), icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', path: '/vertraege' },
    { label: 'Jahres-Forecast', value: fmtChf(yearlyCommissionForecast), icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100', path: '/provisionen-courtagen' },
    { label: 'Offene Abläufe', value: expiringContracts.length, icon: RefreshCw, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', urgent: expiringContracts.length > 0, path: '/vertraege' },
    { label: 'Offene Aufgaben', value: openTasks.length, icon: CheckSquare, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', urgent: openTasks.length > 5, path: '/aufgaben' },
    { label: 'Fehl. Dokumente', value: contractsWithoutDoc, icon: FileWarning, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', urgent: contractsWithoutDoc > 0, path: '/dokumente' },
    { label: 'Coverage-Lücken', value: customersWithCriticalGaps.length, icon: ShieldAlert, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-100', path: '/coverage-intelligence' },
  ]

  return (
    <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
      {kpis.map(k => {
        const Icon = k.icon
        return (
          <button
            key={k.label}
            onClick={() => navigate(k.path)}
            className={cn(
              'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 text-center',
              k.bg, k.border,
              k.urgent ? 'ring-2 ring-red-300 ring-offset-1' : ''
            )}
          >
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', k.bg)}>
              <Icon className={cn('w-4 h-4', k.color)} />
            </div>
            <span className={cn('text-lg font-bold leading-none', k.color)}>{k.value}</span>
            <span className="text-[10px] text-muted-foreground leading-tight font-medium">{k.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Priority Action Center ────────────────────────────────────────────────────
function PriorityActionCenter({ data, onCustomerSelect }) {
  const navigate = useNavigate()
  const { expiringContracts, openTasks, activeLeads, customers, customersWithCriticalGaps } = data

  const CONTRACT_TASK_TYPES = ['renewal', 'health_declaration']
  const overdueTasks = openTasks.filter(t => t.due_date && daysUntil(t.due_date) !== null && daysUntil(t.due_date) <= 0)
  const urgentRenewals = expiringContracts.filter(c => daysUntil(c.end_date) !== null && daysUntil(c.end_date) <= 30).slice(0, 5)
  const hotLeads = activeLeads.filter(l => l.lead_score >= 70).sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0)).slice(0, 4)
  const attentionCustomers = customersWithCriticalGaps.slice(0, 4)

  const priorityItems = [
    ...overdueTasks.map(t => ({
      type: 'task', icon: CheckSquare, color: 'text-red-600', bg: 'bg-red-50',
      label: t.title, sub: `Überfällig · ${t.customer_name || ''}`,
      days: daysUntil(t.due_date), action: () => navigate('/aufgaben'),
      urgent: true,
    })),
    ...urgentRenewals.map(c => ({
      type: 'renewal', icon: RefreshCw, color: 'text-orange-600', bg: 'bg-orange-50',
      label: c.customer_name || c.insurer, sub: `Ablauf: ${fmtDate(c.end_date)} · ${c.insurer || ''}`,
      days: daysUntil(c.end_date), action: () => navigate('/vertraege'),
      urgent: (daysUntil(c.end_date) || 0) <= 14,
    })),
    ...hotLeads.map(l => ({
      type: 'lead', icon: Target, color: 'text-violet-600', bg: 'bg-violet-50',
      label: `${l.first_name} ${l.last_name}`, sub: `Score: ${l.lead_score}% · ${l.status}`,
      days: null, action: () => navigate('/leads'),
      urgent: false,
    })),
    ...attentionCustomers.slice(0, 2).map(c => ({
      type: 'coverage', icon: ShieldAlert, color: 'text-pink-600', bg: 'bg-pink-50',
      label: `${c.first_name} ${c.last_name}`, sub: 'Coverage-Lücke erkannt',
      days: null, action: () => onCustomerSelect(c), urgent: false,
    })),
  ].sort((a, b) => (a.urgent ? -1 : 1))

  if (priorityItems.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Keine kritischen Prioritäten — alles im grünen Bereich ✓</p>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {priorityItems.slice(0, 8).map((item, i) => {
        const Icon = item.icon
        return (
          <button
            key={i}
            onClick={item.action}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-sm hover:border-primary/30',
              item.urgent ? 'border-red-200 bg-red-50/50' : 'border-border bg-background hover:bg-muted/30'
            )}
          >
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', item.bg)}>
              <Icon className={cn('w-4 h-4', item.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.label}</p>
              <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
            </div>
            {item.days !== null && (
              <span className={cn('text-xs font-semibold flex-shrink-0', urgencyColor(item.days))}>
                {item.days <= 0 ? 'Überfällig' : `${item.days}T`}
              </span>
            )}
            {item.urgent && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />}
          </button>
        )
      })}
    </div>
  )
}

// ── Activity Timeline ─────────────────────────────────────────────────────────
function ActivityTimeline({ data }) {
  const navigate = useNavigate()
  const { contracts, customers, applications, documents } = data

  const items = useMemo(() => {
    const events = []
    contracts.slice(0, 6).forEach(c => {
      if (c.updated_date) events.push({
        date: c.updated_date, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50',
        label: `Vertrag aktualisiert`, sub: `${c.customer_name || ''} · ${c.insurer || ''} · ${c.status}`,
        action: () => navigate('/vertraege'),
      })
    })
    customers.slice(0, 4).forEach(c => {
      if (c.created_date) events.push({
        date: c.created_date, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50',
        label: 'Neuer Kunde', sub: `${c.first_name} ${c.last_name}`,
        action: () => navigate(`/kunden/${c.id}`),
      })
    })
    applications.slice(0, 4).forEach(a => {
      if (a.updated_date) events.push({
        date: a.updated_date, icon: Activity, color: 'text-violet-500', bg: 'bg-violet-50',
        label: 'Antrag aktualisiert', sub: `${a.customer_name || ''} · ${a.status}`,
        action: () => navigate('/antraege'),
      })
    })
    documents.slice(0, 3).forEach(d => {
      if (d.created_date) events.push({
        date: d.created_date, icon: FileWarning, color: 'text-amber-500', bg: 'bg-amber-50',
        label: 'Dokument hochgeladen', sub: d.name || 'Unbenannt',
        action: () => navigate('/dokumente'),
      })
    })
    return events.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8)
  }, [contracts, customers, applications, documents])

  if (items.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">Keine aktuellen Aktivitäten</p>

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => {
        const Icon = item.icon
        const dt = new Date(item.date)
        const age = Math.floor((Date.now() - dt) / 86400000)
        const ageStr = age === 0 ? 'Heute' : age === 1 ? 'Gestern' : `vor ${age}T`
        return (
          <button key={i} onClick={item.action} className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors text-left group">
            <div className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0', item.bg)}>
              <Icon className={cn('w-3.5 h-3.5', item.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
            </div>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{ageStr}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Sales & Coverage Intelligence ─────────────────────────────────────────────
function SalesCoveragePanel({ data }) {
  const navigate = useNavigate()
  const { activeLeads, expiringContracts, customersWithCriticalGaps, conversionRate, activeContracts } = data

  const renewalStages = useMemo(() => {
    const d = { early: 0, contact: 0, offer: 0, negotiation: 0, renewed: 0 }
    expiringContracts.forEach(c => { const s = c.renewal_stage || 'early'; if (d[s] !== undefined) d[s]++ })
    return d
  }, [expiringContracts])

  const leadStages = useMemo(() => {
    const d = { new: 0, contacted: 0, qualified: 0 }
    activeLeads.forEach(l => { if (d[l.status] !== undefined) d[l.status]++ })
    return d
  }, [activeLeads])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Pipeline */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Lead Pipeline</p>
        <div className="space-y-2">
          {[
            { label: 'Neu', count: leadStages.new, color: 'bg-slate-400' },
            { label: 'Kontaktiert', count: leadStages.contacted, color: 'bg-blue-400' },
            { label: 'Qualifiziert', count: leadStages.qualified, color: 'bg-violet-500' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-20">{s.label}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', s.color)} style={{ width: `${activeLeads.length > 0 ? (s.count / activeLeads.length) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-semibold w-5 text-right">{s.count}</span>
            </div>
          ))}
          <button onClick={() => navigate('/leads')} className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
            <ArrowRight className="w-3 h-3" /> Leads öffnen
          </button>
        </div>
      </div>

      {/* Renewals */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Renewal Stages</p>
        <div className="space-y-2">
          {[
            { label: 'Early', count: renewalStages.early, color: 'bg-slate-300' },
            { label: 'Kontakt', count: renewalStages.contact, color: 'bg-amber-400' },
            { label: 'Angebot', count: renewalStages.offer, color: 'bg-orange-500' },
            { label: 'Verhandlung', count: renewalStages.negotiation, color: 'bg-red-500' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-20">{s.label}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', s.color)} style={{ width: `${expiringContracts.length > 0 ? (s.count / expiringContracts.length) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-semibold w-5 text-right">{s.count}</span>
            </div>
          ))}
          <button onClick={() => navigate('/vertraege')} className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
            <ArrowRight className="w-3 h-3" /> Verträge öffnen
          </button>
        </div>
      </div>

      {/* Coverage */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Coverage Intelligence</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center p-2.5 rounded-lg bg-pink-50 border border-pink-100">
            <span className="text-xs text-pink-700 font-medium">Kritische Lücken</span>
            <span className="text-sm font-bold text-pink-700">{customersWithCriticalGaps.length}</span>
          </div>
          <div className="flex justify-between items-center p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
            <span className="text-xs text-emerald-700 font-medium">Conversion Rate</span>
            <span className="text-sm font-bold text-emerald-700">{conversionRate}%</span>
          </div>
          <div className="flex justify-between items-center p-2.5 rounded-lg bg-blue-50 border border-blue-100">
            <span className="text-xs text-blue-700 font-medium">Aktive Policen</span>
            <span className="text-sm font-bold text-blue-700">{activeContracts.length}</span>
          </div>
          <button onClick={() => navigate('/coverage-intelligence')} className="flex items-center gap-1 text-xs text-primary mt-1 hover:underline">
            <ArrowRight className="w-3 h-3" /> Coverage öffnen
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Task Split Panel ──────────────────────────────────────────────────────────
const CONTRACT_TASK_TYPES_SET = new Set(['renewal', 'health_declaration'])

function TaskSplitPanel({ tasks, onTaskClick }) {
  const navigate = useNavigate()
  const adminTasks = tasks.filter(t => !CONTRACT_TASK_TYPES_SET.has(t.task_type) && t.status !== 'completed')
  const contractTasks = tasks.filter(t => CONTRACT_TASK_TYPES_SET.has(t.task_type) && t.status !== 'completed')

  const renderTask = (t) => {
    const days = daysUntil(t.due_date)
    return (
      <button
        key={t.id}
        onClick={() => onTaskClick(t)}
        className={cn(
          'w-full flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all hover:shadow-sm',
          days !== null && days <= 0 ? 'bg-red-50 border-red-200' : 'bg-background border-border hover:bg-muted/30'
        )}
      >
        <div className={cn('w-1.5 h-6 rounded-full flex-shrink-0', {
          'bg-red-500': t.priority === 'urgent',
          'bg-orange-400': t.priority === 'high',
          'bg-blue-400': t.priority === 'medium',
          'bg-slate-300': t.priority === 'low' || !t.priority,
        })} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{t.title}</p>
          {t.customer_name && <p className="text-[10px] text-muted-foreground truncate">{t.customer_name}</p>}
        </div>
        {t.due_date && (
          <span className={cn('text-[10px] font-semibold flex-shrink-0', urgencyColor(days))}>
            {days !== null && days <= 0 ? 'Überfällig' : fmtDate(t.due_date)}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ListTodo className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Administrative Aufgaben</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">{adminTasks.length}</span>
        </div>
        {adminTasks.length === 0
          ? <p className="text-xs text-muted-foreground py-3 text-center">Alle erledigt ✓</p>
          : <div className="space-y-1.5">{adminTasks.slice(0, 5).map(renderTask)}</div>
        }
        {adminTasks.length > 5 && (
          <button onClick={() => navigate('/aufgaben')} className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
            <ArrowRight className="w-3 h-3" /> +{adminTasks.length - 5} weitere
          </button>
        )}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FileWarning className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Vertrags-Workflows</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">{contractTasks.length}</span>
        </div>
        {contractTasks.length === 0
          ? <p className="text-xs text-muted-foreground py-3 text-center">Keine offenen Vertragsaufgaben ✓</p>
          : <div className="space-y-1.5">{contractTasks.slice(0, 5).map(renderTask)}</div>
        }
        {contractTasks.length > 5 && (
          <button onClick={() => navigate('/aufgaben')} className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
            <ArrowRight className="w-3 h-3" /> +{contractTasks.length - 5} weitere
          </button>
        )}
      </div>
    </div>
  )
}

// ── Customer Quick View ───────────────────────────────────────────────────────
function CustomerQuickView({ customer, contracts, tasks, documents, onClose }) {
  const navigate = useNavigate()
  if (!customer) return null

  const custContracts = contracts.filter(c => c.customer_id === customer.id || c.primary_customer_id === customer.id)
  const custTasks = tasks.filter(t => t.customer_id === customer.id && t.status !== 'completed')
  const custDocs = documents.filter(d => d.customer_id === customer.id || d.primary_customer_id === customer.id)
  const totalPremium = custContracts.filter(c => c.status === 'active').reduce((s, c) => s + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-border">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
            {customer.first_name?.[0]}{customer.last_name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base">{customer.first_name} {customer.last_name}</h3>
            <p className="text-xs text-muted-foreground">{customer.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate(`/kunden/${customer.id}/360`)}>
              <Eye className="w-3.5 h-3.5 mr-1" /> 360°
            </Button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Policen', value: custContracts.length, color: 'text-blue-600' },
              { label: 'Prämie/J.', value: fmtChf(totalPremium), color: 'text-emerald-600' },
              { label: 'Aufgaben', value: custTasks.length, color: 'text-amber-600' },
              { label: 'Dokumente', value: custDocs.length, color: 'text-slate-600' },
            ].map(k => (
              <div key={k.label} className="text-center p-2 rounded-lg bg-muted/40">
                <p className={cn('text-base font-bold', k.color)}>{k.value}</p>
                <p className="text-[10px] text-muted-foreground">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Contracts */}
          {custContracts.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Verträge</p>
              <div className="space-y-1.5">
                {custContracts.slice(0, 4).map(c => {
                  const days = daysUntil(c.end_date)
                  return (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                      <span className={cn('w-1.5 h-5 rounded-full flex-shrink-0', {
                        'bg-emerald-400': c.status === 'active',
                        'bg-orange-400': c.status === 'renewal_due',
                        'bg-red-400': c.status === 'expired' || c.status === 'cancelled',
                        'bg-slate-300': !['active', 'renewal_due', 'expired', 'cancelled'].includes(c.status),
                      })} />
                      <span className="font-medium flex-1 truncate">{c.insurer} · {c.sparte || c.insurance_type}</span>
                      {c.end_date && <span className={cn('flex-shrink-0', urgencyColor(days))}>{fmtDate(c.end_date)}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Open Tasks */}
          {custTasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Offene Aufgaben</p>
              <div className="space-y-1">
                {custTasks.slice(0, 3).map(t => (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100 text-xs">
                    <CheckSquare className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span className="truncate">{t.title}</span>
                    {t.due_date && <span className={cn('ml-auto flex-shrink-0', urgencyColor(daysUntil(t.due_date)))}>{fmtDate(t.due_date)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Master Control Dashboard ──────────────────────────────────────────────────
export default function MasterControlDashboard({ data, onTaskClick }) {
  const navigate = useNavigate()
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const { tasks = [], contracts = [], documents = [] } = data
  const openTasks = data.openTasks || []

  return (
    <div className="space-y-3">

      {/* 1. KPI Strip */}
      <Section
        title="Executive KPIs"
        icon={Activity}
        accent="bg-blue-500"
        defaultOpen={true}
      >
        <KpiStrip data={data} />
      </Section>

      {/* 2. Priority Action Center */}
      <Section
        title="Prioritäten & Sofortmassnahmen"
        icon={Zap}
        accent="bg-red-500"
        count={
          data.openTasks.filter(t => t.due_date && daysUntil(t.due_date) !== null && daysUntil(t.due_date) <= 0).length +
          data.expiringContracts.filter(c => daysUntil(c.end_date) !== null && daysUntil(c.end_date) <= 14).length
        }
        badgeClass="bg-red-100 text-red-700"
        defaultOpen={true}
      >
        <PriorityActionCenter data={data} onCustomerSelect={setSelectedCustomer} />
      </Section>

      {/* 3. Activity Timeline */}
      <Section
        title="Kundenaktivitäten & Vertragsübersicht"
        icon={Activity}
        accent="bg-emerald-500"
        defaultOpen={true}
      >
        <ActivityTimeline data={data} />
      </Section>

      {/* 4. Sales & Coverage Intelligence */}
      <Section
        title="Sales & Coverage Intelligence"
        icon={TrendingUp}
        accent="bg-violet-500"
        defaultOpen={true}
      >
        <SalesCoveragePanel data={data} />
      </Section>

      {/* 5. Task Split */}
      <Section
        title="Operative Aufgaben"
        icon={CheckSquare}
        accent="bg-amber-500"
        count={openTasks.length}
        badgeClass={openTasks.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}
        defaultOpen={true}
      >
        <TaskSplitPanel tasks={openTasks} onTaskClick={onTaskClick} />
      </Section>

      {/* Customer Quick View Overlay */}
      {selectedCustomer && (
        <CustomerQuickView
          customer={selectedCustomer}
          contracts={contracts}
          tasks={tasks}
          documents={documents}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  )
}