import React, { useMemo } from 'react'
import { Activity, Upload, FileText, CheckCircle2, Clock, MessageSquare, Zap } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const ICON_MAP = {
  upload: Upload,
  application: FileText,
  contract: CheckCircle2,
  status_change: Clock,
  task: FileText,
  email: MessageSquare,
  ai_event: Zap,
}

const COLOR_MAP = {
  upload: 'bg-blue-50 border-blue-200 text-blue-700',
  application: 'bg-orange-50 border-orange-200 text-orange-700',
  contract: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  status_change: 'bg-purple-50 border-purple-200 text-purple-700',
  task: 'bg-amber-50 border-amber-200 text-amber-700',
  email: 'bg-slate-50 border-slate-200 text-slate-700',
  ai_event: 'bg-violet-50 border-violet-200 text-violet-700',
}

export default function ActivityTimeline({ customer, contracts = [], applications = [], documents = [], tasks = [], messages = [] }) {
  // Build chronological timeline from all sources
  const timeline = useMemo(() => {
    const events = []

    // Documents (uploads)
    documents.forEach(d => {
      if (d.customer_id === customer.id || d.primary_customer_id === customer.id) {
        events.push({
          type: 'upload',
          date: d.created_date,
          title: d.name,
          subtitle: `Dokument: ${d.category || 'unbekannt'}`,
          id: `doc-${d.id}`,
        })
      }
    })

    // Applications
    applications.forEach(a => {
      if (a.customer_id === customer.id || a.primary_customer_id === customer.id) {
        events.push({
          type: 'application',
          date: a.created_date,
          title: `Antrag: ${a.insurer || '–'}`,
          subtitle: `${a.sparte || a.insurance_type || '–'} · Status: ${a.custom_status || a.status}`,
          id: `app-${a.id}`,
        })
        // Status changes
        if (a.status_changed_at) {
          events.push({
            type: 'status_change',
            date: a.status_changed_at,
            title: `Antragsstatus geändert`,
            subtitle: `Neuer Status: ${a.custom_status || a.status}`,
            id: `app-status-${a.id}`,
          })
        }
      }
    })

    // Contracts
    contracts.forEach(c => {
      if (c.customer_id === customer.id || c.primary_customer_id === customer.id) {
        events.push({
          type: 'contract',
          date: c.created_date,
          title: `Vertrag: ${c.insurer || '–'}`,
          subtitle: `${c.sparte || c.insurance_type || '–'} · ${c.policy_number || 'Keine Nummer'}`,
          id: `contract-${c.id}`,
        })
      }
    })

    // Tasks
    tasks.forEach(t => {
      if (t.customer_id === customer.id) {
        events.push({
          type: 'task',
          date: t.created_date,
          title: `Aufgabe: ${t.title}`,
          subtitle: `Status: ${t.status} · Fällig: ${t.due_date || '–'}`,
          id: `task-${t.id}`,
        })
      }
    })

    // Messages
    messages.forEach(m => {
      if (m.customer_id === customer.id) {
        events.push({
          type: 'email',
          date: m.created_date,
          title: `Nachricht von ${m.sender_name || 'System'}`,
          subtitle: m.content?.substring(0, 50) || '–',
          id: `msg-${m.id}`,
        })
      }
    })

    // Sort by date (newest first)
    return events.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [customer, contracts, applications, documents, tasks, messages])

  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffDays === 0) return 'Heute'
    if (diffDays === 1) return 'Gestern'
    if (diffDays < 7) return `vor ${diffDays} Tagen`
    return date.toLocaleDateString('de-CH')
  }

  if (timeline.length === 0) {
    return (
      <Card>
        <div className="p-6 text-center text-muted-foreground">
          <Activity className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Noch keine Aktivitäten</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {timeline.map((event, idx) => {
        const Icon = ICON_MAP[event.type] || Activity
        const colorClass = COLOR_MAP[event.type] || 'bg-slate-50 border-slate-200 text-slate-700'

        return (
          <div key={event.id} className="flex gap-3">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0', colorClass)}>
                <Icon className="w-4 h-4" />
              </div>
              {idx < timeline.length - 1 && (
                <div className="w-0.5 h-8 bg-border mt-1" />
              )}
            </div>

            {/* Event card */}
            <div className="flex-1 pt-1 pb-4">
              <div className={cn('p-3 rounded-lg border', colorClass)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs opacity-75 mt-0.5">{event.subtitle}</p>
                  </div>
                  <span className="text-xs opacity-60 whitespace-nowrap ml-2">{formatDate(event.date)}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}