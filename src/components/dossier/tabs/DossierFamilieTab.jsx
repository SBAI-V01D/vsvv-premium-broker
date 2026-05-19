/**
 * DossierFamilieTab — Phase 2
 * Zeigt Familienmitglieder des Kunden read-only.
 * Kein Write auf Customer-Entity.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Shield, User } from 'lucide-react';

const FAMILY_ROLE = {
  primary: 'Hauptperson', spouse: 'Ehepartner/in', child: 'Kind',
  parent: 'Elternteil', other: 'Andere',
};

const CIVIL_STATUS = {
  single: 'Ledig', married: 'Verheiratet', divorced: 'Geschieden',
  widowed: 'Verwitwet', registered_partnership: 'Eingetragene Partnerschaft',
  dissolved_partnership: 'Aufgelöste Partnerschaft',
};

function MemberCard({ member, isPrimary }) {
  const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim();
  const age = member.birthdate
    ? Math.floor((Date.now() - new Date(member.birthdate)) / 31557600000)
    : null;

  return (
    <div className={`border rounded-xl p-5 ${isPrimary ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0
          ${isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
          {fullName[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{fullName}</p>
            {isPrimary && (
              <span className="text-[10px] font-medium bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                Hauptperson
              </span>
            )}
            {!isPrimary && member.family_role && (
              <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                {FAMILY_ROLE[member.family_role] || member.family_role}
              </span>
            )}
          </div>
          {age !== null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(member.birthdate).toLocaleDateString('de-CH')} · {age} Jahre
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {member.civil_status && (
          <div>
            <span className="text-muted-foreground">Zivilstand: </span>
            <span className="font-medium">{CIVIL_STATUS[member.civil_status] || member.civil_status}</span>
          </div>
        )}
        {member.nationality && (
          <div>
            <span className="text-muted-foreground">Nationalität: </span>
            <span className="font-medium">{member.nationality}</span>
          </div>
        )}
        {member.ahv_number && (
          <div className="col-span-2">
            <span className="text-muted-foreground">AHV: </span>
            <span className="font-medium font-mono">{member.ahv_number}</span>
          </div>
        )}
        {member.email && (
          <div className="col-span-2">
            <span className="text-muted-foreground">E-Mail: </span>
            <span className="font-medium">{member.email}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DossierFamilieTab({ dossier }) {
  const customerId = dossier?.customer_id;

  const { data: mainCustomer } = useQuery({
    queryKey: ['dossier_customer_ro', customerId],
    queryFn: () => base44.entities.Customer.filter({ id: customerId }).then(r => r[0]),
    enabled: !!customerId,
  });

  const { data: familyMembers = [], isLoading } = useQuery({
    queryKey: ['dossier_family_ro', customerId],
    queryFn: () => base44.entities.Customer.filter({ primary_customer_id: customerId }),
    enabled: !!customerId,
  });

  if (!customerId) {
    return (
      <div className="flex items-center justify-center py-16 text-center">
        <div>
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Users className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Bitte zuerst einen Kunden im Stammdaten-Tab auswählen.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map(i => <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border border-border/60 rounded-lg px-3 py-2">
        <Shield className="w-3.5 h-3.5 shrink-0" />
        Familiendaten werden ausschliesslich lesend aus dem CRM angezeigt.
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Haushalt</h3>
        <span className="text-xs text-muted-foreground">
          {1 + familyMembers.length} {1 + familyMembers.length === 1 ? 'Person' : 'Personen'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mainCustomer && <MemberCard member={mainCustomer} isPrimary={true} />}
        {familyMembers.map(m => <MemberCard key={m.id} member={m} isPrimary={false} />)}
      </div>

      {familyMembers.length === 0 && (
        <div className="border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
          <User className="w-6 h-6 mx-auto mb-2 text-muted-foreground/60" />
          Keine Familienmitglieder im CRM erfasst.
        </div>
      )}
    </div>
  );
}