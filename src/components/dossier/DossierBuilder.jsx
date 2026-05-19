/**
 * DossierBuilder — Phase 2
 * Tabs: Stammdaten (Phase 1), Personalien, Familie, Policen, Vergleich (Phase 2).
 * Phase 3+ als Platzhalter.
 * Kein Write auf bestehende CRM-Entities.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DossierStammdatenTab from './tabs/DossierStammdatenTab';
import DossierPersonalienTab from './tabs/DossierPersonalienTab';
import DossierFamilieTab from './tabs/DossierFamilieTab';
import DossierPolicenTab from './tabs/DossierPolicenTab';
import DossierVergleichTab from './tabs/DossierVergleichTab';
import DossierPlaceholderTab from './tabs/DossierPlaceholderTab';

const TABS = [
  { key: 'stammdaten',  label: 'Stammdaten',   icon: '📋', phase: 1 },
  { key: 'personalien', label: 'Personalien',   icon: '👤', phase: 2 },
  { key: 'familie',     label: 'Familie',       icon: '👨‍👩‍👧', phase: 2 },
  { key: 'policen',     label: 'Policen',       icon: '🛡️', phase: 2 },
  { key: 'vergleich',   label: 'Vergleich',     icon: '📊', phase: 2 },
  { key: 'empfehlung',  label: 'Empfehlung',    icon: '💡', phase: 3 },
  { key: 'export',      label: 'Export / PDF',  icon: '📄', phase: 4 },
];

const PHASE2_TABS = new Set(['personalien', 'familie', 'policen', 'vergleich']);

export default function DossierBuilder({ dossierId, onSaved }) {
  const [activeTab, setActiveTab] = useState('stammdaten');
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
      // Jump to Personalien after creation
      setActiveTab('personalien');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AdvisoryDossier.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advisory_dossier', dossierId] });
      qc.invalidateQueries({ queryKey: ['advisory_dossiers'] });
    },
  });

  if (isLoading && dossierId) {
    return <div className="h-40 bg-muted animate-pulse rounded-xl" />;
  }

  const isTabEnabled = (tab) => {
    if (tab.phase === 1) return true;
    if (tab.phase === 2) return !!dossierId;
    return false; // Phase 3+ locked
  };

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
              title={!enabled && tab.phase > 2 ? `Verfügbar in Phase ${tab.phase}` : undefined}
              className={[
                'flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
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
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  Phase {tab.phase}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Dossier meta strip (wenn geladen) */}
      {dossier && (
        <div className="px-6 py-2 bg-muted/30 border-b border-border/60 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{dossier.title}</span>
          <span>·</span>
          <span>{dossier.customer_name}</span>
          {dossier.version > 1 && <><span>·</span><span>v{dossier.version}</span></>}
        </div>
      )}

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
        {activeTab === 'policen'     && <DossierPolicenTab     dossier={dossier} />}
        {activeTab === 'vergleich'   && <DossierVergleichTab   dossier={dossier} />}

        {activeTab === 'empfehlung' && (
          <DossierPlaceholderTab tab={TABS.find(t => t.key === 'empfehlung')} />
        )}
        {activeTab === 'export' && (
          <DossierPlaceholderTab tab={TABS.find(t => t.key === 'export')} />
        )}
      </div>
    </div>
  );
}