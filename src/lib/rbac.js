/**
 * ENTERPRISE RBAC FOUNDATION
 * Role-Based Access Control — UI Layer
 * Backend enforcement is handled via Base44 entity permissions.
 * This module drives UI visibility, navigation filtering, and feature gating.
 */

export const ROLES = {
  ADMIN:       'admin',
  MANAGEMENT:  'management',
  BROKER:      'broker',
  BACKOFFICE:  'backoffice',
  FINANCE:     'finance',
  SUPPORT:     'support',
  COMPLIANCE:  'compliance',
}

export const ROLE_LABELS = {
  admin:      'Administrator',
  management: 'Management',
  broker:     'Berater',
  backoffice: 'Backoffice',
  finance:    'Finanzen',
  support:    'Support',
  compliance: 'Compliance',
}

export const ROLE_COLORS = {
  admin:      'bg-red-100 text-red-800 border-red-300',
  management: 'bg-purple-100 text-purple-800 border-purple-300',
  broker:     'bg-blue-100 text-blue-800 border-blue-300',
  backoffice: 'bg-slate-100 text-slate-800 border-slate-300',
  finance:    'bg-emerald-100 text-emerald-800 border-emerald-300',
  support:    'bg-amber-100 text-amber-800 border-amber-300',
  compliance: 'bg-orange-100 text-orange-800 border-orange-300',
}

/**
 * Permission matrix — what each role can see/do in the UI.
 * Backend always re-validates; this is UI-layer gating only.
 */
export const PERMISSIONS = {
  // Navigation access
  canViewFinance:      (role) => ['admin', 'management', 'finance'].includes(role),
  canViewAllCustomers: (role) => ['admin', 'management', 'backoffice', 'compliance'].includes(role),
  canViewSystemLogs:   (role) => ['admin', 'compliance'].includes(role),
  canViewAdvisors:     (role) => ['admin', 'management'].includes(role),
  canViewCEO:          (role) => ['admin', 'management'].includes(role),
  canExport:           (role) => ['admin', 'management', 'finance', 'compliance'].includes(role),
  canDeleteRecords:    (role) => ['admin'].includes(role),
  canModifyStatus:     (role) => ['admin', 'management', 'backoffice'].includes(role),
  canViewAuditLog:     (role) => ['admin', 'compliance', 'management'].includes(role),

  // Feature gating
  canApprovePayouts:   (role) => ['admin', 'finance'].includes(role),
  canApproveRenewals:  (role) => ['admin', 'management', 'backoffice'].includes(role),
  canSendCampaigns:    (role) => ['admin', 'management', 'backoffice'].includes(role),
  canAccessPortal:     (role) => ['admin', 'backoffice', 'support'].includes(role),
}

/**
 * Resolve effective role from Base44 user object.
 * Base44 uses `role` field ('admin' | 'user').
 * We extend it by checking if user has a custom role property.
 */
export function resolveRole(user) {
  if (!user) return ROLES.BROKER
  // Base44 admin → maps to ADMIN
  if (user.role === 'admin') return ROLES.ADMIN
  // Custom role stored on user entity
  if (user.broker_role) return user.broker_role
  // Default: broker for regular users
  return ROLES.BROKER
}