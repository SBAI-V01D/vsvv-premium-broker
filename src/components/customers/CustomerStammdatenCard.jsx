import React from 'react'
import {
  User, Phone, Smartphone, Mail, MapPin, CreditCard, Calendar, Shield,
  Briefcase, Heart, Globe, FileText, Building2, Flag, Hash
} from 'lucide-react'
import EmailLink from '@/components/common/EmailLink'
import { cn } from '@/lib/utils'

const CIVIL_STATUS_LABELS = {
  single: 'Ledig',
  married: 'Verheiratet',
  divorced: 'Geschieden',
  widowed: 'Verwitwet',
  registered_partnership: 'Eingetragene Partnerschaft',
  dissolved_partnership: 'Aufgelöste Partnerschaft',
}

const PERMIT_LABELS = {
  b_permit: 'Aufenthaltsbewilligung B',
  l_permit: 'Kurzaufenthalt L',
  c_permit: 'Niederlassungsbewilligung C',
  ec_permit: 'Aufenthalt EU/EFTA',
  ci_permit: 'Grenzgänger CI',
  g_permit: 'Besucher G',
  none: null,
}

const ASSOCIATION_LABELS = {
  vsvv: 'VSVV',
  skv: 'SKV',
  reka: 'REKA',
  vfs: 'VFS',
  pro_life: 'Pro Life',
  none: null,
}

const MANDATE_CONFIG = {
  valid:   { label: 'Gültig',      cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  pending: { label: 'Ausstehend',  cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  expired: { label: 'Abgelaufen', cls: 'text-rose-700 bg-rose-50 border-rose-200' },
  invalid: { label: 'Ungültig',   cls: 'text-rose-700 bg-rose-50 border-rose-200' },
}

function Row({ icon: Icon, label, value, mono, children }) {
  if (!value && !children) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[hsl(var(--border-subtle))] last:border-0">
      <div className="w-5 h-5 mt-0.5 flex items-center justify-center text-slate-400 shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
        {children || (
          <p className={cn('text-sm text-slate-800 break-words', mono && 'font-mono text-xs')}>{value}</p>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-[hsl(var(--border-subtle))] overflow-hidden">
      <div className="px-4 py-2.5 bg-[hsl(var(--surface-2))] border-b border-[hsl(var(--border-subtle))]">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
      </div>
      <div className="px-4 divide-y-0">
        {children}
      </div>
    </div>
  )
}

export default function CustomerStammdatenCard({ customer }) {
  if (!customer) return null

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-CH') : null
  const mandate = MANDATE_CONFIG[customer.mandate_status]
  const permitLabel = PERMIT_LABELS[customer.permit_type]
  const assocLabel = ASSOCIATION_LABELS[customer.association_membership]

  const fullAddress = [customer.street, [customer.zip_code, customer.city].filter(Boolean).join(' '), customer.canton]
    .filter(Boolean).join(', ')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

      {/* Persönliche Daten */}
      <Section title="Persönliche Daten">
        {customer.customer_number && (
          <Row icon={Hash} label="Kundennummer" value={customer.customer_number} mono />
        )}
        <Row icon={User} label="Name" value={`${customer.first_name || ''} ${customer.last_name || ''}`.trim()} />
        {customer.birthdate && (
          <Row icon={Calendar} label="Geburtsdatum" value={formatDate(customer.birthdate)} />
        )}
        {customer.ahv_number && (
          <Row icon={Hash} label="AHV-Nummer" value={customer.ahv_number} mono />
        )}
        {customer.civil_status && (
          <Row icon={Heart} label="Zivilstand" value={CIVIL_STATUS_LABELS[customer.civil_status] || customer.civil_status} />
        )}
        {customer.profession && (
          <Row icon={Briefcase} label="Beruf" value={customer.profession} />
        )}
        {customer.nationality && customer.nationality !== 'CH' && (
          <Row icon={Globe} label="Nationalität" value={customer.nationality} />
        )}
        {permitLabel && (
          <Row icon={Flag} label="Bewilligung" value={permitLabel} />
        )}
        {customer.drivers_license_date && (
          <Row icon={Calendar} label="Führerausweis seit" value={formatDate(customer.drivers_license_date)} />
        )}
        {assocLabel && (
          <Row icon={Building2} label="Verband" value={assocLabel} />
        )}
      </Section>

      {/* Kontakt & Finanzen */}
      <Section title="Kontakt & Finanzen">
        {customer.email && (
          <Row icon={Mail} label="E-Mail">
            <EmailLink email={customer.email} className="text-sm text-primary hover:underline" />
          </Row>
        )}
        {customer.phone && (
          <Row icon={Phone} label="Telefon" value={customer.phone} />
        )}
        {customer.mobile && (
          <Row icon={Smartphone} label="Mobilnummer" value={customer.mobile} />
        )}
        {fullAddress && (
          <Row icon={MapPin} label="Adresse" value={fullAddress} />
        )}
        {customer.bank_account && (
          <Row icon={CreditCard} label="Bank- / Postkonto" value={customer.bank_account} mono />
        )}
        {customer.mandate_status && mandate && (
          <Row icon={Shield} label="Mandatsstatus">
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border', mandate.cls)}>
              {mandate.label}
            </span>
          </Row>
        )}
        {customer.risk_profile && (
          <Row icon={Shield} label="Risikoprofil">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border',
              customer.risk_profile === 'low' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
              customer.risk_profile === 'high' ? 'text-rose-700 bg-rose-50 border-rose-200' :
              'text-slate-700 bg-slate-50 border-slate-200'
            )}>
              {customer.risk_profile === 'low' ? 'Niedrig' : customer.risk_profile === 'high' ? 'Hoch' : 'Mittel'}
            </span>
          </Row>
        )}
        {customer.notes && (
          <Row icon={FileText} label="Notizen" value={customer.notes} />
        )}
      </Section>

    </div>
  )
}