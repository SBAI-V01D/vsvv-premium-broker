/**
 * EditableField — Globale Inline-Edit-Komponente
 *
 * Grundregel: Jedes sichtbare Feld ist entweder
 *   (a) direkt editierbar  →  onClick → Inline-Input → Save
 *   (b) bewusst readonly   →  🔒 mit kurzem Grund
 *   (c) navigierbar        →  onClick → Route
 *
 * Props:
 *   value        — aktueller Wert (string | number | null)
 *   onSave       — async (newValue) => void
 *   type         — "text" | "email" | "phone" | "number" | "date" | "select" | "textarea"
 *   options      — [{value, label}] für type="select"
 *   label        — optionales Label über dem Wert
 *   placeholder  — Platzhaltertext wenn kein Wert
 *   readOnly     — boolean
 *   readOnlyReason — "auto" | "ai" | "history" | "compliance" | string
 *   format       — (value) => displayString
 *   className    — wrapper className
 *   compact      — kleinere Variante
 */
import React, { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X, Lock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const READONLY_LABELS = {
  auto:       '🔒 Automatisch generiert',
  ai:         '🔒 KI-berechnet',
  history:    '🔒 Historischer Wert',
  compliance: '🔒 Compliance-geschützt',
}

export default function EditableField({
  value,
  onSave,
  type = 'text',
  options = [],
  label,
  placeholder = '–',
  readOnly = false,
  readOnlyReason,
  format,
  className,
  compact = false,
  inputClassName,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const [saving, setSaving]   = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) {
      setDraft(value ?? '')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [editing])

  const displayValue = format ? format(value) : (value ?? '')

  const handleSave = async () => {
    if (draft === (value ?? '')) { setEditing(false); return }
    setSaving(true)
    try {
      await onSave(type === 'number' ? (parseFloat(draft) || null) : (draft || null))
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && type !== 'textarea') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  // ── Read-only ──────────────────────────────────────────────────────────────
  if (readOnly) {
    const roLabel = READONLY_LABELS[readOnlyReason] || readOnlyReason
    return (
      <div className={cn('group', className)}>
        {label && <p className={cn('text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5', compact && 'text-[9px]')}>{label}</p>}
        <div className="flex items-center gap-1.5">
          <span className={cn('text-foreground', compact ? 'text-xs' : 'text-sm', !displayValue && 'text-muted-foreground italic')}>
            {displayValue || placeholder}
          </span>
          <Lock className="w-2.5 h-2.5 text-muted-foreground/50 flex-shrink-0" title={roLabel} />
        </div>
        {roLabel && (
          <p className="text-[9px] text-muted-foreground/60 mt-0.5">{roLabel}</p>
        )}
      </div>
    )
  }

  // ── Edit Mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <div className="flex-1 min-w-0">
          {type === 'select' ? (
            <select
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-full border border-primary rounded-md px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary',
                inputClassName
              )}
            >
              {options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : type === 'textarea' ? (
            <textarea
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              className={cn(
                'w-full border border-primary rounded-md px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none',
                inputClassName
              )}
            />
          ) : (
            <input
              ref={inputRef}
              type={type}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-full border border-primary rounded-md px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary',
                compact ? 'py-0.5 text-xs' : '',
                inputClassName
              )}
            />
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="p-1 rounded-md bg-primary text-white hover:bg-primary/90 flex-shrink-0"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="p-1 rounded-md hover:bg-muted flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    )
  }

  // ── Display Mode ───────────────────────────────────────────────────────────
  return (
    <div
      className={cn('group relative', className)}
    >
      {label && (
        <p className={cn('text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5', compact && 'text-[9px]')}>{label}</p>
      )}
      <button
        onClick={() => setEditing(true)}
        className={cn(
          'flex items-center gap-1 text-left w-full rounded hover:bg-blue-50 px-1 -mx-1 transition-colors group/ef',
          compact ? 'py-0' : 'py-0.5'
        )}
        title="Klicken zum Bearbeiten"
      >
        <span className={cn(
          'flex-1 min-w-0',
          compact ? 'text-xs' : 'text-sm',
          !displayValue ? 'text-muted-foreground italic' : 'text-foreground'
        )}>
          {displayValue || placeholder}
        </span>
        <Pencil className={cn(
          'flex-shrink-0 opacity-0 group-hover/ef:opacity-60 transition-opacity text-primary',
          compact ? 'w-2.5 h-2.5' : 'w-3 h-3'
        )} />
      </button>
    </div>
  )
}