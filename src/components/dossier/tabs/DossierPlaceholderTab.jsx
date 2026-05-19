/**
 * DossierPlaceholderTab
 * Platzhalter für Tabs der Phase 2-4.
 * Wird ersetzt sobald die jeweilige Phase implementiert wird.
 */
import React from 'react';

const PHASE_INFO = {
  2: { label: 'Vergleichstabelle', desc: 'Side-by-Side Prämienvergleich aktuelle Police vs. Offerten, Einsparungsrechner.' },
  3: { label: 'Leistungsmatrix & Empfehlung', desc: 'Bewertungsmatrix 1–6 pro Gesellschaft und Leistungsposition, KI-gestützte Empfehlung.' },
  4: { label: 'PDF-Export & Archivierung', desc: 'Professioneller PDF-Export, Snapshot-Versionierung, Archivierung in Dokumentenverwaltung.' },
};

export default function DossierPlaceholderTab({ tab }) {
  if (!tab) return null;
  const info = PHASE_INFO[tab.phase] || {};

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4 text-2xl">
        {tab.icon}
      </div>
      <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-1 rounded-full mb-3">
        Kommt in Phase {tab.phase}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">{info.label || tab.label}</h3>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
        {info.desc || 'Dieser Bereich wird in einer späteren Phase implementiert.'}
      </p>
    </div>
  );
}