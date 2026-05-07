import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Phone, FileText, CheckCircle2, AlertCircle, TrendingUp, Zap, Clock, MessageSquare } from 'lucide-react'

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

function calculateConversionChance(contract) {
  let chance = 50
  
  if (contract.renewal_stage === 'contact') chance += 20
  if (contract.renewal_offer_status === 'sent') chance += 30
  if (contract.renewal_last_activity) {
    const lastActivity = new Date(contract.renewal_last_activity)
    const daysSinceActivity = Math.floor((new Date() - lastActivity) / (1000 * 60 * 60 * 24))
    if (daysSinceActivity > 14) chance -= 20
    else if (daysSinceActivity > 7) chance -= 10
  } else {
    chance -= 20
  }
  
  return Math.max(0, Math.min(100, chance))
}

function getNextAction(contract) {
  if (!contract.renewal_last_activity || 
      (new Date() - new Date(contract.renewal_last_activity)) / (1000 * 60 * 60 * 24) > 5) {
    return 'Kontaktieren'
  }
  if (contract.renewal_offer_status === 'none' || contract.renewal_offer_status === 'pending') {
    return 'Angebot senden'
  }
  if (contract.renewal_offer_status === 'sent') {
    return 'Nachfassen'
  }
  if (contract.renewal_customer_accepted) {
    return 'Abschluss bestätigen'
  }
  return 'Folgeaktion'
}

function getStuckStatus(contract) {
  if (!contract.renewal_last_activity) return 'no_contact'
  const daysSinceActivity = Math.floor((new Date() - new Date(contract.renewal_last_activity)) / (1000 * 60 * 60 * 24))
  if (daysSinceActivity > 14) return 'stuck'
  if (daysSinceActivity > 7) return 'warning'
  return null
}

function RenewalCard({ contract, onActionClick, isHotDeal = false }) {
  const daysLeft = contract.end_date
    ? Math.floor((new Date(contract.end_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  const [showDetails, setShowDetails] = useState(false)
  const [showMessage, setShowMessage] = useState(false)
  
  const conversionChance = calculateConversionChance(contract)
  const nextAction = getNextAction(contract)
  const stuckStatus = getStuckStatus(contract)

  return (
    <>
      <Card
        className={`border-l-4 ${getUrgencyColor(daysLeft)} flex-shrink-0 ${isHotDeal ? 'w-96 shadow-lg ring-2 ring-red-400' : 'w-72'} hover:shadow-lg transition-shadow cursor-default group`}
        onMouseEnter={() => setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
      >
        <CardContent className="p-4 space-y-3">
          {/* HEADER: Name + Product + Hot Badge */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-bold text-sm text-slate-900 truncate">{contract.customer_name}</p>
                <p className="text-xs text-muted-foreground truncate">{contract.product || contract.insurance_type}</p>
              </div>
              {isHotDeal && <span className="text-lg flex-shrink-0">🔥</span>}
            </div>
          </div>

          {/* NEXT ACTION BADGE */}
          <Badge className="w-full justify-center bg-blue-100 text-blue-700 font-semibold text-xs">
            ➜ {nextAction}
          </Badge>

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

          {/* URGENCY + CONVERSION CHANCE */}
          <div className="flex gap-2 flex-wrap">
            {daysLeft !== null && daysLeft < 120 && (
              <Badge className={daysLeft < 60 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}>
                {daysLeft < 0 ? 'ÜBERFÄLLIG' : `${daysLeft}d`}
              </Badge>
            )}
            <Badge className={conversionChance > 70 ? 'bg-green-100 text-green-700' : conversionChance > 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
              {conversionChance}% Chance
            </Badge>
            {stuckStatus === 'stuck' && (
              <Badge className="bg-red-100 text-red-700 font-bold">⚠️ STECKEN</Badge>
            )}
            {stuckStatus === 'warning' && (
              <Badge className="bg-yellow-100 text-yellow-700">⏰ 7d inaktiv</Badge>
            )}
          </div>

          {/* HOVER DETAILS */}
          {showDetails && (
            <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs">
              {contract.assigned_broker && (
                <p className="text-muted-foreground"><strong>Berater:</strong> {contract.assigned_broker}</p>
              )}
              {contract.renewal_last_activity && (
                <p className="text-muted-foreground">
                  <strong>Zuletzt:</strong> {new Date(contract.renewal_last_activity).toLocaleDateString('de-CH')}
                </p>
              )}
              <p className="text-muted-foreground">
                <strong>Stage:</strong> {contract.renewal_stage || 'early'}
              </p>
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
              <Phone className="w-3 h-3 mr-1" /> Ruf
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={() => onActionClick('offer', contract)}
            >
              <FileText className="w-3 h-3 mr-1" /> Ang
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={() => setShowMessage(true)}
            >
              <MessageSquare className="w-3 h-3 mr-1" /> Msg
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* MESSAGE DIALOG */}
      <Dialog open={showMessage} onOpenChange={setShowMessage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Follow-Up Message: {contract.customer_name}</DialogTitle>
          </DialogHeader>
          <Textarea
            defaultValue={`Sehr geehrte/r ${contract.customer_name},

Ihr Versicherungsvertrag (${contract.policy_number}) läuft am ${new Date(contract.end_date).toLocaleDateString('de-CH')} aus.

Gerne bespreche ich mit Ihnen die Verlängerung oder Optimierungsmöglichkeiten.

Freundliche Grüsse`}
            className="h-40"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessage(false)}>Abbrechen</Button>
            <Button onClick={() => { onActionClick('message', contract); setShowMessage(false) }}>Senden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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

  // Filter to active contracts — including overdue ones (end_date in past, status still 'active')
  const activeContracts = contracts.filter(c => c.status === 'active' && c.end_date)

  // Compute KPIs
  const kpis = useMemo(() => {
    const today = new Date()
    const critical = activeContracts.filter(c => {
      if (!c.end_date) return false
      const daysLeft = Math.floor((new Date(c.end_date) - today) / (1000 * 60 * 60 * 24))
      return daysLeft < 60 // includes overdue (negative daysLeft)
    })
    const expectedRevenue = activeContracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0)
    
    // Conversion metrics
    const withActivity = activeContracts.filter(c => c.renewal_last_activity).length
    const avgConversionChance = activeContracts.length > 0
      ? Math.round(activeContracts.reduce((sum, c) => sum + calculateConversionChance(c), 0) / activeContracts.length)
      : 0

    return {
      total: activeContracts.length,
      critical: critical.length,
      expectedRevenue: Math.round(expectedRevenue),
      avgConversion: avgConversionChance,
      conversionRate: activeContracts.length > 0 ? Math.round((withActivity / activeContracts.length) * 100) : 0,
    }
  }, [activeContracts])

  // Hot deals: <30 days, overdue, OR >70% conversion
  const hotDeals = useMemo(() => {
    const today = new Date()
    return activeContracts
      .filter(c => {
        if (!c.end_date) return false
        const daysLeft = Math.floor((new Date(c.end_date) - today) / (1000 * 60 * 60 * 24))
        const chance = calculateConversionChance(c)
        return daysLeft < 30 || chance > 70 // includes overdue (negative)
      })
      .sort((a, b) => {
        const aDays = a.end_date ? Math.floor((new Date(a.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : 999
        const bDays = b.end_date ? Math.floor((new Date(b.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : 999
        return aDays - bDays
      })
      .slice(0, 5)
  }, [activeContracts])

  // Organize contracts by stage with smart sorting
  const contractsByStage = useMemo(() => {
    const today = new Date()

    const sorted = (stageContracts) =>
      stageContracts.sort((a, b) => {
        // Prioritize critical (<60 days)
        const aDaysLeft = a.end_date ? Math.floor((new Date(a.end_date) - today) / (1000 * 60 * 60 * 24)) : 999
        const bDaysLeft = b.end_date ? Math.floor((new Date(b.end_date) - today) / (1000 * 60 * 60 * 24)) : 999

        const aCritical = aDaysLeft < 60 // includes overdue
        const bCritical = bDaysLeft < 60

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Renewals</p>
            <p className="text-2xl font-bold text-primary mt-1">{kpis.total}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Kritisch &lt;60d</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{kpis.critical}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Erwarteter Umsatz</p>
            <p className="text-lg font-bold text-green-600 mt-1">
              CHF {(kpis.expectedRevenue / 1000).toFixed(0)}k
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Ø Conversion Chance</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{kpis.avgConversion}%</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Mit Aktivität</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{kpis.conversionRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* HOT RENEWALS SECTION */}
      {hotDeals.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 p-6 rounded-lg border-2 border-red-200">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-bold text-red-900">🔥 HOT RENEWALS – Top {hotDeals.length} (Fokus jetzt!)</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {hotDeals.map(deal => (
              <RenewalCard
                key={deal.id}
                contract={deal}
                onActionClick={(action, c) => console.log(`Action: ${action} on`, c)}
                isHotDeal={true}
              />
            ))}
          </div>
        </div>
      )}

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

      {/* HINTS */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
        <p className="text-xs text-blue-900"><strong>💡 Conversion Booster:</strong></p>
        <ul className="text-xs text-blue-800 space-y-1 ml-4">
          <li>✓ <strong>Next Action:</strong> automatisch berechnet – folge der Empfehlung</li>
          <li>✓ <strong>Conversion Chance:</strong> zeigt Abschluss-Wahrscheinlichkeit</li>
          <li>✓ <strong>Hot Renewals:</strong> die wichtigsten 5 Deals – diese sind dein Fokus</li>
          <li>✓ <strong>Msg Button:</strong> sendet vorgefertigte Follow-Up-Nachricht</li>
          <li>✓ <strong>⚠️ STECKEN:</strong> Deals ohne Aktivität &gt; 14 Tage</li>
        </ul>
      </div>
    </div>
  )
}