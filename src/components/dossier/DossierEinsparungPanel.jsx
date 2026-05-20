/**
 * DossierEinsparungPanel — Phase 3
 * Zentrales Summary-Panel: Aktuelle vs. Empfohlene Prämien, Einsparungsanzeige.
 * Verwendet ausschliesslich dossierCalc.js — keine eigene Berechnungslogik.
 */
import React from 'react';
import { TrendingDown, TrendingUp, Minus, Info } from 'lucide-react';
import { calcDossierSummary, fmtCHF } from '@/lib/dossierCalc';

export default function DossierEinsparungPanel({ entries }) {
  const s = calcDossierSummary(entries);

  // DEBUG: Zeige Berechnungsdetails
  const currentEntries = entries.filter(e => e.gruppe === 'aktuelle_loesung');
  const proposedEntries = s.proposedGruppe ? entries.filter(e => e.gruppe === s.proposedGruppe) : [];

  if (!s.hasCurrent && !s.hasRecommendation) {
    return (
      <div className="border border-dashed border-border rounded-xl p-5 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Info className="w-4 h-4 shrink-0" />
        Erfassen Sie aktuelle Policen und Empfehlungen, um die Einsparungsberechnung zu sehen.
      </div>
    );
  }

  const savingsAbs = s.savingsMonthly;
  const isPositive = savingsAbs !== null && savingsAbs > 0.005;
  const isNegative = savingsAbs !== null && savingsAbs < -0.005;
  const isNeutral  = !isPositive && !isNegative;

  const savingsBadgeClass = isPositive
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : isNegative
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-slate-50 border-slate-200 text-slate-700';

  const SavingsIcon = isPositive ? TrendingDown : isNegative ? TrendingUp : Minus;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border/60 bg-muted/30 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Prämienvergleich — Übersicht
        </span>
        {savingsAbs !== null && (
          <div className={`flex items-center gap-1.5 text-xs font-semibold border px-3 py-1 rounded-full ${savingsBadgeClass}`}>
            <SavingsIcon className="w-3.5 h-3.5" />
            {isPositive
              ? `Einsparung ${fmtCHF(savingsAbs)}/Mt.`
              : isNegative
                ? `Mehrkosten ${fmtCHF(Math.abs(savingsAbs))}/Mt.`
                : 'Kein Unterschied'}
          </div>
        )}
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 divide-x divide-border">
        {/* Aktuell */}
        <div className="px-5 py-4 text-center">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Aktuell
          </p>
          {s.hasCurrent ? (
            <>
              <p className="text-2xl font-bold text-foreground">{fmtCHF(s.currentMonthly)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">pro Monat</p>
              <p className="text-xs text-muted-foreground">{fmtCHF(s.currentYearly)} / Jahr</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-2">Keine aktuellen Policen erfasst</p>
          )}
        </div>

        {/* Einsparung */}
        <div className={`px-5 py-4 text-center ${isPositive ? 'bg-emerald-50/60' : isNegative ? 'bg-red-50/60' : 'bg-muted/30'}`}>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Differenz
          </p>
          {savingsAbs !== null ? (
            <>
              <p className={`text-2xl font-bold ${isPositive ? 'text-emerald-700' : isNegative ? 'text-red-700' : 'text-muted-foreground'}`}>
                {isPositive ? '−' : isNegative ? '+' : ''}{fmtCHF(Math.abs(savingsAbs))}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">pro Monat</p>
              {s.savingsYearly !== null && (
                <p className={`text-xs font-medium mt-1 ${isPositive ? 'text-emerald-700' : isNegative ? 'text-red-700' : 'text-muted-foreground'}`}>
                  {isPositive ? '−' : isNegative ? '+' : ''}{fmtCHF(Math.abs(s.savingsYearly))} / Jahr
                </p>
              )}
              {s.savingsPercent !== null && (
                <p className={`text-xs font-semibold mt-0.5 ${isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'}`}>
                  ({isPositive ? '−' : '+'}{Math.abs(s.savingsPercent).toFixed(1)}%)
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-2">—</p>
          )}
        </div>

        {/* Empfohlen */}
        <div className="px-5 py-4 text-center">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Empfohlen
          </p>
          {s.hasRecommendation ? (
            <>
              <p className="text-2xl font-bold text-foreground">{fmtCHF(s.proposedMonthly)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">pro Monat</p>
              <p className="text-xs text-muted-foreground">{fmtCHF(s.proposedYearly)} / Jahr</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-2">Keine Empfehlung gesetzt</p>
          )}
        </div>
      </div>

      {/* DEBUG: Berechnungsdetails */}
      <div className="border-t border-border bg-muted/20 px-5 py-3">
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-2">
            <Info className="w-3.5 h-3.5" />
            Berechnungsdetails anzeigen ({entries.length} Einträge total)
          </summary>
          <div className="mt-3 space-y-3">
            {/* Aktuelle Einträge */}
            <div>
              <p className="font-semibold text-foreground mb-1">Aktuelle Lösung ({currentEntries.length} Einträge):</p>
              {currentEntries.length > 0 ? (
                <div className="bg-white border border-border rounded p-2 space-y-1">
                  {currentEntries.map((e, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{e.gesellschaft} {e.product_name && `· ${e.product_name}`} ({e.person_name})</span>
                      <span className="font-medium">{e.praemie_monatlich != null ? `CHF ${Number(e.praemie_monatlich).toFixed(2)}` : '—'}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border mt-1">
                    <span className="font-semibold">Summe:</span>
                    <span className="font-bold text-foreground">CHF {s.currentMonthly.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground italic">Keine Einträge mit gruppe="aktuelle_loesung" oder is_current=true</p>
              )}
            </div>

            {/* Empfohlene Einträge */}
            {s.proposedGruppe && (
              <div>
                <p className="font-semibold text-foreground mb-1">Empfohlene Lösung — Gruppe "{s.proposedGruppe}" ({proposedEntries.length} Einträge):</p>
                {proposedEntries.length > 0 ? (
                  <div className="bg-white border border-border rounded p-2 space-y-1">
                    {proposedEntries.map((e, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{e.gesellschaft} {e.product_name && `· ${e.product_name}`} ({e.person_name})</span>
                        <span className="font-medium">{e.praemie_monatlich != null ? `CHF ${Number(e.praemie_monatlich).toFixed(2)}` : '—'}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border mt-1">
                      <span className="font-semibold">Summe:</span>
                      <span className="font-bold text-foreground">CHF {s.proposedMonthly.toFixed(2)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Berechnung */}
            <div className="bg-primary/5 border border-primary/20 rounded p-2 space-y-1">
              <p className="font-semibold text-primary mb-1">Berechnung:</p>
              <div className="text-[11px] text-muted-foreground">
                <p>Aktuell: CHF {s.currentMonthly.toFixed(2)}</p>
                <p>Empfohlen: CHF {s.proposedMonthly.toFixed(2)}</p>
                <p className="text-foreground font-medium">Differenz: CHF {(s.currentMonthly - s.proposedMonthly).toFixed(2)} {s.savingsMonthly > 0 ? '(Einsparung)' : s.savingsMonthly < 0 ? '(Mehrkosten)' : '(gleich)'}</p>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}