import React from 'react'
import { Users, Home, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function FamilyOverviewPanel({ primaryCustomer, familyMembers, contracts }) {
  if (!familyMembers || familyMembers.length === 0) {
    return (
      <div className="p-4 bg-muted/20 rounded-lg border text-center text-sm text-muted-foreground">
        <Users className="w-5 h-5 mx-auto mb-2 opacity-40" />
        Keine Familienmitglieder erfasst
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Adresse */}
      {(primaryCustomer?.street || primaryCustomer?.city) && (
        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Home className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="text-xs text-blue-600 font-semibold uppercase">Gemeinsame Adresse</p>
            <p className="font-medium text-blue-900">
              {primaryCustomer?.street}{primaryCustomer?.zip_code && `, ${primaryCustomer.zip_code}`} {primaryCustomer?.city}
            </p>
          </div>
        </div>
      )}

      {/* Familienmitglieder */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase">Familienmitglieder ({familyMembers.length})</p>
        {familyMembers.map(member => {
          const memberContracts = contracts.filter(c => c.customer_id === member.id)
          const activeContracts = memberContracts.filter(c => c.status === 'active')

          return (
            <div key={member.id} className="p-3 border rounded-lg hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-sm">
                    {member.first_name} {member.last_name}
                  </p>
                  {member.birthdate && (
                    <p className="text-xs text-muted-foreground">
                      Geb. {new Date(member.birthdate).toLocaleDateString('de-CH')}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {member.family_role === 'spouse' ? '👰 Ehepartner' : member.family_role === 'child' ? '👧 Kind' : '👤 ' + (member.family_role || 'Mitglied')}
                </Badge>
              </div>

              {memberContracts.length > 0 && (
                <div className="text-xs space-y-1 pt-2 border-t">
                  <p className="font-medium text-muted-foreground">
                    {activeContracts.length}/{memberContracts.length} aktive Verträge
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {memberContracts.slice(0, 4).map(c => (
                      <Badge key={c.id} variant="secondary" className="text-[10px]">
                        {c.insurer || 'Versicherer'}
                      </Badge>
                    ))}
                    {memberContracts.length > 4 && (
                      <Badge variant="secondary" className="text-[10px]">
                        +{memberContracts.length - 4}
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
      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <div className="text-center p-2 bg-muted/50 rounded">
          <p className="text-xs text-muted-foreground">Haushalt Verträge</p>
          <p className="text-lg font-bold text-foreground">
            {contracts.filter(c => c.status === 'active').length}
          </p>
        </div>
        <div className="text-center p-2 bg-muted/50 rounded">
          <p className="text-xs text-muted-foreground">Personen</p>
          <p className="text-lg font-bold text-foreground">
            {familyMembers.length + 1}
          </p>
        </div>
      </div>
    </div>
  )
}