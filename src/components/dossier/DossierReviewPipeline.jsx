/**
 * DossierReviewPipeline — Review-Status-Stepper
 *
 * Zeigt den vollständigen Beratungsprozess als visuelle Pipeline.
 * Klickbar zum manuellen Vorwärtsbewegen.
 * Berücksichtigt advisor_approved als automatischen Trigger.
 */
import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';

const STAGES = [
  {
    key: 'offen',
    label: 'Erstellt',
    short: 'Erstellt',
    description: 'Dossier angelegt',
  },
  {
    key: 'ki_analysiert',
    label: 'KI analysiert',
    short: 'KI',
    description: 'Dokumente analysiert, Einträge vorhanden',
  },
  {
    key: 'in_pruefung',
    label: 'In Prüfung',
    short: 'Prüfung',
    description: 'Berater prüft und passt Vergleich an',
  },
  {
    key: 'berater_angepasst',
    label: 'Berater entschieden',
    short: 'Entscheid',
    description: 'Finale Empfehlung gewählt, Begründung erfasst',
  },
  {
    key: 'freigegeben',
    label: 'Freigegeben',
    short: 'Freigabe',
    description: 'Berater hat freigegeben — PDF bereit',
  },
];

const STAGE_KEYS = STAGES.map(s => s.key);

function getEffectiveStatus(dossier) {
  // advisor_approved überschreibt immer den manuellen Status
  if (dossier?.advisor_approved) return 'freigegeben';
  return dossier?.review_status || 'offen';
}

function getStageIndex(key) {
  return STAGE_KEYS.indexOf(key);
}

export default function DossierReviewPipeline({ dossier }) {
  const qc = useQueryClient();
  const effectiveStatus = getEffectiveStatus(dossier);
  const currentIndex = Math.max(0, getStageIndex(effectiveStatus));

  const mutation = useMutation({
    mutationFn: (review_status) => base44.entities.AdvisoryDossier.update(dossier.id, { review_status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advisory_dossier', dossier.id] });
      qc.invalidateQueries({ queryKey: ['advisory_dossiers'] });
    },
  });

  const handleStageClick = (idx) => {
    if (!dossier?.id) return;
    // advisor_approved kann nur über BeraterEntscheidPanel gesetzt werden
    if (STAGE_KEYS[idx] === 'freigegeben') return;
    mutation.mutate(STAGE_KEYS[idx]);
  };

  return (
    <div className="px-6 py-2.5 bg-slate-50/80 border-b border-border/50 flex items-center gap-0">
      {STAGES.map((stage, idx) => {
        const isDone    = idx < currentIndex;
        const isActive  = idx === currentIndex;
        const isFuture  = idx > currentIndex;
        const isLocked  = stage.key === 'freigegeben'; // nur via advisor_approved

        return (
          <React.Fragment key={stage.key}>
            <button
              onClick={() => !isLocked && !isDone && handleStageClick(idx)}
              disabled={isLocked || mutation.isPending}
              title={isLocked ? 'Wird automatisch gesetzt wenn Berater freigibt' : stage.description}
              className={[
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                isActive  ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : '',
                isDone    ? 'text-emerald-700 hover:bg-emerald-50 cursor-pointer' : '',
                isFuture && !isLocked ? 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted cursor-pointer' : '',
                isLocked && !isActive && !isDone ? 'text-muted-foreground/40 cursor-default' : '',
              ].join(' ')}
            >
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground/40'}`} />
              )}
              <span className="hidden sm:inline">{stage.short}</span>
            </button>
            {idx < STAGES.length - 1 && (
              <ChevronRight className="w-3 h-3 text-muted-foreground/30 mx-0.5 shrink-0" />
            )}
          </React.Fragment>
        );
      })}

      {/* Status-Label rechts */}
      <div className="ml-auto pl-3 flex items-center gap-1.5">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          effectiveStatus === 'freigegeben'
            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            : effectiveStatus === 'berater_angepasst'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : effectiveStatus === 'in_pruefung'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
        }`}>
          {STAGES[currentIndex]?.label}
        </span>
      </div>
    </div>
  );
}