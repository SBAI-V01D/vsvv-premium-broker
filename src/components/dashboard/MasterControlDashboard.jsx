import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Users, Target, TrendingUp, Wallet, RefreshCw, CheckSquare,
  FileWarning, ShieldAlert, ChevronDown, AlertTriangle, Clock,
  ArrowRight, FileText, ListTodo, Activity, Zap, Eye, X,
  CalendarClock, CircleDot, TriangleAlert
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

const urgencyColor = (days) => {
  if (days === null) return 'text-muted-foreground'
  if (days <= 0)  return 'text-red-600 font-bold'
  if (days <= 7)  return 'text-red-500 font-semibold'
  if (days <= 14) return 'text-orange-500 font-semibold'
  if (days <= 30) return 'text-amber-500'
  return 'text-emerald-600'
}

const urgencyBg = (days) => {
  if (days === null) return ''
  if (days <= 0)  return 'bg-red-50 border-red-200'
  if (days <= 7)  return 'bg-red-50/60 border-red-100'
  if (days <= 14) return 'bg-orange-50 border-orange-100'
  if (days <= 30) return 'bg-amber-50/50 border-amber-100'
  return 'bg-background border-border'
}

// ── Collapsible Section ───────────────────────────────────────────────────────
function Section({ title, icon: Icon, accent, children, defaultOpen = true, countBadge, subtitleBadge }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={cn('rounded-xl overflow-hidden border shadow-sm', accent?.border || 'border-border bg-card')}>
      <button
        onClick={() => setOpen(!open)}
        className={cn('w-full flex items-center gap-2.5 px-4 py-3 transition-colors hover:bg-black/[0.02]', accent?.header)}
      >
        <span className={cn('w-[3px] h-4 rounded-full flex-shrink-0', accent?.bar || 'bg-slate-300')} />
        {Icon && <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', accent?.icon || 'text-muted-foreground')} />}
        <span className="text-sm font-semibold flex-1 text-left">{title}</span>
        {countBadge}
        {subtitleBadge && <span className="text-[10px] text-muted-foreground">{subtitleBadge}</span>}
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function CountBadge({ n, className }) {
  if (!n) return null
  return <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold', className)}>{n}</span>
}

// ── 1. TODAY'S PRIORITY TASKS ─────────────────────────────────────────────────
const CONTRACT_TASK_TYPES = new Set(['renewal', 'health_declaration'])

function TodayPriorityTasks({ openTasks, onTaskClick, customers = [] }) {
  const navigate = useNavigate()
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const today = new Date().toISOString().slice(0, 10)

  const overdue   = openTasks.filter(t => t.due_date && daysUntil(t.due_date) < 0)
  const dueToday  = openTasks.filter(t => t.due_date === today)
  const dueThisWeek = openTasks.filter(t => {
    const d = daysUntil(t.due_date)
    return d !== null && d > 0 && d <= 7
  })

  const totalUrgent = overdue.length + dueToday.length

  if (overdue.length === 0 && dueToday.length === 0 && dueThisWeek.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 text-emerald-600">
        <CheckSquare className="w-4 h-4" />
        <span className="text-sm font-medium">Keine dringenden Aufgaben — alles erledigt ✓</span>
      </div>
    )
  }

  const renderRow = (t, variant = 'default') => {
    const days = daysUntil(t.due_date)
    const isContract = CONTRACT_TASK_TYPES.has(t.task_type)
    return (
      <button
        key={t.id}
        onClick={() => onTaskClick(t)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all hover:shadow-sm group',
          urgencyBg(days)
        )}
      >
        {/* Type indicator */}
        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
          isContract ? 'bg-orange-100' : 'bg-slate-100'
        )}>
          {isContract
            ? <RefreshCw className="w-3.5 h-3.5 text-orange-600" />
            : <ListTodo className="w-3.5 h-3.5 text-slate-500" />
          }
        </div>
        {/* Priority bar */}
        <span className={cn('w-1 h-7 rounded-full flex-shrink-0', {
          'bg-red-500': t.priority === 'urgent' || days !== null && days <= 0,
          'bg-orange-400': t.priority === 'high' || (days !== null && days > 0 && days <= 7),
          'bg-blue-400': t.priority === 'medium' && (days === null || days > 7),
          'bg-slate-200': t.priority === 'low' || !t.priority,
        })} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{t.title}</p>
          {t.customer_name ? (
            <button 
              onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customers.find(c => c.id === t.customer_id)) }}
              className="text-[10px] text-blue-700 font-medium hover:underline"
            >
              {t.customer_name}
            </button>
          ) : (
            <p className="text-[10px] text-amber-600 italic">Kein Kunde verknüpft</p>
          )}
        </div>
        {isContract && (
          <span className="text-[9px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-semibold flex-shrink-0">VERTRAG</span>
        )}
        <span className={cn('text-xs flex-shrink-0', urgencyColor(days))}>
          {days === null ? '' : days <= 0 ? 'Überfällig' : days === 0 ? 'Heute' : `${days}T`}
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TriangleAlert className="w-3.5 h-3.5 text-red-600" />
            <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Überfällig ({overdue.length})</span>
          </div>
          <div className="space-y-1.5">{overdue.map(t => renderRow(t, 'overdue'))}</div>
        </div>
      )}
      {dueToday.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-orange-600" />
            <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">Heute fällig ({dueToday.length})</span>
          </div>
          <div className="space-y-1.5">{dueToday.map(t => renderRow(t, 'today'))}</div>
        </div>
      )}
      {dueThisWeek.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Diese Woche ({dueThisWeek.length})</span>
          </div>
          <div className="space-y-1.5">{dueThisWeek.slice(0, 4).map(t => renderRow(t, 'week'))}</div>
        </div>
      )}
      <button onClick={() => navigate('/aufgaben')} className="flex items-center gap-1.5 text-xs text-primary hover:underline pt-1">
        <ArrowRight className="w-3 h-3" /> Alle Aufgaben öffnen
      </button>
    </div>
  )
}

// ── 2. URGENT CONTRACT WORKFLOWS ──────────────────────────────────────────────
function UrgentContracts({ expiringContracts, onContractSelect }) {
  const navigate = useNavigate()
  const urgent = expiringContracts
    .map(c => ({ ...c, _days: daysUntil(c.end_date) }))
    .sort((a, b) => (a._days ?? 999) - (b._days ?? 999))
    .slice(0, 8)

  if (urgent.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 text-emerald-600">
        <RefreshCw className="w-4 h-4" />
        <span className="text-sm font-medium">Keine ablaufenden Verträge in den nächsten 90 Tagen ✓</span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {urgent.map(c => {
        const days = c._days
        const stageLabel = { early: 'Early', contact: 'Kontakt', offer: 'Angebot', negotiation: 'Verhandlung', renewed: 'Erneuert', lost: 'Verloren' }[c.renewal_stage] || 'Early'
        return (
          <button
            key={c.id}
            onClick={() => onContractSelect?.(c)}
            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all hover:shadow-sm', urgencyBg(days))}
          >
            <div className="w-7 h-7 rounded-md bg-orange-100 flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-3.5 h-3.5 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{c.customer_name || '–'}</p>
              <p className="text-[10px] text-muted-foreground">{c.insurer} · {c.sparte || c.insurance_type || '–'}</p>
            </div>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0', {
              'bg-slate-100 text-slate-600': c.renewal_stage === 'early' || !c.renewal_stage,
              'bg-blue-100 text-blue-700': c.renewal_stage === 'contact',
              'bg-violet-100 text-violet-700': c.renewal_stage === 'offer',
              'bg-orange-100 text-orange-700': c.renewal_stage === 'negotiation',
            })}>{stageLabel}</span>
            <span className={cn('text-xs flex-shrink-0 w-16 text-right', urgencyColor(days))}>
              {days === null ? '–' : days <= 0 ? 'Abgelaufen' : `${days}T`}
            </span>
          </button>
        )
      })}
      {expiringContracts.length > 8 && (
        <button onClick={() => navigate('/vertraege')} className="flex items-center gap-1.5 text-xs text-primary hover:underline pt-1">
          <ArrowRight className="w-3 h-3" /> +{expiringContracts.length - 8} weitere anzeigen
        </button>
      )}
    </div>
  )
}

// ── 3. CUSTOMER ACTIONS ───────────────────────────────────────────────────────
function CustomerActionItems({ data, onCustomerSelect }) {
  const navigate = useNavigate()
  const { customersWithCriticalGaps, activeLeads, contractsWithoutDoc } = data

  const hotLeads = activeLeads
    .filter(l => (l.lead_score || 0) >= 60)
    .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
    .slice(0, 4)

  const total = customersWithCriticalGaps.length + hotLeads.length + (contractsWithoutDoc > 0 ? 1 : 0)

  if (total === 0) {
    return (
      <div className="flex items-center gap-2 py-4 text-emerald-600">
        <Users className="w-4 h-4" />
        <span className="text-sm font-medium">Keine Kundenmassnahmen ausstehend ✓</span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {contractsWithoutDoc > 0 && (
        <button
          onClick={() => navigate('/dokumente')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-red-100 bg-red-50/50 text-left hover:shadow-sm transition-all"
        >
          <div className="w-7 h-7 rounded-md bg-red-100 flex items-center justify-center flex-shrink-0">
            <FileWarning className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">{contractsWithoutDoc} Policen ohne Dokument</p>
            <p className="text-[10px] text-muted-foreground">Dokumente hochladen oder verknüpfen</p>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold">DRINGEND</span>
        </button>
      )}
      {customersWithCriticalGaps.slice(0, 3).map(c => (
        <button
          key={c.id}
          onClick={() => onCustomerSelect(c)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-pink-100 bg-pink-50/40 text-left hover:shadow-sm transition-all"
        >
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs flex-shrink-0">
            {c.first_name?.[0]}{c.last_name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <button 
              onClick={(e) => { e.stopPropagation(); onCustomerSelect(c) }}
              className="text-xs font-semibold truncate hover:underline"
            >
              {c.first_name} {c.last_name}
            </button>
            <p className="text-[10px] text-muted-foreground">Coverage-Lücke erkannt</p>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded font-semibold flex-shrink-0">LÜCKE</span>
          <Eye className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        </button>
      ))}
      {hotLeads.map(l => (
        <button
          key={l.id}
          onClick={() => navigate('/leads')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-violet-100 bg-violet-50/30 text-left hover:shadow-sm transition-all"
        >
          <div className="w-7 h-7 rounded-md bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Target className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{l.first_name} {l.last_name}</p>
            <p className="text-[10px] text-muted-foreground">Score: {l.lead_score}% · {l.status}</p>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded font-semibold flex-shrink-0">LEAD</span>
        </button>
      ))}
    </div>
  )
}

// ── 4. ALL TASKS SPLIT PANEL ──────────────────────────────────────────────────
function AllTasksSplit({ openTasks, onTaskClick, customers = [] }) {
  const navigate = useNavigate()
  const adminTasks    = openTasks.filter(t => !CONTRACT_TASK_TYPES.has(t.task_type))
  const contractTasks = openTasks.filter(t => CONTRACT_TASK_TYPES.has(t.task_type))

  const renderTask = (t) => {
    const days = daysUntil(t.due_date)
    return (
      <button
        key={t.id}
        onClick={() => onTaskClick(t)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all hover:shadow-sm',
          urgencyBg(days)
        )}
      >
        <span className={cn('w-1 h-6 rounded-full flex-shrink-0', {
          'bg-red-500':    t.priority === 'urgent' || (days !== null && days <= 0),
          'bg-orange-400': t.priority === 'high'   || (days !== null && days > 0 && days <= 7),
          'bg-blue-400':   t.priority === 'medium' && (days === null || days > 7),
          'bg-slate-200':  !t.priority || t.priority === 'low',
        })} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{t.title}</p>
          {t.customer_name && (
            <button 
              onClick={(e) => { e.stopPropagation(); navigate(`/kunden/${t.customer_id}`) }}
              className="text-[10px] text-blue-700 font-medium hover:underline"
            >
              {t.customer_name}
            </button>
          )}
        </div>
        {t.due_date && (
          <span className={cn('text-[10px] flex-shrink-0', urgencyColor(days))}>
            {days !== null && days <= 0 ? 'Überfällig' : fmtDate(t.due_date)}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
      {/* Administrative */}
      <div>
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-100">
          <ListTodo className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Administrative Aufgaben</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold ml-auto">{adminTasks.length}</span>
        </div>
        {adminTasks.length === 0
          ? <p className="text-xs text-muted-foreground py-3 text-center">Alle erledigt ✓</p>
          : <div className="space-y-1.5">{adminTasks.slice(0, 6).map(renderTask)}</div>
        }
        {adminTasks.length > 6 && (
          <button onClick={() => navigate('/aufgaben')} className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
            <ArrowRight className="w-3 h-3" /> +{adminTasks.length - 6} weitere
          </button>
        )}
      </div>

      {/* Contract Workflows */}
      <div>
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-orange-100">
          <RefreshCw className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">Vertrags-Workflows</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold ml-auto">{contractTasks.length}</span>
        </div>
        {contractTasks.length === 0
          ? <p className="text-xs text-muted-foreground py-3 text-center">Keine offenen Vertragsaufgaben ✓</p>
          : <div className="space-y-1.5">{contractTasks.slice(0, 6).map(renderTask)}</div>
        }
        {contractTasks.length > 6 && (
          <button onClick={() => navigate('/aufgaben')} className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
            <ArrowRight className="w-3 h-3" /> +{contractTasks.length - 6} weitere
          </button>
        )}
      </div>
    </div>
  )
}

// ── 5. KPI STRIP (compact, secondary) ────────────────────────────────────────
function CompactKpiStrip({ data }) {
  const navigate = useNavigate()
  const {
    activeCustomers, activeLeads, totalMonthlyPremium, yearlyCommissionForecast,
    expiringContracts, openTasks, contractsWithoutDoc, customersWithCriticalGaps,
  } = data

  const kpis = [
    { label: 'Kunden',       value: activeCustomers.length,            color: 'text-blue-600',   path: '/kunden' },
    { label: 'Leads',        value: activeLeads.length,                color: 'text-violet-600', path: '/leads' },
    { label: 'Monatspr.',    value: fmtChf(totalMonthlyPremium),       color: 'text-emerald-600',path: '/vertraege' },
    { label: 'Forecast/J.',  value: fmtChf(yearlyCommissionForecast),  color: 'text-teal-600',   path: '/provisionen-courtagen' },
    { label: 'Abläufe',      value: expiringContracts.length,          color: expiringContracts.length > 0 ? 'text-orange-600' : 'text-muted-foreground', path: '/vertraege' },
    { label: 'Aufgaben',     value: openTasks.length,                  color: openTasks.length > 5 ? 'text-amber-600' : 'text-muted-foreground', path: '/aufgaben' },
    { label: 'Fehl. Dok.',   value: contractsWithoutDoc,               color: contractsWithoutDoc > 0 ? 'text-red-600' : 'text-muted-foreground', path: '/dokumente' },
    { label: 'Coverage',     value: customersWithCriticalGaps.length,  color: customersWithCriticalGaps.length > 0 ? 'text-pink-600' : 'text-muted-foreground', path: '/coverage-intelligence' },
  ]

  return (
    <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
      {kpis.map(k => (
        <button
          key={k.label}
          onClick={() => navigate(k.path)}
          className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors border border-transparent hover:border-border text-center"
        >
          <span className={cn('text-base font-bold leading-none', k.color)}>{k.value}</span>
          <span className="text-[9px] text-muted-foreground font-medium leading-tight">{k.label}</span>
        </button>
      ))}
    </div>
  )
}

// ── 6. SALES & PIPELINE SUMMARY ───────────────────────────────────────────────
function SalesPipelineSummary({ data }) {
  const navigate = useNavigate()
  const { activeLeads, expiringContracts, customersWithCriticalGaps, conversionRate, activeContracts } = data

  const renewalStages = useMemo(() => {
    const d = { early: 0, contact: 0, offer: 0, negotiation: 0 }
    expiringContracts.forEach(c => { const s = c.renewal_stage || 'early'; if (s in d) d[s]++ })
    return d
  }, [expiringContracts])

  const leadStages = useMemo(() => {
    const d = { new: 0, contacted: 0, qualified: 0 }
    activeLeads.forEach(l => { if (l.status in d) d[l.status]++ })
    return d
  }, [activeLeads])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Lead Pipeline</p>
        <div className="space-y-1.5">
          {[
            { label: 'Neu',         count: leadStages.new,       color: 'bg-slate-400' },
            { label: 'Kontaktiert', count: leadStages.contacted, color: 'bg-blue-400' },
            { label: 'Qualifiziert',count: leadStages.qualified, color: 'bg-violet-500' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-18">{s.label}</span>
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', s.color)} style={{ width: `${activeLeads.length > 0 ? (s.count / activeLeads.length) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-bold w-4 text-right">{s.count}</span>
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/leads')} className="flex items-center gap-1 text-xs text-primary mt-3 hover:underline">
          <ArrowRight className="w-3 h-3" /> Leads öffnen
        </button>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Renewal Pipeline</p>
        <div className="space-y-1.5">
          {[
            { label: 'Early',       count: renewalStages.early,       color: 'bg-slate-300' },
            { label: 'Kontakt',     count: renewalStages.contact,     color: 'bg-amber-400' },
            { label: 'Angebot',     count: renewalStages.offer,       color: 'bg-orange-500' },
            { label: 'Verhandlung', count: renewalStages.negotiation, color: 'bg-red-500' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-18">{s.label}</span>
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', s.color)} style={{ width: `${expiringContracts.length > 0 ? (s.count / expiringContracts.length) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-bold w-4 text-right">{s.count}</span>
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/vertraege')} className="flex items-center gap-1 text-xs text-primary mt-3 hover:underline">
          <ArrowRight className="w-3 h-3" /> Verträge öffnen
        </button>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Intelligence</p>
        <div className="space-y-1.5">
          {[
            { label: 'Coverage-Lücken', value: customersWithCriticalGaps.length, color: 'text-pink-600', path: '/coverage-intelligence' },
            { label: 'Conversion Rate', value: `${conversionRate}%`,            color: 'text-emerald-600', path: '/leads' },
            { label: 'Aktive Policen',  value: activeContracts.length,           color: 'text-blue-600', path: '/vertraege' },
          ].map(item => (
            <button key={item.label} onClick={() => navigate(item.path)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-muted/40 hover:bg-muted/70 transition-colors">
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
              <span className={cn('text-xs font-bold', item.color)}>{item.value}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Customer Quick View Overlay ───────────────────────────────────────────────
function CustomerQuickView({ customer, contracts, tasks, documents, onClose }) {
  const navigate = useNavigate()
  if (!customer) return null

  const custContracts = contracts.filter(c => c.customer_id === customer.id || c.primary_customer_id === customer.id)
  const custTasks     = tasks.filter(t => t.customer_id === customer.id && t.status !== 'completed')
  const custDocs      = documents.filter(d => d.customer_id === customer.id || d.primary_customer_id === customer.id)
  const totalPremium  = custContracts.filter(c => c.status === 'active').reduce((s, c) => s + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
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
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Policen',   value: custContracts.length,  color: 'text-blue-600' },
              { label: 'Prämie/J.',  value: fmtChf(totalPremium), color: 'text-emerald-600' },
              { label: 'Aufgaben',  value: custTasks.length,       color: 'text-amber-600' },
              { label: 'Dokumente', value: custDocs.length,        color: 'text-slate-600' },
            ].map(k => (
              <div key={k.label} className="text-center p-2 rounded-lg bg-muted/40">
                <p className={cn('text-base font-bold', k.color)}>{k.value}</p>
                <p className="text-[10px] text-muted-foreground">{k.label}</p>
              </div>
            ))}
          </div>
          {custContracts.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Verträge</p>
              <div className="space-y-1.5">
                {custContracts.slice(0, 5).map(c => {
                  const days = daysUntil(c.end_date)
                  return (
                    <button key={c.id} onClick={() => navigate(`/vertraege`)} className="w-full flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-xs transition-colors text-left">
                      <span className={cn('w-1.5 h-5 rounded-full flex-shrink-0', {
                        'bg-emerald-400': c.status === 'active',
                        'bg-orange-400':  c.status === 'renewal_due',
                        'bg-red-400':     ['expired','cancelled'].includes(c.status),
                        'bg-slate-300':   true,
                      })} />
                      <span className="font-medium flex-1 truncate">{c.insurer} · {c.sparte || c.insurance_type}</span>
                      {c.end_date && <span className={cn('flex-shrink-0', urgencyColor(days))}>{fmtDate(c.end_date)}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {custTasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Offene Aufgaben</p>
              <div className="space-y-1">
                {custTasks.slice(0, 3).map(t => (
                  <button key={t.id} onClick={() => navigate('/aufgaben')} className="w-full flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100 hover:bg-amber-100 text-xs transition-colors text-left">
                    <CheckSquare className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span className="truncate">{t.title}</span>
                    {t.due_date && <span className={cn('ml-auto flex-shrink-0', urgencyColor(daysUntil(t.due_date)))}>{fmtDate(t.due_date)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── MASTER CONTROL DASHBOARD ──────────────────────────────────────────────────
export default function MasterControlDashboard({ data, onTaskClick }) {
  const navigate = useNavigate()
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const { tasks = [], contracts = [], documents = [], customers = [] } = data
  const openTasks = data.openTasks || []

  const overdueCount = openTasks.filter(t => t.due_date && daysUntil(t.due_date) <= 0).length
  const todayCount   = openTasks.filter(t => t.due_date === new Date().toISOString().slice(0, 10)).length
  const urgentContractCount = data.expiringContracts.filter(c => {
    const d = daysUntil(c.end_date)
    return d !== null && d <= 14
  }).length

  const adminOpen    = openTasks.filter(t => !CONTRACT_TASK_TYPES.has(t.task_type)).length
  const contractOpen = openTasks.filter(t =>  CONTRACT_TASK_TYPES.has(t.task_type)).length

  return (
    <div className="space-y-3">

      {/* ① TODAY'S PRIORITY TASKS — highest visual weight */}
      <Section
        title="Heutige Prioritäten"
        icon={Zap}
        accent={{ bar: 'bg-red-500', header: 'bg-red-50/30', border: 'border-red-100 bg-card', icon: 'text-red-500' }}
        defaultOpen={true}
        countBadge={
          (overdueCount + todayCount) > 0
            ? <CountBadge n={overdueCount + todayCount} className="bg-red-100 text-red-700 animate-pulse" />
            : null
        }
      >
        <TodayPriorityTasks openTasks={openTasks} onTaskClick={onTaskClick} customers={customers} />
      </Section>

      {/* ② URGENT CONTRACT WORKFLOWS */}
      <Section
        title="Kritische Vertragsabläufe"
        icon={RefreshCw}
        accent={{ bar: 'bg-orange-500', header: 'bg-orange-50/20', border: 'border-orange-100 bg-card', icon: 'text-orange-500' }}
        defaultOpen={true}
        countBadge={
          urgentContractCount > 0
            ? <CountBadge n={urgentContractCount} className="bg-orange-100 text-orange-700" />
            : <CountBadge n={data.expiringContracts.length} className="bg-muted text-muted-foreground" />
        }
        subtitleBadge={`${data.expiringContracts.length} Abläufe / 90 Tage`}
      >
        <UrgentContracts expiringContracts={data.expiringContracts} onContractSelect={(c) => c.customer_id && navigate(`/kunden/${c.customer_id}`)} />
      </Section>

      {/* ③ CUSTOMER ACTIONS */}
      <Section
        title="Kundenmassnahmen"
        icon={Users}
        accent={{ bar: 'bg-violet-500', header: 'bg-violet-50/10', border: 'border-border bg-card', icon: 'text-violet-500' }}
        defaultOpen={true}
        countBadge={
          (data.customersWithCriticalGaps.length + data.contractsWithoutDoc) > 0
            ? <CountBadge n={data.customersWithCriticalGaps.length + data.contractsWithoutDoc} className="bg-violet-100 text-violet-700" />
            : null
        }
      >
        <CustomerActionItems data={data} onCustomerSelect={setSelectedCustomer} />
      </Section>

      {/* ④ ALL TASKS SPLIT */}
      <Section
        title="Alle offenen Aufgaben"
        icon={CheckSquare}
        accent={{ bar: 'bg-blue-400', border: 'border-border bg-card', icon: 'text-blue-500' }}
        defaultOpen={false}
        countBadge={
          openTasks.length > 0
            ? <span className="flex gap-1.5 items-center">
                <CountBadge n={adminOpen} className="bg-blue-100 text-blue-700" />
                <CountBadge n={contractOpen} className="bg-orange-100 text-orange-700" />
              </span>
            : null
        }
      >
        <AllTasksSplit openTasks={openTasks} onTaskClick={onTaskClick} customers={customers} />
      </Section>

      {/* ⑤ SALES & PIPELINE */}
      <Section
        title="Sales & Pipeline"
        icon={TrendingUp}
        accent={{ bar: 'bg-emerald-500', border: 'border-border bg-card', icon: 'text-emerald-500' }}
        defaultOpen={false}
      >
        <SalesPipelineSummary data={data} />
      </Section>

      {/* ⑥ KPI STRIP — compact, lowest visual weight */}
      <Section
        title="Executive KPIs"
        icon={Activity}
        accent={{ bar: 'bg-slate-400', border: 'border-border bg-card', icon: 'text-muted-foreground' }}
        defaultOpen={false}
        subtitleBadge="Überblick"
      >
        <CompactKpiStrip data={data} />
      </Section>

      {/* Customer Quick View */}
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