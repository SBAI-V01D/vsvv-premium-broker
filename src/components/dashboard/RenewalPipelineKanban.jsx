import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Send, FileText, CheckCircle2, Phone, TrendingUp } from 'lucide-react'

const STAGE_CONFIG = {
  early: {
    label: 'Early (180-120d)',
    icon: '📅',
    color: 'bg-green-50 border-l-green-500',
    badgeColor: 'bg-green-100 text-green-700',
  },
  contact: {
    label: 'Kontakt (120-60d)',
    icon: '📞',
    color: 'bg-yellow-50 border-l-yellow-500',
    badgeColor: 'bg-yellow-100 text-yellow-700',
  },
  offer: {
    label: 'Angebot',
    icon: '📄',
    color: 'bg-blue-50 border-l-blue-500',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  negotiation: {
    label: 'Verhandlung',
    icon: '🤝',
    color: 'bg-orange-50 border-l-orange-500',
    badgeColor: 'bg-orange-100 text-orange-700',
  },
  renewed: {
    label: '✅ Verlängert',
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

export default function RenewalPipelineKanban({ contracts = [] }) {
  const stages = useMemo(() => {
    const today = new Date()
    const stageMap = {
      early: [],
      contact: [],
      offer: [],
      negotiation: [],
      renewed: [],
      lost: [],
    }

    contracts
      .filter(c => c.status === 'active' && c.end_date)
      .forEach(c => {
        const stage = c.renewal_stage || 'early'
        stageMap[stage].push(c)
      })

    return stageMap
  }, [contracts])

  const kpis = useMemo(() => {
    const total = Object.values(stages).reduce((sum, arr) => sum + arr.length, 0)
    const totalPremium = Object.values(stages)
      .flat()
      .reduce((sum, c) => sum + (c.premium_yearly || 0), 0)
    const renewedCount = stages.renewed.length
    const renewalRate = total > 0 ? Math.round((renewedCount / total) * 100) : 0

    return {
      totalOpen: total - renewedCount - stages.lost.length,
      totalPremium: Math.round(totalPremium),
      renewalRate,
      lostCount: stages.lost.length,
    }
  }, [stages])

  return (
    <div className="space-y-6">
      {/* KPI HEADER */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Offene Renewals</p>
            <p className="text-2xl font-bold text-primary">{kpis.totalOpen}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Erwarteter Umsatz</p>
            <p className="text-2xl font-bold text-green-600">CHF {kpis.totalPremium.toLocaleString('de-CH')}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Abschlussquote</p>
            <p className="text-2xl font-bold text-blue-600">{kpis.renewalRate}%</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Verloren</p>
            <p className="text-2xl font-bold text-red-600">{kpis.lostCount}</p>
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
              <p className="text-xs text-slate-600 mt-1 font-medium">{stages[stageKey].length} Verträge</p>
            </div>

            {/* CARDS */}
            <div className="space-y-2 flex-1 bg-slate-50/50 p-3 rounded-b-lg min-h-96">
              {stages[stageKey].length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-4">Keine Verträge</p>
              ) : (
                stages[stageKey].map(contract => {
                  const daysLeft = Math.floor(
                    (new Date(contract.end_date) - new Date()) / (1000 * 60 * 60 * 24)
                  )
                  const isCritical = daysLeft < 30

                  return (
                    <Card
                      key={contract.id}
                      className={`border-l-4 ${
                        isCritical ? 'border-l-red-500 bg-red-50' : config.color
                      } hover:shadow-md transition-shadow`}
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
                          <Badge className={config.badgeColor} variant="secondary" className="flex-shrink-0 text-xs">
                            {daysLeft}d
                          </Badge>
                        </div>

                        {/* DETAILS */}
                        <div className="space-y-1 mb-3 border-t border-slate-200 pt-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Prämie</span>
                            <span className="font-semibold text-slate-900">
                              CHF {contract.premium_yearly?.toLocaleString('de-CH', {
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Produkt</span>
                            <span className="font-medium text-slate-900 truncate">{contract.product}</span>
                          </div>
                          {isCritical && (
                            <div className="flex items-center gap-1 text-xs text-red-600 font-semibold mt-1">
                              🔴 Kritisch
                            </div>
                          )}
                        </div>

                        {/* ACTIONS */}
                        <div className="flex gap-1">
                          {stageKey === 'early' && (
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