/**
 * ActivityTimeline — Vollständige Kundenhistorie
 * Automatisch wachsend aus allen Entitäten.
 */
import React, { useMemo } from 'react'
import {
  Upload, FileText, Shield, Clock, MessageSquare, Zap,
  TrendingUp, CheckCircle2, AlertTriangle, RefreshCw, Star, Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

const EVENT_CONFIG = {
  upload:           { icon: Upload,        color: 'bg-blue-100 text-blue-700 border-blue-200',     label: 'Dokument' },
  application:      { icon: FileText,      color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Antrag' },
  application_status:{ icon: RefreshCw,   color: 'bg-violet-100 text-violet-700 border-violet-200', label: 'Antrag-Status' },
  contract:         { icon: Shield,        color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Vertrag' },
  contract_change:  { icon: RefreshCw,     color: 'bg-teal-100 text-teal-700 border-teal-200',     label: 'Vertragsänderung' },
  task:             { icon: CheckCircle2,  color: 'bg-amber-100 text-amber-700 border-amber-200',  label: 'Aufgabe' },
  task_completed:   { icon: CheckCircle2,  color: 'bg-green-100 text-green-700 border-green-200',  label: 'Aufgabe erledigt' },
  verkaufschance:   { icon: TrendingUp,    color: 'bg-blue-100 text-blue-700 border-blue-200',     label: 'Verkaufschance' },
  vs_status:        { icon: TrendingUp,    color: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Chance-Status' },
  email:            { icon: MessageSquare, color: 'bg-slate-100 text-slate-600 border-slate-200',  label: 'Nachricht' },
  ai_event:         { icon: Zap,           color: 'bg-violet-100 text-violet-700 border-violet-200', label: 'KI-Aktion' },
  renewal:          { icon: RefreshCw,     color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Verlängerung' },
  review:           { icon: Star,          color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Review' },
}

function formatDate(dateStr) {
  if (!dateStr) return '–'
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return 'Heute'
  if (diff === 1) return 'Gestern'
  if (diff < 7) return `vor ${diff} Tagen`
  return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ActivityTimeline({
  customer,
  contracts = [],
  applications = [],
  documents = [],
  tasks = [],
  messages = [],
  verkaufschancen = [],
  limit = 30,
}) {
  const timeline = useMemo(() => {
    const events = []

    // ── Dokumente ────────────────────────────────────────────────────────
    documents
      .filter(d => d.customer_id === customer.id || d.primary_customer_id === customer.id)
      .forEach(d => events.push({
        type: 'upload',
        date: d.created_date,
        title: d.name,
        subtitle: `Dokument hochgeladen · ${d.category || d.doc_type || 'unbekannt'}`,
        id: `doc-${d.id}`,
      }))

    // ── Anträge ──────────────────────────────────────────────────────────
    applications
      .filter(a => a.customer_id === customer.id || a.primary_customer_id === customer.id)
      .forEach(a => {
        events.push({
          type: 'application',
          date: a.created_date,
          title: `Antrag erstellt: ${a.insurer || '–'}`,
          subtitle: `${a.sparte || a.insurance_type || '–'} · Status: ${a.custom_status || a.status}`,
          id: `app-${a.id}`,
        })
        if (a.status_changed_at && a.status_changed_at !== a.created_date) {
          events.push({
            type: 'application_status',
            date: a.status_changed_at,
            title: `Antragsstatus: ${a.custom_status || a.status}`,
            subtitle: `${a.insurer || '–'} · ${a.sparte || '–'}`,
            id: `app-status-${a.id}`,
          })
        }
      })

    // ── Verträge ─────────────────────────────────────────────────────────
    contracts
      .filter(c => c.customer_id === customer.id || c.primary_customer_id === customer.id)
      .forEach(c => {
        events.push({
          type: 'contract',
          date: c.created_date,
          title: `Vertrag erstellt: ${c.insurer || '–'}`,
          subtitle: `${c.sparte || c.insurance_type || '–'} · ${c.policy_number || 'Keine Nummer'}`,
          id: `contract-${c.id}`,
        })
        if (c.updated_date && c.updated_date !== c.created_date) {
          events.push({
            type: 'contract_change',
            date: c.updated_date,
            title: `Vertrag aktualisiert: ${c.insurer || '–'}`,
            subtitle: `Status: ${c.status} · Prozess: ${c.process_status || '–'}`,
            id: `contract-upd-${c.id}`,
          })
        }
      })

    // ── Aufgaben ─────────────────────────────────────────────────────────
    tasks
      .filter(t => t.customer_id === customer.id)
      .forEach(t => {
        events.push({
          type: t.status === 'completed' ? 'task_completed' : 'task',
          date: t.created_date,
          title: t.title,
          subtitle: `${t.status === 'completed' ? 'Erledigt' : 'Aufgabe'} · Fällig: ${t.due_date || '–'}`,
          id: `task-${t.id}`,
        })
        if (t.status === 'completed' && t.completion_date) {
          events.push({
            type: 'task_completed',
            date: t.completion_date + 'T12:00:00',
            title: `✓ Erledigt: ${t.title}`,
            subtitle: `Abgeschlossen`,
            id: `task-done-${t.id}`,
          })
        }
      })

    // ── Verkaufschancen ──────────────────────────────────────────────────
    verkaufschancen
      .filter(v => v.customer_id === customer.id)
      .forEach(v => {
        events.push({
          type: 'verkaufschance',
          date: v.created_date,
          title: `Verkaufschance: ${v.title || v.sparte || '–'}`,
          subtitle: `Status: ${v.status} · ${v.estimated_value ? `CHF ${v.estimated_value.toLocaleString('de-CH')}` : '–'}`,
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

    // ── Nachrichten ──────────────────────────────────────────────────────
    messages
      .filter(m => m.customer_id === customer.id)
      .forEach(m => events.push({
        type: 'email',
        date: m.created_date,
        title: `Nachricht von ${m.sender_name || 'System'}`,
        subtitle: m.content?.substring(0, 60) || '–',
        id: `msg-${m.id}`,
      }))

    // Sort newest first, deduplicate by id, limit
    const seen = new Set()
    return events
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter(e => {
        if (seen.has(e.id)) return false
        seen.add(e.id)
        return true
      })
      .slice(0, limit)
  }, [customer, contracts, applications, documents, tasks, messages, verkaufschancen, limit])

  if (timeline.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
        <p className="text-sm">Noch keine Aktivitäten vorhanden</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {timeline.map((event, idx) => {
        const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.upload
        const Icon = cfg.icon
        const isLast = idx === timeline.length - 1

        return (
          <div key={event.id} className="flex gap-3">
            {/* Connector */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1', cfg.color)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              {!isLast && <div className="w-0.5 flex-1 bg-border mt-1 min-h-[16px]" />}
            </div>

            {/* Content */}
            <div className={cn('flex-1 pb-4 pt-0.5', isLast && 'pb-0')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{event.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.subtitle}</p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                  {formatDate(event.date)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}