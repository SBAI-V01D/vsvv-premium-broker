import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, FileText, Edit } from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

const FAMILY_ROLE_LABELS = {
  spouse: 'Ehepartner/in',
  child: 'Kind',
  parent: 'Elternteil',
  primary: 'Hauptkontakt',
  other: 'Mitglied'
}

export default function FamilyMemberCard({ member, memberContracts = [], onEdit }) {
  const getPrimarySparte = () => {
    const spartes = memberContracts
      .map(c => c.sparte || c.insurance_type)
      .filter(Boolean)
    if (spartes.length === 0) return null
    const counts = {}
    spartes.forEach(s => counts[s] = (counts[s] || 0) + 1)
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]
  }

  const getStatus = () => {
    if (memberContracts.length === 0) return { label: 'Keine Verträge', color: 'bg-slate-100 text-slate-700' }
    const today = new Date()
    const critical = memberContracts.some(c => c.end_date && new Date(c.end_date) < today)
    const urgent = memberContracts.some(c => {
      const days = Math.ceil((new Date(c.end_date) - today) / (1000 * 60 * 60 * 24))
      return days >= 0 && days <= 30
    })
    if (critical) return { label: '⚠️ Überfällig', color: 'bg-red-100 text-red-700' }
    if (urgent) return { label: '⏰ Bald fällig', color: 'bg-amber-100 text-amber-700' }
    return { label: '✓ Stabil', color: 'bg-green-100 text-green-700' }
  }

  const primarySparte = getPrimarySparte()
  const status = getStatus()
  const age = member.birthdate ? Math.floor((new Date() - new Date(member.birthdate)) / (365.25 * 24 * 60 * 60 * 1000)) : null

  return (
    <Card className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-primary">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">{member.first_name} {member.last_name}</h4>
          <p className="text-xs text-muted-foreground">{FAMILY_ROLE_LABELS[member.family_role] || 'Mitglied'}</p>
        </div>
        <Badge variant="outline" className={`text-xs ${status.color} border-0`}>
          {status.label}
        </Badge>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-3 text-xs">
        {member.birthdate && (
          <p className="text-muted-foreground">
            <strong>Geb.:</strong> {format(new Date(member.birthdate), 'd. MMMM yyyy', { locale: de })}
            {age && ` (${age}J)`}
          </p>
        )}
        {primarySparte && (
          <p className="text-muted-foreground">
            <strong>Hauptsparte:</strong> {primarySparte}
          </p>
        )}
        <div className="flex items-center gap-1 text-muted-foreground">
          <FileText className="w-3.5 h-3.5" />
          <span>{memberContracts.length} {memberContracts.length === 1 ? 'Vertrag' : 'Verträge'}</span>
        </div>
      </div>

      {/* Contract Summary */}
      {memberContracts.length > 0 && (
        <div className="mb-3 p-2 bg-muted/30 rounded text-xs space-y-1 max-h-24 overflow-y-auto">
          {memberContracts.slice(0, 3).map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="font-medium truncate">{c.insurer}</span>
              {c.end_date && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {format(new Date(c.end_date), 'd.MM.yy', { locale: de })}
                </span>
              )}
            </div>
          ))}
          {memberContracts.length > 3 && (
            <p className="text-[10px] text-primary font-medium pt-1">+{memberContracts.length - 3} weitere</p>
          )}
        </div>
      )}

      {/* Action */}
      {onEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => onEdit(member)}
        >
          <Edit className="w-3.5 h-3.5 mr-1" />
          Details
        </Button>
      )}
    </Card>
  )
}