/**
 * DossierPersonalienTab — Phase 5.1
 * Edit-Modus für Kundenstammdaten.
 * Customer bleibt Source of Truth — kein Shadow-Cache.
 * Schreibt direkt auf Customer-Entity mit invalidateQueries für CRM-Sync.
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { User, Phone, Mail, MapPin, Calendar, CreditCard, Shield, Edit3, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const CIVIL_STATUS_OPTIONS = [
  { value: '', label: '— Auswählen —' },
  { value: 'single',                 label: 'Ledig' },
  { value: 'married',                label: 'Verheiratet' },
  { value: 'divorced',               label: 'Geschieden' },
  { value: 'widowed',                label: 'Verwitwet' },
  { value: 'registered_partnership', label: 'Eingetragene Partnerschaft' },
  { value: 'dissolved_partnership',  label: 'Aufgelöste Partnerschaft' },
];

const CIVIL_STATUS_LABELS = Object.fromEntries(
  CIVIL_STATUS_OPTIONS.filter(o => o.value).map(o => [o.value, o.label])
);

const PERMIT_LABELS = {
  b_permit: 'Ausweis B', l_permit: 'Ausweis L', c_permit: 'Ausweis C',
  ec_permit: 'Ausweis EC', ci_permit: 'Ausweis CI', g_permit: 'Ausweis G', none: '—',
};

// Dossier-relevante editierbare Felder (kein Write auf systemische Felder)
const EDITABLE_FIELDS = [
  'first_name', 'last_name', 'birthdate', 'civil_status', 'nationality',
  'ahv_number', 'profession', 'phone', 'mobile', 'email',
  'street', 'zip_code', 'city', 'canton', 'permit_type',
  'bank_account', 'risk_profile',
];

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground font-medium">{value}</span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function EditField({ label, type = 'text', value, onChange, options }) {
  const inputCls = "w-full border border-input bg-background rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
  return (
    <div>
      <label className="block text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">{label}</label>
      {options ? (
        <select className={inputCls} value={value || ''} onChange={e => onChange(e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input className={inputCls} type={type} value={value || ''} onChange={e => onChange(e.target.value)} />
      )}
    </div>
  );
}

export default function DossierPersonalienTab({ dossier }) {
  const customerId = dossier?.customer_id;
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const qc = useQueryClient();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['dossier_customer_ro', customerId],
    queryFn: () => base44.entities.Customer.filter({ id: customerId }).then(r => r[0]),
    enabled: !!customerId,
  });

  // Sync edit form when customer loads or edit mode activates
  useEffect(() => {
    if (customer && editing) {
      const snapshot = {};
      EDITABLE_FIELDS.forEach(f => { snapshot[f] = customer[f] ?? ''; });
      setEditForm(snapshot);
    }
  }, [customer, editing]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.update(customerId, data),
    onSuccess: () => {
      // Invalidate überall — CRM-Module + Dossier sehen sofort frische Daten
      qc.invalidateQueries({ queryKey: ['dossier_customer_ro', customerId] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer', customerId] });
      qc.invalidateQueries({ queryKey: ['customers_search_dossier'] });
      setEditing(false);
      toast.success('Kundendaten aktualisiert');
    },
  });

  const handleSave = () => {
    // Nur geänderte, dossier-relevante Felder übermitteln
    const patch = {};
    EDITABLE_FIELDS.forEach(f => {
      const val = editForm[f];
      if (val !== (customer[f] ?? '')) patch[f] = val === '' ? null : val;
    });
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    updateMutation.mutate(patch);
  };

  const handleCancel = () => setEditing(false);

  if (!customerId) {
    return (
      <div className="flex items-center justify-center py-16 text-center">
        <div>
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Bitte zuerst einen Kunden im Stammdaten-Tab auswählen.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
      </div>
    );
  }

  if (!customer) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Kunde nicht gefunden.</p>;
  }

  const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  const address = [customer.street, `${customer.zip_code || ''} ${customer.city || ''}`.trim(), customer.canton]
    .filter(Boolean).join(', ');
  const age = customer.birthdate
    ? Math.floor((Date.now() - new Date(customer.birthdate)) / 31557600000)
    : null;

  const set = (field) => (val) => setEditForm(f => ({ ...f, [field]: val }));

  if (editing) {
    return (
      <div className="space-y-4">
        {/* Edit-Modus Banner */}
        <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-primary font-medium">
            <Edit3 className="w-3.5 h-3.5" />
            Bearbeitungsmodus — Änderungen werden direkt im CRM gespeichert
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
              onClick={handleCancel}
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
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">Persönliche Daten</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Vorname" value={editForm.first_name} onChange={set('first_name')} />
              <EditField label="Nachname" value={editForm.last_name} onChange={set('last_name')} />
            </div>
            <EditField label="Geburtsdatum" type="date" value={editForm.birthdate} onChange={set('birthdate')} />
            <EditField label="Zivilstand" value={editForm.civil_status} onChange={set('civil_status')} options={CIVIL_STATUS_OPTIONS} />
            <EditField label="Nationalität" value={editForm.nationality} onChange={set('nationality')} />
            <EditField label="AHV-Nummer" value={editForm.ahv_number} onChange={set('ahv_number')} />
            <EditField label="Beruf" value={editForm.profession} onChange={set('profession')} />
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">Kontakt & Adresse</h3>
            </div>
            <EditField label="E-Mail" type="email" value={editForm.email} onChange={set('email')} />
            <EditField label="Telefon" value={editForm.phone} onChange={set('phone')} />
            <EditField label="Mobile" value={editForm.mobile} onChange={set('mobile')} />
            <EditField label="Strasse" value={editForm.street} onChange={set('street')} />
            <div className="grid grid-cols-2 gap-3">
              <EditField label="PLZ" value={editForm.zip_code} onChange={set('zip_code')} />
              <EditField label="Ort" value={editForm.city} onChange={set('city')} />
            </div>
            <EditField label="Kanton" value={editForm.canton} onChange={set('canton')} />
          </div>
        </div>
      </div>
    );
  }

  // ── Read-only Ansicht ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header mit Edit-Button */}
      <div className="flex items-center justify-between gap-3 text-xs bg-muted/50 border border-border/60 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          Customer-Entity als Source of Truth — Änderungen synchronisieren ins gesamte CRM.
        </div>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-primary text-xs font-medium hover:underline shrink-0"
        >
          <Edit3 className="w-3 h-3" />
          Bearbeiten
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Persönliche Daten" icon={User}>
          <InfoRow label="Name" value={fullName} />
          <InfoRow label="Geburtsdatum" value={customer.birthdate
            ? `${new Date(customer.birthdate).toLocaleDateString('de-CH')}${age ? ` (${age} Jahre)` : ''}`
            : null} />
          <InfoRow label="Zivilstand" value={CIVIL_STATUS_LABELS[customer.civil_status]} />
          <InfoRow label="Nationalität" value={customer.nationality} />
          <InfoRow label="Bewilligung" value={PERMIT_LABELS[customer.permit_type]} />
          <InfoRow label="AHV-Nummer" value={customer.ahv_number} />
          <InfoRow label="Beruf" value={customer.profession} />
        </SectionCard>

        <SectionCard title="Kontakt & Adresse" icon={MapPin}>
          <InfoRow label="E-Mail" value={customer.email} />
          <InfoRow label="Telefon" value={customer.phone} />
          <InfoRow label="Mobile" value={customer.mobile} />
          <InfoRow label="Adresse" value={address} />
        </SectionCard>

        {(customer.bank_account || customer.risk_profile) && (
          <SectionCard title="Finanzielle Angaben" icon={CreditCard}>
            <InfoRow label="Bankverbindung" value={customer.bank_account} />
            <InfoRow label="Risikoprofil" value={
              customer.risk_profile === 'low' ? 'Konservativ' :
              customer.risk_profile === 'medium' ? 'Ausgeglichen' :
              customer.risk_profile === 'high' ? 'Wachstumsorientiert' : null
            } />
          </SectionCard>
        )}

        {customer.association_membership && customer.association_membership !== 'none' && (
          <SectionCard title="Verbandsmitgliedschaft" icon={Calendar}>
            <InfoRow label="Verband" value={customer.association_membership?.toUpperCase()} />
          </SectionCard>
        )}
      </div>
    </div>
  );
}