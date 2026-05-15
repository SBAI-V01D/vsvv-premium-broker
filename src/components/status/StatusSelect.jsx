import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const COLOR_DOT = {
  gray:   'bg-slate-400',
  blue:   'bg-blue-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  green:  'bg-emerald-500',
  red:    'bg-red-500',
  purple: 'bg-purple-500',
  teal:   'bg-teal-500',
}

export default function StatusSelect({ value, onChange, statusDefinitions = [], placeholder = 'Status wählen' }) {
  const EXCLUDED_KEYS = ['bewilligung_erteilt', 'risikopruefung']
  const active = statusDefinitions.filter(s => s.is_active !== false && !EXCLUDED_KEYS.includes(s.key))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger className="mt-1">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {active.map(s => (
          <SelectItem key={s.key} value={s.key}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${COLOR_DOT[s.color] || COLOR_DOT.gray}`} />
              {s.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}