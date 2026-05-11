import React, { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, Clock, Building2, MoreVertical } from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const SPARTEN_GROUPS = {
  motorfahrzeug: { label: '🚗 Motorfahrzeug', color: 'bg-blue-50 border-blue-200' },
  hausrat: { label: '🏠 Hausrat', color: 'bg-amber-50 border-amber-200' },
  gebaude_privat: { label: '🏡 Gebäude', color: 'bg-amber-50 border-amber-200' },
  haftpflicht_privat: { label: '⚖️ Haftpflicht', color: 'bg-green-50 border-green-200' },
  betriebshaftpflicht: { label: '⚖️ Betriebshaftpflicht', color: 'bg-green-50 border-green-200' },
  unfall_privat: { label: '🚨 Unfall', color: 'bg-purple-50 border-purple-200' },
  uvg: { label: '🚨 UVG', color: 'bg-purple-50 border-purple-200' },
  rechtsschutz_privat: { label: '⚖️ Rechtsschutz', color: 'bg-pink-50 border-pink-200' },
  ktg: { label: '💼 Krankentaggeld', color: 'bg-cyan-50 border-cyan-200' },
  kvg: { label: '🏥 Krankenversicherung', color: 'bg-red-50 border-red-200' },
  vvg_zusatz: { label: '🏥 Zusatzversicherung', color: 'bg-red-50 border-red-200' },
  bvg: { label: '🎯 BVG/Pensionskasse', color: 'bg-indigo-50 border-indigo-200' },
  leben_3a: { label: '💰 Leben 3a', color: 'bg-orange-50 border-orange-200' },
  leben_3b: { label: '💰 Leben 3b', color: 'bg-orange-50 border-orange-200' },
}

function getContractStatus(contract) {
  if (!contract.end_date) return { icon: CheckCircle2, label: 'Stabil', color: 'text-green-600', bg: 'bg-green-50' }

  const days = Math.ceil((new Date(contract.end_date) - new Date()) / (1000 * 60 * 60 * 24))
  
  if (days < 0) return { icon: AlertCircle, label: 'Überfällig', color: 'text-red-600', bg: 'bg-red-50' }
  if (days <= 30) return { icon: AlertCircle, label: 'Ablauf < 30 Tage', color: 'text-red-600', bg: 'bg-red-50' }
  if (days <= 90) return { icon: Clock, label: 'Ablauf < 90 Tage', color: 'text-amber-600', bg: 'bg-amber-50' }
  return { icon: CheckCircle2, label: 'Stabil', color: 'text-green-600', bg: 'bg-green-50' }
}

function ContractRow({ contract, family, onStartReview, onCreateOpportunity }) {
  const status = getContractStatus(contract)
  const StatusIcon = status.icon

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors text-sm">
      {/* Status Ampel */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full ${status.bg} flex items-center justify-center`}>
        <StatusIcon className={`w-4 h-4 ${status.color}`} />
      </div>

      {/* Vertrag Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{contract.insurer || '—'}</p>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {contract.policy_number || 'Keine Nummer'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {contract.product || contract.sparte || '—'}
          {family && <span className="ml-1">• {family.first_name} {family.last_name}</span>}
        </p>
      </div>

      {/* Prämie + Ablauf */}
      <div className="text-right flex-shrink-0">
        {contract.premium_yearly && (
          <p className="font-semibold text-xs">CHF {contract.premium_yearly.toLocaleString('de-CH')}/a</p>
        )}
        {contract.end_date && (
          <p className="text-xs text-muted-foreground">
            {format(new Date(contract.end_date), 'd.MMM.yy', { locale: de })}
          </p>
        )}
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onStartReview(contract)}>
            📋 Review starten
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCreateOpportunity(contract)}>
            💡 Verkaufschance
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default function ContractsBySparteGroup({ contracts, familyMembers, primaryCustomer, onStartReview, onCreateOpportunity }) {
  const groupedContracts = useMemo(() => {
    const groups = {}
    contracts.forEach(c => {
      const sparte = c.sparte || c.insurance_type || 'other'
      if (!groups[sparte]) groups[sparte] = []
      groups[sparte].push(c)
    })
    return groups
  }, [contracts])

  const totalPremium = useMemo(() => {
    return contracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0)
  }, [contracts])

  const getFamilyForContract = (contractCustomerId) => {
    if (contractCustomerId === primaryCustomer.id) return null
    return familyMembers.find(m => m.id === contractCustomerId)
  }

  return (
    <div className="space-y-6">
      {/* Gesamt-Prämie */}
      {totalPremium > 0 && (
        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-lg border">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Gesamtprämie (jährlich)</p>
            <p className="text-xl font-bold text-slate-800 mt-1">
              CHF {(totalPremium).toLocaleString('de-CH')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Monatlich</p>
            <p className="text-xl font-bold text-slate-800 mt-1">
              CHF {(totalPremium / 12).toLocaleString('de-CH', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      )}

      {/* Sparten-Gruppen */}
      {Object.entries(groupedContracts).map(([sparteKey, sparteContracts]) => {
        const sparteInfo = SPARTEN_GROUPS[sparteKey] || { label: sparteKey, color: 'bg-gray-50 border-gray-200' }
        
        return (
          <Card key={sparteKey} className={`${sparteInfo.color} border`}>
            {/* Sparten-Header */}
            <div className="px-4 py-3 border-b bg-opacity-50 flex items-center justify-between">
              <h4 className="font-semibold text-sm">{sparteInfo.label}</h4>
              <Badge variant="secondary" className="text-xs">
                {sparteContracts.length} {sparteContracts.length === 1 ? 'Vertrag' : 'Verträge'}
              </Badge>
            </div>

            {/* Verträge */}
            <div className="divide-y p-3 space-y-1">
              {sparteContracts.map(contract => (
                <div key={contract.id} className="pt-2 first:pt-0">
                  <ContractRow
                    contract={contract}
                    family={getFamilyForContract(contract.customer_id)}
                    onStartReview={onStartReview}
                    onCreateOpportunity={onCreateOpportunity}
                  />
                </div>
              ))}
            </div>
          </Card>
        )
      })}

      {contracts.length === 0 && (
        <div className="text-center p-8 text-muted-foreground">
          <p className="text-sm">Keine Verträge vorhanden</p>
        </div>
      )}
    </div>
  )
}