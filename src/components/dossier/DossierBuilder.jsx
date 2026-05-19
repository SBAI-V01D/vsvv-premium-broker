/**
 * DossierBuilder — Phase 1
 * Grundstruktur: Tabs für spätere Phasen.
 * Aktuell: Stammdaten-Tab funktional, restliche Tabs als Platzhalter.
 * Keine Automationen, keine PDF-Generierung, keine Writes auf bestehende Entities.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DossierStammdatenTab from './tabs/DossierStammdatenTab';
import DossierPlaceholderTab from './tabs/DossierPlaceholderTab';

const TABS = [
  { key: 'stammdaten',  label: 'Stammdaten',   icon: '👤', phase: 1 },
  { key: 'vergleich',   label: 'Vergleich',    icon: '📊', phase: 2 },
  { key: 'leistungen',  label: 'Leistungen',   icon: '⭐', phase: 3 },
  { key: 'empfehlung',  label: 'Empfehlung',   icon: '💡', phase: 3 },
  { key: 'export',      label: 'Export / PDF', icon: '📄', phase: 4 },
];

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

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Tab Bar */}
      <div className="flex border-b border-border overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            disabled={tab.phase > 1 && !dossierId}
            className={`
              flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
              ${activeTab === tab.key
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'}
              ${tab.phase > 1 ? 'opacity-50' : ''}
            `}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {tab.phase > 1 && (
              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                Phase {tab.phase}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'stammdaten' && (
          <DossierStammdatenTab
            dossier={dossier}
            onSave={(data) => {
              if (dossierId) {
                updateMutation.mutate({ id: dossierId, data });
              } else {
                createMutation.mutate(data);
              }
            }}
            isSaving={createMutation.isPending || updateMutation.isPending}
          />
        )}

        {activeTab !== 'stammdaten' && (
          <DossierPlaceholderTab tab={TABS.find(t => t.key === activeTab)} />
        )}
      </div>
    </div>
  );
}