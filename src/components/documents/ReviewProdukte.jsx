import React from 'react'
import { Input } from '@/components/ui/input'
import { AlertTriangle } from 'lucide-react'

export default function ReviewProdukte({ produkte, onChange }) {
  const handleChange = (idx, key, val) =>
    onChange(produkte.map((p, i) => i === idx ? { ...p, [key]: val } : p))

  return (
    <div className="space-y-1.5">
      {produkte.length === 0 && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Keine Produkte erkannt – bitte manuell hinzufügen
        </div>
      )}
      {produkte.map((p, i) => {
        const isKVG = p.typ === 'KVG'
        const isVVG = p.typ === 'VVG'
        return (
          <div key={i} className="flex gap-1.5 items-center">
            <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-md ${
              isKVG ? 'bg-blue-100 text-blue-700' :
              isVVG ? 'bg-purple-100 text-purple-700' :
              'bg-muted text-muted-foreground'
            }`}>
              {p.typ || '?'}
            </span>
            <Input
              value={p.name}
              onChange={e => handleChange(i, 'name', e.target.value)}
              className="h-7 text-xs flex-1"
              placeholder="Produktname"
            />
            {p.zusatz_typ && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                {p.zusatz_typ}
              </span>
            )}
            <button
              onClick={() => onChange(produkte.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-destructive text-sm px-1 flex-shrink-0"
            >✕</button>
          </div>
        )
      })}
      <button
        onClick={() => onChange([...produkte, { typ: 'VVG', name: '' }])}
        className="text-xs text-primary underline mt-1"
      >+ Produkt hinzufügen</button>
    </div>
  )
}