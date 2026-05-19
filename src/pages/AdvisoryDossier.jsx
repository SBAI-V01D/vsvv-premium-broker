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

// Feature-Flag: Modul ist aktuell nur für Admins sichtbar
const DOSSIER_MODULE_ENABLED = true;

export default function AdvisoryDossier() {
  const { user } = useAuth();
  const [view, setView] = useState('list'); // 'list' | 'builder'
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

        {view === 'list' && (
          <button
            onClick={() => { setSelectedDossierId(null); setView('builder'); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Neues Dossier
          </button>
        )}

        {view === 'builder' && (
          <button
            onClick={() => setView('list')}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-lg hover:bg-muted transition-colors"
          >
            ← Zurück zur Übersicht
          </button>
        )}
      </div>

      {/* Phase-3 Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        <strong>Phase 3 — Vergleichs- &amp; Berechnungslogik:</strong> Prämienvergleich, Einsparungsberechnung, Side-by-Side-Vergleich und Leistungsbewertung aktiv.
        PDF-Export, Automationen und KI-Empfehlungen folgen in späteren Phasen.
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
    </div>
  );
}