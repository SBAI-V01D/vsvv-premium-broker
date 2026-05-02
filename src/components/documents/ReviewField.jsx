import React from 'react'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * confidence: 'high' | 'low' | 'missing'
 */
export default function ReviewField({ label, value, onChange, confidence = 'high', required = false, readOnly = false }) {
  const styles = {
    high:    { border: 'border-green-300 bg-green-50/60',  icon: <CheckCircle2 className="w-3 h-3 text-green-500" />,  badge: 'text-green-700' },
    low:     { border: 'border-amber-300 bg-amber-50/60',  icon: <AlertTriangle className="w-3 h-3 text-amber-500" />, badge: 'text-amber-700' },
    missing: { border: 'border-red-300 bg-red-50/60',      icon: <XCircle className="w-3 h-3 text-red-500" />,        badge: 'text-red-700' },
  }
  const s = styles[confidence] || styles.high

  return (
    <div className={`p-2.5 rounded-lg border ${s.border} transition-colors`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">
          {label}{required ? ' *' : ''}
        </span>
        <span title={confidence === 'high' ? 'Sicher erkannt' : confidence === 'low' ? 'Unsicher – bitte prüfen' : 'Fehlt – bitte ausfüllen'}>
          {s.icon}
        </span>
      </div>
      {readOnly ? (
        <p className={`text-sm font-semibold ${s.badge}`}>{value || '–'}</p>
      ) : (
        <Input
          value={value ?? ''}
          onChange={e => onChange?.(e.target.value)}
          className="h-7 text-sm bg-transparent border-0 p-0 focus-visible:ring-0 shadow-none"
          placeholder="–"
        />
      )}
    </div>
  )
}