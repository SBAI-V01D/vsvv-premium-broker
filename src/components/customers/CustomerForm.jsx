import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DialogFooter } from '@/components/ui/dialog'
import { usePostalCodeLookup } from '@/hooks/usePostalCodeLookup'
import PostalCodeInput from '@/components/common/PostalCodeInput'

const CANTONS = ["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"]
const FAMILY_ROLES = {
  primary: 'Hauptkunde',
  spouse: 'Ehepartner/in',
  child: 'Kind',
  parent: 'Eltern',
  other: 'Sonstiges',
}
const MANDATE_STATUSES = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  pending: 'Ausstehend',
  terminated: 'Beendet',
}
const ASSOCIATIONS = {
  vsvv: 'VSVV',
  skv: 'SKV',
  reka: 'REKA',
  vfs: 'VFS',
  pro_life: 'Pro Life',
  none: 'Keine',
}
const CIVIL_STATUSES = {
  single: 'Ledig',
  married: 'Verheiratet',
  divorced: 'Geschieden',
  widowed: 'Verwitwet',
  registered_partnership: 'Eingetragene Partnerschaft',
  dissolved_partnership: 'Aufgelöste Partnerschaft',
}
const PERMITS = {
  b_permit: 'Aufenthaltsbewilligung (Kategorie B)',
  l_permit: 'Kurzaufenthaltserlaubnis (Kategorie L)',
  c_permit: 'Niederlassungsbewilligung (Kategorie C)',
  ec_permit: 'Aufenthaltserlaubnis EU/EFTA',
  ci_permit: 'Aufenthaltserlaubnis Grenzgänger',
  g_permit: 'Aufenthaltserlaubnis Besucher',
  none: 'Keine',
}
const COUNTRIES = [
  'CH', 'DE', 'FR', 'IT', 'AT', 'BE', 'LU', 'NL', 'PL', 'ES', 'PT', 'GR', 'SE', 'NO', 'DK', 'FI',
  'CZ', 'SK', 'HU', 'RO', 'BG', 'HR', 'SI', 'LT', 'LV', 'EE', 'GB', 'IE', 'US', 'CA', 'AU', 'NZ',
  'CN', 'IN', 'JP', 'KR', 'SG', 'MY', 'TH', 'VN', 'ID', 'PH', 'BR', 'MX', 'ZA', 'AE', 'TR', 'RU',
]

export default function CustomerForm({ customer, primaryCustomers = [], onSave, onCancel, saving }) {
   const [form, setForm] = useState(() => {
      if (!customer) {
         return {
            first_name: '',
            last_name: '',
            email: '',
            phone: '',
            mobile: '',
            street: '',
            zip_code: '',
            city: '',
            canton: '',
            birthdate: '',
            ahv_number: '',
            profession: '',
            civil_status: 'single',
            nationality: 'CH',
            drivers_license_date: '',
            risk_profile: 'medium',
            customer_type: 'private',
            status: 'active',
            mandate_status: 'active',
            association_membership: 'none',
            permit_type: 'none',
            is_family_member: false,
            primary_customer_id: '',
            family_role: 'primary',
            notes: '',
            assigned_broker: '',
            organization_id: '',
            advisor_id: '',
         }
      }
      // Normalize all string fields: replace null/undefined with ''
      const normalize = (v) => v == null ? '' : v
      return {
         ...customer,
         first_name: normalize(customer.first_name),
         last_name: normalize(customer.last_name),
         email: normalize(customer.email),
         phone: normalize(customer.phone),
         mobile: normalize(customer.mobile),
         street: normalize(customer.street),
         zip_code: normalize(customer.zip_code),
         city: normalize(customer.city),
         canton: normalize(customer.canton),
         birthdate: normalize(customer.birthdate),
         ahv_number: normalize(customer.ahv_number),
         profession: normalize(customer.profession),
         drivers_license_date: normalize(customer.drivers_license_date),
         notes: normalize(customer.notes),
         assigned_broker: normalize(customer.assigned_broker),
         organization_id: normalize(customer.organization_id),
         advisor_id: normalize(customer.advisor_id),
         primary_customer_id: normalize(customer.primary_customer_id),
      }
   })

   const [autoFilled, setAutoFilled] = useState(false)
   const { plzError, plzSuggestions, handlePostalCodeChange, selectSuggestion } = usePostalCodeLookup()

   const { data: advisors = [] } = useQuery({
     queryKey: ['advisors'],
     queryFn: () => base44.entities.Advisor.filter({ status: 'active' }),
   })

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handlePlzChange = (plz) => {
    set('zip_code', plz)
    handlePostalCodeChange(plz, ({ city, canton, autoFilled: auto }) => {
      set('city', city)
      set('canton', canton)
      setAutoFilled(auto || false)
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Family Member Selection */}
      <div>
        <Label>Kundentyp</Label>
        <Select
          value={form.is_family_member ? 'member' : 'primary'}
          onValueChange={(v) => {
            set('is_family_member', v === 'member')
            if (v === 'primary') {
              set('primary_customer_id', '')
              set('family_role', 'primary')
            }
          }}
        >
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Hauptkunde</SelectItem>
            <SelectItem value="member">Familienmitglied</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.is_family_member && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Hauptkunde *</Label>
            <Select value={form.primary_customer_id} onValueChange={v => set('primary_customer_id', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {primaryCustomers.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Rolle in Familie</Label>
            <Select value={form.family_role} onValueChange={v => set('family_role', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FAMILY_ROLES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Vorname *</Label>
          <Input value={form.first_name} onChange={e => set('first_name', e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label>Nachname *</Label>
          <Input value={form.last_name} onChange={e => set('last_name', e.target.value)} required className="mt-1" />
        </div>
      </div>

      <div>
        <Label>E-Mail *</Label>
        <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} required className="mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Telefon</Label>
          <Input value={form.phone} onChange={e => set('phone', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Mobilnummer</Label>
          <Input value={form.mobile} onChange={e => set('mobile', e.target.value)} className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-3">
        <div>
          <Label>Straße</Label>
          <Input value={form.street} onChange={e => set('street', e.target.value)} className="mt-1" />
        </div>
      </div>

      <PostalCodeInput
        plz={form.zip_code}
        city={form.city}
        canton={form.canton}
        cantons={CANTONS}
        plzError={plzError}
        plzSuggestions={plzSuggestions}
        autoFilled={autoFilled}
        onPlzChange={handlePlzChange}
        onCityChange={(city) => { set('city', city); setAutoFilled(false) }}
        onCantonChange={(canton) => set('canton', canton)}
        onSelectSuggestion={(suggestion) => {
          selectSuggestion(suggestion, ({ city, canton, autoFilled: auto }) => {
            set('city', city)
            set('canton', canton)
            setAutoFilled(auto)
          })
        }}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Geburtsdatum</Label>
          <Input type="date" value={form.birthdate} onChange={e => set('birthdate', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>AHV-Nummer</Label>
          <Input value={form.ahv_number} onChange={e => set('ahv_number', e.target.value)} placeholder="756.1234.5678.90" className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Nationalität</Label>
          <Select value={form.nationality} onValueChange={v => set('nationality', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Führerausweis Datum</Label>
          <Input type="date" value={form.drivers_license_date} onChange={e => set('drivers_license_date', e.target.value)} className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Beruf</Label>
          <Input value={form.profession} onChange={e => set('profession', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Zivilstand</Label>
          <Select value={form.civil_status} onValueChange={v => set('civil_status', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Ledig</SelectItem>
              <SelectItem value="married">Verheiratet</SelectItem>
              <SelectItem value="divorced">Geschieden</SelectItem>
              <SelectItem value="widowed">Verwitwet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Risikoprofil</Label>
          <Select value={form.risk_profile} onValueChange={v => set('risk_profile', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Niedrig</SelectItem>
              <SelectItem value="medium">Mittel</SelectItem>
              <SelectItem value="high">Hoch</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="inactive">Inaktiv</SelectItem>
              <SelectItem value="prospect">Interessent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Beratender Berater</Label>
        <Select value={form.advisor_id || ''} onValueChange={v => set('advisor_id', v === '' ? '' : v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Berater auswählen..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>– Kein Berater –</SelectItem>
            {advisors.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">Keine Berater vorhanden</div>
            ) : (
              advisors.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.firstname} {a.lastname}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Status Mandat</Label>
          <Select value={form.mandate_status} onValueChange={v => set('mandate_status', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(MANDATE_STATUSES).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Verbandzugehörigkeit</Label>
          <Select value={form.association_membership} onValueChange={v => set('association_membership', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ASSOCIATIONS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label>Bewilligung</Label>
          <Select value={form.permit_type} onValueChange={v => set('permit_type', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PERMITS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Notizen</Label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" rows={3} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Speichern...' : (customer ? 'Aktualisieren' : 'Erstellen')}
        </Button>
      </DialogFooter>
    </form>
  )
}