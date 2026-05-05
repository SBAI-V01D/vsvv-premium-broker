import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DialogFooter } from '@/components/ui/dialog'

const LEGAL_FORMS = ['AG', 'GmbH', 'Einzelfirma', 'Kollektivgesellschaft', 'Kommanditgesellschaft', 'Genossenschaft', 'Verein', 'Stiftung', 'Öffentlich-rechtliche Körperschaft', 'Sonstiges']
const INDUSTRIES = ['Landwirtschaft', 'Bau & Handwerk', 'Detailhandel', 'Gastronomie & Hotellerie', 'Gesundheit & Soziales', 'IT & Technologie', 'Transport & Logistik', 'Finanz & Versicherung', 'Immobilien', 'Bildung', 'Industrie & Produktion', 'Dienstleistungen', 'Sonstiges']
const COUNTRIES = ['CH', 'DE', 'AT', 'FR', 'IT', 'LI', 'LU', 'BE', 'NL', 'GB', 'US', 'Sonstiges']

export default function CompanyForm({ customer, primaryCustomers = [], onSave, onCancel, saving }) {
  const [form, setForm] = useState(customer?.customer_type === 'business' ? customer : {
    customer_type: 'business',
    company_name: '',
    legal_form: '',
    uid_number: '',
    industry: '',
    contact_person_firstname: '',
    contact_person_lastname: '',
    // Map to existing entity fields
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile: '',
    street: '',
    zip_code: '',
    city: '',
    canton: '',
    notes: '',
    assigned_broker: '',
    status: 'active',
    mandate_status: 'active',
    is_family_member: false,
  })

  const [brokerSearch, setBrokerSearch] = useState('')

  const { data: brokers = [] } = useQuery({
    queryKey: ['brokers'],
    queryFn: () => base44.entities.Broker.list(),
  })

  const filteredBrokers = brokers.filter(b =>
    b.name.toLowerCase().includes(brokerSearch.toLowerCase()) ||
    (b.email && b.email.toLowerCase().includes(brokerSearch.toLowerCase()))
  )

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    // Sync contact person to first_name/last_name so existing code still works
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
        <Input value={form.company_name || ''} onChange={e => set('company_name', e.target.value)} required className="mt-1" placeholder="Muster AG" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Rechtsform</Label>
          <Select value={form.legal_form || ''} onValueChange={v => set('legal_form', v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Wählen..." /></SelectTrigger>
            <SelectContent>
              {LEGAL_FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>UID-Nummer (CHE)</Label>
          <Input value={form.uid_number || ''} onChange={e => set('uid_number', e.target.value)} className="mt-1" placeholder="CHE-123.456.789" />
        </div>
      </div>

      <div>
        <Label>Branche</Label>
        <Select value={form.industry || ''} onValueChange={v => set('industry', v)}>
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
          <Label>Vorname Kontaktperson *</Label>
          <Input value={form.contact_person_firstname || ''} onChange={e => set('contact_person_firstname', e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label>Nachname Kontaktperson *</Label>
          <Input value={form.contact_person_lastname || ''} onChange={e => set('contact_person_lastname', e.target.value)} required className="mt-1" />
        </div>
      </div>

      <div>
        <Label>E-Mail *</Label>
        <Input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} required className="mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Telefon</Label>
          <Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Mobilnummer</Label>
          <Input value={form.mobile || ''} onChange={e => set('mobile', e.target.value)} className="mt-1" />
        </div>
      </div>

      {/* Adresse */}
      <div className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 mt-2 mb-1">
        Adresse
      </div>

      <div>
        <Label>Strasse</Label>
        <Input value={form.street || ''} onChange={e => set('street', e.target.value)} className="mt-1" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>PLZ</Label>
          <Input value={form.zip_code || ''} onChange={e => set('zip_code', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Ort</Label>
          <Input value={form.city || ''} onChange={e => set('city', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Land</Label>
          <Select value={form.canton || 'CH'} onValueChange={v => set('canton', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Verwaltung */}
      <div className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 mt-2 mb-1">
        Verwaltung
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Status</Label>
          <Select value={form.status || 'active'} onValueChange={v => set('status', v)}>
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
          <Select value={form.mandate_status || 'active'} onValueChange={v => set('mandate_status', v)}>
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
        <Label>Beratender Broker</Label>
        <div className="mt-1 space-y-2">
          <Input
            placeholder="Broker durchsuchen..."
            value={brokerSearch}
            onChange={e => setBrokerSearch(e.target.value)}
          />
          <Select value={form.assigned_broker || ''} onValueChange={v => { set('assigned_broker', v); setBrokerSearch('') }}>
            <SelectTrigger><SelectValue placeholder="Broker auswählen..." /></SelectTrigger>
            <SelectContent>
              {filteredBrokers.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">Keine Broker gefunden</div>
              ) : (
                filteredBrokers.map(b => (
                  <SelectItem key={b.id} value={b.email}>{b.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Notizen</Label>
        <Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} className="mt-1" rows={3} />
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