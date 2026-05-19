import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ALLE_STATUS } from './VerkaufschanceStatusBadge'
import { base44 } from '@/api/base44Client'
import { Search, User, Mail, Phone, Building2, FileText } from 'lucide-react'
import { getSparteLabel } from '@/lib/insuranceSparten'

const SPARTEN = [
  { value: 'kvg', label: 'KVG – Grundversicherung' },
  { value: 'vvg_krankenzusatz', label: 'VVG – Krankenzusatz' },
  { value: 'haftpflicht_privat', label: 'Haftpflicht Privat' },
  { value: 'hausrat', label: 'Hausrat' },
  { value: 'motorfahrzeug', label: 'Motorfahrzeug' },
  { value: 'leben', label: 'Leben / Vorsorge' },
  { value: 'bvg', label: 'BVG – Berufliche Vorsorge' },
  { value: 'uvg', label: 'UVG / Unfall' },
  { value: 'ktg', label: 'KTG – Krankentaggeld' },
  { value: 'rechtsschutz', label: 'Rechtsschutz' },
  { value: 'reise', label: 'Reise / Assistance' },
  { value: 'cyber', label: 'Cyber' },
  { value: 'other', label: 'Sonstiges' },
]

export default function VerkaufschanceForm({ verkaufschance, customer, onSave, onCancel, saving, lead }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(customer || null)
  const [selectedContract, setSelectedContract] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [contractSearchQuery, setContractSearchQuery] = useState('')
  const [contractResults, setContractResults] = useState([])
  const [isContractSearching, setIsContractSearching] = useState(false)
  const [form, setForm] = useState({
    title: verkaufschance?.title || '',
    sparte: verkaufschance?.sparte || '',
    status: verkaufschance?.status || 'neu',
    priority: verkaufschance?.priority || 'medium',
    estimated_value: verkaufschance?.estimated_value || '',
    expected_close_date: verkaufschance?.expected_close_date || '',
    start_date_requested: verkaufschance?.start_date_requested || '',
    contact_person: verkaufschance?.contact_person || '',
    notes: verkaufschance?.notes || '',
  })

  // Lead-Daten übernehmen wenn vorhanden
  useEffect(() => {
    if (lead && !selectedCustomer) {
      const searchFromLead = async () => {
        setIsSearching(true)
        try {
          const customers = await base44.entities.Customer.list()
          const emailMatch = customers.find(c => c.email === lead.email)
          const phoneMatch = customers.find(c => c.phone === lead.phone || c.mobile === lead.phone)
          const nameMatch = customers.find(c => 
            `${c.first_name} ${c.last_name}`.toLowerCase() === `${lead.first_name || ''} ${lead.last_name || ''}`.toLowerCase()
          )
          const match = emailMatch || phoneMatch || nameMatch
          if (match) setSelectedCustomer(match)
        } catch (e) {
          console.error('Lead customer search failed:', e)
        }
        setIsSearching(false)
      }
      searchFromLead()
    }
  }, [lead])

  // URL-Parameter für Mutation/Wechsel (von Contract aus)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const linkedContractId = params.get('linked_contract_id')
    const customerIdFromUrl = params.get('customer_id')
    
    if (linkedContractId && !verkaufschance && !selectedCustomer) {
      const loadFromContract = async () => {
        setIsSearching(true)
        try {
          const contract = await base44.entities.Contract.get(linkedContractId)
          if (contract && customerIdFromUrl) {
            const customer = await base44.entities.Customer.get(customerIdFromUrl)
            if (customer) {
              setSelectedCustomer(customer)
              setSelectedContract(contract)
              setForm(prev => ({
                ...prev,
                title: `Mutation ${contract.insurer} – ${contract.sparte || contract.insurance_type}`,
                notes: `Aus Vertrag ${contract.policy_number || contract.id} erstellt.`,
              }))
            }
          }
        } catch (e) {
          console.error('Contract load failed:', e)
        }
        setIsSearching(false)
      }
      loadFromContract()
    }
  }, [])

  // Vertrags-Suche wenn Kunde ausgewählt
  useEffect(() => {
    if (!selectedCustomer?.id) {
      setContractResults([])
      return
    }
    const debounce = setTimeout(async () => {
      setIsContractSearching(true)
      try {
        const contracts = await base44.entities.Contract.filter({ customer_id: selectedCustomer.id })
        const activeContracts = contracts.filter(c => c.status === 'active')
        setContractResults(activeContracts.slice(0, 10))
      } catch (e) {
        console.error('Contract search failed:', e)
      }
      setIsContractSearching(false)
    }, 300)
    return () => clearTimeout(debounce)
  }, [selectedCustomer])

  // Live-Kundensuche
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const debounce = setTimeout(async () => {
      setIsSearching(true)
      try {
        const customers = await base44.entities.Customer.list()
        const q = searchQuery.toLowerCase()
        const results = customers.filter(c => 
          !c.is_family_member &&
          (
            `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.phone?.toLowerCase().includes(q) ||
            c.mobile?.toLowerCase().includes(q) ||
            c.company_name?.toLowerCase().includes(q)
          )
        ).slice(0, 8)
        setSearchResults(results)
      } catch (e) {
        console.error('Customer search failed:', e)
      }
      setIsSearching(false)
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const handleSubmit = () => {
    if (!form.sparte || !selectedCustomer) return
    onSave({
      ...form,
      estimated_value: parseFloat(form.estimated_value) || null,
      expected_close_date: form.expected_close_date || null,
      start_date_requested: form.start_date_requested || null,
      customer_id: selectedCustomer.id,
      customer_name: `${selectedCustomer.first_name} ${selectedCustomer.last_name}`,
      organization_id: selectedCustomer.organization_id,
      advisor_id: selectedCustomer.advisor_id,
      assigned_broker: selectedCustomer.assigned_broker,
      linked_contract_id: selectedContract?.id || null,
    })
  }

  return (
    <div className="space-y-4">
      {/* KUNDENSUCHE — SUCHBASIERT STATT DROPDOWN */}
      {!selectedCustomer && (
        <div className="space-y-2">
          <Label>Kunde suchen *</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Name, E-Mail, Telefon, Policennummer..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          {searchResults.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {searchResults.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(c)
                    setSearchQuery('')
                    setSearchResults([])
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors border-b last:border-0 text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {c.first_name} {c.last_name}
                      {c.company_name && <span className="text-muted-foreground font-normal ml-1">({c.company_name})</span>}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                    </div>
                  </div>
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
          {searchQuery.trim() && searchResults.length === 0 && !isSearching && (
            <p className="text-xs text-muted-foreground text-center py-2">Keine Kunden gefunden</p>
          )}
        </div>
      )}

      {/* Ausgewählter Kunde */}
      {selectedCustomer && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-emerald-900 truncate">
                  {selectedCustomer.first_name} {selectedCustomer.last_name}
                </p>
                <div className="flex items-center gap-3 text-xs text-emerald-700">
                  {selectedCustomer.email && <span className="truncate">{selectedCustomer.email}</span>}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedCustomer(null)
                setSelectedContract(null)
              }}
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-100 flex-shrink-0"
            >
              Ändern
            </Button>
          </div>

          {/* VERTRAGS-AUSWAHL */}
          <div className="space-y-1.5">
            <Label>Bestehender Vertrag (für Mutation/Wechsel)</Label>
            {selectedContract ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-blue-900 truncate">
                      {selectedContract.insurer} · {getSparteLabel(selectedContract.sparte || selectedContract.insurance_type)}
                    </p>
                    <p className="text-xs text-blue-700 truncate">
                      Police: {selectedContract.policy_number || '–'} · CHF {selectedContract.premium_yearly?.toLocaleString('de-CH') || '–'}/Jahr
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedContract(null)}
                  className="text-blue-700 border-blue-300 hover:bg-blue-100 flex-shrink-0"
                >
                  Ändern
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 border border-border rounded-lg p-2 bg-card">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <select
                    value=""
                    onChange={e => {
                      const contract = contractResults.find(c => c.id === e.target.value)
                      if (contract) {
                        setSelectedContract(contract)
                        setForm(prev => ({
                          ...prev,
                          title: `Mutation ${contract.insurer} – ${getSparteLabel(contract.sparte || contract.insurance_type)}`,
                          sparte: contract.sparte || contract.insurance_type,
                          estimated_value: contract.premium_yearly?.toString() || '',
                        }))
                      }
                    }}
                    className="flex-1 text-sm bg-transparent border-none focus:ring-0 cursor-pointer"
                  >
                    <option value="">Vertrag wählen...</option>
                    {contractResults.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.insurer} · {getSparteLabel(c.sparte || c.insurance_type)} · {c.policy_number || '–'}
                      </option>
                    ))}
                  </select>
                </div>
                {contractResults.length === 0 && selectedCustomer && (
                  <p className="text-xs text-muted-foreground mt-1">Keine aktiven Verträge für diesen Kunden</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Titel + Sparte */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Bezeichnung</Label>
          <Input
            placeholder="z.B. KVG Wechsel 2026, Hausrat-Offerte..."
            value={form.title}
            onChange={e => set('title', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Versicherungssparte <span className="text-destructive">*</span></Label>
          <Select value={form.sparte} onValueChange={v => set('sparte', v)}>
            <SelectTrigger><SelectValue placeholder="Sparte wählen..." /></SelectTrigger>
            <SelectContent>
              {SPARTEN.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status + Priorität */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALLE_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Priorität</Label>
          <Select value={form.priority} onValueChange={v => set('priority', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Tief</SelectItem>
              <SelectItem value="medium">Mittel</SelectItem>
              <SelectItem value="high">Hoch</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Wert + Datum */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Geschätzter Wert (CHF/J.)</Label>
          <Input type="number" placeholder="0.00"
            value={form.estimated_value}
            onChange={e => set('estimated_value', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Versicherungsbeginn</Label>
          <Input type="date"
            value={form.start_date_requested}
            onChange={e => set('start_date_requested', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Erwarteter Abschluss</Label>
          <Input type="date"
            value={form.expected_close_date}
            onChange={e => set('expected_close_date', e.target.value)} />
        </div>
      </div>

      {/* Kontaktperson + Notizen */}
      <div className="space-y-1.5">
        <Label>Ansprechperson beim Kunden</Label>
        <Input placeholder="Optional..."
          value={form.contact_person}
          onChange={e => set('contact_person', e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Notizen / Kundenbedürfnis</Label>
        <Textarea placeholder="Bedürfnis, Ausgangslage, offene Fragen..." rows={3}
          value={form.notes}
          onChange={e => set('notes', e.target.value)} />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button onClick={handleSubmit} disabled={!form.sparte || saving}>
          {saving ? 'Speichert...' : (verkaufschance ? 'Speichern' : 'Verkaufschance erstellen')}
        </Button>
      </div>
    </div>
  )
}