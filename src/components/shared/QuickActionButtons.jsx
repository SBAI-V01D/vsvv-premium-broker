import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Phone, Mail, User, Edit, FileText, CheckSquare, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * QuickActionButtons - schnelle Aktionen für jeden Datensatz
 * Werden beim Hover angezeigt und ermöglichen:
 * - Kunde öffnen
 * - Anrufen
 * - E-Mail senden
 * - Bearbeiten
 * - Aufgabe erledigen
 */
export default function QuickActionButtons({ 
  onEdit,
  onComplete,
  customerEmail,
  customerPhone,
  customerId,
  policyId,
  taskId,
  onCustomerClick,
  className = '',
  size = 'sm',
  variant = 'ghost'
}) {
  const navigate = useNavigate()

  const actions = []

  if (customerPhone) {
    actions.push({
      icon: Phone,
      label: 'Anrufen',
      onClick: () => window.location.href = `tel:${customerPhone}`,
      color: 'text-green-600 hover:text-green-700'
    })
  }

  if (customerEmail) {
    actions.push({
      icon: Mail,
      label: 'E-Mail',
      onClick: () => window.location.href = `mailto:${customerEmail}`,
      color: 'text-blue-600 hover:text-blue-700'
    })
  }

  if (customerId) {
    actions.push({
      icon: User,
      label: 'Kunde',
      onClick: onCustomerClick ? onCustomerClick : () => navigate(`/kunden/${customerId}`),
      color: 'text-purple-600 hover:text-purple-700'
    })
  }

  if (onEdit) {
    actions.push({
      icon: Edit,
      label: 'Bearbeiten',
      onClick: onEdit,
      color: 'text-slate-600 hover:text-slate-700'
    })
  }

  if (onComplete) {
    actions.push({
      icon: CheckSquare,
      label: 'Erledigt',
      onClick: onComplete,
      color: 'text-emerald-600 hover:text-emerald-700'
    })
  }

  if (actions.length === 0) return null

  return (
    <div className={cn('flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity', className)}>
      {actions.map((action, idx) => {
        const Icon = action.icon
        return (
          <Button
            key={idx}
            size={size}
            variant={variant}
            onClick={(e) => {
              e.stopPropagation()
              action.onClick()
            }}
            className={cn('h-6 w-6 p-0', action.color)}
            title={action.label}
          >
            <Icon className="w-3 h-3" />
          </Button>
        )
      })}
    </div>
  )
}