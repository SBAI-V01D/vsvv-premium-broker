import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Phone, FileText, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react'

const STAGES = [
  { key: 'early', label: 'EARLY', days: '180–120d' },
  { key: 'contact', label: 'CONTACT', days: '120–60d' },
  { key: 'offer', label: 'OFFER', days: '–' },
  { key: 'negotiation', label: 'NEGOTIATION', days: '–' },
  { key: 'renewed', label: 'WON ✅', days: '–' },
  { key: 'lost', label: 'LOST ❌', days: '–' },
]

function getUrgencyColor(daysLeft) {
  if (daysLeft < 60) return 'border-l-red-500'
  if (daysLeft < 120) return 'border-l-orange-500'
  return 'border-l-green-500'
}

function RenewalCard({ contract, onActionClick }) {
  const daysLeft = contract.end_date
    ? Math.floor((new Date(contract.end_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  const [showDetails, setShowDetails] = useState(false)

  return (
    <Card
      className={`border-l-4 ${getUrgencyColor(daysLeft)} flex-shrink-0 w-72 hover:shadow-lg transition-shadow cursor-default group`}
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <CardContent className="p-4 space-y-3">
        {/* HEADER: Name + Product */}
        <div>
          <p className="font-bold text-sm text-slate-900 truncate">{contract.customer_name}</p>
          <p className="text-xs text-muted-foreground truncate">{contract.product || contract.insurance_type}</p>
        </div>

        {/* MIDDLE: Key Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Endet</p>
            <p className="font-semibold text-slate-900">
              {contract.end_date ? new Date(contract.end_date).toLocaleDateString('de-CH') : '–'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Prämie</p>
            <p className="font-semibold text-slate-900">
              CHF {contract.premium_yearly?.toLocaleString('de-CH', { maximumFractionDigits: 0 }) || '–'}
            </p>
          </div>
        </div>

        {/* URGENCY BADGE */}
        {daysLeft !== null && daysLeft < 120 && (
          <Badge className={daysLeft < 60 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}>
            {daysLeft < 0 ? 'ÜBERFÄLLIG' : `${daysLeft} Tage`}
          </Badge>
        )}

        {/* HOVER DETAILS */}
        {showDetails && (
          <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
            {contract.assigned_broker && (
              <p className="text-muted-foreground"><strong>Berater:</strong> {contract.assigned_broker}</p>
            )}
            {contract.renewal_last_activity && (
              <p className="text-muted-foreground">
                <strong>Zuletzt:</strong> {new Date(contract.renewal_last_activity).toLocaleDateString('de-CH')}
              </p>
            )}
            {contract.notes && (
              <p className="text-muted-foreground italic">"{contract.notes.substring(0, 50)}..."</p>
            )}
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div className="flex gap-2 pt-2 border-t border-slate-200">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={() => onActionClick('contact', contract)}
          >
            <Phone className="w-3 h-3 mr-1" /> Kontakt
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={() => onActionClick('offer', contract)}
          >
            <FileText className="w-3 h-3 mr-1" /> Angebot
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={() => onActionClick('close', contract)}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" /> Schluss
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function KanbanColumn({ stage, contracts }) {
  const totalPremium = contracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0)

  return (
    <div className="flex-shrink-0 w-96">
      {/* COLUMN HEADER */}
      <div className="bg-gradient-to-r from-slate-100 to-slate-50 p-4 rounded-t-lg border-b-2 border-slate-200">
        <h3 className="font-bold text-sm text-slate-900">{stage.label}</h3>
        <div className="text-xs text-muted-foreground mt-1">
          <p><strong>{contracts.length}</strong> Deals</p>
          <p className="font-semibold text-slate-700">
            CHF {totalPremium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
          </p>
        </div>
        {stage.days !== '–' && <p className="text-xs text-muted-foreground mt-2">{stage.days}</p>}
      </div>

      {/* CARDS */}
      <div className="space-y-3 p-4 min-h-96 bg-slate-50/50 rounded-b-lg max-h-screen overflow-y-auto">
        {contracts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Keine Verträge</p>
        ) : (
          contracts.map(contract => (
            <RenewalCard
              key={contract.id}
              contract={contract}
              onActionClick={(action, c) => console.log(`Action: ${action} on`, c)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default function RenewalPipelineKanbanV2({ contracts = [] }) {
  const queryClient = useQueryClient()

  // Filter to active contracts only
  const activeContracts = contracts.filter(c => c.status === 'active')

  // Compute KPIs
  const kpis = useMemo(() => {
    const today = new Date()
    const critical = activeContracts.filter(c => {
      if (!c.end_date) return false
      const daysLeft = Math.floor((new Date(c.end_date) - today) / (1000 * 60 * 60 * 24))
      return daysLeft > 0 && daysLeft < 60
    })
    const expectedRevenue = activeContracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0)

    return {
      total: activeContracts.length,
      critical: critical.length,
      expectedRevenue: Math.round(expectedRevenue),
    }
  }, [activeContracts])

  // Organize contracts by stage with smart sorting
  const contractsByStage = useMemo(() => {
    const today = new Date()

    const sorted = (stageContracts) =>
      stageContracts.sort((a, b) => {
        // Prioritize critical (<60 days)
        const aDaysLeft = a.end_date ? Math.floor((new Date(a.end_date) - today) / (1000 * 60 * 60 * 24)) : 999
        const bDaysLeft = b.end_date ? Math.floor((new Date(b.end_date) - today) / (1000 * 60 * 60 * 24)) : 999

        const aCritical = aDaysLeft > 0 && aDaysLeft < 60
        const bCritical = bDaysLeft > 0 && bDaysLeft < 60

        if (aCritical && !bCritical) return -1
        if (!aCritical && bCritical) return 1

        // Then sort by days left (ascending)
        return aDaysLeft - bDaysLeft
      })

    const stages = {}
    STAGES.forEach(s => {
      stages[s.key] = sorted(activeContracts.filter(c => c.renewal_stage === s.key))
    })

    return stages
  }, [activeContracts])

  // Filter out empty stages
  const visibleStages = STAGES.filter(s => contractsByStage[s.key].length > 0)

  return (
    <div className="space-y-6">
      {/* KPI BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Renewals</p>
            <p className="text-3xl font-bold text-primary mt-2">{kpis.total}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-xs text-muted-foreground">Kritisch (&lt;60d)</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{kpis.critical}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Erwarteter Umsatz</p>
                <p className="text-2xl font-bold text-green-600 mt-2">
                  CHF {kpis.expectedRevenue.toLocaleString('de-CH')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KANBAN BOARD */}
      {visibleStages.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Keine aktiven Renewals
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-4 border-b border-slate-200 bg-white rounded-lg">
          <div className="flex gap-4 p-4 min-w-min">
            {visibleStages.map(stage => (
              <KanbanColumn key={stage.key} stage={stage} contracts={contractsByStage[stage.key]} />
            ))}
          </div>
        </div>
      )}

      {/* HINT */}
      <p className="text-xs text-muted-foreground text-center">
        💡 Klick auf Kontakt / Angebot / Schluss für direkte Aktion
      </p>
    </div>
  )
}