import React from 'react'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/rbac'

export default function RoleBadge({ role, size = 'sm' }) {
  if (!role) return null
  const label  = ROLE_LABELS[role] || role
  const colors = ROLE_COLORS[role] || 'bg-slate-100 text-slate-700 border-slate-300'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colors}`}>
      {label}
    </span>
  )
}