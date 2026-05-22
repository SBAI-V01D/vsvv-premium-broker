import React from 'react'
import { AlertTriangle, Users, ExternalLink, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

function MatchBadge({ label }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
      {label}
    </span>
  )
}

export default function DuplicateWarning({ duplicates, householdHints, onForceCreate, onDismiss }) {
  const navigate = useNavigate()
  if (duplicates.length === 0 && householdHints.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-100/60 border-b border-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-sm font-semibold text-amber-800">
          {duplicates.length > 0 ? `${duplicates.length} mögliche Dublette${duplicates.length > 1 ? 'n' : ''} gefunden` : ''}
          {duplicates.length > 0 && householdHints.length > 0 ? ' · ' : ''}
          {householdHints.length > 0 ? `${householdHints.length} möglicher Haushalt` : ''}
        </p>
      </div>

      <div className="divide-y divide-amber-200/60">
        {duplicates.map(match => (
          <div key={match.customer.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {match.customer.company_name || `${match.customer.first_name} ${match.customer.last_name}`}
                  </p>
                  {match.reasons.map(r => <MatchBadge key={r} label={r} />)}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
                  {match.customer.email && <span>{match.customer.email}</span>}
                  {match.customer.phone && <span>{match.customer.phone}</span>}
                  {match.customer.birthdate && <span>* {new Date(match.customer.birthdate).toLocaleDateString('de-CH')}</span>}
                  {match.customer.city && <span>{match.customer.city}</span>}
                </div>
                {match.advisorName && (
                  <p className="text-[10px] text-slate-400 mt-0.5">Berater: {match.advisorName}</p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => navigate(`/kunden/${match.customer.id}`)}
              >
                <ExternalLink className="w-3 h-3" /> Öffnen
              </Button>
            </div>
          </div>
        ))}

        {householdHints.map(match => (
          <div key={match.customer.id} className="px-4 py-3 bg-blue-50/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {`${match.customer.first_name} ${match.customer.last_name}`}
                  </p>
                  <span className="text-[9px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                    Möglicher Haushalt
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Gleicher Nachname{match.customer.city ? ` · ${match.customer.city}` : ''}
                  {match.customer.street ? ` · ${match.customer.street}` : ''}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => navigate(`/kunden/${match.customer.id}`)}
              >
                <ExternalLink className="w-3 h-3" /> Öffnen
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 flex items-center justify-between gap-3 bg-amber-50/80 border-t border-amber-200">
        <p className="text-[11px] text-amber-700">
          Bitte prüfen ob es sich um einen bestehenden Kunden handelt.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 h-7 text-xs gap-1 border-amber-400 bg-white text-amber-800 hover:bg-amber-100"
          onClick={onForceCreate}
        >
          <UserPlus className="w-3 h-3" /> Trotzdem erstellen
        </Button>
      </div>
    </div>
  )
}