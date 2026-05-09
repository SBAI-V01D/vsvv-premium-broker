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

const LEGAL_FORMS = ['AG', 'GmbH', 'Einzelfirma', 'Kollektivgesellschaft', 'Kommanditgesellschaft', 'Genossenschaft', 'Verein', 'Stiftung', 'Öffentlich-rechtliche Körperschaft', 'Sonstiges']
const INDUSTRIES = ['Landwirtschaft', 'Bau & Handwerk', 'Detailhandel', 'Gastronomie & Hotellerie', 'Gesundheit & Soziales', 'IT & Technologie', 'Transport & Logistik', 'Finanz & Versicherung', 'Immobilien', 'Bildung', 'Industrie & Produktion', 'Dienstleistungen', 'Sonstiges']
const CANTONS = ["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"]
const COUNTRIES = [
  { code: 'CH', label: 'Schweiz' },
  { code: 'DE', label: 'Deutschland' },
  { code: 'AT', label: 'Österreich' },
  { code: 'FR', label: 'Frankreich' },
  { code: 'IT', label: 'Italien' },
  { code: 'LI', label: 'Liechtenstein' },
  { code: 'LU', label: 'Luxemburg' },
  { code: 'BE', label: 'Belgien' },
  { code: 'NL', label: 'Niederlande' },
  { code: 'GB', label: 'Vereinigtes Königreich' },
  { code: 'US', label: 'USA' },
  { code: 'OTHER', label: 'Sonstiges' },
]

export default function CompanyForm({ customer, onSave, onCancel, saving }) {
  const n = (v) => v == null ? '' : v

  const [form, setForm] = useState(() => {
    if (customer?.customer_type === 'business') {
      return {
        ...customer,
        company_name: n(customer.company_name),
        legal_form: n(customer.legal_form),
        uid_number: n(customer.uid_number),
        industry: n(customer.industry),
        contact_person_firstname: n(customer.contact_person_firstname),
        contact_person_lastname: n(customer.contact_person_lastname),
        first_name: n(customer.first_name),
        last_name: n(customer.last_name),
        email: n(customer.email),
        phone: n(customer.phone),
        mobile: n(customer.mobile),
        street: n(customer.street),
        zip_code: n(customer.zip_code),
        city: n(customer.city),
        canton: n(customer.canton),
        nationality: n(customer.nationality) || 'CH',
        notes: n(customer.notes),
        assigned_broker: n(customer.assigned_broker),
        advisor_id: n(customer.advisor_id),
        organization_id: n(customer.organization_id),
        status: customer.status || 'active',
        mandate_status: customer.mandate_status || 'pending',
        is_family_member: false,
        customer_type: 'business',
      }
    }
    return {
      customer_type: 'business',
      company_name: '',
      legal_form: '',
      uid_number: '',
      industry: '',
      contact_person_firstname: '',
      contact_person_lastname: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      mobile: '',
      street: '',
      zip_code: '',
      city: '',
      canton: '',
      nationality: 'CH',
      notes: '',
      assigned_broker: '',
      advisor_id: '',
      organization_id: '',
      status: 'active',
      mandate_status: 'pending',
      is_family_member: false,
    }
  })

  const [advisorSearch, setAdvisorSearch] = useState('')
  const [autoFilled, setAutoFilled] = useState(false)
  const { plzError, plzSuggestions, handlePostalCodeChange, selectSuggestion } = usePostalCodeLookup()

  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.filter({ status: 'active' }),
  })

  const filteredAdvisors = advisors.filter(a => {
    const search = advisorSearch.toLowerCase()
    return (
      `${a.firstname} ${a.lastname}`.toLowerCase().includes(search) ||
      (a.email && a.email.toLowerCase().includes(search))
    )
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
    onSave({
      ...form,
      first_name: form.contact_person_firstname,
      last_name: form.contact_person_lastname,
      customer_type: 'business',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Unternehmensdaten */}
      <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-2 text-sm font-semibold text-purple-700 mb-1">
        Unternehmensdaten
      </div>

      <div>
        <Label>Unternehmensname *</Label>
        <Input value={form.company_name} onChange={e => set('company_name', e.target.value)} required className="mt-1" placeholder="Muster AG" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Rechtsform</Label>
          <Select value={form.legal_form} onValueChange={v => set('legal_form', v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Wählen..." /></SelectTrigger>
            <SelectContent>
              {LEGAL_FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>UID-Nummer (CHE)</Label>
          <Input value={form.uid_number} onChange={e => set('uid_number', e.target.value)} className="mt-1" placeholder="CHE-123.456.789" />
        </div>
      </div>

      <div>
        <Label>Branche</Label>
        <Select value={form.industry} onValueChange={v => set('industry', v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Branche wählen..." /></SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Kontaktperson */}
      <div className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 mt-2 mb-1">
        Kontaktperson
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Vorname Kontaktperson</Label>
          <Input value={form.contact_person_firstname} onChange={e => set('contact_person_firstname', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Nachname Kontaktperson</Label>
          <Input value={form.contact_person_lastname} onChange={e => set('contact_person_lastname', e.target.value)} className="mt-1" />
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

      {/* Adresse */}
      <div className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 mt-2 mb-1">
        Adresse
      </div>

      <div>
        <Label>Strasse</Label>
        <Input value={form.street} onChange={e => set('street', e.target.value)} className="mt-1" />
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

      <div>
        <Label>Land</Label>
        <Select value={form.nationality || 'CH'} onValueChange={v => set('nationality', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label} ({c.code})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Verwaltung */}
      <div className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 mt-2 mb-1">
        Verwaltung
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        <div>
          <Label>Status Mandat</Label>
          <Select value={form.mandate_status} onValueChange={v => set('mandate_status', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="inactive">Inaktiv</SelectItem>
              <SelectItem value="pending">Ausstehend</SelectItem>
              <SelectItem value="terminated">Beendet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Beratender Berater</Label>
        <div className="mt-1 space-y-2">
          <Input
            placeholder="Berater durchsuchen..."
            value={advisorSearch}
            onChange={e => setAdvisorSearch(e.target.value)}
          />
          <Select
            value={form.advisor_id || ''}
            onValueChange={v => {
              set('advisor_id', v)
              const found = advisors.find(a => a.id === v)
              if (found) set('assigned_broker', `${found.firstname} ${found.lastname}`)
              setAdvisorSearch('')
            }}
          >
            <SelectTrigger><SelectValue placeholder="Berater auswählen..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>– Kein Berater –</SelectItem>
              {filteredAdvisors.length === 0 && advisorSearch ? (
                <div className="p-2 text-sm text-muted-foreground">Kein Berater gefunden</div>
              ) : (
                filteredAdvisors.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.firstname} {a.lastname} ({a.email})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {form.advisor_id && (() => {
            const found = advisors.find(a => a.id === form.advisor_id)
            return found ? (
              <p className="text-xs text-green-600">✓ {found.firstname} {found.lastname} ausgewählt</p>
            ) : null
          })()}
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
          {saving ? 'Speichern...' : (customer?.id ? 'Aktualisieren' : 'Erstellen')}
        </Button>
      </DialogFooter>
    </form>
  )
}