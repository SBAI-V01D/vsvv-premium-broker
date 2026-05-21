/**
 * BeraterEntscheidPanel — Beraterentscheid-Layer
 *
 * KI liefert Optionen. Der Berater liefert die Empfehlung.
 *
 * Berater wählt:
 *   - Welche Vergleichsgruppe ist die finale Empfehlung
 *   - Label/Positionierung (z.B. "Preis-Leistungs-Empfehlung")
 *   - Begründung (optional)
 *   - Freigabe für PDF-Export
 */
import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Award, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';

const GRUPPE_OPTIONS = [
  { value: '',              label: '— Noch nicht entschieden —' },
  { value: 'optimiert',    label: 'Optimierte Lösung' },
  { value: 'angebot_1',   label: 'Angebot 1' },
  { value: 'angebot_2',   label: 'Angebot 2' },
  { value: 'angebot_3',   label: 'Angebot 3' },
  { value: 'angebot_4',   label: 'Angebot 4' },
  { value: 'angebot_5',   label: 'Angebot 5' },
  { value: 'aktuelle_loesung', label: 'Aktuelle Lösung (beibehalten)' },
];

const LABEL_SUGGESTIONS = [
  'Preis-Leistungs-Empfehlung',
  'Komfortlösung',
  'Budgetlösung',
  'Familienlösung',
  'Premium-Empfehlung',
  'Flexibilitätslösung',
  'Sicherheitslösung',
  'Empfehlung Berater',
];

export default function BeraterEntscheidPanel({ dossier, entries = [] }) {
  const [form, setForm] = useState({
    advisor_final_recommendation: '',
    advisor_recommendation_label: '',
    advisor_recommendation_reason: '',
    advisor_recommendation_highlights: '',
    advisor_approved: false,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!dossier) return;
    setForm({
      advisor_final_recommendation: dossier.advisor_final_recommendation || '',
      advisor_recommendation_label: dossier.advisor_recommendation_label || '',
      advisor_recommendation_reason: dossier.advisor_recommendation_reason || '',
      advisor_recommendation_highlights: dossier.advisor_recommendation_highlights || '',
      advisor_approved: dossier.advisor_approved || false,
    });
    setHasChanges(false);
  }, [dossier?.id]);

  const mutation = useMutation({
    mutationFn: (data) => {
      // Approval-History-Eintrag wenn advisor_approved sich ändert
      const approvalChanged =
        data.advisor_approved !== undefined &&
        data.advisor_approved !== (dossier.advisor_approved || false);
      if (approvalChanged) {
        const entry = {
          action: data.advisor_approved ? 'approved' : 'approval_revoked',
          timestamp: new Date().toISOString(),
          previous_approved: dossier.advisor_approved || false,
        };
        data = { ...data, approval_history: [...(dossier.approval_history || []), entry] };
      }
      return base44.entities.AdvisoryDossier.update(dossier.id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advisory_dossier'] });
      qc.invalidateQueries({ queryKey: ['dossier_detail'] });
      setHasChanges(false);
      toast.success('Beraterentscheid gespeichert');
    },
  });

  const set = (field) => (val) => {
    setForm(f => ({ ...f, [field]: val }));
    setHasChanges(true);
  };

  const isApproved = form.advisor_approved;
  const hasRec = !!form.advisor_final_recommendation;

  // Nur Gruppen anzeigen, die tatsächlich Einträge haben
  const presentGruppen = GRUPPE_OPTIONS.filter(o =>
    !o.value || entries.some(e => e.gruppe === o.value)
  );

  const statusBg    = isApproved ? 'bg-emerald-50 border-emerald-300' : hasRec ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200';
  const statusColor = isApproved ? 'text-emerald-700' : hasRec ? 'text-amber-700' : 'text-slate-500';

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${statusBg}`}>
      {/* Header */}
      <div className={`px-5 py-3 flex items-center justify-between gap-3 flex-wrap`}>
        <div className="flex items-center gap-2.5">
          <Award className={`w-4 h-4 ${statusColor}`} />
          <span className="text-sm font-bold text-foreground">Beraterentscheid</span>
          {isApproved && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Freigegeben für PDF
            </span>
          )}
          {!isApproved && hasRec && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-2.5 h-2.5" />
              Empfehlung gewählt — noch nicht freigegeben
            </span>
          )}
          {!hasRec && (
            <span className="text-[10px] text-muted-foreground">
              Noch kein Entscheid getroffen
            </span>
          )}
        </div>

        {hasChanges && (
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            className="text-xs font-semibold text-primary border border-primary/30 bg-primary/5 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Speichern…' : 'Speichern'}
          </button>
        )}
      </div>

      {/* Form */}
      <div className="px-5 py-4 bg-white space-y-4 border-t border-border/40">
        <p className="text-xs text-muted-foreground italic">
          KI liefert Optionen. Der Berater liefert die Empfehlung.
          Wählen Sie die finale Lösung — erst dann ist das PDF bereit.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Finale Empfehlung */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Finale Empfehlung <span className="text-muted-foreground font-normal">(Vergleichsgruppe)</span>
            </label>
            <select
              value={form.advisor_final_recommendation}
              onChange={e => set('advisor_final_recommendation')(e.target.value)}
              className="w-full border border-input bg-background rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {presentGruppen.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Label / Positionierung */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Positionierung <span className="text-muted-foreground font-normal">(erscheint im PDF)</span>
            </label>
            <input
              list="berater-label-suggestions"
              value={form.advisor_recommendation_label}
              onChange={e => set('advisor_recommendation_label')(e.target.value)}
              placeholder="z.B. Preis-Leistungs-Empfehlung"
              className="w-full border border-input bg-background rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <datalist id="berater-label-suggestions">
              {LABEL_SUGGESTIONS.map(l => <option key={l} value={l} />)}
            </datalist>
          </div>
        </div>

        {/* Begründung */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Beratungsbegründung <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={form.advisor_recommendation_reason}
            onChange={e => set('advisor_recommendation_reason')(e.target.value)}
            placeholder="z.B. Aufgrund des Reiseprofils und der bevorzugten tiefen Franchise wird Angebot 1 empfohlen. Familie steht im Mittelpunkt."
            rows={2}
            className="w-full border border-input bg-background rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>

        {/* Highlights / Empfohlen aufgrund */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Empfohlen aufgrund <span className="text-muted-foreground font-normal">(optional — erscheinen als Checkmarks im PDF)</span>
          </label>
          <textarea
            value={form.advisor_recommendation_highlights}
            onChange={e => set('advisor_recommendation_highlights')(e.target.value)}
            placeholder={`höhere Flexibilität bei der Spitalabteilung\nbessere ambulante Zusätze\nakzeptable Mehrkosten von CHF 12/Mt.`}
            rows={3}
            className="w-full border border-input bg-background rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Einen Punkt pro Zeile. Jede Zeile erscheint als ✓-Checkmark im PDF.</p>
        </div>

        {/* Freigabe */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.advisor_approved}
              onChange={e => set('advisor_approved')(e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-sm font-semibold">
              Dossier freigeben für PDF-Export
            </span>
          </label>
          {!isApproved && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              Freigabe erforderlich für finales PDF
            </div>
          )}
        </div>
      </div>
    </div>
  );
}