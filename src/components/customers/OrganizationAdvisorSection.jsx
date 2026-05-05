import React, { useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Organizational & Advisor Assignment Section for Customer Form
 * 
 * Enforces:
 * - organization_id is mandatory
 * - Advisor + Teamlead must be from same organization as customer
 * - Auto-populates available advisors based on selected org
 */
export default function OrganizationAdvisorSection({
  formData,
  onFormChange,
  organizations = [],
  advisors = [],
}) {
  const selectedOrg = formData.organization_id ? organizations.find(o => o.id === formData.organization_id) : null

  // Filter advisors by selected organization
  const advisorsInOrg = useMemo(() => {
    if (!formData.organization_id) return []
    return advisors.filter(a => a.organization_id === formData.organization_id && a.status === 'active')
  }, [formData.organization_id, advisors])

  const teamleadsInOrg = useMemo(() => {
    return advisorsInOrg.filter(a => a.role === 'team_lead')
  }, [advisorsInOrg])

  const regularAdvisorsInOrg = useMemo(() => {
    return advisorsInOrg.filter(a => a.role === 'advisor')
  }, [advisorsInOrg])

  // Check if selected advisor still belongs to the organization
  const selectedAdvisor = advisors.find(a => a.id === formData.advisor_id)
  const advisorMismatch = selectedAdvisor && selectedAdvisor.organization_id !== formData.organization_id

  const selectedTeamlead = advisors.find(a => a.id === formData.teamlead_id)
  const teamleadMismatch = selectedTeamlead && selectedTeamlead.organization_id !== formData.organization_id

  return (
    <div className="space-y-4 p-4 bg-muted/20 rounded-lg border">
      <p className="text-sm font-semibold text-foreground">Organisation & Berater</p>

      {/* Organization - REQUIRED */}
      <div>
        <label className="text-sm font-semibold flex items-center gap-2">
          Organisation *
          {formData.organization_id && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
        </label>
        <Select
          value={formData.organization_id || ''}
          onValueChange={v => onFormChange({
            ...formData,
            organization_id: v,
            // Clear advisor selections when org changes
            advisor_id: '',
            teamlead_id: ''
          })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Organisation wählen (erforderlich)" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map(o => (
              <SelectItem key={o.id} value={o.id}>
                {o.name} {o.type && `(${o.type})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!formData.organization_id && (
          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Organisation ist erforderlich
          </p>
        )}
      </div>

      {/* Teamleiter - AUTO SELECT / OPTIONAL */}
      {formData.organization_id && (
        <div>
          <label className="text-sm font-semibold flex items-center gap-2">
            Teamleiter
            {teamleadsInOrg.length > 0 ? (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                {teamleadsInOrg.length} verfügbar
              </span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                Keine verfügbar
              </span>
            )}
          </label>
          <Select
            value={formData.teamlead_id || ''}
            onValueChange={v => onFormChange({ ...formData, teamlead_id: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={teamleadsInOrg.length > 0 ? 'Teamleiter wählen' : 'Keine Teamleiter in dieser Org'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>– Kein Teamleiter –</SelectItem>
              {teamleadsInOrg.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.firstname} {a.lastname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {teamleadMismatch && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Teamleiter gehört nicht zu dieser Organisation
            </p>
          )}
        </div>
      )}

      {/* Advisor - OPTIONAL */}
      {formData.organization_id && (
        <div>
          <label className="text-sm font-semibold flex items-center gap-2">
            Berater
            {regularAdvisorsInOrg.length > 0 ? (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                {regularAdvisorsInOrg.length} verfügbar
              </span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                Keine verfügbar
              </span>
            )}
          </label>
          <Select
            value={formData.advisor_id || ''}
            onValueChange={v => onFormChange({ ...formData, advisor_id: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={regularAdvisorsInOrg.length > 0 ? 'Berater wählen' : 'Keine Berater in dieser Org'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>– Kein Berater –</SelectItem>
              {regularAdvisorsInOrg.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.firstname} {a.lastname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {advisorMismatch && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Berater gehört nicht zu dieser Organisation
            </p>
          )}
        </div>
      )}

      {selectedOrg && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          <p className="font-medium">{selectedOrg.name}</p>
          <p className="text-muted-foreground">
            {advisorsInOrg.length} aktive Berater · {teamleadsInOrg.length} Teamleiter
          </p>
        </div>
      )}
    </div>
  )
}