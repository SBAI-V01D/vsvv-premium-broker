import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  neu:               { label: 'Neu',               color: 'bg-slate-100 text-slate-700 border-slate-200' },
  in_ausschreibung:  { label: 'In Ausschreibung',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  offerten_erhalten: { label: 'Offerten erhalten', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  beratung_erfolgt:  { label: 'Beratung erfolgt',  color: 'bg-amber-100 text-amber-700 border-amber-200' },
  kunde_entscheidet: { label: 'Kunde entscheidet', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  gewonnen:          { label: 'Gewonnen ✓',        color: 'bg-green-100 text-green-700 border-green-200' },
  verloren:          { label: 'Verloren',           color: 'bg-red-100 text-red-700 border-red-200' },
  wiedervorlage:     { label: 'Wiedervorlage',     color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
}

export const ALLE_STATUS = Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }))

export default function VerkaufschanceStatusBadge({ status, size = 'sm' }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border font-medium whitespace-nowrap',
      cfg.color,
      size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
    )}>
      {cfg.label}
    </span>
  )
}

export { STATUS_CONFIG }