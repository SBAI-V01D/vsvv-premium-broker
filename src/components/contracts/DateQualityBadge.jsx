/**
 * DateQualityBadge — zeigt an wenn Vertragsdaten ungeprüft/Platzhalter sind
 * FINMA-Ansatz: Datenprobleme sichtbar, auditierbar, kontrollierbar machen
 */
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  placeholder: {
    label: '⚠ Datumsprüfung ausstehend',
    short: '⚠ Prüfung',
    cls: 'bg-amber-50 text-amber-700 border-amber-300',
    dot: 'bg-amber-500',
  },
  missing: {
    label: '⚠ Datum fehlt',
    short: '⚠ Fehlt',
    cls: 'bg-red-50 text-red-700 border-red-300',
    dot: 'bg-red-500',
  },
  estimated: {
    label: 'Geschätztes Datum',
    short: 'Geschätzt',
    cls: 'bg-blue-50 text-blue-600 border-blue-200',
    dot: 'bg-blue-400',
  },
}

/**
 * @param {object} props
 * @param {string}  props.dateQualityStatus  - verified | estimated | placeholder | missing
 * @param {boolean} props.requiresReview     - true wenn Platzhalter gesetzt wurde
 * @param {'full'|'compact'|'dot'} props.variant
 */
export default function DateQualityBadge({ dateQualityStatus, requiresReview, variant = 'compact' }) {
  // Nur anzeigen wenn Prüfung nötig
  if (!requiresReview && dateQualityStatus === 'verified') return null
  if (!requiresReview && !dateQualityStatus) return null

  const status = dateQualityStatus || (requiresReview ? 'placeholder' : null)
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return null

  if (variant === 'dot') {
    return (
      <span title={cfg.label} className={cn('inline-block w-2 h-2 rounded-full shrink-0', cfg.dot)} />
    )
  }

  if (variant === 'compact') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border', cfg.cls)}>
        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
        {cfg.short}
      </span>
    )
  }

  // full
  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium', cfg.cls)}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>{cfg.label}</span>
      {status === 'placeholder' && (
        <span className="ml-1 text-[10px] opacity-70">(Platzhalter 9999-12-31)</span>
      )}
    </div>
  )
}