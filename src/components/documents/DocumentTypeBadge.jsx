import React from 'react'
import { AlertTriangle } from 'lucide-react'

export default function DocumentTypeBadge({ doc }) {
  const { doc_type, classification_status, classification_confidence } = doc

  if (classification_status === 'ausstehend') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
        Klassifizierung...
      </span>
    )
  }

  if (classification_status === 'pruefung_erforderlich') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium border border-amber-200">
        <AlertTriangle className="w-3 h-3" />
        Prüfung erforderlich
      </span>
    )
  }

  if (doc_type === 'antrag') {
    const pct = classification_confidence ? Math.round(classification_confidence * 100) : null
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold border border-green-200">
        ANTRAG{pct && classification_status !== 'manuell' ? ` ${pct}%` : ''}
        {classification_status === 'manuell' && <span className="text-green-500 font-normal ml-0.5">(manuell)</span>}
      </span>
    )
  }

  if (doc_type === 'anlage') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200">
        ANLAGE
        {classification_status === 'manuell' && <span className="text-slate-400 font-normal ml-0.5">(manuell)</span>}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
      Unbekannt
    </span>
  )
}