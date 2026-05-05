import React from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, FileText, UserCheck, Wallet } from 'lucide-react'

const actions = [
  { label: 'Kunde erstellen', icon: UserPlus, color: 'bg-blue-600 hover:bg-blue-700', path: '/kunden' },
  { label: 'Police erstellen', icon: FileText, color: 'bg-green-600 hover:bg-green-700', path: '/vertraege' },
  { label: 'Berater hinzufügen', icon: UserCheck, color: 'bg-purple-600 hover:bg-purple-700', path: '/berater-organisation' },
  { label: 'Provision erfassen', icon: Wallet, color: 'bg-amber-500 hover:bg-amber-600', path: '/provisionen-courtagen' },
]

export default function QuickActions() {
  const navigate = useNavigate()
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {actions.map(a => {
        const Icon = a.icon
        return (
          <button
            key={a.label}
            onClick={() => navigate(a.path)}
            className={`${a.color} text-white rounded-xl p-4 flex flex-col items-center gap-2 text-center transition-colors shadow-sm font-medium text-sm`}
          >
            <Icon className="w-6 h-6" />
            {a.label}
          </button>
        )
      })}
    </div>
  )
}