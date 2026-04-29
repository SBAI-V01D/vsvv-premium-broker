import React from 'react'
import { getSparteLabel } from '@/lib/insuranceSparten'

const PRIVAT_VALUES = [
  'kvg','vvg_zusatz','kvg_vvg_kombi','leben_3a','leben_3b','unfall_privat',
  'haftpflicht_privat','hausrat','gebaude_privat','motorfahrzeug',
  'rechtsschutz_privat','reise','cyber_privat',
]

const FIRMA_VALUES = [
  'bvg','uvg','ktg','inventar','gebaude_firma','technisch','transport',
  'betriebshaftpflicht','berufshaftpflicht','do','rechtsschutz_firma',
  'cyber_firma','kredit','flotte','keyman','gruppen_leben',
]

function isPrivat(app) {
  return PRIVAT_VALUES.includes(app.sparte || app.insurance_type)
}
function isFirma(app) {
  return FIRMA_VALUES.includes(app.sparte || app.insurance_type)
}

export default function SparteFilterButtons({ applications, activeKundentyp, onSelectKundentyp }) {
  const privatCount = applications.filter(isPrivat).length
  const firmaCount = applications.filter(isFirma).length

  // Berechne Auswertung je nach aktiver Gruppe
  const relevantApps = activeKundentyp === 'privat'
    ? applications.filter(isPrivat)
    : activeKundentyp === 'firma'
    ? applications.filter(isFirma)
    : applications

  // Zähle Sparten
  const sparteCounts = {}
  relevantApps.forEach(a => {
    const key = a.sparte || a.insurance_type || 'Unbekannt'
    sparteCounts[key] = (sparteCounts[key] || 0) + 1
  })
  const sortedSparten = Object.entries(sparteCounts).sort((a, b) => b[1] - a[1])
  const total = relevantApps.length

  return (
    <div className="mb-6 space-y-4">
      {/* Kundenkategorie-Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">Kundentyp:</span>
        <button
          onClick={() => onSelectKundentyp('all')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
            activeKundentyp === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border text-foreground hover:border-primary hover:text-primary'
          }`}
        >
          Alle ({applications.length})
        </button>
        <button
          onClick={() => onSelectKundentyp(activeKundentyp === 'privat' ? 'all' : 'privat')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
            activeKundentyp === 'privat'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
          }`}
        >
          Privatkunden ({privatCount})
        </button>
        <button
          onClick={() => onSelectKundentyp(activeKundentyp === 'firma' ? 'all' : 'firma')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
            activeKundentyp === 'firma'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
          }`}
        >
          Firmenkunden ({firmaCount})
        </button>
      </div>

      {/* Auswertung: Anträge nach Sparte (immer sichtbar) */}
      {sortedSparten.length > 0 && (
        <div className="bg-muted/30 rounded-xl border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Auswertung nach Sparte
            {activeKundentyp === 'privat' && ' – Privatkunden'}
            {activeKundentyp === 'firma' && ' – Firmenkunden'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
            {sortedSparten.map(([key, count]) => (
              <div key={key} className="flex items-center gap-2 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium truncate text-foreground">{getSparteLabel(key)}</span>
                    <span className="text-muted-foreground ml-2 flex-shrink-0">{count} ({Math.round(count / total * 100)}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(count / total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-border flex justify-between text-xs font-semibold text-foreground">
            <span>Total</span>
            <span>{total} Anträge</span>
          </div>
        </div>
      )}
    </div>
  )
}