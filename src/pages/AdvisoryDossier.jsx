/**
 * AdvisoryDossierEngine — Phase 1
 * Status: Grundstruktur / Admin-Only (Feature-Flag: DOSSIER_MODULE_ENABLED)
 * Keine aktive Businesslogik, keine PDF-Generierung, keine Automationen.
 * Alle CRM-Datenzugriffe: read-only.
 */

import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import DossierList from '@/components/dossier/DossierList';
import DossierBuilder from '@/components/dossier/DossierBuilder.jsx';
import DossierModuleGuard from '@/components/dossier/DossierModuleGuard';
import AiExtractionQualityDashboard from '@/components/dossier/AiExtractionQualityDashboard';

// Feature-Flag: Modul ist aktuell nur für Admins sichtbar
const DOSSIER_MODULE_ENABLED = true;

export default function AdvisoryDossier() {
  const { user } = useAuth();
  const [view, setView] = useState('list'); // 'list' | 'builder' | 'quality'
  const [selectedDossierId, setSelectedDossierId] = useState(null);

  // Admin-Only Guard
  if (!DOSSIER_MODULE_ENABLED || user?.role !== 'admin') {
    return (
      <DossierModuleGuard
        reason={!DOSSIER_MODULE_ENABLED ? 'feature_disabled' : 'insufficient_role'}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold text-foreground">Beratungsdossiers</h1>
            <span className="text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
              Beta · Admin only
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Professionelle Versicherungsvergleiche und Kundendossiers — modular, versioniert, exportierbar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {view === 'list' && (
            <>
              <button
                onClick={() => setView('quality')}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-border text-sm font-medium rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                📊 KI-Qualität
              </button>
              <button
                onClick={() => { setSelectedDossierId(null); setView('builder'); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                <span className="text-base leading-none">+</span>
                Neues Dossier
              </button>
            </>
          )}
          {(view === 'builder' || view === 'quality') && (
            <button
              onClick={() => setView('list')}
              className="inline-flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-lg hover:bg-muted transition-colors"
            >
              ← Zurück zur Übersicht
            </button>
          )}
        </div>
      </div>

      {/* Phase B+C Status */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
        <span className="text-base leading-none mt-0.5">✅</span>
        <div>
          <strong>Phase B+C aktiv:</strong> Multi-Produkt-KI-Extraktion, Personen-Erkennung, Review-Workflow, Confidence-System und Qualitätsmessung verfügbar.
          Navigation mit <kbd className="bg-white border border-emerald-300 rounded px-1 py-0.5 text-[11px] font-mono">Alt+←</kbd> <kbd className="bg-white border border-emerald-300 rounded px-1 py-0.5 text-[11px] font-mono">Alt+→</kbd> zwischen Tabs.
        </div>
      </div>

      {/* Content */}
      {view === 'list' && (
        <DossierList
          onOpen={(id) => { setSelectedDossierId(id); setView('builder'); }}
        />
      )}

      {view === 'builder' && (
        <DossierBuilder
          dossierId={selectedDossierId}
          onSaved={(id) => { setSelectedDossierId(id); }}
        />
      )}

      {view === 'quality' && (
        <div className="bg-card border border-border rounded-xl p-6">
          <AiExtractionQualityDashboard />
        </div>
      )}
    </div>
  );
}