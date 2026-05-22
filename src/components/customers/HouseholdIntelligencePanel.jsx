import React from 'react'
import { Users, Home, FileText, TrendingUp, AlertCircle, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Erweitertes Household Panel mit Relationship Intelligence.
 * Zeigt nicht nur Familienmitglieder, sondern auch:
 * - Gemeinsame Policen
 * - Rollen & Beziehungen
 * - Cross-Selling Potenzial
 * - Haushalts-Premium
 */
export default function HouseholdIntelligencePanel({ primaryCustomer, familyMembers, contracts, opportunities }) {
  if (!familyMembers || familyMembers.length === 0) {
    return (
      <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-50/50 rounded-xl border border-slate-200 text-center">
        <Users className="w-6 h-6 mx-auto mb-2.5 text-slate-400 opacity-60" />
        <p className="text-sm font-semibold text-slate-700">Einzelkunde</p>
        <p className="text-xs text-slate-500 mt-0.5">Keine Familienmitglieder erfasst</p>
        <button className="mt-3 text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
          <Users className="w-3 h-3" /> Familienmitglied hinzufügen
        </button>
      </div>
    )
  }

  // Haushalts-KPIs berechnen
  const allCustomerIds = [primaryCustomer.id, ...familyMembers.map(f => f.id)]
  const householdContracts = contracts.filter(c => allCustomerIds.includes(c.customer_id))
  const activeContracts = householdContracts.filter(c => c.status === 'active')
  const totalPremium = activeContracts.reduce((sum, c) => sum + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)
  const insurers = new Set(activeContracts.map(c => c.insurer))
  
  // Cross-Selling Potenzial
  const hasLife = activeContracts.some(c => c.insurance_type === 'life')
  const hasHealth = activeContracts.some(c => c.insurance_type === 'health')
  const hasProperty = activeContracts.some(c => c.insurance_type === 'property')
  const crossSellOpportunities = []
  
  if (!hasLife) crossSellOpportunities.push('Lebensversicherung')
  if (!hasHealth) crossSellOpportunities.push('Krankenzusatz')
  if (!hasProperty) crossSellOpportunities.push('Haftpflicht/Hausrat')

  return (
    <div className="space-y-4">
      {/* Haushalts-KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-blue-50/50 border border-blue-200/60">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px] font-semibold text-blue-700 uppercase">Haushalt</span>
          </div>
          <p className="text-xl font-bold text-blue-800">{familyMembers.length + 1}</p>
          <p className="text-[9px] text-blue-600">Personen</p>
        </div>
        <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-50/50 border border-emerald-200/60">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[10px] font-semibold text-emerald-700 uppercase">Versichert</span>
          </div>
          <p className="text-lg font-bold text-emerald-800">{activeContracts.length}</p>
          <p className="text-[9px] text-emerald-600">Verträge</p>
        </div>
        <div className="p-3 rounded-lg bg-gradient-to-br from-violet-50 to-violet-50/50 border border-violet-200/60">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-[10px] font-semibold text-violet-700 uppercase">Prämie/Jahr</span>
          </div>
          <p className="text-lg font-bold text-violet-800">CHF {(totalPremium / 1000).toFixed(1)}k</p>
          <p className="text-[9px] text-violet-600">{insurers.size} Gesellschaften</p>
        </div>
      </div>

      {/* Cross-Selling Potenzial */}
      {crossSellOpportunities.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200/70">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[10px] font-semibold text-amber-800 uppercase">Cross-Selling</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {crossSellOpportunities.map((opp, idx) => (
              <Badge key={idx} className="text-[10px] bg-amber-100 text-amber-800 border-amber-300/60">
                {opp}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Familienmitglieder mit Details */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
          Haushaltsmitglieder ({familyMembers.length})
        </p>
        {familyMembers.map(member => {
          const memberContracts = contracts.filter(c => c.customer_id === member.id)
          const memberActive = memberContracts.filter(c => c.status === 'active')
          const memberPremium = memberActive.reduce((sum, c) => sum + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)

          return (
            <div
              key={member.id}
              className="group p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm text-slate-800">
                      {member.first_name} {member.last_name}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] px-1.5 py-0.5',
                        member.family_role === 'spouse' ? 'bg-pink-50 text-pink-700 border-pink-200' :
                        member.family_role === 'child' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                      )}
                    >
                      {member.family_role === 'spouse' ? 'Ehepartner' :
                       member.family_role === 'child' ? 'Kind' :
                       member.family_role || 'Mitglied'}
                    </Badge>
                  </div>
                  {member.birthdate && (
                    <p className="text-[10px] text-slate-500">
                      Geb. {new Date(member.birthdate).toLocaleDateString('de-CH')}
                      {member.age && <span className="ml-1.5">· {member.age} Jahre</span>}
                    </p>
                  )}
                </div>
                {memberPremium > 0 && (
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-700">CHF {(memberPremium / 1000).toFixed(1)}k</p>
                    <p className="text-[9px] text-slate-500">Jahr</p>
                  </div>
                )}
              </div>

              {memberActive.length > 0 && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                  <div className="flex-1 flex flex-wrap gap-1">
                    {memberActive.slice(0, 5).map(c => (
                      <Badge key={c.id} variant="secondary" className="text-[9px] bg-slate-100 text-slate-700 border-slate-200">
                        {c.insurer}
                      </Badge>
                    ))}
                    {memberActive.length > 5 && (
                      <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-700 border-slate-200">
                        +{memberActive.length - 5}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Zusammenfassung */}
      <div className="pt-3 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">Gesamtprämie Haushalt</span>
          <span className="text-sm font-bold text-slate-800">CHF {totalPremium.toLocaleString('de-CH')}</span>
        </div>
      </div>
    </div>
  )
}