/**
 * DossierList — Phase 1
 * Listet alle vorhandenen AdvisoryDossiers auf.
 * Read-only CRM-Verbindung via customer_name Cache.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const STATUS_CONFIG = {
  entwurf:       { label: 'Entwurf',        className: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_bearbeitung:{ label: 'In Bearbeitung', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  bereit:        { label: 'Bereit',          className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  archiviert:    { label: 'Archiviert',      className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const TYPE_LABELS = {
  kk_vergleich:    'KK-Vergleich',
  vorsorge:        'Vorsorge',
  sachversicherung:'Sachversicherung',
  gesamtdossier:   'Gesamtdossier',
};

export default function DossierList({ onOpen }) {
  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['advisory_dossiers'],
    queryFn: () => base44.entities.AdvisoryDossier.list('-created_date', 50),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (dossiers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl bg-muted/30">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
          <span className="text-xl">📋</span>
        </div>
        <p className="text-sm font-medium text-foreground mb-1">Noch keine Dossiers</p>
        <p className="text-xs text-muted-foreground">
          Erstellen Sie Ihr erstes Beratungsdossier mit «Neues Dossier».
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dossiers.map(dossier => {
        const st = STATUS_CONFIG[dossier.status] || STATUS_CONFIG.entwurf;
        const savings = dossier.savings_monthly;
        return (
          <div
            key={dossier.id}
            onClick={() => onOpen(dossier.id)}
            className="bg-card border border-border rounded-xl px-5 py-4 flex items-center justify-between hover:shadow-card-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                {(dossier.customer_name || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {dossier.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dossier.customer_name} · {TYPE_LABELS[dossier.dossier_type] || dossier.dossier_type}
                  {dossier.version > 1 && <span className="ml-1">· v{dossier.version}</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {savings > 0 && (
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  − CHF {savings.toFixed(2)}/Mt.
                </span>
              )}
              <span className={`text-xs font-medium border px-2 py-0.5 rounded-full ${st.className}`}>
                {st.label}
              </span>
              <span className="text-muted-foreground text-sm">›</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}