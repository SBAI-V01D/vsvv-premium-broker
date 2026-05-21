/**
 * DossierBrokerSection — Berater & Organisation im Dossier
 *
 * - Zeigt/editiert snap_org_* und snap_adv_* Felder auf dem Dossier
 * - Schreibt NUR auf AdvisoryDossier, NICHT auf Org/Advisor Stammdaten
 * - Auto-Befüllung aus Live-Daten (einmalig, auf Wunsch)
 * - Historisiert: Änderungen am Stammdaten beeinflussen dieses Dossier nicht
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, User, Edit3, Check, X, Download, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';

function EditField({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">{label}</label>
      <input
        className="w-full border border-input bg-background rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-sm text-foreground font-medium">{value}</span>
    </div>
  );
}

export default function DossierBrokerSection({ dossier }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const qc = useQueryClient();

  const hasSnapData = !!(dossier?.snap_org_name || dossier?.snap_adv_firstname);

  // Live-Daten nur für Auto-Befüllung laden
  const { data: liveOrg } = useQuery({
    queryKey: ['snap_org', dossier?.organization_id],
    queryFn: () => base44.entities.Organization.filter({ id: dossier.organization_id }).then(r => r[0]),
    enabled: !!dossier?.organization_id && !hasSnapData,
  });
  const { data: liveAdv } = useQuery({
    queryKey: ['snap_adv', dossier?.advisor_id],
    queryFn: () => base44.entities.Advisor.filter({ id: dossier.advisor_id }).then(r => r[0]),
    enabled: !!dossier?.advisor_id && !hasSnapData,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.AdvisoryDossier.update(dossier.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advisory_dossier'] });
      qc.invalidateQueries({ queryKey: ['dossier_detail'] });
      setEditing(false);
      toast.success('Berater- & Organisationsdaten gespeichert');
    },
  });

  const buildFormFromDossier = () => ({
    snap_org_name:    dossier.snap_org_name    || '',
    snap_org_street:  dossier.snap_org_street  || '',
    snap_org_zip:     dossier.snap_org_zip     || '',
    snap_org_city:    dossier.snap_org_city    || '',
    snap_org_phone:   dossier.snap_org_phone   || '',
    snap_org_email:   dossier.snap_org_email   || '',
    snap_org_website: dossier.snap_org_website || '',
    snap_org_finma:   dossier.snap_org_finma   || '',
    snap_adv_firstname: dossier.snap_adv_firstname || '',
    snap_adv_lastname:  dossier.snap_adv_lastname  || '',
    snap_adv_function:  dossier.snap_adv_function  || '',
    snap_adv_phone:     dossier.snap_adv_phone     || '',
    snap_adv_email:     dossier.snap_adv_email     || '',
    snap_adv_finma:     dossier.snap_adv_finma     || '',
    snap_adv_vbv:       dossier.snap_adv_vbv       || '',
  });

  const handleAutoFill = () => {
    const prefilled = {
      snap_org_name:    liveOrg?.name    || '',
      snap_org_street:  liveOrg?.street  || '',
      snap_org_zip:     liveOrg?.zip_code || '',
      snap_org_city:    liveOrg?.city    || '',
      snap_org_phone:   liveOrg?.phone   || '',
      snap_org_email:   liveOrg?.email   || '',
      snap_org_website: liveOrg?.website || '',
      snap_org_finma:   liveOrg?.finma_number || '',
      snap_adv_firstname: liveAdv?.firstname || '',
      snap_adv_lastname:  liveAdv?.lastname  || '',
      snap_adv_function:  '',
      snap_adv_phone:     liveAdv?.phone || '',
      snap_adv_email:     liveAdv?.email || '',
      snap_adv_finma:     liveAdv?.finma_number || '',
      snap_adv_vbv:       liveAdv?.vbv_number  || '',
    };
    setForm(prefilled);
    setEditing(true);
  };

  const handleEdit = () => {
    setForm(buildFormFromDossier());
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  const set = (field) => (val) => setForm(f => ({ ...f, [field]: val }));

  if (editing) {
    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-primary font-medium">
            <Edit3 className="w-3.5 h-3.5" />
            Absenderdaten bearbeiten — wird nur in diesem Dossier gespeichert
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Check className="w-3 h-3" />
              {updateMutation.isPending ? 'Speichern…' : 'Speichern'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-3 h-3" />
              Abbrechen
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Organisation */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <h3 className="text-sm font-semibold">Organisation</h3>
            </div>
            <EditField label="Organisationsname" value={form.snap_org_name} onChange={set('snap_org_name')} />
            <EditField label="Strasse" value={form.snap_org_street} onChange={set('snap_org_street')} />
            <div className="grid grid-cols-2 gap-3">
              <EditField label="PLZ" value={form.snap_org_zip} onChange={set('snap_org_zip')} />
              <EditField label="Ort" value={form.snap_org_city} onChange={set('snap_org_city')} />
            </div>
            <EditField label="Telefon" value={form.snap_org_phone} onChange={set('snap_org_phone')} />
            <EditField label="E-Mail" value={form.snap_org_email} onChange={set('snap_org_email')} type="email" />
            <EditField label="Website" value={form.snap_org_website} onChange={set('snap_org_website')} />
            <EditField label="FINMA-Nr." value={form.snap_org_finma} onChange={set('snap_org_finma')} />
          </div>

          {/* Berater */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <h3 className="text-sm font-semibold">Berater</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Vorname" value={form.snap_adv_firstname} onChange={set('snap_adv_firstname')} />
              <EditField label="Nachname" value={form.snap_adv_lastname} onChange={set('snap_adv_lastname')} />
            </div>
            <EditField label="Funktion / Titel" value={form.snap_adv_function} onChange={set('snap_adv_function')} />
            <EditField label="Telefon" value={form.snap_adv_phone} onChange={set('snap_adv_phone')} />
            <EditField label="E-Mail" value={form.snap_adv_email} onChange={set('snap_adv_email')} type="email" />
            <EditField label="FINMA-Nr." value={form.snap_adv_finma} onChange={set('snap_adv_finma')} />
            <EditField label="VBV-Nr." value={form.snap_adv_vbv} onChange={set('snap_adv_vbv')} />
          </div>
        </div>
      </div>
    );
  }

  // ── Read-only Ansicht ─────────────────────────────────────────────────────
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between gap-3 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 text-amber-800">
          <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>Absenderdaten (historisiert)</strong> — werden im PDF-Header angezeigt und ändern sich nie rückwirkend.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!hasSnapData && (liveOrg || liveAdv) && (
            <button
              onClick={handleAutoFill}
              className="flex items-center gap-1.5 text-amber-700 font-medium hover:underline"
            >
              <Download className="w-3 h-3" />
              Auto-befüllen
            </button>
          )}
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 text-primary font-medium hover:underline"
          >
            <Edit3 className="w-3 h-3" />
            Bearbeiten
          </button>
        </div>
      </div>

      {!hasSnapData ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
          Noch keine Absenderdaten hinterlegt.{' '}
          {(liveOrg || liveAdv) ? (
            <button onClick={handleAutoFill} className="text-primary font-medium hover:underline">
              Aus Stammdaten übernehmen
            </button>
          ) : (
            <button onClick={handleEdit} className="text-primary font-medium hover:underline">
              Jetzt erfassen
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <h3 className="text-sm font-semibold">Organisation</h3>
            </div>
            <div className="space-y-2.5">
              <InfoRow label="Name" value={dossier.snap_org_name} />
              <InfoRow label="Adresse" value={[dossier.snap_org_street, `${dossier.snap_org_zip || ''} ${dossier.snap_org_city || ''}`.trim()].filter(Boolean).join(', ')} />
              <InfoRow label="Telefon" value={dossier.snap_org_phone} />
              <InfoRow label="E-Mail" value={dossier.snap_org_email} />
              <InfoRow label="Website" value={dossier.snap_org_website} />
              <InfoRow label="FINMA-Nr." value={dossier.snap_org_finma} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <h3 className="text-sm font-semibold">Berater</h3>
            </div>
            <div className="space-y-2.5">
              <InfoRow label="Name" value={[dossier.snap_adv_firstname, dossier.snap_adv_lastname].filter(Boolean).join(' ')} />
              <InfoRow label="Funktion" value={dossier.snap_adv_function} />
              <InfoRow label="Telefon" value={dossier.snap_adv_phone} />
              <InfoRow label="E-Mail" value={dossier.snap_adv_email} />
              <InfoRow label="FINMA-Nr." value={dossier.snap_adv_finma} />
              <InfoRow label="VBV-Nr." value={dossier.snap_adv_vbv} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}