// Zentrale Deutsche Übersetzungen für alle Enum-Werte

export const STATUS_LABELS = {
  // Kunden
  active: 'Aktiv',
  inactive: 'Inaktiv',
  prospect: 'Interessent',
  // Verträge
  cancelled: 'Gekündigt',
  paused: 'Pausiert',
  expired: 'Abgelaufen',
  // Anträge
  draft: 'Entwurf',
  submitted: 'Eingereicht',
  under_review: 'In Prüfung',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
}

export const INSURANCE_TYPE_LABELS = {
  life: 'Leben',
  health: 'Kranken',
  property: 'Sach',
  liability: 'Haftpflicht',
  motor: 'Motorfahrzeug',
  other: 'Sonstiges',
}

export const FAMILY_ROLE_LABELS = {
  primary: 'Hauptkunde',
  spouse: 'Ehepartner/in',
  child: 'Kind',
  parent: 'Elternteil',
  other: 'Sonstiges',
}

export const RISK_PROFILE_LABELS = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
}

export const CIVIL_STATUS_LABELS = {
  single: 'Ledig',
  married: 'Verheiratet',
  divorced: 'Geschieden',
  widowed: 'Verwitwet',
}

export function label(map, value) {
  return map[value] || value
}