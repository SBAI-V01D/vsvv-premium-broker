/**
 * Advisor Assignment & Validation Logic
 * 
 * Zentrale Validierungs- und Auto-Zuweisungslogik für:
 * - Customer organization_id (Pflicht)
 * - Berater & Teamleiter (nur aus gleicher Org)
 * - Auto-Zuweisung von Teamleiter bei Customer-Erstellung
 */

/**
 * Validiert dass Berater/Teamleiter zur gleichen Organisation gehören
 */
export async function validateAdvisorAssignment(customerId, advisorId, organizationId, advisors) {
  if (!advisorId) return { valid: true };
  
  const advisor = advisors.find(a => a.id === advisorId);
  if (!advisor) {
    return { valid: false, error: 'Berater nicht gefunden' };
  }
  
  if (advisor.organization_id !== organizationId) {
    return {
      valid: false,
      error: `Berater gehört zu Organization ${advisor.organization_id}, aber Kunde zu ${organizationId}. Bitte Berater aus der gleichen Organisation wählen.`
    };
  }
  
  return { valid: true };
}

/**
 * Auto-findet Teamleiter in derselben Organisation
 * Gibt die ID des ersten aktiven Teamleiters zurück (falls vorhanden)
 */
export function autoFindTeamlead(organizationId, advisors) {
  const teamlead = advisors.find(a =>
    a.organization_id === organizationId &&
    a.role === 'team_lead' &&
    a.status === 'active'
  );
  return teamlead?.id || null;
}

/**
 * Validiert dass Organization gesetzt ist
 */
export function validateOrganizationRequired(organizationId) {
  if (!organizationId) {
    return { valid: false, error: 'Organization ist erforderlich. Bitte eine Organisation zuweisen.' };
  }
  return { valid: true };
}

/**
 * Validiert dass zwei Advisor aus gleicher Org sind
 */
export function validateSameOrganization(advisor1OrgId, advisor2OrgId) {
  if (advisor1OrgId !== advisor2OrgId) {
    return { valid: false, error: 'Berater und Teamleiter müssen aus der gleichen Organisation sein.' };
  }
  return { valid: true };
}

export default {
  validateAdvisorAssignment,
  autoFindTeamlead,
  validateOrganizationRequired,
  validateSameOrganization
};