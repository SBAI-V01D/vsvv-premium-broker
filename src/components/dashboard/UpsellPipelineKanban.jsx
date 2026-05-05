import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Send, FileText, CheckCircle2, Phone, TrendingUp } from 'lucide-react'

const STAGE_CONFIG = {
  identified: {
    label: 'Erkannt',
    icon: '🔍',
    color: 'bg-cyan-50 border-l-cyan-500',
    badgeColor: 'bg-cyan-100 text-cyan-700',
  },
  contact: {
    label: 'Kontakt',
    icon: '📞',
    color: 'bg-blue-50 border-l-blue-500',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  offer: {
    label: 'Angebot',
    icon: '📄',
    color: 'bg-amber-50 border-l-amber-500',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  negotiation: {
    label: 'Verhandlung',
    icon: '🤝',
    color: 'bg-orange-50 border-l-orange-500',
    badgeColor: 'bg-orange-100 text-orange-700',
  },
  won: {
    label: '✅ Verkauft',
    icon: '🎉',
    color: 'bg-green-100 border-l-green-600',
    badgeColor: 'bg-green-100 text-green-700',
  },
  lost: {
    label: '❌ Verloren',
    icon: '😞',
    color: 'bg-red-50 border-l-red-500',
    badgeColor: 'bg-red-100 text-red-700',
  },
}

const REASON_LABELS = {
  high_pricing: '💸 Zu hohe Prämie',
  product_gap: '📦 Produkt-Lücke',
  renewal_approaching: '⏰ Verlängerung',
  coverage_improvement: '🛡️ Verbesserung',
}

export default function UpsellPipelineKanban({ contracts = [] }) {
  const stages = useMemo(() => {
    const stageMap = {
      identified: [],
      contact: [],
      offer: [],
      negotiation: [],
      won: [],
      lost: [],
    }

    contracts
      .filter(c => c.status === 'active' && c.upsell_potential_value && c.upsell_potential_value > 0)
      .forEach(c => {
        const stage = c.upsell_stage || 'identified'
        stageMap[stage].push(c)
      })

    return stageMap
  }, [contracts])

  const kpis = useMemo(() => {
    const allDeals = Object.values(stages).flat()
    const totalPotential = allDeals.reduce((sum, c) => sum + (c.upsell_potential_value || 0), 0)
    const wonValue = stages.won.reduce((sum, c) => sum + (c.upsell_offer_value || 0), 0)
    const winRate = allDeals.length > 0 ? Math.round((stages.won.length / allDeals.length) * 100) : 0

    return {
      totalDeals: allDeals.length,
      totalPotential: Math.round(totalPotential),
      wonValue: Math.round(wonValue),
      winRate,
    }
  }, [stages])

  return (
    <div className="space-y-6">
      {/* KPI HEADER */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Offene Chancen</p>
            <p className="text-2xl font-bold text-primary">{kpis.totalDeals}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Gesamtpotenzial</p>
            <p className="text-2xl font-bold text-amber-600">CHF {kpis.totalPotential.toLocaleString('de-CH')}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Realisiert</p>
            <p className="text-2xl font-bold text-green-600">CHF {kpis.wonValue.toLocaleString('de-CH')}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Abschlussquote</p>
            <p className="text-2xl font-bold text-blue-600">{kpis.winRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* KANBAN BOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {Object.entries(STAGE_CONFIG).map(([stageKey, config]) => (
          <div key={stageKey} className="flex flex-col min-w-fit lg:min-w-0 flex-1">
            {/* COLUMN HEADER */}
            <div className={`p-3 rounded-t-lg border-b-2 ${config.color} sticky top-0 z-10`}>
              <h3 className="font-bold text-sm text-slate-900">
                {config.icon} {config.label}
              </h3>
              <p className="text-xs text-slate-600 mt-1 font-medium">{stages[stageKey].length} Deals</p>
            </div>

            {/* CARDS */}
            <div className="space-y-2 flex-1 bg-slate-50/50 p-3 rounded-b-lg min-h-96">
              {stages[stageKey].length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-4">Keine Chancen</p>
              ) : (
                stages[stageKey].map(contract => {
                  const priority =
                    contract.upsell_potential_percent >= 20
                      ? 'high'
                      : contract.upsell_potential_percent >= 10
                        ? 'medium'
                        : 'low'
                  const priorityColor =
                    priority === 'high' ? 'bg-red-100 text-red-700' : priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'

                  return (
                    <Card
                      key={contract.id}
                      className={`border-l-4 ${contract.upsell_potential_percent >= 20 ? 'border-l-red-500 bg-red-50' : config.color} hover:shadow-md transition-shadow`}
                    >
                      <CardContent className="p-3">
                        {/* TITLE */}
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs text-slate-900 truncate">
                              {contract.policy_number}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {contract.customer_name}
                            </p>
                          </div>
                          <Badge className={priorityColor} variant="secondary" className="flex-shrink-0 text-xs">
                            {contract.upsell_potential_percent}%
                          </Badge>
                        </div>

                        {/* REASON */}
                        {contract.upsell_identified_reason && (
                          <div className="text-xs text-slate-600 mb-2 p-1.5 bg-white/50 rounded">
                            {REASON_LABELS[contract.upsell_identified_reason] || contract.upsell_identified_reason}
                          </div>
                        )}

                        {/* DETAILS */}
                        <div className="space-y-1 mb-3 border-t border-slate-200 pt-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Aktuell</span>
                            <span className="font-semibold text-slate-900">
                              CHF {contract.premium_yearly?.toLocaleString('de-CH', {
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Potenzial</span>
                            <span className="font-bold text-amber-600">
                              +CHF {contract.upsell_potential_value?.toLocaleString('de-CH', {
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                          {contract.upsell_offer_created && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold mt-1">
                              ✓ Angebot erstellt
                            </div>
                          )}
                        </div>

                        {/* ACTIONS */}
                        <div className="flex gap-1">
                          {stageKey === 'identified' && (
                            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs">
                              <Phone className="w-3 h-3 mr-1" /> Kontakt
                            </Button>
                          )}
                          {stageKey === 'contact' && (
                            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs">
                              <FileText className="w-3 h-3 mr-1" /> Angebot
                            </Button>
                          )}
                          {stageKey === 'offer' && (
                            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs">
                              <Send className="w-3 h-3 mr-1" /> Senden
                            </Button>
                          )}
                          {stageKey === 'negotiation' && (
                            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Abschluss
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}