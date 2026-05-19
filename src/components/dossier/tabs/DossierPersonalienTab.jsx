/**
 * DossierPersonalienTab — Phase 2
 * Zeigt Kundenstammdaten read-only aus dem CRM.
 * Kein Write auf Customer-Entity.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { User, Phone, Mail, MapPin, Calendar, CreditCard, Shield } from 'lucide-react';

const CIVIL_STATUS = {
  single: 'Ledig', married: 'Verheiratet', divorced: 'Geschieden',
  widowed: 'Verwitwet', registered_partnership: 'Eingetragene Partnerschaft',
  dissolved_partnership: 'Aufgelöste Partnerschaft',
};

const PERMIT_LABELS = {
  b_permit: 'Ausweis B', l_permit: 'Ausweis L', c_permit: 'Ausweis C',
  ec_permit: 'Ausweis EC', ci_permit: 'Ausweis CI', g_permit: 'Ausweis G', none: '—',
};

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

export default function DossierPersonalienTab({ dossier }) {
  const customerId = dossier?.customer_id;

  const { data: customer, isLoading } = useQuery({
    queryKey: ['dossier_customer_ro', customerId],
    queryFn: () => base44.entities.Customer.filter({ id: customerId }).then(r => r[0]),
    enabled: !!customerId,
  });

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

  return (
    <div className="space-y-4">
      {/* Read-only notice */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border border-border/60 rounded-lg px-3 py-2">
        <Shield className="w-3.5 h-3.5 shrink-0" />
        Kundendaten werden ausschliesslich lesend aus dem CRM angezeigt — keine Änderungen möglich.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Persönliche Daten" icon={User}>
          <InfoRow label="Name" value={fullName} />
          <InfoRow label="Geburtsdatum" value={customer.birthdate
            ? `${new Date(customer.birthdate).toLocaleDateString('de-CH')}${age ? ` (${age} Jahre)` : ''}`
            : null} />
          <InfoRow label="Zivilstand" value={CIVIL_STATUS[customer.civil_status]} />
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