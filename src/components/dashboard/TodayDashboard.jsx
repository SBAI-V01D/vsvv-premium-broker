/**
 * TodayDashboard — fokussiertes Tages-Cockpit
 * Zeigt NUR: Was bringt heute Umsatz?
 * Keine Statistiken, keine Analysecharts, keine Komplexität.
 */
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { parseISO, isToday, isBefore } from 'date-fns'
import {
  CheckSquare, TrendingUp, Target, RefreshCw, CalendarClock,
  ChevronRight, CheckCircle2, ArrowRight, Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import BestandsmanagementPanel from './BestandsmanagementPanel'

// ── Helpers ─────────────────────────────────────────────────────────────────
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null

const urgencyStyle = (days) => {
  if (days === null) return { bg: 'bg-card', border: 'border-border', text: 'text-muted-foreground', badge: '' }
  if (days <= 0)  return { bg: 'bg-rose-50/60', border: 'border-rose-200', text: 'text-rose-800', badge: 'bg-rose-500 text-white' }
  if (days <= 3)  return { bg: 'bg-amber-50/60', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-500 text-white' }
  if (days <= 7)  return { bg: 'bg-amber-50/30', border: 'border-amber-200/60', text: 'text-amber-700', badge: 'bg-amber-400/80 text-white' }
  return { bg: 'bg-card', border: 'border-border', text: 'text-foreground', badge: 'bg-slate-200 text-slate-600' }
}

// ── Aufgaben-Zeile ───────────────────────────────────────────────────────────
function TaskRow({ task, onComplete, onOpen }) {
  const days = daysUntil(task.due_date)
  const style = urgencyStyle(days)
  const [completing, setCompleting] = useState(false)

  const handleComplete = async (e) => {
    e.stopPropagation()
    setCompleting(true)
    await onComplete(task.id)
    setCompleting(false)
  }

  return (
    <div
      className={cn('flex items-center gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer hover:shadow-xs transition-all group', style.bg, style.border)}
      onClick={() => onOpen(task)}
    >
      <button
        onClick={handleComplete}
        disabled={completing}
        className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
          completing ? 'border-emerald-400 bg-emerald-400' : 'border-muted-foreground/30 hover:border-emerald-500 group-hover:border-emerald-400'
        )}
      >
        {completing && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[12.5px] font-semibold truncate', style.text)}>{task.title}</p>
        {task.customer_name && <p className="text-[11px] text-muted-foreground truncate">{task.customer_name}</p>}
      </div>
      {days !== null && (
        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0', style.badge)}>
          {days <= 0 ? `+${Math.abs(days)}d` : `${days}d`}
        </span>
      )}
    </div>
  )
}

// ── Verkaufschance-Zeile ────────────────────────────────────────────────────
const VS_NEXT = {
  neu: 'Gesellschaften anfragen',
  in_ausschreibung: 'Offerten einfordern',
  offerten_erhalten: 'Vergleich & Beratung',
  beratung_erfolgt: 'Entscheid abwarten',
  kunde_entscheidet: 'Kunden nachfassen',
  gewonnen: 'Vertrag erstellen',
  wiedervorlage: 'Wiedervorlage prüfen',
}

function VsRow({ vs, onClick }) {
  const isWv = vs.status === 'wiedervorlage' && vs.wiedervorlage_date
  const days = isWv ? daysUntil(vs.wiedervorlage_date) : daysUntil(vs.expected_close_date)
  const style = urgencyStyle(days)
  const gesellschaften = vs.gesellschaften || []
  const offerten = gesellschaften.filter(g => g.praemie_yearly).length

  return (
    <div
      className={cn('flex items-center gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer hover:shadow-xs transition-all group', style.bg, style.border)}
      onClick={() => onClick(vs)}
    >
      <div className={cn('w-1 h-7 rounded-full flex-shrink-0',
        vs.status === 'gewonnen' ? 'bg-emerald-400' :
        vs.status === 'kunde_entscheidet' ? 'bg-amber-500' :
        vs.status === 'offerten_erhalten' ? 'bg-violet-400' :
        vs.status === 'in_ausschreibung' ? 'bg-blue-400' : 'bg-slate-300'
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[12.5px] font-semibold truncate">{vs.customer_name}</p>
          {vs.estimated_value > 0 && (
            <span className="text-[11px] text-emerald-700 font-bold flex-shrink-0">CHF {vs.estimated_value.toLocaleString('de-CH')}</span>
          )}
        </div>
        <p className="text-[11px] text-primary/80 font-medium truncate">{VS_NEXT[vs.status] || vs.status}</p>
        {offerten > 0 && <p className="text-[10px] text-muted-foreground">{offerten} Offerte(n)</p>}
      </div>
      {days !== null && Math.abs(days) <= 14 && (
        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0', style.badge)}>
          {days <= 0 ? 'Heute' : `${days}d`}
        </span>
      )}
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0 group-hover:text-muted-foreground transition-colors" />
    </div>
  )
}

// ── Section ──────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, iconColor, count, urgentCount, children, cta, empty, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', iconColor)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[13px] font-bold flex-1">{title}</span>
        {urgentCount > 0 && (
          <span className="text-[9px] px-2 py-0.5 bg-rose-500 text-white rounded-full font-bold">{urgentCount} dringend</span>
        )}
        {count > 0 && !urgentCount && (
          <span className="text-[9px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full font-medium">{count}</span>
        )}
        <ChevronRight className={cn('w-3.5 h-3.5 text-muted-foreground/60 transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="px-4 pb-3.5">
          {children || (
            <div className="py-4 text-center text-[12px] text-muted-foreground">{empty || 'Alles erledigt ✓'}</div>
          )}
          {cta && <div className="mt-2.5">{cta}</div>}
        </div>
      )}
    </div>
  )
}

const TASK_FILTERS = [
  { key: 'all',      label: 'Alle' },
  { key: 'overdue',  label: 'Überfällig' },
  { key: 'today',    label: 'Heute' },
  { key: 'week',     label: 'Diese Woche' },
  { key: 'later',    label: 'Später' },
]

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function TodayDashboard({ openTasks, expiringContracts, contracts = [], activeLeads, verkaufschancen, tasks = [], onTaskClick, onTaskComplete }) {
  const navigate = useNavigate()
  const today = new Date()
  const [taskFilter, setTaskFilter] = useState('all')

  // Wiedervorlagen heute
  const wiedervorlagen = useMemo(() => verkaufschancen.filter(v => {
    if (!v.wiedervorlage_date || ['gewonnen', 'verloren'].includes(v.status)) return false
    try {
      const d = parseISO(v.wiedervorlage_date)
      return isToday(d) || isBefore(d, today)
    } catch { return false }
  }), [verkaufschancen])

  // Alle aktiven Verkaufschancen
  const actionableVs = useMemo(() => verkaufschancen
    .filter(v => !['gewonnen', 'verloren'].includes(v.status))
    .sort((a, b) => (daysUntil(a.expected_close_date) ?? 999) - (daysUntil(b.expected_close_date) ?? 999)),
    [verkaufschancen]
  )

  // Hot Leads
  const hotLeads = useMemo(() => activeLeads
    .filter(l => l.status === 'qualified' || (l.lead_score || 0) >= 60)
    .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
    .slice(0, 4),
    [activeLeads]
  )

  const newLeadsCount = activeLeads.filter(l => l.status === 'new').length

  // Aufgaben sortiert nach Fälligkeit
  const sortedTasks = useMemo(() =>
    [...openTasks].sort((a, b) => (daysUntil(a.due_date) ?? 999) - (daysUntil(b.due_date) ?? 999)),
    [openTasks]
  )

  // Aufgaben-Filter
  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return sortedTasks
    if (taskFilter === 'overdue') return sortedTasks.filter(t => { const d = daysUntil(t.due_date); return d !== null && d <= 0 })
    if (taskFilter === 'today') return sortedTasks.filter(t => { const d = daysUntil(t.due_date); return d !== null && d === 0 })
    if (taskFilter === 'week') return sortedTasks.filter(t => { const d = daysUntil(t.due_date); return d !== null && d > 0 && d <= 7 })
    if (taskFilter === 'later') return sortedTasks.filter(t => { const d = daysUntil(t.due_date); return d === null || d > 7 })
    return sortedTasks
  }, [sortedTasks, taskFilter])

  // Counts für Task-Filter-Badges
  const taskCounts = useMemo(() => ({
    all:     sortedTasks.length,
    overdue: sortedTasks.filter(t => { const d = daysUntil(t.due_date); return d !== null && d <= 0 }).length,
    today:   sortedTasks.filter(t => { const d = daysUntil(t.due_date); return d !== null && d === 0 }).length,
    week:    sortedTasks.filter(t => { const d = daysUntil(t.due_date); return d !== null && d > 0 && d <= 7 }).length,
    later:   sortedTasks.filter(t => { const d = daysUntil(t.due_date); return d === null || d > 7 }).length,
  }), [sortedTasks])

  const overdueCount = taskCounts.overdue
  const allEmpty = openTasks.length === 0 && actionableVs.length === 0 && contracts.length === 0

  return (
    <div className="space-y-3">

      {/* ── Tages-Übersicht — monochrome KPIs ────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: 'Tasks', value: openTasks.length, path: '/aufgaben', icon: CheckSquare },
          { label: 'Offerten', value: verkaufschancen.filter(v => !['gewonnen','verloren'].includes(v.status)).length, path: '/verkaufschancen', icon: TrendingUp },
          { label: 'Neu', value: newLeadsCount, path: '/leads', icon: Target },
          { label: 'Abläufe', value: expiringContracts.length, path: '/vertragsablaeufe', icon: RefreshCw },
        ].map(k => (
          <button
            key={k.label}
            onClick={() => navigate(k.path)}
            className="flex flex-col gap-0.5 p-3 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] hover:bg-[hsl(var(--surface-2))] transition-colors text-left"
          >
            <k.icon className="w-3.5 h-3.5 text-[hsl(var(--text-muted))]" />
            <p className="text-[20px] font-bold text-[hsl(var(--text-heading))] leading-none">{k.value}</p>
            <p className="text-[10px] text-[hsl(var(--text-muted))]">{k.label}</p>
          </button>
        ))}
      </div>

      {/* Wiedervorlagen — nur wenn kritisch */}
      {wiedervorlagen.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-subheading text-[hsl(var(--text-heading))]">Wiedervorlagen</h3>
            <span className="text-body-sm text-[hsl(var(--text-muted))]">{wiedervorlagen.length}</span>
          </div>
          <div className="space-y-1.5">
            {wiedervorlagen.map(vs => (
              <VsRow key={vs.id} vs={vs} onClick={() => navigate('/verkaufschancen')} />
            ))}
          </div>
        </div>
      )}

      {/* ── Sections — unified structure ─────────────────────────────────── */}
      <div className="space-y-6">
        {/* 1. Vertragsabläufe */}
        <BestandsmanagementPanel contracts={contracts} />

        {/* 2. Aufgaben */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-subheading text-[hsl(var(--text-heading))]">Aufgaben</h3>
            <div className="flex gap-1">
              {TASK_FILTERS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setTaskFilter(tab.key)}
                  className={cn(
                    'text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors',
                    taskFilter === tab.key
                      ? 'bg-[hsl(var(--primary))] text-white'
                      : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-3))]'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          {filteredTasks.length === 0 ? (
            <p className="py-6 text-center text-body-sm text-[hsl(var(--text-muted))]">Keine Aufgaben</p>
          ) : (
            <div className="space-y-1.5">
              {filteredTasks.map(t => (
                <TaskRow key={t.id} task={t} onComplete={onTaskComplete} onOpen={onTaskClick} />
              ))}
            </div>
          )}
        </div>

        {/* 3. Verkaufschancen */}
        {actionableVs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-subheading text-[hsl(var(--text-heading))]">Verkaufschancen</h3>
              <button onClick={() => navigate('/verkaufschancen')} className="text-body-sm text-[hsl(var(--primary))] hover:underline">
                Alle →
              </button>
            </div>
            <div className="space-y-1.5">
              {actionableVs.map(vs => (
                <VsRow key={vs.id} vs={vs} onClick={() => navigate('/verkaufschancen')} />
              ))}
            </div>
          </div>
        )}

        {/* 4. Hot Leads */}
        {hotLeads.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-subheading text-[hsl(var(--text-heading))]">Hot Leads</h3>
              <button onClick={() => navigate('/leads')} className="text-body-sm text-[hsl(var(--primary))] hover:underline">
                Alle →
              </button>
            </div>
            <div className="space-y-1.5">
              {hotLeads.map(l => (
                <button
                  key={l.id}
                  onClick={() => navigate('/leads')}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] hover:bg-[hsl(var(--surface-2))] transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-[hsl(var(--primary))/0.1] flex items-center justify-center font-semibold text-[hsl(var(--primary))] text-[11px] flex-shrink-0">
                    {l.first_name?.[0]}{l.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-[hsl(var(--text-heading))] truncate">{l.first_name} {l.last_name}</p>
                    <p className="text-[11px] text-[hsl(var(--text-muted))]">{l.status === 'qualified' ? 'Qualifiziert' : 'Kontaktieren'}</p>
                  </div>
                  {l.lead_score > 0 && (
                    <span className="text-[10px] font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary))/0.1] px-1.5 py-0.5 rounded-md flex-shrink-0">{l.lead_score}%</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}