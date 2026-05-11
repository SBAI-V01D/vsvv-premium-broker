import React, { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DialogFooter } from '@/components/ui/dialog'
import { lookupPostalCode, isValidPostalCode, fixOcrPostalCode } from '@/lib/swissPostalCodes'
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
  { code: 'CH', label: 'Schweiz' },
  { code: 'DE', label: 'Deutschland' },
  { code: 'FR', label: 'Frankreich' },
  { code: 'IT', label: 'Italien' },
  { code: 'AT', label: 'Österreich' },
  { code: 'BE', label: 'Belgien' },
  { code: 'LU', label: 'Luxemburg' },
  { code: 'NL', label: 'Niederlande' },
  { code: 'PL', label: 'Polen' },
  { code: 'ES', label: 'Spanien' },
  { code: 'PT', label: 'Portugal' },
  { code: 'GR', label: 'Griechenland' },
  { code: 'SE', label: 'Schweden' },
  { code: 'NO', label: 'Norwegen' },
  { code: 'DK', label: 'Dänemark' },
  { code: 'FI', label: 'Finnland' },
  { code: 'CZ', label: 'Tschechien' },
  { code: 'SK', label: 'Slowakei' },
  { code: 'HU', label: 'Ungarn' },
  { code: 'RO', label: 'Rumänien' },
  { code: 'BG', label: 'Bulgarien' },
  { code: 'HR', label: 'Kroatien' },
  { code: 'SI', label: 'Slowenien' },
  { code: 'LT', label: 'Litauen' },
  { code: 'LV', label: 'Lettland' },
  { code: 'EE', label: 'Estland' },
  { code: 'GB', label: 'Vereinigtes Königreich' },
  { code: 'IE', label: 'Irland' },
  { code: 'US', label: 'USA' },
  { code: 'CA', label: 'Kanada' },
  { code: 'AU', label: 'Australien' },
  { code: 'NZ', label: 'Neuseeland' },
  { code: 'CN', label: 'China' },
  { code: 'IN', label: 'Indien' },
  { code: 'JP', label: 'Japan' },
  { code: 'KR', label: 'Südkorea' },
  { code: 'SG', label: 'Singapur' },
  { code: 'MY', label: 'Malaysia' },
  { code: 'TH', label: 'Thailand' },
  { code: 'VN', label: 'Vietnam' },
  { code: 'ID', label: 'Indonesien' },
  { code: 'PH', label: 'Philippinen' },
  { code: 'BR', label: 'Brasilien' },
  { code: 'MX', label: 'Mexiko' },
  { code: 'ZA', label: 'Südafrika' },
  { code: 'AE', label: 'Vereinigte Arabische Emirate' },
  { code: 'TR', label: 'Türkei' },
  { code: 'RU', label: 'Russland' },
  { code: 'RS', label: 'Serbien' },
  { code: 'BA', label: 'Bosnien und Herzegowina' },
  { code: 'MK', label: 'Nordmazedonien' },
  { code: 'AL', label: 'Albanien' },
  { code: 'XK', label: 'Kosovo' },
  { code: 'ME', label: 'Montenegro' },
  { code: 'UA', label: 'Ukraine' },
  { code: 'MD', label: 'Moldau' },
  { code: 'MA', label: 'Marokko' },
  { code: 'TN', label: 'Tunesien' },
  { code: 'DZ', label: 'Algerien' },
  { code: 'EG', label: 'Ägypten' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'ET', label: 'Äthiopien' },
  { code: 'GH', label: 'Ghana' },
  { code: 'KE', label: 'Kenia' },
  { code: 'LK', label: 'Sri Lanka' },
  { code: 'PK', label: 'Pakistan' },
  { code: 'BD', label: 'Bangladesch' },
  { code: 'NP', label: 'Nepal' },
  { code: 'AF', label: 'Afghanistan' },
  { code: 'IR', label: 'Iran' },
  { code: 'IQ', label: 'Irak' },
  { code: 'SY', label: 'Syrien' },
  { code: 'LB', label: 'Libanon' },
  { code: 'IL', label: 'Israel' },
  { code: 'SA', label: 'Saudi-Arabien' },
  { code: 'AR', label: 'Argentinien' },
  { code: 'CO', label: 'Kolumbien' },
  { code: 'PE', label: 'Peru' },
  { code: 'VE', label: 'Venezuela' },
  { code: 'CL', label: 'Chile' },
  { code: 'EC', label: 'Ecuador' },
  { code: 'BO', label: 'Bolivien' },
  { code: 'DO', label: 'Dominikanische Republik' },
  { code: 'CU', label: 'Kuba' },
  { code: 'OTHER', label: 'Sonstiges' },
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
             bank_account: '',
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
      // Normalize all fields: replace null/undefined with '' or defaults
      const n = (v) => v == null ? '' : v
      return {
         ...customer,
         first_name: n(customer.first_name),
         last_name: n(customer.last_name),
         email: n(customer.email),
         phone: n(customer.phone),
         mobile: n(customer.mobile),
         street: n(customer.street),
         zip_code: n(customer.zip_code),
         city: n(customer.city),
         canton: n(customer.canton),
         birthdate: n(customer.birthdate),
         ahv_number: n(customer.ahv_number),
         profession: n(customer.profession),
         drivers_license_date: n(customer.drivers_license_date),
         bank_account: n(customer.bank_account),
         notes: n(customer.notes),
         assigned_broker: n(customer.assigned_broker),
         organization_id: n(customer.organization_id),
         advisor_id: n(customer.advisor_id),
         primary_customer_id: n(customer.primary_customer_id),
         // Select fields with fallback defaults
         civil_status: customer.civil_status || 'single',
         nationality: customer.nationality || 'CH',
         risk_profile: customer.risk_profile || 'medium',
         status: customer.status || 'active',
         mandate_status: customer.mandate_status || 'pending',
         association_membership: customer.association_membership || 'none',
         permit_type: customer.permit_type || 'none',
         family_role: customer.family_role || 'primary',
         is_family_member: customer.is_family_member || false,
      }
   })

   // Re-initialize form when customer prop changes (e.g. dialog reopened with different customer)
   useEffect(() => {
      if (!customer) return
      const n = (v) => v == null ? '' : v
      setForm({
         ...customer,
         first_name: n(customer.first_name),
         last_name: n(customer.last_name),
         email: n(customer.email),
         phone: n(customer.phone),
         mobile: n(customer.mobile),
         street: n(customer.street),
         zip_code: n(customer.zip_code),
         city: n(customer.city),
         canton: n(customer.canton),
         birthdate: n(customer.birthdate),
         ahv_number: n(customer.ahv_number),
         profession: n(customer.profession),
         drivers_license_date: n(customer.drivers_license_date),
         bank_account: n(customer.bank_account),
         notes: n(customer.notes),
         assigned_broker: n(customer.assigned_broker),
         organization_id: n(customer.organization_id),
         advisor_id: n(customer.advisor_id),
         primary_customer_id: n(customer.primary_customer_id),
         civil_status: customer.civil_status || 'single',
         nationality: customer.nationality || 'CH',
         risk_profile: customer.risk_profile || 'medium',
         status: customer.status || 'active',
         mandate_status: customer.mandate_status || 'pending',
         association_membership: customer.association_membership || 'none',
         permit_type: customer.permit_type || 'none',
         family_role: customer.family_role || 'primary',
         is_family_member: customer.is_family_member || false,
      })
   }, [customer?.id])

   const [autoFilled, setAutoFilled] = useState(false)
   const [plzError, setPlzError] = useState('')
   const [plzSuggestions, setPlzSuggestions] = useState(null)

   // Direct PLZ lookup — no hook indirection
   const doPlzLookup = useCallback((rawPlz, keepExisting = false) => {
     if (!rawPlz) return
     const plz = fixOcrPostalCode(rawPlz)
     if (plz.length !== 4) return
     if (!isValidPostalCode(plz)) { setPlzError('Ungültige PLZ'); return }
     setPlzError('')
     setPlzSuggestions(null)
     const result = lookupPostalCode(plz)
     if (!result) {
       // PLZ not in DB — allow manual entry, no error
       return
     }
     if (!Array.isArray(result)) {
       // Single match — auto-fill
       setForm(prev => ({
         ...prev,
         city: keepExisting && prev.city ? prev.city : result.ort,
         canton: keepExisting && prev.canton ? prev.canton : result.kanton,
       }))
       setAutoFilled(true)
     } else {
       // Multiple — take first match or show picker
       if (result.length === 1) {
         setForm(prev => ({
           ...prev,
           city: keepExisting && prev.city ? prev.city : result[0].ort,
           canton: keepExisting && prev.canton ? prev.canton : result[0].kanton,
         }))
         setAutoFilled(true)
       } else {
         setPlzSuggestions(result)
       }
     }
   }, [])

   // Auto-lookup on load if city/canton missing
   useEffect(() => {
     if (form.zip_code && (!form.city || !form.canton)) {
       doPlzLookup(form.zip_code, true)
     }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [customer?.id])

   const { data: advisors = [] } = useQuery({
     queryKey: ['advisors'],
     queryFn: () => base44.entities.Advisor.filter({ status: 'active' }),
   })

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handlePlzChange = (plz) => {
    setForm(prev => ({ ...prev, zip_code: plz }))
    setAutoFilled(false)
    setPlzSuggestions(null)
    if (plz.length === 4) doPlzLookup(plz, false)
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
          setForm(prev => ({ ...prev, city: suggestion.ort, canton: suggestion.kanton }))
          setAutoFilled(true)
          setPlzSuggestions(null)
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

      <div>
        <Label>Bank- oder Postkontoverbindung</Label>
        <Input value={form.bank_account} onChange={e => set('bank_account', e.target.value)} placeholder="IBAN oder Kontonummer" className="mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Nationalität</Label>
          <Select value={form.nationality} onValueChange={v => set('nationality', v)}>
            <SelectTrigger className="mt-1">
              <SelectValue>{COUNTRIES.find(c => c.code === form.nationality)?.label || form.nationality}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label} ({c.code})</SelectItem>)}
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