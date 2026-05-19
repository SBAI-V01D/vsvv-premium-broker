/**
 * DossierBuilder — Phase 5.5 UX-Feinschliff
 * - Tastatur-Navigation zwischen Tabs (← →)
 * - Fortschrittsindikator (Step x / n)
 * - Weiter/Zurück-Buttons am Seitenende
 * - Schnellnavigation ohne Scrollen
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import DossierStammdatenTab from './tabs/DossierStammdatenTab';
import DossierPersonalienTab from './tabs/DossierPersonalienTab';
import DossierFamilieTab from './tabs/DossierFamilieTab';
import DossierPolicenTab from './tabs/DossierPolicenTab';
import DossierVergleichTab from './tabs/DossierVergleichTab';
import DossierPlaceholderTab from './tabs/DossierPlaceholderTab';
import DossierExportTab from './tabs/DossierExportTab';

const TABS = [
  { key: 'stammdaten',  label: 'Stammdaten',  icon: '📋', phase: 1 },
  { key: 'personalien', label: 'Personalien',  icon: '👤', phase: 2 },
  { key: 'familie',     label: 'Familie',      icon: '👨‍👩‍👧', phase: 2 },
  { key: 'policen',     label: 'Policen',      icon: '🛡️', phase: 2 },
  { key: 'vergleich',   label: 'Vergleich',    icon: '📊', phase: 2 },
  { key: 'empfehlung',  label: 'Empfehlung',   icon: '💡', phase: 3 },
  { key: 'export',      label: 'Export / PDF', icon: '📄', phase: 4 },
];

export default function DossierBuilder({ dossierId, onSaved }) {
  const [activeTab, setActiveTab] = useState('stammdaten');
  const [pendingImportContract, setPendingImportContract] = useState(null);
  const qc = useQueryClient();

  const { data: dossier, isLoading } = useQuery({
    queryKey: ['advisory_dossier', dossierId],
    queryFn: () => base44.entities.AdvisoryDossier.filter({ id: dossierId }).then(r => r[0]),
    enabled: !!dossierId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AdvisoryDossier.create(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['advisory_dossiers'] });
      onSaved(created.id);
      setActiveTab('personalien');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AdvisoryDossier.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advisory_dossier', dossierId] });
      qc.invalidateQueries({ queryKey: ['advisory_dossiers'] });
      setActiveTab('personalien');
    },
  });

  // Aktivierbare Tabs berechnen
  const isTabEnabled = useCallback((tab) => {
    if (tab.phase === 1) return true;
    if (tab.phase === 2) return !!dossierId;
    if (tab.phase === 4) return !!dossierId;
    return false;
  }, [dossierId]);

  const enabledTabs = TABS.filter(isTabEnabled);
  const activeIndex = enabledTabs.findIndex(t => t.key === activeTab);
  const prevTab = activeIndex > 0 ? enabledTabs[activeIndex - 1] : null;
  const nextTab = activeIndex < enabledTabs.length - 1 ? enabledTabs[activeIndex + 1] : null;

  // Tastatur-Navigation: Alt+← / Alt+→
  useEffect(() => {
    const handler = (e) => {
      if (!e.altKey) return;
      if (e.key === 'ArrowLeft' && prevTab) { e.preventDefault(); setActiveTab(prevTab.key); }
      if (e.key === 'ArrowRight' && nextTab) { e.preventDefault(); setActiveTab(nextTab.key); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevTab, nextTab]);

  if (isLoading && dossierId) {
    return <div className="h-40 bg-muted animate-pulse rounded-xl" />;
  }

  const totalEnabled = enabledTabs.length;
  const progressPct = totalEnabled > 1 ? Math.round((activeIndex / (totalEnabled - 1)) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">

      {/* Tab Bar */}
      <div className="flex border-b border-border overflow-x-auto scrollbar-none">
        {TABS.map(tab => {
          const enabled = isTabEnabled(tab);
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => enabled && setActiveTab(tab.key)}
              disabled={!enabled}
              title={
                !enabled && tab.phase > 2
                  ? `Verfügbar ab Phase ${tab.phase}`
                  : enabled
                    ? `${tab.label} (Alt+← / Alt+→)`
                    : 'Zuerst Dossier speichern'
              }
              className={[
                'flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors relative',
                isActive
                  ? 'border-primary text-primary bg-primary/5'
                  : enabled
                    ? 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    : 'border-transparent text-muted-foreground/40 cursor-not-allowed',
              ].join(' ')}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.phase > 2 && (
                <span className="text-[10px] bg-muted text-muted-foreground/70 px-1.5 py-0.5 rounded-full">
                  {tab.phase === 3 ? 'Bald' : 'PDF'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Meta-Strip: Dossier-Info + Fortschrittsbalken */}
      <div className="border-b border-border/60">
        {dossier ? (
          <div className="px-6 py-2 bg-muted/20 flex items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-semibold text-foreground truncate">{dossier.title}</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="truncate">{dossier.customer_name}</span>
              {dossier.version > 1 && (
                <span className="bg-muted border border-border px-1.5 py-0.5 rounded text-[10px]">v{dossier.version}</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground/60 shrink-0 hidden sm:block">
              Alt+← / Alt+→ zum Navigieren
            </span>
          </div>
        ) : (
          <div className="px-6 py-1.5 bg-amber-50/50">
            <p className="text-[11px] text-amber-700">Neues Dossier — Stammdaten speichern, um weitere Tabs freizuschalten.</p>
          </div>
        )}
        {/* Fortschrittsbalken */}
        <div className="h-0.5 bg-muted/40 relative">
          <div
            className="h-full bg-primary/50 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'stammdaten' && (
          <DossierStammdatenTab
            dossier={dossier}
            onSave={(data) => {
              if (dossierId) updateMutation.mutate({ id: dossierId, data });
              else createMutation.mutate(data);
            }}
            isSaving={createMutation.isPending || updateMutation.isPending}
          />
        )}
        {activeTab === 'personalien' && <DossierPersonalienTab dossier={dossier} />}
        {activeTab === 'familie'     && <DossierFamilieTab     dossier={dossier} />}
        {activeTab === 'policen'     && (
          <DossierPolicenTab
            dossier={dossier}
            onImportContract={(contract) => {
              setActiveTab('vergleich');
              setPendingImportContract(contract);
            }}
          />
        )}
        {activeTab === 'vergleich' && (
          <DossierVergleichTab
            dossier={dossier}
            pendingImportContract={pendingImportContract}
            onPendingImportConsumed={() => setPendingImportContract(null)}
          />
        )}
        {activeTab === 'empfehlung' && (
          <DossierPlaceholderTab tab={TABS.find(t => t.key === 'empfehlung')} />
        )}
        {activeTab === 'export' && (
          <DossierExportTab dossier={dossier} />
        )}
      </div>

      {/* Weiter / Zurück Navigation */}
      {enabledTabs.length > 1 && (
        <div className="border-t border-border/60 px-6 py-3 flex items-center justify-between bg-muted/20">
          <button
            onClick={() => prevTab && setActiveTab(prevTab.key)}
            disabled={!prevTab}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-0 transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {prevTab?.label}
          </button>

          {/* Step-Indikator */}
          <div className="flex items-center gap-1.5">
            {enabledTabs.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full transition-all ${
                  i === activeIndex
                    ? 'w-4 h-2 bg-primary'
                    : 'w-2 h-2 bg-border hover:bg-muted-foreground/50'
                }`}
                title={tab.label}
              />
            ))}
          </div>

          <button
            onClick={() => nextTab && setActiveTab(nextTab.key)}
            disabled={!nextTab}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-0 transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            {nextTab?.label}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}