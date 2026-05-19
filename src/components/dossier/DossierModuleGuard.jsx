/**
 * DossierModuleGuard
 * Zeigt eine Sperrseite wenn das Modul deaktiviert oder der Nutzer kein Admin ist.
 */
import React from 'react';

export default function DossierModuleGuard({ reason }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <span className="text-2xl">🔒</span>
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        {reason === 'feature_disabled' ? 'Modul nicht aktiv' : 'Kein Zugriff'}
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {reason === 'feature_disabled'
          ? 'Das Beratungsdossier-Modul ist aktuell deaktiviert. Bitte wenden Sie sich an Ihren Administrator.'
          : 'Dieses Modul ist aktuell nur für Administratoren zugänglich (Beta-Phase).'}
      </p>
    </div>
  );
}