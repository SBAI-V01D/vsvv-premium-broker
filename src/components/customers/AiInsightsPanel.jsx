import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, AlertTriangle, TrendingUp, CheckCircle2, Clock, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

const RISK_COLORS = {
  niedrig: 'bg-green-100 text-green-700 border-green-200',
  mittel: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  hoch: 'bg-orange-100 text-orange-700 border-orange-200',
  kritisch: 'bg-red-100 text-red-700 border-red-200',
}

const URGENCY_COLORS = {
  sofort: 'text-red-600',
  hoch: 'text-orange-600',
  mittel: 'text-yellow-600',
  niedrig: 'text-green-600',
}

export default function AiInsightsPanel({ customerId }) {
  const [insights, setInsights] = useState(null)
  const [context, setContext] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadInsights = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await base44.functions.invoke('aiCustomerInsights', { customer_id: customerId })
      setInsights(res.data.insights)
      setContext(res.data.context)
    } catch (e) {
      setError(e.message || 'Fehler beim Laden der KI-Analyse')
    }
    setLoading(false)
  }

  if (!insights && !loading) {
    return (
      <Card className="border-dashed border-2 border-primary/20 bg-primary/[0.02]">
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold text-sm mb-1">KI-Kundenanalyse</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Automatische Analyse von Deckungslücken, Upsell-Chancen und Risiken
          </p>
          <Button onClick={loadInsights} size="sm" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Analyse starten
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">KI analysiert Kundendaten...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">Analyse fehlgeschlagen</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={loadInsights}>Retry</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">KI-Analyse</span>
          <Badge className={cn('text-xs border', RISK_COLORS[insights?.risk_level] || 'bg-muted text-muted-foreground')}>
            {insights?.risk_level || '–'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Score: <strong>{insights?.priority_score || 0}/100</strong></span>
          <Button size="sm" variant="ghost" onClick={loadInsights} className="h-7 w-7 p-0">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* SUMMARY */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4">
          <p className="text-sm text-foreground leading-relaxed">{insights?.summary}</p>
        </CardContent>
      </Card>

      {/* RISK FLAGS */}
      {insights?.risk_flags?.length > 0 && (
        <Card className="border-l-4 border-l-red-500 bg-red-50/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs flex items-center gap-1.5 text-red-700">
              <ShieldAlert className="w-3.5 h-3.5" /> Warnsignale
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ul className="space-y-1">
              {insights.risk_flags.map((flag, i) => (
                <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                  <span className="mt-0.5">⚠</span> {flag}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* IMMEDIATE ACTIONS */}
      {insights?.immediate_actions?.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs flex items-center gap-1.5 text-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Sofortmassnahmen
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {insights.immediate_actions.map((action, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40">
                <span className="text-xs font-bold text-muted-foreground mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{action.action}</p>
                  {action.deadline && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> {action.deadline}
                    </p>
                  )}
                </div>
                {action.urgency && (
                  <span className={cn('text-[10px] font-semibold', URGENCY_COLORS[action.urgency?.toLowerCase()] || 'text-muted-foreground')}>
                    {action.urgency}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* COVERAGE GAPS */}
      {insights?.coverage_gaps?.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs flex items-center gap-1.5 text-foreground">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Deckungslücken
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {insights.coverage_gaps.map((gap, i) => (
              <div key={i} className="flex items-start justify-between gap-2 py-1.5 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{gap.coverage}</p>
                  <p className="text-[10px] text-muted-foreground">{gap.reason}</p>
                </div>
                {gap.estimated_premium > 0 && (
                  <span className="text-[10px] text-emerald-600 font-semibold whitespace-nowrap">
                    ~CHF {gap.estimated_premium}/J.
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* UPSELL OPPORTUNITIES */}
      {insights?.upsell_opportunities?.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs flex items-center gap-1.5 text-foreground">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Upsell-Chancen
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {insights.upsell_opportunities.map((opp, i) => (
              <div key={i} className="flex items-start justify-between gap-2 py-1.5 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{opp.product}</p>
                  <p className="text-[10px] text-muted-foreground">{opp.reason}</p>
                </div>
                {opp.estimated_premium > 0 && (
                  <span className="text-[10px] text-emerald-600 font-semibold whitespace-nowrap">
                    +CHF {opp.estimated_premium}/J.
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* CONTEXT METRICS */}
      {context && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Jahresprämie', value: `CHF ${(context.total_yearly_premium || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}` },
            { label: 'Abläufe (90d)', value: context.soon_expiring || 0, highlight: context.soon_expiring > 0 },
            { label: 'Deckungslücken', value: context.missing_coverage?.length || 0, highlight: context.missing_coverage?.length > 0 },
          ].map(m => (
            <div key={m.label} className={cn('text-center p-2 rounded-lg', m.highlight ? 'bg-red-50' : 'bg-muted/40')}>
              <p className={cn('text-lg font-bold', m.highlight ? 'text-red-600' : 'text-foreground')}>{m.value}</p>
              <p className="text-[9px] text-muted-foreground font-medium">{m.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}