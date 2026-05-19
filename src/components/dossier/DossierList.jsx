/**
 * DossierList — Phase 5.5 UX-Feinschliff
 * - Suche/Filter
 * - Klarere Status-Darstellung
 * - Datum der letzten Änderung
 * - Typ-Farbcodierung
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, FileText, Plus } from 'lucide-react';

const STATUS_CONFIG = {
  entwurf:        { label: 'Entwurf',         cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_bearbeitung: { label: 'In Bearbeitung',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  bereit:         { label: 'Bereit',           cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  archiviert:     { label: 'Archiviert',       cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const TYPE_CONFIG = {
  kk_vergleich:    { label: 'KK-Vergleich',    dot: 'bg-blue-500' },
  vorsorge:        { label: 'Vorsorge',         dot: 'bg-violet-500' },
  sachversicherung:{ label: 'Sachversicherung', dot: 'bg-orange-500' },
  gesamtdossier:   { label: 'Gesamtdossier',   dot: 'bg-emerald-500' },
};

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'Heute';
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function DossierList({ onOpen, onNew }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['advisory_dossiers'],
    queryFn: () => base44.entities.AdvisoryDossier.list('-updated_date', 100),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return dossiers.filter(d => {
      const matchSearch = !term
        || d.title?.toLowerCase().includes(term)
        || d.customer_name?.toLowerCase().includes(term);
      const matchStatus = !filterStatus || d.status === filterStatus;
      return matchSearch && matchStatus && !d.archived;
    });
  }, [dossiers, search, filterStatus]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Suchleiste + Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-input bg-transparent rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            placeholder="Dossier oder Kunde suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-input bg-transparent rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring text-muted-foreground"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Alle Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground ml-1">
          {filtered.length} Dossier{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Leerer State */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-muted/20">
          <FileText className="w-8 h-8 mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground mb-1">
            {search || filterStatus ? 'Keine Treffer' : 'Noch keine Dossiers'}
          </p>
          <p className="text-xs text-muted-foreground">
            {search || filterStatus
              ? 'Filter anpassen oder Suche zurücksetzen.'
              : 'Erstellen Sie Ihr erstes Beratungsdossier mit «Neues Dossier».'}
          </p>
        </div>
      )}

      {/* Dossier-Liste */}
      {filtered.map(dossier => {
        const st = STATUS_CONFIG[dossier.status] || STATUS_CONFIG.entwurf;
        const tc = TYPE_CONFIG[dossier.dossier_type];
        const savings = dossier.savings_monthly;

        return (
          <div
            key={dossier.id}
            onClick={() => onOpen(dossier.id)}
            className="bg-card border border-border rounded-xl px-5 py-3.5 flex items-center justify-between hover:shadow-card-md hover:border-primary/30 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Typ-Indikator */}
              <div className="flex flex-col items-center shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full ${tc?.dot || 'bg-slate-400'}`} />
              </div>
              {/* Avatar */}
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                {(dossier.customer_name || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                  {dossier.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="truncate">{dossier.customer_name}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{tc?.label || dossier.dossier_type}</span>
                  {dossier.version > 1 && (
                    <><span className="text-muted-foreground/40">·</span><span>v{dossier.version}</span></>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              {/* Einsparung */}
              {savings > 0 && (
                <span className="hidden sm:inline text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  − CHF {Math.round(savings)}/Mt.
                </span>
              )}
              {/* Datum */}
              <span className="hidden md:inline text-[11px] text-muted-foreground/70">
                {formatDate(dossier.updated_date)}
              </span>
              {/* Status */}
              <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${st.cls}`}>
                {st.label}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Inline import for chevron
function ChevronRight({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}