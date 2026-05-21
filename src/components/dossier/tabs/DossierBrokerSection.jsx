/**
 * DossierBrokerSection — Berater & Organisation im Dossier
 *
 * Datenquellen (Priorität):
 *   1. Dossier snap_* Felder (historisiert, persistent)
 *   2. Live-Daten aus Advisor + Organization (via customer.advisor_id / customer.organization_id)
 *
 * Schreibt NUR auf AdvisoryDossier. Keine Mutation an Stammdaten.
 */
import React, { useState } from 'react';
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

  // 1. Kunde laden → liefert advisor_id + organization_id als Fallback
  const { data: customer } = useQuery({
    queryKey: ['broker_section_customer', dossier?.customer_id],
    queryFn: () => base44.entities.Customer.filter({ id: dossier.customer_id }).then(r => r[0]),
    enabled: !!dossier?.customer_id,
  });

  const advisorId = dossier?.advisor_id || customer?.advisor_id;
  const orgId = dossier?.organization_id || customer?.organization_id;

  // 2. Live-Daten immer laden (für Anzeige + Auto-Befüllung)
  const { data: liveOrg } = useQuery({
    queryKey: ['broker_section_org', orgId],
    queryFn: () => base44.entities.Organization.filter({ id: orgId }).then(r => r[0]),
    enabled: !!orgId,
  });
  const { data: liveAdv } = useQuery({
    queryKey: ['broker_section_adv', advisorId],
    queryFn: () => base44.entities.Advisor.filter({ id: advisorId }).then(r => r[0]),
    enabled: !!advisorId,
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

  const buildFromLive = () => ({
    snap_org_name:      liveOrg?.name         || '',
    snap_org_street:    liveOrg?.street        || '',
    snap_org_zip:       liveOrg?.zip_code      || '',
    snap_org_city:      liveOrg?.city          || '',
    snap_org_phone:     liveOrg?.phone         || '',
    snap_org_email:     liveOrg?.email         || '',
    snap_org_website:   liveOrg?.website       || '',
    snap_org_finma:     liveOrg?.finma_number  || '',
    snap_adv_firstname: liveAdv?.firstname     || '',
    snap_adv_lastname:  liveAdv?.lastname      || '',
    snap_adv_function:  '',
    snap_adv_phone:     liveAdv?.phone         || '',
    snap_adv_email:     liveAdv?.email         || '',
    snap_adv_finma:     liveAdv?.finma_number  || '',
    snap_adv_vbv:       liveAdv?.vbv_number    || '',
  });

  const buildFromSnap = () => ({
    snap_org_name:      dossier?.snap_org_name      || '',
    snap_org_street:    dossier?.snap_org_street    || '',
    snap_org_zip:       dossier?.snap_org_zip       || '',
    snap_org_city:      dossier?.snap_org_city      || '',
    snap_org_phone:     dossier?.snap_org_phone     || '',
    snap_org_email:     dossier?.snap_org_email     || '',
    snap_org_website:   dossier?.snap_org_website   || '',
    snap_org_finma:     dossier?.snap_org_finma     || '',
    snap_adv_firstname: dossier?.snap_adv_firstname || '',
    snap_adv_lastname:  dossier?.snap_adv_lastname  || '',
    snap_adv_function:  dossier?.snap_adv_function  || '',
    snap_adv_phone:     dossier?.snap_adv_phone     || '',
    snap_adv_email:     dossier?.snap_adv_email     || '',
    snap_adv_finma:     dossier?.snap_adv_finma     || '',
    snap_adv_vbv:       dossier?.snap_adv_vbv       || '',
  });

  const handleAutoFill = () => { setForm(buildFromLive()); setEditing(true); };
  const handleEdit = () => { setForm(buildFromSnap()); setEditing(true); };
  const handleSave = () => updateMutation.mutate(form);
  const set = (field) => (val) => setForm(f => ({ ...f, [field]: val }));

  // ── Edit-Modus ─────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-primary font-medium">
            <Edit3 className="w-3.5 h-3.5" />
            Absenderdaten — wird nur in diesem Dossier gespeichert (historisiert)
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
            <EditField label="E-Mail" type="email" value={form.snap_org_email} onChange={set('snap_org_email')} />
            <EditField label="Website" value={form.snap_org_website} onChange={set('snap_org_website')} />
            <EditField label="FINMA-Nr." value={form.snap_org_finma} onChange={set('snap_org_finma')} />
          </div>

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
            <EditField label="E-Mail" type="email" value={form.snap_adv_email} onChange={set('snap_adv_email')} />
            <EditField label="FINMA-Nr." value={form.snap_adv_finma} onChange={set('snap_adv_finma')} />
            <EditField label="VBV-Nr." value={form.snap_adv_vbv} onChange={set('snap_adv_vbv')} />
          </div>
        </div>
      </div>
    );
  }

  // ── Read-only — zeigt entweder Snap-Daten oder Live-Vorschau ───────────────
  const displayOrg = hasSnapData ? {
    name:    dossier.snap_org_name,
    address: [dossier.snap_org_street, `${dossier.snap_org_zip || ''} ${dossier.snap_org_city || ''}`.trim()].filter(Boolean).join(', '),
    phone:   dossier.snap_org_phone,
    email:   dossier.snap_org_email,
    website: dossier.snap_org_website,
    finma:   dossier.snap_org_finma,
  } : liveOrg ? {
    name:    liveOrg.name,
    address: [liveOrg.street, `${liveOrg.zip_code || ''} ${liveOrg.city || ''}`.trim()].filter(Boolean).join(', '),
    phone:   liveOrg.phone,
    email:   liveOrg.email,
    website: liveOrg.website,
    finma:   liveOrg.finma_number,
  } : null;

  const displayAdv = hasSnapData ? {
    name:     [dossier.snap_adv_firstname, dossier.snap_adv_lastname].filter(Boolean).join(' '),
    function: dossier.snap_adv_function,
    phone:    dossier.snap_adv_phone,
    email:    dossier.snap_adv_email,
    finma:    dossier.snap_adv_finma,
    vbv:      dossier.snap_adv_vbv,
  } : liveAdv ? {
    name:     [liveAdv.firstname, liveAdv.lastname].filter(Boolean).join(' '),
    function: '',
    phone:    liveAdv.phone,
    email:    liveAdv.email,
    finma:    liveAdv.finma_number,
    vbv:      liveAdv.vbv_number,
  } : null;

  const hasAnyData = !!(displayOrg || displayAdv);

  return (
    <div className="mt-4 space-y-4">
      {/* Status-Banner */}
      <div className="flex items-center justify-between gap-3 text-xs rounded-lg px-3 py-2 border"
        style={hasSnapData
          ? { background: '#f0fdf4', borderColor: '#bbf7d0' }
          : { background: '#fffbeb', borderColor: '#fde68a' }}
      >
        <div className="flex items-center gap-2" style={{ color: hasSnapData ? '#166534' : '#92400e' }}>
          <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
          {hasSnapData
            ? <span><strong>Im Dossier gespeichert</strong> — historisch stabil, unabhängig von Stammdatenänderungen.</span>
            : <span><strong>Live-Vorschau aus Stammdaten</strong> — noch nicht im Dossier gespeichert. Daten für PDF übernehmen.</span>
          }
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!hasSnapData && hasAnyData && (
            <button
              onClick={handleAutoFill}
              className="flex items-center gap-1.5 font-medium hover:underline text-amber-700"
            >
              <Download className="w-3 h-3" />
              Ins Dossier übernehmen
            </button>
          )}
          <button
            onClick={hasSnapData ? handleEdit : handleAutoFill}
            className="flex items-center gap-1.5 text-primary font-medium hover:underline"
          >
            <Edit3 className="w-3 h-3" />
            {hasSnapData ? 'Bearbeiten' : 'Erfassen'}
          </button>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
          Kein Berater oder keine Organisation am Kunden/Dossier hinterlegt.{' '}
          <button onClick={handleEdit} className="text-primary font-medium hover:underline">Manuell erfassen</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Organisation */}
          {displayOrg && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold">Organisation</h3>
                {!hasSnapData && <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Live</span>}
              </div>
              <div className="space-y-2.5">
                <InfoRow label="Name" value={displayOrg.name} />
                <InfoRow label="Adresse" value={displayOrg.address} />
                <InfoRow label="Telefon" value={displayOrg.phone} />
                <InfoRow label="E-Mail" value={displayOrg.email} />
                <InfoRow label="Website" value={displayOrg.website} />
                <InfoRow label="FINMA-Nr." value={displayOrg.finma} />
              </div>
            </div>
          )}

          {/* Berater */}
          {displayAdv && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <h3 className="text-sm font-semibold">Berater</h3>
                {!hasSnapData && <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Live</span>}
              </div>
              <div className="space-y-2.5">
                <InfoRow label="Name" value={displayAdv.name} />
                <InfoRow label="Funktion" value={displayAdv.function} />
                <InfoRow label="Telefon" value={displayAdv.phone} />
                <InfoRow label="E-Mail" value={displayAdv.email} />
                <InfoRow label="FINMA-Nr." value={displayAdv.finma} />
                <InfoRow label="VBV-Nr." value={displayAdv.vbv} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}