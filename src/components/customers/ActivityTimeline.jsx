/**
 * ActivityTimeline — Executive Operations Timeline
 * Grouped by date, filterable by type, visually premium.
 */
import React, { useMemo, useState } from 'react'
import {
  Upload, FileText, Shield, Clock, MessageSquare, Zap,
  TrendingUp, CheckCircle2, AlertTriangle, RefreshCw, Star,
  Activity, Filter, Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptySection } from '@/components/ui/ds'

// ─── Event type configuration ────────────────────────────────────────────────
const EVENT_CONFIG = {
  upload:            { icon: Upload,        bg: 'bg-blue-50',    ring: 'ring-blue-200',    text: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700',    label: 'Dokument' },
  application:       { icon: FileText,      bg: 'bg-orange-50',  ring: 'ring-orange-200',  text: 'text-orange-600',  badge: 'bg-orange-100 text-orange-700', label: 'Antrag' },
  application_status:{ icon: RefreshCw,     bg: 'bg-violet-50',  ring: 'ring-violet-200',  text: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700', label: 'Status-Änderung' },
  contract:          { icon: Shield,        bg: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', label: 'Vertrag' },
  contract_change:   { icon: RefreshCw,     bg: 'bg-teal-50',    ring: 'ring-teal-200',    text: 'text-teal-600',    badge: 'bg-teal-100 text-teal-700',    label: 'Vertragsänderung' },
  task:              { icon: Clock,         bg: 'bg-amber-50',   ring: 'ring-amber-200',   text: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700',  label: 'Aufgabe' },
  task_completed:    { icon: CheckCircle2,  bg: 'bg-green-50',   ring: 'ring-green-200',   text: 'text-green-600',   badge: 'bg-green-100 text-green-700',  label: 'Erledigt' },
  verkaufschance:    { icon: TrendingUp,    bg: 'bg-blue-50',    ring: 'ring-blue-200',    text: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700',    label: 'Verkaufschance' },
  vs_status:         { icon: TrendingUp,    bg: 'bg-indigo-50',  ring: 'ring-indigo-200',  text: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700', label: 'Chance-Update' },
  email:             { icon: MessageSquare, bg: 'bg-slate-50',   ring: 'ring-slate-200',   text: 'text-slate-500',   badge: 'bg-slate-100 text-slate-600',  label: 'Nachricht' },
  ai_event:          { icon: Zap,          bg: 'bg-violet-50',  ring: 'ring-violet-200',  text: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700', label: 'KI-Aktion' },
  renewal:           { icon: RefreshCw,     bg: 'bg-orange-50',  ring: 'ring-orange-200',  text: 'text-orange-600',  badge: 'bg-orange-100 text-orange-700', label: 'Verlängerung' },
  review:            { icon: Star,          bg: 'bg-yellow-50',  ring: 'ring-yellow-200',  text: 'text-yellow-600',  badge: 'bg-yellow-100 text-yellow-700', label: 'Review' },
}

const FILTER_GROUPS = [
  { id: 'all',      label: 'Alle' },
  { id: 'contract', label: 'Verträge',   types: ['contract', 'contract_change', 'renewal'] },
  { id: 'docs',     label: 'Dokumente',  types: ['upload'] },
  { id: 'tasks',    label: 'Aufgaben',   types: ['task', 'task_completed'] },
  { id: 'sales',    label: 'Sales',      types: ['verkaufschance', 'vs_status', 'application', 'application_status'] },
]

// ─── Date formatting ──────────────────────────────────────────────────────────
function formatRelative(dateStr) {
  if (!dateStr) return '–'
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return 'Heute'
  if (diff === 1) return 'Gestern'
  if (diff < 7) return `vor ${diff} Tagen`
  if (diff < 32) return `vor ${Math.floor(diff / 7)} Woche${Math.floor(diff / 7) > 1 ? 'n' : ''}`
  return d.toLocaleDateString('de-CH', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
}

function getDateGroup(dateStr) {
  if (!dateStr) return 'Früher'
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return 'Heute'
  if (diff === 1) return 'Gestern'
  if (diff < 7) return 'Diese Woche'
  if (diff < 31) return 'Diesen Monat'
  if (diff < 90) return 'Letztes Quartal'
  const month = d.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' })
  return month.charAt(0).toUpperCase() + month.slice(1)
}

// ─── TimelineEntry ────────────────────────────────────────────────────────────
function TimelineEntry({ event, isLast }) {
  const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.upload
  const Icon = cfg.icon

  return (
    <div className="flex gap-4 group">
      {/* Connector line */}
      <div className="flex flex-col items-center shrink-0 w-9">
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-2 transition-all duration-150 group-hover:scale-110',
          cfg.bg, cfg.ring, cfg.text
        )}>
          <Icon className="w-4 h-4" />
        </div>
        {!isLast && (
          <div className="w-px flex-1 mt-1.5 min-h-[20px]"
            style={{ background: 'linear-gradient(to bottom, hsl(var(--border-default)), transparent)' }} />
        )}
      </div>

      {/* Content card */}
      <div className={cn(
        'flex-1 pb-5 pt-0.5 min-w-0',
        isLast && 'pb-0'
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className={cn('text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded', cfg.badge)}>
                {cfg.label}
              </span>
            </div>
            <p className="text-body-sm font-semibold leading-snug">{event.title}</p>
            {event.subtitle && (
              <p className="text-caption mt-0.5 line-clamp-2">{event.subtitle}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-medium text-slate-500 whitespace-nowrap">{formatRelative(event.date)}</p>
            <p className="text-[10px] text-slate-400 whitespace-nowrap">{formatTime(event.date)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── DateGroupHeader ──────────────────────────────────────────────────────────
function DateGroupHeader({ label, count }) {
  return (
    <div className="flex items-center gap-3 py-1 mb-2 mt-6 first:mt-0">
      <div className="flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-label text-slate-500">{label}</span>
        <span className="text-[10px] text-slate-400">({count})</span>
      </div>
      <div className="flex-1 h-px bg-[hsl(var(--border-subtle))]" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ActivityTimeline({
  customer,
  contracts = [],
  applications = [],
  documents = [],
  tasks = [],
  messages = [],
  verkaufschancen = [],
  limit = 50,
}) {
  const [activeFilter, setActiveFilter] = useState('all')

  const allEvents = useMemo(() => {
    const events = []

    documents
      .filter(d => d.customer_id === customer.id || d.primary_customer_id === customer.id)
      .forEach(d => events.push({
        type: 'upload',
        date: d.created_date,
        title: d.name,
        subtitle: [d.category, d.doc_type].filter(Boolean).join(' · ') || 'Dokument',
        id: `doc-${d.id}`,
      }))

    applications
      .filter(a => a.customer_id === customer.id || a.primary_customer_id === customer.id)
      .forEach(a => {
        events.push({
          type: 'application',
          date: a.created_date,
          title: `Antrag: ${a.insurer || '–'}`,
          subtitle: `${a.sparte || a.insurance_type || '–'} · ${a.custom_status || a.status}`,
          id: `app-${a.id}`,
        })
        if (a.status_changed_at && a.status_changed_at !== a.created_date) {
          events.push({
            type: 'application_status',
            date: a.status_changed_at,
            title: `Status geändert → ${a.custom_status || a.status}`,
            subtitle: `${a.insurer || '–'} · ${a.sparte || '–'}`,
            id: `app-status-${a.id}`,
          })
        }
      })

    contracts
      .filter(c => c.customer_id === customer.id || c.primary_customer_id === customer.id)
      .forEach(c => {
        events.push({
          type: 'contract',
          date: c.created_date,
          title: `Vertrag erfasst: ${c.insurer || '–'}`,
          subtitle: `${c.sparte || c.insurance_type || '–'} · ${c.policy_number || 'Keine Nummer'}`,
          id: `contract-${c.id}`,
        })
        if (c.updated_date && c.updated_date !== c.created_date) {
          events.push({
            type: 'contract_change',
            date: c.updated_date,
            title: `Vertrag aktualisiert: ${c.insurer || '–'}`,
            subtitle: `Status: ${c.status} · ${c.process_status || '–'}`,
            id: `contract-upd-${c.id}`,
          })
        }
        if (c.renewal_date && c.renewal_status && c.renewal_status !== 'none') {
          events.push({
            type: 'renewal',
            date: c.renewal_last_reminder || c.updated_date,
            title: `Verlängerung aktiv: ${c.insurer || '–'}`,
            subtitle: `Ablauf: ${c.renewal_date} · Status: ${c.renewal_status}`,
            id: `renewal-${c.id}`,
          })
        }
      })

    tasks
      .filter(t => t.customer_id === customer.id)
      .forEach(t => {
        events.push({
          type: t.status === 'completed' ? 'task_completed' : 'task',
          date: t.created_date,
          title: t.title,
          subtitle: `${t.status === 'completed' ? '✓ Erledigt' : 'Aufgabe offen'} · Fällig: ${t.due_date || '–'}`,
          id: `task-${t.id}`,
        })
        if (t.status === 'completed' && t.completion_date) {
          events.push({
            type: 'task_completed',
            date: t.completion_date + 'T12:00:00',
            title: `Erledigt: ${t.title}`,
            subtitle: 'Aufgabe abgeschlossen',
            id: `task-done-${t.id}`,
          })
        }
      })

    verkaufschancen
      .filter(v => v.customer_id === customer.id)
      .forEach(v => {
        events.push({
          type: 'verkaufschance',
          date: v.created_date,
          title: `Verkaufschance: ${v.title || v.sparte || '–'}`,
          subtitle: `Status: ${v.status}${v.estimated_value ? ` · CHF ${v.estimated_value.toLocaleString('de-CH')}` : ''}`,
          id: `vs-${v.id}`,
        })
        if (v.updated_date && v.updated_date !== v.created_date && v.status !== 'neu') {
          events.push({
            type: 'vs_status',
            date: v.updated_date,
            title: `Chance-Status: ${v.status}`,
            subtitle: v.title || v.sparte || '–',
            id: `vs-upd-${v.id}`,
          })
        }
      })

    messages
      .filter(m => m.customer_id === customer.id)
      .forEach(m => events.push({
        type: 'email',
        date: m.created_date,
        title: `Nachricht: ${m.sender_name || 'System'}`,
        subtitle: m.content?.substring(0, 80) || '–',
        id: `msg-${m.id}`,
      }))

    const seen = new Set()
    return events
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
      .slice(0, limit)
  }, [customer, contracts, applications, documents, tasks, messages, verkaufschancen, limit])

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return allEvents
    const group = FILTER_GROUPS.find(g => g.id === activeFilter)
    if (!group?.types) return allEvents
    return allEvents.filter(e => group.types.includes(e.type))
  }, [allEvents, activeFilter])

  // Group by date
  const grouped = useMemo(() => {
    const groups = []
    let currentGroup = null
    filtered.forEach((event) => {
      const gLabel = getDateGroup(event.date)
      if (!currentGroup || currentGroup.label !== gLabel) {
        currentGroup = { label: gLabel, events: [] }
        groups.push(currentGroup)
      }
      currentGroup.events.push(event)
    })
    return groups
  }, [filtered])

  return (
    <div className="space-y-0">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        {FILTER_GROUPS.map(g => {
          const count = g.types
            ? allEvents.filter(e => g.types.includes(e.type)).length
            : allEvents.length
          return (
            <button
              key={g.id}
              onClick={() => setActiveFilter(g.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all',
                activeFilter === g.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {g.label}
              <span className={cn(
                'text-[10px] font-bold',
                activeFilter === g.id ? 'text-white/70' : 'text-slate-400'
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <EmptySection icon={Activity} title="Keine Aktivitäten" subtitle="Noch keine Ereignisse für diesen Kunden vorhanden." />
      ) : (
        grouped.map(group => (
          <div key={group.label}>
            <DateGroupHeader label={group.label} count={group.events.length} />
            {group.events.map((event, idx) => (
              <TimelineEntry
                key={event.id}
                event={event}
                isLast={idx === group.events.length - 1 && group === grouped[grouped.length - 1]}
              />
            ))}
          </div>
        ))
      )}
    </div>
  )
}