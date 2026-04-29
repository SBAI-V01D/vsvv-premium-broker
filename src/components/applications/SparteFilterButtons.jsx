import React from 'react'
import { Button } from '@/components/ui/button'

const SPARTEN_PRIVAT = [
  { value: 'kvg', label: 'Krankenkasse (Grundversicherung)' },
  { value: 'vvg_zusatz', label: 'Krankenzusatzversicherung' },
  { value: 'motorfahrzeug', label: 'Motorfahrzeugversicherung' },
  { value: 'hausrat', label: 'Hausratversicherung' },
  { value: 'haftpflicht_privat', label: 'Privathaftpflichtversicherung' },
  { value: 'rechtsschutz_privat', label: 'Rechtsschutzversicherung' },
  { value: 'leben_3a', label: 'Lebensversicherung (Risiko)' },
  { value: 'leben_3b', label: 'Säule 3b' },
  { value: 'reise', label: 'Reiseversicherung' },
  { value: 'unfall_privat', label: 'Unfallversicherung (privat)' },
  { value: 'gebaude_privat', label: 'Gebäudeversicherung' },
  { value: 'cyber_privat', label: 'Cyberversicherung (privat)' },
]

const SPARTEN_FIRMA = [
  { value: 'berufshaftpflicht', label: 'Berufshaftpflicht' },
  { value: 'betriebshaftpflicht', label: 'Betriebshaftpflicht' },
  { value: 'ktg', label: 'Kollektiv-Krankentaggeld (KTG)' },
  { value: 'uvg', label: 'Kollektiv-Unfall (UVG)' },
  { value: 'bvg', label: 'BVG / Pensionskasse' },
  { value: 'inventar', label: 'Sachversicherung (Betrieb)' },
  { value: 'transport', label: 'Transportversicherung' },
  { value: 'cyber_firma', label: 'Cyberversicherung (Unternehmen)' },
  { value: 'kredit', label: 'Kreditversicherung' },
  { value: 'rechtsschutz_firma', label: 'Rechtsschutz (Unternehmen)' },
  { value: 'do', label: 'D&O Versicherung' },
]

export default function SparteFilterButtons({ applications, activeSparte, onSelect }) {
  const countForSparte = (value) =>
    applications.filter(a => (a.sparte === value || a.insurance_type === value)).length

  const totalCount = applications.length

  return (
    <div className="mb-6 space-y-3">
      {/* Privat */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Privatkundenversicherungen</p>
        <div className="flex flex-wrap gap-1.5">
          {SPARTEN_PRIVAT.map(s => {
            const count = countForSparte(s.value)
            const active = activeSparte === s.value
            return (
              <button
                key={s.value}
                onClick={() => onSelect(active ? 'all' : s.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border text-foreground hover:border-primary hover:text-primary'
                }`}
              >
                {s.label} {count > 0 && <span className={`ml-1 font-semibold ${active ? 'opacity-80' : 'text-primary'}`}>({count})</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Firma */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Firmenversicherungen (KMU & Unternehmen)</p>
        <div className="flex flex-wrap gap-1.5">
          {SPARTEN_FIRMA.map(s => {
            const count = countForSparte(s.value)
            const active = activeSparte === s.value
            return (
              <button
                key={s.value}
                onClick={() => onSelect(active ? 'all' : s.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border text-foreground hover:border-primary hover:text-primary'
                }`}
              >
                {s.label} {count > 0 && <span className={`ml-1 font-semibold ${active ? 'opacity-80' : 'text-primary'}`}>({count})</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Reset */}
      {activeSparte !== 'all' && (
        <button
          onClick={() => onSelect('all')}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Alle anzeigen ({totalCount})
        </button>
      )}
    </div>
  )
}