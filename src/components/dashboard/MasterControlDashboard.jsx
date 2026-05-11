import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Users, Target, TrendingUp, Wallet, RefreshCw, CheckSquare,
  FileWarning, ShieldAlert, ChevronDown, AlertTriangle, Clock,
  ArrowRight, FileText, ListTodo, Activity, Zap, Eye, X,
  CalendarClock, CircleDot, TriangleAlert, CalendarX2, PhoneCall,
  FileCheck, AlertCircle, TrendingDown, Flame, Trophy, Building2
} from 'lucide-react'
import VerkaufschancenWidget from './VerkaufschancenWidget'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
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
  if (days === null) return 'bg-background border-border'
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

// ── Task Kategorisierung ──────────────────────────────────────────────────────
// Vertrags-Workflow: fristenkritisch, umsatzkritisch
const CONTRACT_WORKFLOW_TYPES = new Set(['renewal', 'health_declaration'])
const CONTRACT_TASK_TYPES = CONTRACT_WORKFLOW_TYPES // alias for backwards compat

const isContractWorkflowTask = (t) => {
  if (CONTRACT_WORKFLOW_TYPES.has(t.task_type)) return true
  const title = (t.title || '').toLowerCase()
  return (
    title.includes('vertrag') ||
    title.includes('police') ||
    title.includes('verlänger') ||
    title.includes('kündigung') ||
    title.includes('offert') ||
    title.includes('mutation') ||
    title.includes('ablauf')
  )
}

const isFollowUpTask = (t) => {
  if (t.task_type === 'follow_up' || t.task_type === 'consultation') return true
  const title = (t.title || '').toLowerCase()
  return title.includes('rückruf') || title.includes('follow') || title.includes('angebot nachfass') || title.includes('kontakt')
}

const getActionLabel = (t) => {
  if (t.task_type === 'renewal')            return 'Verlängerung prüfen'
  if (t.task_type === 'health_declaration') return 'Gesundheitserklärung einholen'
  if (t.task_type === 'follow_up')          return 'Follow-up durchführen'
  if (t.task_type === 'consultation')       return 'Beratungsgespräch vorbereiten'
  if (t.task_type === 'onboarding')         return 'Kunden onboarden'
  if (t.priority === 'urgent')              return 'Sofort handeln'
  if (t.priority === 'high')               return 'Rückruf erforderlich'
  const title = (t.title || '').toLowerCase()
  if (title.includes('kündigung') || title.includes('kündigen')) return 'Kündigung bearbeiten'
  if (title.includes('offert') || title.includes('angebot'))     return 'Offerte nachfassen'
  if (title.includes('vertrag'))                                  return 'Vertrag prüfen'
  if (title.includes('rückruf') || title.includes('call'))        return 'Rückruf tätigen'
  if (title.includes('verlänger'))                                return 'Verlängerung vorbereiten'
  if (title.includes('mutation'))                                 return 'Mutation bearbeiten'
  return 'Aufgabe erledigen'
}

// ── Vertrags-Workflow Tasks (operativ kritisch, volle Karten-Optik) ────────────
function ContractWorkflowTasks({ tasks, onTaskClick }) {
  const navigate = useNavigate()

  const sorted = [...tasks].sort((a, b) => {
    const da = daysUntil(a.due_date) ?? 999
    const db = daysUntil(b.due_date) ?? 999
    const pa = { urgent: 0, high: 1, medium: 2, low: 3 }[a.priority] ?? 2
    const pb = { urgent: 0, high: 1, medium: 2, low: 3 }[b.priority] ?? 2
    return (da + pa * 10) - (db + pb * 10)
  })

  if (sorted.length === 0) {
    return (
      <div className="flex items-center gap-2.5 py-3 px-3 bg-emerald-50 rounded-lg border border-emerald-100">
        <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-sm font-medium text-emerald-700">Keine offenen Vertragsaufgaben ✓</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sorted.map(t => {
        const days = daysUntil(t.due_date)
        const isOverdue = days !== null && days <= 0
        const isUrgent = isOverdue || t.priority === 'urgent'
        const isSoon = !isUrgent && (days !== null && days <= 7 || t.priority === 'high')
        const actionLabel = getActionLabel(t)

        return (
          <button
            key={t.id}
            onClick={() => onTaskClick(t)}
            className={cn(
              'w-full flex items-center gap-4 px-4 py-3 rounded-xl border-2 text-left transition-all',
              isUrgent ? 'bg-red-50 border-red-400 hover:border-red-500 hover:shadow-lg hover:shadow-red-100' :
              isSoon   ? 'bg-orange-50 border-orange-300 hover:border-orange-400 hover:shadow-md' :
                         'bg-amber-50/60 border-amber-200 hover:border-amber-300 hover:shadow-sm'
            )}
          >
            {/* Countdown box — gleiches Format wie Kündigungstermine */}
            <div className={cn(
              'flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center border-2 select-none',
              isUrgent && isOverdue ? 'bg-red-600 border-red-700 text-white' :
              isUrgent              ? 'bg-red-100 border-red-400 text-red-700' :
              isSoon                ? 'bg-orange-100 border-orange-300 text-orange-700' :
                                     'bg-amber-50 border-amber-300 text-amber-700'
            )}>
              {days === null ? (
                <><CheckSquare className="w-5 h-5" /></>
              ) : isOverdue ? (
                <>
                  <span className="text-base font-black leading-none">{Math.abs(days)}</span>
                  <span className="text-[8px] font-bold uppercase leading-none mt-0.5 text-center px-0.5">ÜBER<br/>FÄLLIG</span>
                </>
              ) : days === 0 ? (
                <>
                  <AlertCircle className="w-5 h-5 mb-0.5" />
                  <span className="text-[9px] font-black uppercase leading-none">HEUTE</span>
                </>
              ) : (
                <>
                  <span className="text-xl font-black leading-none">{days}</span>
                  <span className="text-[9px] font-bold uppercase leading-none mt-0.5">Tage</span>
                </>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={cn('text-sm font-bold truncate leading-tight flex-1',
                  isUrgent ? 'text-red-900' : isSoon ? 'text-orange-900' : 'text-amber-900'
                )}>{t.title}</p>
                <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0',
                  isUrgent ? 'bg-red-700 text-white' : isSoon ? 'bg-orange-600 text-white' : 'bg-amber-500 text-white'
                )}>VERTRAG</span>
              </div>
              <p className={cn('text-xs mt-0.5 font-semibold',
                isUrgent ? 'text-red-700' : isSoon ? 'text-orange-700' : 'text-amber-700'
              )}>→ {actionLabel}</p>
              {t.customer_name
                ? <p className={cn('text-[11px] font-semibold mt-1',
                    isUrgent ? 'text-red-600' : isSoon ? 'text-orange-600' : 'text-amber-600'
                  )}>👤 {t.customer_name}</p>
                : <p className="text-[10px] text-slate-400 italic mt-1">Kein Kunde verknüpft</p>
              }
            </div>
          </button>
        )
      })}
      <button onClick={() => navigate('/aufgaben')} className="flex items-center gap-1.5 text-xs text-primary hover:underline pt-1 font-medium">
        <ArrowRight className="w-3 h-3" /> Alle Aufgaben öffnen
      </button>
    </div>
  )
}

// ── Follow-Up Tasks (orange, wichtige Tagesaktionen) ─────────────────────────
function FollowUpTasks({ tasks, onTaskClick }) {
  const navigate = useNavigate()
  const sorted = [...tasks].sort((a, b) => (daysUntil(a.due_date) ?? 999) - (daysUntil(b.due_date) ?? 999))

  return (
    <div className="space-y-1.5">
      {sorted.map(t => {
        const days = daysUntil(t.due_date)
        const isOverdue = days !== null && days <= 0
        const isToday = days === 0
        const actionLabel = getActionLabel(t)
        return (
          <button
            key={t.id}
            onClick={() => onTaskClick(t)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all hover:shadow-sm',
              isOverdue ? 'bg-red-50 border-red-200' :
              isToday   ? 'bg-orange-50 border-orange-300' :
              'bg-orange-50/30 border-orange-100 hover:border-orange-200'
            )}
          >
            <span className={cn('w-1 h-6 rounded-full flex-shrink-0',
              isOverdue ? 'bg-red-500' : isToday ? 'bg-orange-500' : 'bg-orange-300'
            )} />
            <div className="flex-1 min-w-0">
              <p className={cn('text-xs font-semibold truncate',
                isOverdue ? 'text-red-800' : 'text-orange-900'
              )}>{t.title}</p>
              <p className="text-[10px] text-orange-700 font-medium">→ {actionLabel}</p>
              {t.customer_name && <p className="text-[10px] text-muted-foreground truncate">{t.customer_name}</p>}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[8px] px-1 py-0.5 bg-orange-100 text-orange-700 rounded font-bold">FOLLOW-UP</span>
              {days !== null && (
                <span className={cn('text-[10px] font-bold',
                  isOverdue ? 'text-red-600' : days <= 3 ? 'text-orange-600' : 'text-slate-400'
                )}>
                  {isOverdue ? `+${Math.abs(days)}d` : isToday ? 'HEUTE' : `${days}d`}
                </span>
              )}
            </div>
          </button>
        )
      })}
      <button onClick={() => navigate('/aufgaben')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline pt-0.5">
        <ArrowRight className="w-3 h-3" /> Alle Aufgaben öffnen
      </button>
    </div>
  )
}

// ── Administrative Tasks (kompakt, grau, ruhig) ───────────────────────────────
function AdminTasksCompact({ tasks, onTaskClick }) {
  const navigate = useNavigate()
  const sorted = [...tasks].sort((a, b) => (daysUntil(a.due_date) ?? 999) - (daysUntil(b.due_date) ?? 999))

  return (
    <div className="space-y-1">
      {sorted.slice(0, 8).map(t => {
        const days = daysUntil(t.due_date)
        const isOverdue = days !== null && days <= 0
        return (
          <button
            key={t.id}
            onClick={() => onTaskClick(t)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all',
              isOverdue ? 'bg-red-50 border-red-100 hover:border-red-200' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
            )}
          >
            <span className={cn('w-1 h-5 rounded-full flex-shrink-0', isOverdue ? 'bg-red-400' : 'bg-slate-200')} />
            <div className="flex-1 min-w-0">
              <p className={cn('text-xs truncate', isOverdue ? 'font-semibold text-red-800' : 'text-slate-600')}>{t.title}</p>
              {t.customer_name && <p className="text-[10px] text-muted-foreground truncate">{t.customer_name}</p>}
            </div>
            {days !== null && (
              <span className={cn('text-[10px] font-medium flex-shrink-0', isOverdue ? 'text-red-500' : 'text-slate-400')}>
                {isOverdue ? `+${Math.abs(days)}d` : `${days}d`}
              </span>
            )}
          </button>
        )
      })}
      {tasks.length > 8 && (
        <p className="text-[10px] text-muted-foreground text-center pt-1">+{tasks.length - 8} weitere</p>
      )}
      <button onClick={() => navigate('/aufgaben')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline pt-0.5">
        <ArrowRight className="w-3 h-3" /> Alle Aufgaben öffnen
      </button>
    </div>
  )
}

// ── 1b. KÜNDIGUNGSTERMINE ─────────────────────────────────────────────────────
function KuendigungsTermine({ contracts }) {
  const navigate = useNavigate()
  const today = new Date()

  const termine = contracts
    .filter(c => c.cancellation_deadline && c.status === 'active')
    .map(c => ({ ...c, _days: Math.ceil((new Date(c.cancellation_deadline) - today) / 86400000) }))
    .filter(c => c._days >= -7 && c._days <= 180)
    .sort((a, b) => a._days - b._days)

  if (termine.length === 0) {
    return (
      <div className="flex items-center gap-2.5 py-3 px-3 bg-emerald-50 rounded-lg border border-emerald-100">
        <CalendarX2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-sm font-medium text-emerald-700">Keine Kündigungstermine in den nächsten 180 Tagen ✓</span>
      </div>
    )
  }

  // Action labels based on days remaining
  const getAction = (days) => {
    if (days <= 0)  return { label: 'SOFORT KÜNDIGEN', color: 'bg-red-600 text-white' }
    if (days <= 7)  return { label: 'JETZT HANDELN', color: 'bg-red-500 text-white' }
    if (days <= 30) return { label: 'DRINGEND', color: 'bg-orange-500 text-white' }
    if (days <= 60) return { label: 'IN VORBEREITUNG', color: 'bg-amber-400 text-amber-900' }
    return { label: 'BEOBACHTEN', color: 'bg-slate-100 text-slate-600' }
  }

  return (
    <div className="space-y-2">
      {termine.map(c => {
        const days = c._days
        const action = getAction(days)
        return (
          <button
            key={c.id}
            onClick={() => navigate('/vertraege')}
            className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all hover:shadow-md', urgencyBg(days))}
          >
            {/* Days countdown — prominent */}
            <div className={cn('flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center border-2',
              days <= 0  ? 'bg-red-600 border-red-700 text-white' :
              days <= 7  ? 'bg-red-100 border-red-300 text-red-700' :
              days <= 30 ? 'bg-orange-100 border-orange-300 text-orange-700' :
              'bg-slate-100 border-slate-200 text-slate-600'
            )}>
              <span className="text-lg font-black leading-none">{Math.abs(days)}</span>
              <span className="text-[9px] font-bold uppercase leading-none mt-0.5">{days <= 0 ? 'überfällig' : 'Tage'}</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{c.customer_name || '–'}</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {c.insurer}{c.product ? ` · ${c.product}` : ''}{c.policy_number ? ` · ${c.policy_number}` : ''}
              </p>
              <p className="text-[10px] font-semibold text-slate-500 mt-1">
                Frist: {format(parseISO(c.cancellation_deadline), 'd. MMMM yyyy', { locale: de })}
              </p>
            </div>

            <span className={cn('text-[9px] px-2 py-1 rounded-lg font-bold flex-shrink-0', action.color)}>
              {action.label}
            </span>
          </button>
        )
      })}
      <button onClick={() => navigate('/vertraege')} className="flex items-center gap-1.5 text-xs text-primary hover:underline pt-1 font-medium">
        <ArrowRight className="w-3 h-3" /> Alle Verträge öffnen
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
      <div className="flex items-center gap-2.5 py-3 px-3 bg-emerald-50 rounded-lg border border-emerald-100">
        <RefreshCw className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-sm font-medium text-emerald-700">Keine ablaufenden Verträge in den nächsten 90 Tagen ✓</span>
      </div>
    )
  }

  // Handlungs-Labels statt Status-Labels
  const getNextAction = (c) => {
    const stage = c.renewal_stage || 'early'
    const days = c._days
    if (stage === 'early' && days <= 30)   return { text: '→ Kunde kontaktieren', color: 'text-red-600' }
    if (stage === 'early')                  return { text: '→ Police prüfen', color: 'text-amber-600' }
    if (stage === 'contact')                return { text: '→ Offerte vorbereiten', color: 'text-blue-600' }
    if (stage === 'offer')                  return { text: '→ Offerte nachfassen', color: 'text-violet-600' }
    if (stage === 'negotiation')            return { text: '→ Verhandlung abschliessen', color: 'text-orange-600' }
    return { text: '→ Verlängerung prüfen', color: 'text-slate-500' }
  }

  const stageColors = {
    early:       'bg-slate-100 text-slate-600',
    contact:     'bg-blue-100 text-blue-700',
    offer:       'bg-violet-100 text-violet-700',
    negotiation: 'bg-orange-100 text-orange-700',
  }

  const stageLabels = { early: 'Early', contact: 'Kontakt', offer: 'Angebot', negotiation: 'Verhandlung', renewed: 'Erneuert', lost: 'Verloren' }

  return (
    <div className="space-y-2">
      {urgent.map(c => {
        const days = c._days
        const nextAction = getNextAction(c)
        return (
          <button
            key={c.id}
            onClick={() => onContractSelect?.(c)}
            className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all hover:shadow-md', urgencyBg(days))}
          >
            <div className={cn('flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center border',
              days !== null && days <= 14 ? 'bg-orange-100 border-orange-300 text-orange-700' :
              days !== null && days <= 30 ? 'bg-amber-50 border-amber-200 text-amber-700' :
              'bg-slate-50 border-slate-200 text-slate-500'
            )}>
              <span className="text-base font-black leading-none">{days === null ? '–' : days <= 0 ? '!' : days}</span>
              {days !== null && days > 0 && <span className="text-[9px] font-bold uppercase leading-none mt-0.5">Tage</span>}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{c.customer_name || '–'}</p>
              <p className="text-[11px] text-muted-foreground">{c.insurer} · {c.sparte || c.insurance_type || '–'}</p>
              <p className={cn('text-[11px] font-semibold mt-0.5', nextAction.color)}>{nextAction.text}</p>
            </div>

            <span className={cn('text-[9px] px-1.5 py-1 rounded-lg font-bold flex-shrink-0',
              stageColors[c.renewal_stage || 'early'] || 'bg-slate-100 text-slate-600'
            )}>
              {stageLabels[c.renewal_stage] || 'Early'}
            </span>
          </button>
        )
      })}
      {expiringContracts.length > 8 && (
        <button onClick={() => navigate('/vertraege')} className="flex items-center gap-1.5 text-xs text-primary hover:underline pt-1 font-medium">
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
      <div className="flex items-center gap-2.5 py-3 px-3 bg-emerald-50 rounded-lg border border-emerald-100">
        <Users className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-sm font-medium text-emerald-700">Keine Kundenmassnahmen ausstehend ✓</span>
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
            <span className="text-xs font-semibold truncate block">{c.first_name} {c.last_name}</span>
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
        <button key={k.label} onClick={() => navigate(k.path)}
          className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors border border-transparent hover:border-border text-center">
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

  // Leads with high conversion probability
  const hotLeads = activeLeads.filter(l => (l.lead_score || 0) >= 70).length
  const warmLeads = activeLeads.filter(l => (l.lead_score || 0) >= 40 && (l.lead_score || 0) < 70).length

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Lead Pipeline</p>
        {/* Hot leads highlight */}
        {hotLeads > 0 && (
          <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded-lg mb-2">
            <Flame className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-bold text-emerald-700">{hotLeads} heisse Leads (&gt;70%)</span>
          </div>
        )}
        <div className="space-y-1.5">
          {[
            { label: 'Neu',          count: leadStages.new,       color: 'bg-slate-400' },
            { label: 'Kontaktiert',  count: leadStages.contacted, color: 'bg-blue-400' },
            { label: 'Qualifiziert', count: leadStages.qualified, color: 'bg-violet-500' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-20">{s.label}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', s.color)} style={{ width: `${activeLeads.length > 0 ? (s.count / activeLeads.length) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-bold w-5 text-right">{s.count}</span>
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/leads')} className="flex items-center gap-1 text-xs text-primary mt-3 hover:underline font-medium">
          <ArrowRight className="w-3 h-3" /> Leads öffnen
        </button>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Renewal Pipeline</p>
        {renewalStages.negotiation > 0 && (
          <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-100 rounded-lg mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
            <span className="text-xs font-bold text-orange-700">{renewalStages.negotiation} in Verhandlung</span>
          </div>
        )}
        <div className="space-y-1.5">
          {[
            { label: 'Early',        count: renewalStages.early,       color: 'bg-slate-300' },
            { label: 'Kontakt',      count: renewalStages.contact,     color: 'bg-amber-400' },
            { label: 'Angebot',      count: renewalStages.offer,       color: 'bg-orange-500' },
            { label: 'Verhandlung',  count: renewalStages.negotiation, color: 'bg-red-500' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-20">{s.label}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', s.color)} style={{ width: `${expiringContracts.length > 0 ? (s.count / expiringContracts.length) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-bold w-5 text-right">{s.count}</span>
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/vertraege')} className="flex items-center gap-1 text-xs text-primary mt-3 hover:underline font-medium">
          <ArrowRight className="w-3 h-3" /> Verträge öffnen
        </button>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Intelligence</p>
        <div className="space-y-1.5">
          {[
            { label: 'Coverage-Lücken', value: customersWithCriticalGaps.length, color: 'text-pink-600', path: '/coverage-intelligence' },
            { label: 'Conversion Rate',  value: `${conversionRate}%`,            color: 'text-emerald-600', path: '/leads' },
            { label: 'Aktive Policen',   value: activeContracts.length,           color: 'text-blue-600', path: '/vertraege' },
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
  const custTasks     = tasks.filter(t => t.customer_id === customer.id && ['open', 'in_progress', 'waiting'].includes(t.status))
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
              { label: 'Policen',    value: custContracts.length,  color: 'text-blue-600' },
              { label: 'Prämie/J.', value: fmtChf(totalPremium),  color: 'text-emerald-600' },
              { label: 'Aufgaben',  value: custTasks.length,        color: 'text-amber-600' },
              { label: 'Dokumente', value: custDocs.length,         color: 'text-slate-600' },
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
                    <button key={c.id} onClick={() => navigate('/vertraege')}
                      className="w-full flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-xs transition-colors text-left">
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
                  <button key={t.id} onClick={() => navigate('/aufgaben')}
                    className="w-full flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100 hover:bg-amber-100 text-xs transition-colors text-left">
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

  // Aufgaben nach operativer Kategorie aufteilen
  const contractWorkflowTasks = openTasks.filter(t => isContractWorkflowTask(t))
  const followUpTasks = openTasks.filter(t => !isContractWorkflowTask(t) && isFollowUpTask(t))
  const adminTasks = openTasks.filter(t => !isContractWorkflowTask(t) && !isFollowUpTask(t))

  const urgentContractCount = data.expiringContracts.filter(c => {
    const d = daysUntil(c.end_date)
    return d !== null && d <= 14
  }).length

  const today = new Date()
  const kuendigungsTermine = (contracts || [])
    .filter(c => c.cancellation_deadline && c.status === 'active')
    .map(c => ({ ...c, _days: Math.ceil((new Date(c.cancellation_deadline) - today) / 86400000) }))
    .filter(c => c._days >= -7 && c._days <= 180)
  const kuendigungDringend = kuendigungsTermine.filter(c => c._days <= 30).length

  const urgentWorkflowCount = contractWorkflowTasks.filter(t => {
    const d = daysUntil(t.due_date)
    return (d !== null && d <= 0) || t.priority === 'urgent'
  }).length

  const totalUrgent = kuendigungDringend + urgentContractCount + urgentWorkflowCount

  return (
    <div className="space-y-3">

      {/* ═══════════════════════════════════════════════════════════════════════
          ZONE 1 — KRITISCHER BEREICH: Operatives Führungsinstrument
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 via-orange-50/60 to-amber-50/40 shadow-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-red-800 to-red-600 text-white">
          <TriangleAlert className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black uppercase tracking-widest">⚡ Operative Aufgaben — Tagessteuerung</p>
            <p className="text-[11px] text-red-200 mt-0.5">Risiken · Fristen · Handlungsbedarf</p>
          </div>
          {totalUrgent > 0 ? (
            <div className="flex flex-col items-center bg-white/15 rounded-xl px-3 py-1.5 border border-white/20">
              <span className="text-2xl font-black leading-none">{totalUrgent}</span>
              <span className="text-[10px] text-red-200 font-bold uppercase">dringend</span>
            </div>
          ) : (
            <span className="bg-emerald-500/80 text-white text-xs font-bold px-3 py-1 rounded-full">Alles OK ✓</span>
          )}
        </div>

        <div className="p-4 space-y-3">

          {/* ── BLOCK A: KÜNDIGUNGSTERMINE — höchste Priorität ── */}
          <div className="rounded-xl border-2 border-red-400 bg-white/90 overflow-hidden shadow-md">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-red-300 bg-gradient-to-r from-red-700 to-red-600 text-white">
              <CalendarX2 className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-xs font-black uppercase tracking-widest">Kündigungstermine</span>
                <p className="text-[10px] text-red-200 mt-0.5">Vertragsfristen · nächste 180 Tage</p>
              </div>
              {kuendigungsTermine.length > 0 ? (
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold',
                  kuendigungDringend > 0 ? 'bg-white text-red-700 animate-pulse' : 'bg-red-800/60 text-white'
                )}>
                  {kuendigungDringend > 0 ? `${kuendigungDringend} dringend` : `${kuendigungsTermine.length} total`}
                </span>
              ) : (
                <span className="bg-emerald-500/80 text-white text-xs font-bold px-3 py-1 rounded-full">✓ Klar</span>
              )}
            </div>
            <div className="px-4 py-3">
              <KuendigungsTermine contracts={contracts} />
            </div>
          </div>

          {/* ── BLOCK B: KRITISCHE VERTRAGSABLÄUFE ── */}
          <div className="rounded-xl border-2 border-orange-400 bg-white/90 overflow-hidden shadow-md">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-orange-300 bg-gradient-to-r from-orange-600 to-orange-500 text-white">
              <RefreshCw className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-xs font-black uppercase tracking-widest">Kritische Vertragsabläufe</span>
                <p className="text-[10px] text-orange-100 mt-0.5">Ablaufende Policen · {data.expiringContracts.length} in 90 Tagen</p>
              </div>
              {urgentContractCount > 0 ? (
                <span className="bg-white text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {urgentContractCount} kritisch
                </span>
              ) : (
                <span className="bg-emerald-500/80 text-white text-xs font-bold px-3 py-1 rounded-full">✓ Klar</span>
              )}
            </div>
            <div className="px-4 py-3">
              <UrgentContracts expiringContracts={data.expiringContracts} onContractSelect={(c) => c.customer_id && navigate(`/kunden/${c.customer_id}`)} />
            </div>
          </div>

          {/* ── BLOCK C: VERTRAGS-WORKFLOW AUFGABEN — operativ kritisch ── */}
          <div className="rounded-xl border-2 border-amber-400 bg-white/90 overflow-hidden shadow-md">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-300 bg-gradient-to-r from-amber-600 to-amber-500 text-white">
              <FileCheck className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-xs font-black uppercase tracking-widest">Vertrags-Workflow Aufgaben</span>
                <p className="text-[10px] text-amber-100 mt-0.5">Verlängerung · Mutation · Police · Offerte</p>
              </div>
              {urgentWorkflowCount > 0 ? (
                <span className="bg-white text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {urgentWorkflowCount} dringend
                </span>
              ) : contractWorkflowTasks.length > 0 ? (
                <span className="bg-amber-800/50 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {contractWorkflowTasks.length} offen
                </span>
              ) : (
                <span className="bg-emerald-500/80 text-white text-xs font-bold px-3 py-1 rounded-full">✓ Klar</span>
              )}
            </div>
            <div className="px-4 py-3">
              <ContractWorkflowTasks tasks={contractWorkflowTasks} onTaskClick={onTaskClick} />
            </div>
          </div>

          {/* ── BLOCK D: WICHTIGE TAGESAKTIONEN (Follow-Ups) — ORANGE, offen ── */}
          {followUpTasks.length > 0 && (
            <div className="rounded-xl border-2 border-orange-300 bg-white/90 overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-orange-200 bg-gradient-to-r from-orange-500 to-orange-400 text-white">
                <PhoneCall className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-xs font-black uppercase tracking-widest">Wichtige Tagesaktionen</span>
                  <p className="text-[10px] text-orange-100 mt-0.5">Follow-Ups · Rückrufe · Beratungen · Nachfassungen</p>
                </div>
                <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full border border-white/30">
                  {followUpTasks.length} offen
                </span>
              </div>
              <div className="px-4 py-3">
                <FollowUpTasks tasks={followUpTasks} onTaskClick={onTaskClick} />
              </div>
            </div>
          )}

          {/* ── BLOCK E: ADMINISTRATIVE AUFGABEN — kompakt, grau, eingeklappt ── */}
          {adminTasks.length > 0 && (
            <Section
              title="Administrative Aufgaben"
              icon={ListTodo}
              accent={{ bar: 'bg-slate-200', border: 'border-slate-200 bg-white/60', icon: 'text-slate-400', header: 'bg-slate-50' }}
              defaultOpen={false}
              countBadge={<CountBadge n={adminTasks.length} className="bg-slate-100 text-slate-500" />}
              subtitleBadge="Wiedervorlagen · intern · allgemein"
            >
              <AdminTasksCompact tasks={adminTasks} onTaskClick={onTaskClick} />
            </Section>
          )}

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ZONE 2 — KUNDENMASSNAHMEN
      ═══════════════════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════════════════
          ZONE 3 — SALES & PIPELINE
      ═══════════════════════════════════════════════════════════════════════ */}
      <Section
        title="Sales & Pipeline"
        icon={TrendingUp}
        accent={{ bar: 'bg-emerald-500', border: 'border-border bg-card', icon: 'text-emerald-500' }}
        defaultOpen={false}
      >
        <SalesPipelineSummary data={data} />
      </Section>

      {/* ═══════════════════════════════════════════════════════════════════════
          ZONE 4 — VERKAUFSCHANCEN (eigene Zone, strikt getrennt)
      ═══════════════════════════════════════════════════════════════════════ */}
      <Section
        title="Verkaufschancen & Ausschreibungen"
        icon={TrendingUp}
        accent={{ bar: 'bg-emerald-400', border: 'border-emerald-200 bg-emerald-50/20', icon: 'text-emerald-600' }}
        defaultOpen={true}
        subtitleBadge="Offerte · Pipeline · Abschluss — separat von Verträgen"
      >
        <VerkaufschancenWidget />
      </Section>

      {/* ═══════════════════════════════════════════════════════════════════════
          ZONE 5 — KPIs (kompakt, sekundär)
      ═══════════════════════════════════════════════════════════════════════ */}
      <Section
        title="Executive KPIs"
        icon={Activity}
        accent={{ bar: 'bg-slate-300', border: 'border-border bg-card', icon: 'text-muted-foreground' }}
        defaultOpen={false}
        subtitleBadge="Statistik-Überblick"
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