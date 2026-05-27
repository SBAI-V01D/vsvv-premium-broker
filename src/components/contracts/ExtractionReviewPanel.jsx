import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, AlertTriangle, Edit3, ChevronLeft, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

function getLevel(score) {
  if (score == null) return null
  if (score >= 0.85) return 'high'
  if (score >= 0.65) return 'medium'
  return 'low'
}

function ConfidenceBadge({ score, empty }) {
  if (empty || score == null) return <span className="text-[10px] text-muted-foreground">nicht erkannt</span>
  const level = getLevel(score)
  const pct = Math.round(score * 100)
  if (level === 'high')   return <span className="text-[10px] font-medium text-green-600 flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> {'✓ Sicher'} ({pct}%)</span>
  if (level === 'medium') return <span className="text-[10px] font-medium text-amber-600 flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> {'⚠ Prüfen'} ({pct}%)</span>
  return <span className="text-[10px] font-medium text-red-500 flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" /> {'✎ Unklar'} ({pct}%)</span>
}

function ReviewField({ label, value, confidence, onChange, type = 'text', fullWidth = false, required = false }) {
  const [editing, setEditing] = useState(false)
  const empty = !value
  const level = empty ? null : getLevel(confidence)

  const rowCls = cn(
    'p-2.5 rounded-lg border transition-colors',
    empty
      ? 'bg-slate-50 border-slate-200'
      : level === 'low' ? 'bg-red-50 border-red-200'
      : level === 'medium' ? 'bg-amber-50 border-amber-200'
      : 'bg-green-50/20 border-green-200/60'
  )

  return (
    <div className={cn(rowCls, fullWidth && 'col-span-2')}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <ConfidenceBadge score={confidence} empty={empty} />
          <button type="button" onClick={() => setEditing(e => !e)} className="text-muted-foreground hover:text-primary transition-colors">
            <Edit3 className="w-3 h-3" />
          </button>
        </div>
      </div>
      {editing ? (
        <Input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          autoFocus
          type={type}
          className="h-7 text-sm mt-1"
          placeholder={`${label} eingeben...`}
        />
      ) : (
        <p
          onClick={() => setEditing(true)}
          className={cn(
            'text-sm font-medium cursor-pointer hover:underline min-h-[1.25rem]',
            empty ? 'text-muted-foreground italic text-xs' : ''
          )}
        >
          {value || 'Nicht erkannt — klicken zum Ergänzen'}
        </p>
      )}
    </div>
  )
}

const DOC_ICONS = {
  'Police': '📋', 'Offerte': '📄', 'Rechnung': '🧾', 'Schaden': '⚠️',
  'Kündigung': '✉️', 'Leistungsabrechnung': '📊', 'Unbekannt': '❓'
}

const DOC_COLORS = {
  'Police': 'bg-blue-50 border-blue-200 text-blue-800',
  'Offerte': 'bg-violet-50 border-violet-200 text-violet-800',
  'Rechnung': 'bg-amber-50 border-amber-200 text-amber-800',
  'Schaden': 'bg-red-50 border-red-200 text-red-800',
  'Kündigung': 'bg-orange-50 border-orange-200 text-orange-800',
  'Leistungsabrechnung': 'bg-teal-50 border-teal-200 text-teal-800',
}

export default function ExtractionReviewPanel({ data, confidences = {}, documentType, onChange, onConfirm, onBack }) {
  const set = (field, val) => onChange({ ...data, [field]: val })

  const lowCount  = Object.entries(confidences).filter(([, v]) => v != null && v < 0.65).length
  const warnCount = Object.entries(confidences).filter(([, v]) => v != null && v >= 0.65 && v < 0.85).length
  const missingRequired = !data?.first_name || !data?.last_name || !data?.insurer
  const docCls = DOC_COLORS[documentType] || 'bg-slate-50 border-slate-200 text-slate-800'

  return (
    <div className="space-y-4 py-1">
      {/* Document type + quality summary */}
      <div className={cn('flex items-center gap-3 p-3 rounded-xl border', docCls)}>
        <span className="text-2xl">{DOC_ICONS[documentType] || '📋'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Erkannter Dokumenttyp</p>
          <p className="font-bold">{documentType || 'Unbekannt'}</p>
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          {lowCount > 0  && <p className="text-[10px] font-semibold text-red-600">{'✎'} {lowCount} Feld{lowCount > 1 ? 'er' : ''} unklar</p>}
          {warnCount > 0 && <p className="text-[10px] font-semibold text-amber-600">{'⚠'} {warnCount} Feld{warnCount > 1 ? 'er' : ''} prüfen</p>}
          {lowCount === 0 && warnCount === 0 && <p className="text-[10px] font-semibold text-green-600">{'✓'} Alle Felder sicher</p>}
        </div>
      </div>

      {/* Warning notice */}
      <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Bitte alle Felder prüfen bevor Sie fortfahren. Felder mit{' '}
          <strong className="text-amber-600">{'⚠ Prüfen'}</strong> oder{' '}
          <strong className="text-red-500">{'✎ Unklar'}</strong>{' '}
          müssen kontrolliert werden — KI-Fehler werden <strong>nicht automatisch</strong> korrigiert.
        </span>
      </div>

      {/* Personendaten */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <FileText className="w-3 h-3" /> Personendaten
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ReviewField
            label="Versicherungsnehmer / Hauptkontakt"
            value={data?.policy_holder_name}
            confidence={confidences.policy_holder_name}
            onChange={v => set('policy_holder_name', v || null)}
            fullWidth
          />
          <ReviewField label="Vorname" value={data?.first_name} confidence={confidences.first_name} onChange={v => set('first_name', v)} required />
          <ReviewField label="Nachname" value={data?.last_name} confidence={confidences.last_name} onChange={v => set('last_name', v)} required />
          <ReviewField label="Geburtsdatum" value={data?.birthdate} confidence={confidences.birthdate} onChange={v => set('birthdate', v)} type="date" />
          <ReviewField label="Strasse" value={data?.street} confidence={confidences.street} onChange={v => set('street', v)} />
        </div>
      </div>

      {/* Versicherungsdaten */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <FileText className="w-3 h-3" /> Versicherungsdaten
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ReviewField label="Versicherungsgesellschaft" value={data?.insurer} confidence={confidences.insurer} onChange={v => set('insurer', v)} required />
          <ReviewField label="Policen-Nummer" value={data?.policy_number} confidence={confidences.policy_number} onChange={v => set('policy_number', v)} />
          <ReviewField label="Versicherungsart" value={data?.insurance_type} confidence={confidences.insurance_type} onChange={v => set('insurance_type', v)} />
          <ReviewField label="Produkt / Tarif" value={data?.product} confidence={confidences.product} onChange={v => set('product', v)} />
          <ReviewField
            label="Monatsprämie (CHF)"
            value={data?.premium_monthly != null ? String(data.premium_monthly) : null}
            confidence={confidences.premium_monthly}
            onChange={v => set('premium_monthly', v ? parseFloat(v) : null)}
            type="number"
          />
          <ReviewField label="Vertragsende" value={data?.end_date} confidence={confidences.end_date} onChange={v => set('end_date', v)} type="date" />
        </div>
      </div>

      {missingRequired && (
        <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-300 rounded-lg text-xs text-red-700 font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Pflichtfelder fehlen:{' '}
          {[!data?.first_name && 'Vorname', !data?.last_name && 'Nachname', !data?.insurer && 'Versicherungsgesellschaft']
            .filter(Boolean).join(', ')}. Bitte ergänzen.
        </div>
      )}

      <div className="flex justify-between pt-1">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Neue Datei
        </Button>
        <Button onClick={onConfirm} disabled={missingRequired} className="gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Bestätigen
        </Button>
      </div>
    </div>
  )
}