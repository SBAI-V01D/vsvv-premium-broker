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
    <div className="space-y-5">
      {/* Haushalts-KPIs — reduced visual weight */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 rounded-lg bg-[hsl(var(--surface-2))] border border-[hsl(var(--border-subtle))]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Users className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
            <span className="text-[9px] font-semibold uppercase tracking-widest text-[hsl(var(--text-muted))]">Haushalt</span>
          </div>
          <p className="text-xl font-bold text-[hsl(var(--text-heading))]">{familyMembers.length + 1}</p>
          <p className="text-[9px] text-[hsl(var(--text-muted))]">Personen</p>
        </div>
        <div className="p-3.5 rounded-lg bg-[hsl(var(--surface-2))] border border-[hsl(var(--border-subtle))]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
            <span className="text-[9px] font-semibold uppercase tracking-widest text-[hsl(var(--text-muted))]">Versichert</span>
          </div>
          <p className="text-lg font-bold text-[hsl(var(--text-heading))">{activeContracts.length}</p>
          <p className="text-[9px] text-[hsl(var(--text-muted))]">Verträge</p>
        </div>
        <div className="p-3.5 rounded-lg bg-[hsl(var(--surface-2))] border border-[hsl(var(--border-subtle))]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--info))]" />
            <span className="text-[9px] font-semibold uppercase tracking-widest text-[hsl(var(--text-muted))]">Prämie/Jahr</span>
          </div>
          <p className="text-lg font-bold text-[hsl(var(--text-heading))]">CHF {(totalPremium / 1000).toFixed(1)}k</p>
          <p className="text-[9px] text-[hsl(var(--text-muted))]}">{insurers.size} Gesellschaften</p>
        </div>
      </div>

      {/* Cross-Selling Potenzial */}
      {crossSellOpportunities.length > 0 && (
        <div className="p-3.5 rounded-lg bg-[hsl(var(--warning))/0.08] border border-[hsl(var(--warning))/0.2]">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />
            <span className="text-[9px] font-semibold uppercase tracking-widest text-[hsl(var(--text-muted))]">Cross-Selling</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {crossSellOpportunities.map((opp, idx) => (
              <Badge key={idx} variant="outline" className="text-[10px] bg-[hsl(var(--warning))/0.1] text-[hsl(var(--warning))] border-[hsl(var(--warning))/0.3]">
                {opp}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Familienmitglieder mit Details — increased whitespace */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--text-muted))]">
          Haushaltsmitglieder ({familyMembers.length})
        </p>
        {familyMembers.map(member => {
          const memberContracts = contracts.filter(c => c.customer_id === member.id)
          const memberActive = memberContracts.filter(c => c.status === 'active')
          const memberPremium = memberActive.reduce((sum, c) => sum + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)

          return (
            <div
              key={member.id}
              className="group p-4 rounded-lg border border-[hsl(var(--border-subtle))] hover:border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-2))]/40 transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-body-sm text-[hsl(var(--text-heading))]">
                      {member.first_name} {member.last_name}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] px-1.5 py-0.5',
                        member.family_role === 'spouse' ? 'bg-[hsl(var(--primary))/0.08] text-[hsl(var(--primary))] border-[hsl(var(--primary))/0.2]' :
                        member.family_role === 'child' ? 'bg-[hsl(var(--info))/0.08] text-[hsl(var(--info))] border-[hsl(var(--info))/0.2]' :
                        'bg-[hsl(var(--surface-3))] text-[hsl(var(--text-muted))] border-[hsl(var(--border-subtle))]'
                      )}
                    >
                      {member.family_role === 'spouse' ? 'Ehepartner' :
                       member.family_role === 'child' ? 'Kind' :
                       member.family_role || 'Mitglied'}
                    </Badge>
                  </div>
                  {member.birthdate && (
                    <p className="text-body-sm text-[hsl(var(--text-muted))]">
                      Geb. {new Date(member.birthdate).toLocaleDateString('de-CH')}
                      {member.age && <span className="ml-1.5">· {member.age} Jahre</span>}
                    </p>
                  )}
                </div>
                {memberPremium > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-body-sm font-bold text-[hsl(var(--text-heading))]">CHF {(memberPremium / 1000).toFixed(1)}k</p>
                    <p className="text-[10px] text-[hsl(var(--text-muted))]">Jahr</p>
                  </div>
                )}
              </div>

              {memberActive.length > 0 && (
                <div className="flex items-center gap-2 pt-2.5 border-t border-[hsl(var(--border-subtle))]">
                  <FileText className="w-3 h-3 text-[hsl(var(--text-muted))] shrink-0" />
                  <div className="flex-1 flex flex-wrap gap-1.5">
                    {memberActive.slice(0, 5).map(c => (
                      <Badge key={c.id} variant="outline" className="text-[10px] bg-[hsl(var(--surface-2))] text-[hsl(var(--text-heading))] border-[hsl(var(--border-subtle))]">
                        {c.insurer}
                      </Badge>
                    ))}
                    {memberActive.length > 5 && (
                      <Badge variant="outline" className="text-[10px] bg-[hsl(var(--surface-2))] text-[hsl(var(--text-heading))] border-[hsl(var(--border-subtle))]">
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
      <div className="pt-4 border-t border-[hsl(var(--border-subtle))]">
        <div className="flex items-center justify-between">
          <span className="text-body-sm font-medium text-[hsl(var(--text-heading))]">Gesamtprämie Haushalt</span>
          <span className="text-heading font-bold text-[hsl(var(--text-heading))]">CHF {totalPremium.toLocaleString('de-CH')}</span>
        </div>
      </div>
    </div>
  )
}