import React from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, AlertCircle, Clock, CheckCircle2, Calendar, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

/**
 * Opportunity Intelligence Card
 * Zeigt nicht nur Opportunity-Daten, sondern auch:
 * - Abschlusswahrscheinlichkeit
 * - Letzter Kontakt
 * - Nächste Aktion
 * - Risiko-Indikatoren
 */
export default function OpportunityIntelligenceCard({ opportunity, onClick }) {
  const vs = opportunity

  // Wahrscheinlichkeit berechnen (basierend auf Status)
  const probabilityMap = {
    neu: 15,
    in_ausschreibung: 35,
    offerten_erhalten: 55,
    beratung_erfolgt: 70,
    kunde_entscheidet: 85,
    gewonnen: 100,
    verloren: 0,
    wiedervorlage: 40,
  }
  const probability = probabilityMap[vs.status] || 0

  // Risiko bewerten
  const daysUntilClose = vs.expected_close_date
    ? Math.ceil((new Date(vs.expected_close_date) - new Date()) / 86400000)
    : null

  const isOverdue = daysUntilClose !== null && daysUntilClose < 0
  const isUrgent = daysUntilClose !== null && daysUntilClose <= 7 && daysUntilClose >= 0
  const hasNoOfferten = vs.gesellschaften && vs.gesellschaften.filter(g => g.praemie_yearly).length === 0
  const hasMultipleOfferten = vs.gesellschaften && vs.gesellschaften.filter(g => g.praemie_yearly).length >= 2

  // Nächste Aktion bestimmen
  const nextActionMap = {
    neu: 'Gesellschaften anfragen',
    in_ausschreibung: 'Offerten einfordern',
    offerten_erhalten: 'Vergleich erstellen',
    beratung_erfolgt: 'Entscheid abwarten',
    kunde_entscheidet: 'Kunden nachfassen',
    gewonnen: 'Vertrag erstellen',
    verloren: '—',
    wiedervorlage: 'Wiedervorlage prüfen',
  }
  const nextAction = nextActionMap[vs.status] || 'Unbekannt'

  // Status-Farbe
  const statusColors = {
    neu: 'bg-slate-100 text-slate-700 border-slate-200',
    in_ausschreibung: 'bg-blue-50 text-blue-700 border-blue-200',
    offerten_erhalten: 'bg-violet-50 text-violet-700 border-violet-200',
    beratung_erfolgt: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    kunde_entscheidet: 'bg-amber-50 text-amber-700 border-amber-200',
    gewonnen: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    verloren: 'bg-slate-100 text-slate-500 border-slate-200',
    wiedervorlage: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  const statusColor = statusColors[vs.status] || statusColors.neu

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-xl border bg-card hover:shadow-card-md transition-all text-left group',
        isOverdue && 'border-rose-300 bg-rose-50/30',
        isUrgent && 'border-amber-300 bg-amber-50/30',
        !isOverdue && !isUrgent && 'border-slate-200 hover:border-slate-300'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-sm text-slate-800 truncate">
              {vs.customer_name || 'Unbekannt'}
            </h4>
            {vs.estimated_value > 0 && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-full shrink-0">
                CHF {(vs.estimated_value / 1000).toFixed(1)}k
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">
            {vs.sparte || 'Allgemein'} · {vs.insurance_type || 'Versicherung'}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
      </div>

      {/* Status & Probability */}
      <div className="flex items-center gap-2 mb-3">
        <span className={cn(
          'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
          statusColor
        )}>
          {vs.status.replace(/_/g, ' ').toUpperCase()}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] text-slate-500 font-medium">Wahrscheinlichkeit</span>
            <span className={cn(
              'text-[10px] font-bold',
              probability >= 70 ? 'text-emerald-700' :
              probability >= 40 ? 'text-amber-700' : 'text-slate-600'
            )}>
              {probability}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                probability >= 70 ? 'bg-emerald-500' :
                probability >= 40 ? 'bg-amber-500' : 'bg-slate-400'
              )}
              style={{ width: `${probability}%` }}
            />
          </div>
        </div>
      </div>

      {/* Intelligence Grid */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
        {/* Nächste Aktion */}
        <div className="flex items-start gap-1.5">
          <Calendar className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] text-slate-500">Nächste Aktion</p>
            <p className="text-[10px] font-medium text-slate-700 truncate">{nextAction}</p>
          </div>
        </div>

        {/* Zeitrahmen */}
        <div className="flex items-start gap-1.5">
          <Clock className={cn(
            'w-3 h-3 mt-0.5 shrink-0',
            isOverdue ? 'text-rose-500' :
            isUrgent ? 'text-amber-500' : 'text-slate-400'
          )} />
          <div className="min-w-0">
            <p className="text-[9px] text-slate-500">Abschluss</p>
            <p className={cn(
              'text-[10px] font-medium truncate',
              isOverdue ? 'text-rose-700' :
              isUrgent ? 'text-amber-700' : 'text-slate-700'
            )}>
              {daysUntilClose === null ? 'Unbekannt' :
               daysUntilClose < 0 ? `+${Math.abs(daysUntilClose)}d überfällig` :
               daysUntilClose === 0 ? 'Heute' :
               `${daysUntilClose}d`}
            </p>
          </div>
        </div>
      </div>

      {/* Risiko-Indikatoren */}
      {(hasNoOfferten || isOverdue) && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
          <span className="text-[9px] text-rose-700 font-medium">
            {hasNoOfferten && isOverdue ? 'Keine Offerten + überfällig' :
             hasNoOfferten ? 'Keine Offerten erhalten' : 'Überfällig'}
          </span>
        </div>
      )}

      {/* Offerten-Status */}
      {hasMultipleOfferten && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
          <span className="text-[9px] text-emerald-700 font-medium">
            {vs.gesellschaften.filter(g => g.praemie_yearly).length} Offerten vorhanden
          </span>
        </div>
      )}
    </button>
  )
}