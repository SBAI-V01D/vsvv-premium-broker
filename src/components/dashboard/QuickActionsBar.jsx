import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Phone, Mail, FileText, User, CheckSquare, Zap } from 'lucide-react'

export default function QuickActionsBar({ customer, contract, task, onClose }) {
  const navigate = useNavigate()

  if (!customer && !contract && !task) return null

  const actions = []

  // Customer Actions
  if (customer) {
    if (customer.email) {
      actions.push({
        label: 'E-Mail',
        icon: Mail,
        onClick: () => window.location.href = `mailto:${customer.email}`,
        color: 'bg-blue-100 text-blue-700 hover:bg-blue-200'
      })
    }
    if (customer.phone) {
      actions.push({
        label: 'Anrufen',
        icon: Phone,
        onClick: () => window.location.href = `tel:${customer.phone}`,
        color: 'bg-green-100 text-green-700 hover:bg-green-200'
      })
    }
    actions.push({
      label: 'Kundendetails',
      icon: User,
      onClick: () => navigate(`/kunden/${customer.id}`),
      color: 'bg-purple-100 text-purple-700 hover:bg-purple-200'
    })
  }

  // Contract Actions
  if (contract) {
    if (contract.customer_id) {
      actions.push({
        label: 'Kunde öffnen',
        icon: User,
        onClick: () => navigate(`/kunden/${contract.customer_id}`),
        color: 'bg-blue-100 text-blue-700 hover:bg-blue-200'
      })
    }
    actions.push({
      label: 'Vertrag bearbeiten',
      icon: FileText,
      onClick: onClose,
      color: 'bg-orange-100 text-orange-700 hover:bg-orange-200'
    })
  }

  // Task Actions
  if (task) {
    if (task.customer_id) {
      actions.push({
        label: 'Kunde öffnen',
        icon: User,
        onClick: () => navigate(`/kunden/${task.customer_id}`),
        color: 'bg-blue-100 text-blue-700 hover:bg-blue-200'
      })
    }
    actions.push({
      label: 'Aufgabe erledigt',
      icon: CheckSquare,
      onClick: onClose,
      color: 'bg-green-100 text-green-700 hover:bg-green-200'
    })
  }

  if (actions.length === 0) return null

  return (
    <div className="flex gap-1.5 flex-wrap">
      {actions.map((action, idx) => {
        const Icon = action.icon
        return (
          <Button
            key={idx}
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className={`gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${action.color}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {action.label}
          </Button>
        )
      })}
    </div>
  )
}