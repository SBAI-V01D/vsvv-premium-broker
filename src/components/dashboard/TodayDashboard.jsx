/**
 * TodayDashboard — fokussiertes Tages-Cockpit
 * Zeigt NUR: Was bringt heute Umsatz?
 * Keine Statistiken, keine Analysecharts, keine Komplexität.
 */
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { cn } from '@/lib/utils'
import { format, parseISO, isToday, isBefore, differenceInDays } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  CheckSquare, TrendingUp, Users, Phone, Clock, AlertTriangle,
  ArrowRight, Plus, Star, Trophy, Target, RefreshCw, CalendarClock,
  ChevronRight, Circle, CheckCircle2, Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import BestandsmanagementPanel from './BestandsmanagementPanel'

// ── Helpers ─────────────────────────────────────────────────────────────────
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null

const urgencyStyle = (days) => {
  if (days === null) return { bg: 'bg-muted/40', border: 'border-border', text: 'text-muted-foreground', badge: '' }
  if (days <= 0)  return { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', badge: 'bg-red-600 text-white' }
  if (days <= 3)  return { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', badge: 'bg-orange-500 text-white' }
  if (days <= 7)  return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-400 text-white' }
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
      className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer hover:shadow-sm transition-all group', style.bg, style.border)}
      onClick={() => onOpen(task)}
    >
      <button
        onClick={handleComplete}
        disabled={completing}
        className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
          completing ? 'border-green-400 bg-green-400' : 'border-muted-foreground/40 hover:border-green-500 group-hover:border-green-400'
        )}
      >
        {completing && <CheckCircle2 className="w-3 h-3 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold truncate', style.text)}>{task.title}</p>
        {task.customer_name && <p className="text-xs text-muted-foreground truncate">{task.customer_name}</p>}
      </div>
      {days !== null && (
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', style.badge)}>
          {days <= 0 ? `+${Math.abs(days)}d` : days === 0 ? 'Heute' : `${days}d`}
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
      className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer hover:shadow-sm transition-all', style.bg, style.border)}
      onClick={() => onClick(vs)}
    >
      <div className={cn('w-2 h-8 rounded-full flex-shrink-0',
        vs.status === 'gewonnen' ? 'bg-green-500' :
        vs.status === 'kunde_entscheidet' ? 'bg-orange-500' :
        vs.status === 'offerten_erhalten' ? 'bg-violet-500' :
        vs.status === 'in_ausschreibung' ? 'bg-blue-500' : 'bg-slate-300'
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{vs.customer_name}</p>
          {vs.estimated_value > 0 && (
            <span className="text-xs text-emerald-700 font-bold flex-shrink-0">CHF {vs.estimated_value.toLocaleString('de-CH')}</span>
          )}
        </div>
        <p className="text-xs text-primary font-medium truncate">→ {VS_NEXT[vs.status] || vs.status}</p>
        {offerten > 0 && <p className="text-[10px] text-muted-foreground">{offerten} Offerte(n) erhalten</p>}
      </div>
      {days !== null && Math.abs(days) <= 14 && (
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', style.badge)}>
          {days <= 0 ? 'Heute' : `${days}d`}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100" />
    </div>
  )
}

// ── Section ──────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, iconColor, count, urgentCount, children, cta, empty, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-bold flex-1">{title}</span>
        {urgentCount > 0 && (
          <span className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded-full font-bold">{urgentCount} dringend</span>
        )}
        {count > 0 && !urgentCount && (
          <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded-full font-medium">{count}</span>
        )}
        <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="px-5 pb-4">
          {children || (
            <div className="py-4 text-center text-sm text-muted-foreground">{empty || 'Alles erledigt ✓'}</div>
          )}
          {cta && (
            <div className="mt-3">
              {cta}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function TodayDashboard({ openTasks, expiringContracts, contracts = [], activeLeads, verkaufschancen, tasks = [], onTaskClick, onTaskComplete }) {
  const navigate = useNavigate()
  const today = new Date()

  // Aufgaben nach Priorität sortieren
  const urgentTasks = useMemo(() => openTasks
    .filter(t => {
      const d = daysUntil(t.due_date)
      return (d !== null && d <= 3) || t.priority === 'urgent' || t.priority === 'high'
    })
    .sort((a, b) => (daysUntil(a.due_date) ?? 999) - (daysUntil(b.due_date) ?? 999))
    .slice(0, 8),
    [openTasks]
  )

  const laterTasks = useMemo(() => openTasks
    .filter(t => {
      const d = daysUntil(t.due_date)
      return d === null || d > 3
    })
    .filter(t => t.priority !== 'urgent' && t.priority !== 'high')
    .sort((a, b) => (daysUntil(a.due_date) ?? 999) - (daysUntil(b.due_date) ?? 999))
    .slice(0, 5),
    [openTasks]
  )

  // Wiedervorlagen heute
  const wiedervorlagen = useMemo(() => verkaufschancen.filter(v => {
    if (!v.wiedervorlage_date || ['gewonnen', 'verloren'].includes(v.status)) return false
    try {
      const d = parseISO(v.wiedervorlage_date)
      return isToday(d) || isBefore(d, today)
    } catch { return false }
  }), [verkaufschancen])

  // Chancen die jetzt Aktion brauchen
  const actionableVs = useMemo(() => verkaufschancen
    .filter(v => ['offerten_erhalten', 'kunde_entscheidet', 'beratung_erfolgt'].includes(v.status))
    .sort((a, b) => (daysUntil(a.expected_close_date) ?? 999) - (daysUntil(b.expected_close_date) ?? 999))
    .slice(0, 6),
    [verkaufschancen]
  )

  // Hot Leads
  const hotLeads = useMemo(() => activeLeads
    .filter(l => l.status === 'qualified' || (l.lead_score || 0) >= 60)
    .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
    .slice(0, 4),
    [activeLeads]
  )

  const overdueCount = urgentTasks.filter(t => daysUntil(t.due_date) !== null && daysUntil(t.due_date) <= 0).length
  const totalUrgent = overdueCount + wiedervorlagen.length

  return (
    <div className="space-y-3">

      {/* ── Tages-Zusammenfassung ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Offene Aufgaben',    value: openTasks.length,          color: 'text-amber-600',  bg: 'bg-amber-50',   path: '/aufgaben',          icon: CheckSquare },
          { label: 'Verkaufschancen',    value: verkaufschancen.filter(v => !['gewonnen','verloren'].includes(v.status)).length, color: 'text-blue-600', bg: 'bg-blue-50', path: '/verkaufschancen', icon: TrendingUp },
          { label: 'Neue Leads',         value: activeLeads.filter(l => l.status === 'new').length, color: 'text-violet-600', bg: 'bg-violet-50', path: '/leads', icon: Target },
          { label: 'Verträge ablaufend', value: expiringContracts.length,   color: expiringContracts.length > 0 ? 'text-red-600' : 'text-muted-foreground', bg: expiringContracts.length > 0 ? 'bg-red-50' : 'bg-muted', path: '/vertraege', icon: RefreshCw },
        ].map(k => (
          <button
            key={k.label}
            onClick={() => navigate(k.path)}
            className={cn('flex items-center gap-3 p-3 rounded-xl border border-border hover:shadow-sm transition-all text-left', k.bg)}
          >
            <k.icon className={cn('w-5 h-5 flex-shrink-0', k.color)} />
            <div className="min-w-0">
              <p className={cn('text-2xl font-black leading-none', k.color)}>{k.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{k.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Wiedervorlagen HEUTE ─────────────────────────────────────────── */}
      {wiedervorlagen.length > 0 && (
        <div className="rounded-2xl border-2 border-orange-400 bg-orange-50 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white">
            <CalendarClock className="w-4 h-4" />
            <span className="text-sm font-bold">⚡ Wiedervorlagen heute / überfällig</span>
            <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">{wiedervorlagen.length}</span>
          </div>
          <div className="p-4 space-y-2">
            {wiedervorlagen.map(vs => (
              <VsRow key={vs.id} vs={vs} onClick={() => navigate('/verkaufschancen')} />
            ))}
          </div>
        </div>
      )}

      {/* ── Vertragsabläufe / Bestandsmanagement ────────────────────────── */}
      <BestandsmanagementPanel
        contracts={contracts}
        tasks={openTasks}
        verkaufschancen={verkaufschancen}
      />

      {/* ── Dringende Aufgaben ───────────────────────────────────────────── */}
      <Section
        title="Aufgaben"
        icon={CheckSquare}
        iconColor="bg-amber-100 text-amber-600"
        count={openTasks.length}
        urgentCount={overdueCount}
        cta={
          <div className="flex items-center justify-between">
            {openTasks.length > urgentTasks.length + laterTasks.length && (
              <span className="text-xs text-muted-foreground">+{openTasks.length - urgentTasks.length - laterTasks.length} weitere</span>
            )}
            <button onClick={() => navigate('/aufgaben')} className="flex items-center gap-1 text-xs text-primary hover:underline font-medium ml-auto">
              <ArrowRight className="w-3 h-3" /> Alle Aufgaben
            </button>
          </div>
        }
      >
        {urgentTasks.length === 0 && laterTasks.length === 0 ? null : (
          <div className="space-y-2">
            {urgentTasks.map(t => (
              <TaskRow key={t.id} task={t} onComplete={onTaskComplete} onOpen={onTaskClick} />
            ))}
            {laterTasks.length > 0 && urgentTasks.length > 0 && (
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest pt-1 pb-0.5 font-semibold">Weitere</p>
            )}
            {laterTasks.map(t => (
              <TaskRow key={t.id} task={t} onComplete={onTaskComplete} onOpen={onTaskClick} />
            ))}
          </div>
        )}
      </Section>

      {/* ── Verkaufschancen mit Handlungsbedarf ─────────────────────────── */}
      {actionableVs.length > 0 && (
        <Section
          title="Verkaufschancen — Jetzt handeln"
          icon={TrendingUp}
          iconColor="bg-blue-100 text-blue-600"
          count={actionableVs.length}
          cta={
            <button onClick={() => navigate('/verkaufschancen')} className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
              <ArrowRight className="w-3 h-3" /> Alle Verkaufschancen
            </button>
          }
        >
          <div className="space-y-2">
            {actionableVs.map(vs => (
              <VsRow key={vs.id} vs={vs} onClick={() => navigate('/verkaufschancen')} />
            ))}
          </div>
        </Section>
      )}



      {/* ── Heiße Leads ─────────────────────────────────────────────────── */}
      {hotLeads.length > 0 && (
        <Section
          title="Hot Leads"
          icon={Target}
          iconColor="bg-violet-100 text-violet-600"
          count={hotLeads.length}
          cta={
            <button onClick={() => navigate('/leads')} className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
              <ArrowRight className="w-3 h-3" /> Alle Leads
            </button>
          }
        >
          <div className="space-y-2">
            {hotLeads.map(l => (
              <button
                key={l.id}
                onClick={() => navigate('/leads')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-violet-100 bg-violet-50/30 hover:shadow-sm transition-all text-left"
              >
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center font-bold text-violet-700 text-xs flex-shrink-0">
                  {l.first_name?.[0]}{l.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{l.first_name} {l.last_name}</p>
                  <p className="text-xs text-muted-foreground">{l.status === 'qualified' ? '🔥 Qualifiziert' : '→ Kontaktieren'}</p>
                </div>
                {l.lead_score > 0 && (
                  <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full flex-shrink-0">{l.lead_score}%</span>
                )}
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Alle erledigt State */}
      {totalUrgent === 0 && openTasks.length === 0 && actionableVs.length === 0 && expiringContracts.length === 0 && (
        <div className="py-12 text-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/30">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
          <p className="text-lg font-bold text-emerald-700">Alles unter Kontrolle!</p>
          <p className="text-sm text-emerald-600 mt-1">Keine dringenden Aufgaben heute.</p>
          <Button className="mt-4 gap-2" onClick={() => navigate('/verkaufschancen')}>
            <Plus className="w-4 h-4" /> Neue Verkaufschance erfassen
          </Button>
        </div>
      )}

    </div>
  )
}