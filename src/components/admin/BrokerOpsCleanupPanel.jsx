import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, Clock, UserX, FileWarning, CheckCircle2, Loader2, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BrokerOpsCleanupPanel() {
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState(null)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [fixedMessages, setFixedMessages] = useState({})

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)
    setResults(null)
    setFixedMessages({})
    const res = await base44.functions.invoke('brokerOpsCleanup', { mode: 'analyze' })
    if (res.data?.success) {
      setResults(res.data.results)
    } else {
      setError(res.data?.error || 'Fehler bei der Analyse')
    }
    setLoading(false)
  }

  const runFix = async (fixType, label) => {
    setFixing(fixType)
    const res = await base44.functions.invoke('brokerOpsCleanup', { mode: 'fix', fix_type: fixType })
    if (res.data?.success) {
      setFixedMessages(prev => ({ ...prev, [fixType]: res.data.message }))
    } else {
      setError(res.data?.error || 'Fehler beim Bereinigen')
    }
    setFixing(null)
  }

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  const SECTIONS = [
    {
      key: 'overdue_tasks',
      label: 'Überfällige offene Tasks',
      icon: Clock,
      color: 'text-red-600',
      bg: 'bg-red-50 border-red-200',
      fix_type: 'tasks_escalate',
      fix_label: 'Alle auf "Dringend" setzen',
      fix_desc: 'Setzt die Priorität aller überfälligen Tasks auf "Urgent"',
      renderItem: (item) => (
        <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{item.title}</p>
            <p className="text-[10px] text-muted-foreground">{item.customer_name} · {item.assigned_to || '– nicht zugewiesen –'}</p>
          </div>
          <span className="text-xs font-bold text-red-600 flex-shrink-0 ml-2">{item.days_overdue}d überfällig</span>
        </div>
      ),
    },
    {
      key: 'leads_without_advisor',
      label: 'Leads ohne Berater-Zuweisung',
      icon: UserX,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
      fix_type: 'leads_flag',
      fix_label: 'Alle auf "Offen" setzen',
      fix_desc: 'Setzt alle nicht zugewiesenen Leads auf Status "Offen" damit sie auffallen',
      renderItem: (item) => (
        <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{item.name || item.email || '–'}</p>
            <p className="text-[10px] text-muted-foreground">{item.email} · Status: {item.status}</p>
          </div>
          <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">{item.created_date?.split('T')[0]}</span>
        </div>
      ),
    },
    {
      key: 'stale_applications',
      label: 'Anträge > 7 Tage ohne Fortschritt',
      icon: FileWarning,
      color: 'text-orange-600',
      bg: 'bg-orange-50 border-orange-200',
      fix_type: 'apps_flag',
      fix_label: 'Als nachzufassen markieren',
      fix_desc: 'Fügt eine Notiz zu jedem veralteten Antrag hinzu',
      renderItem: (item) => (
        <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{item.customer_name} · {item.insurer}</p>
            <p className="text-[10px] text-muted-foreground">Status: {item.status}</p>
          </div>
          <span className="text-xs font-bold text-orange-600 flex-shrink-0 ml-2">{item.days_old}d alt</span>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">Broker Operations Cleanup</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Analysiert und behebt die 3 häufigsten Score-Treiber</p>
        </div>
        <Button onClick={runAnalysis} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {loading ? 'Analysiere...' : 'Analyse starten'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {results && (
        <div className="space-y-3">
          {SECTIONS.map(section => {
            const data = results[section.key]
            const isOpen = expanded[section.key]
            const fixMsg = fixedMessages[section.fix_type]
            const Icon = section.icon
            return (
              <Card key={section.key} className={cn('border', section.bg)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('w-4 h-4', section.color)} />
                      <span className="text-sm font-semibold">{section.label}</span>
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', section.bg, section.color, 'border')}>
                        {data.count} Einträge
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {data.count > 0 && !fixMsg && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runFix(section.fix_type)}
                          disabled={fixing === section.fix_type}
                          className="h-7 text-xs gap-1"
                        >
                          {fixing === section.fix_type ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          {section.fix_label}
                        </Button>
                      )}
                      {fixMsg && (
                        <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {fixMsg}
                        </span>
                      )}
                      {data.items?.length > 0 && (
                        <button onClick={() => toggle(section.key)} className="p-1 rounded hover:bg-black/5">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {data.count === 0 && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-green-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Alles in Ordnung — keine Massnahmen nötig
                    </div>
                  )}

                  {isOpen && data.items?.length > 0 && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-[10px] text-muted-foreground mb-1.5">{section.fix_desc}</p>
                      {data.items.map(item => section.renderItem(item))}
                      {data.count > 20 && (
                        <p className="text-[10px] text-muted-foreground mt-1.5">… und {data.count - 20} weitere Einträge</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
            💡 Nach der Bereinigung bitte den System Excellence Report neu ausführen um den aktualisierten Score zu sehen.
          </div>
        </div>
      )}
    </div>
  )
}