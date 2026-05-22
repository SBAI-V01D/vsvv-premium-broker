/**
 * CustomerCardActions — Quick Action Buttons
 * Premium Financial Platform: minimal · touch-friendly · contextual
 */
import React from 'react'
import { Phone, Mail, FileText, TrendingUp, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CustomerCardActions({ customerId, customerEmail, onAction }) {
  const actions = [
    {
      key: 'call',
      icon: Phone,
      label: 'Anrufen',
      color: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
      onClick: () => onAction?.('call'),
    },
    {
      key: 'email',
      icon: Mail,
      label: 'E-Mail',
      color: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
      onClick: () => {
        if (customerEmail) window.location.href = `mailto:${customerEmail}`
        else onAction?.('email')
      },
    },
    {
      key: 'dossier',
      icon: FileText,
      label: 'Dossier',
      color: 'text-slate-600 hover:text-primary hover:bg-primary/5',
      onClick: () => onAction?.('dossier'),
    },
    {
      key: 'opportunity',
      icon: TrendingUp,
      label: 'Chance',
      color: 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50',
      onClick: () => onAction?.('opportunity'),
    },
    {
      key: 'upload',
      icon: Upload,
      label: 'Upload',
      color: 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50',
      onClick: () => onAction?.('upload'),
    },
  ]

  return (
    <div className="flex items-center gap-1.5">
      {actions.map(action => {
        const Icon = action.icon
        return (
          <button
            key={action.key}
            onClick={action.onClick}
            className={cn(
              'p-1.5 rounded-lg transition-colors group relative',
              action.color
            )}
            title={action.label}
          >
            <Icon className="w-4 h-4" />
            <span className="sr-only">{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}