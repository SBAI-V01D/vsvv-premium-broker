import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, CheckCircle2, Loader2, UserPlus, FileCheck, X, ChevronRight } from 'lucide-react'
import { ALL_SPARTEN } from '@/lib/insuranceSparten'

const SWISS_INSURERS = [
  'Allianz','Axa','Baloise','CSS','Concordia','Die Mobiliar','Elvia','Generali',
  'Helvetia','Helsana','Mutuel','ÖKK','SWICA','Sanitas','Smile','Suva',
  'Swiss Life','Swiss Re','TCS','Visana','Zurich','Andere',
]

const CONFIDENCE_THRESHOLD = 0.9

function FieldRow({ label, fieldKey, fieldData, editedValues, onEdit }) {
  const raw = fieldData || { value: null, confidence: 0 }
  const value = editedValues[fieldKey] !== undefined ? editedValues[fieldKey] : (raw.value ?? '')
  const conf = raw.confidence || 0
  const isLow = conf > 0 && conf < CONFIDENCE_THRESHOLD
  const isEmpty = !raw.value

  return (
    <div className={`p-2.5 rounded-lg border ${isLow ? 'border-amber-300 bg-amber-50' : isEmpty ? 'bg-muted/30 border-border' : 'border-green-200 bg-green-50/40'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {conf > 0 && (
          <span className={`text-xs font-semibold ${isLow ? 'text-amber-600' : 'text-green-600'}`}>
            {isLow && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
            {Math.round(conf * 100)}%
          </span>
        )}
      </div>
      <Input
        value={value}
        onChange={e => onEdit(fieldKey, e.target.value)}
        className={`h-7 text-sm ${isLow ? 'border-amber-300 focus:ring-amber-400' : ''}`}
        placeholder="–"
      />
    </div>
  )
}

export default function DocumentReviewPanel({ document, onClose, onSaved }) {
  const queryClient = useQueryClient()
  const [extractedData, setExtractedData] = useState(null)
  const [editedValues, setEditedValues] = useState({})
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState('person')
  const [matchCustomer, setMatchCustomer] = useState(null)
  const [createNew, setCreateNew] = useState(false)

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const handleExtract = async () => {
    setExtracting(true)
    const res = await base44.functions.invoke('extractApplicationData', {
      file_url: document.file_url,
      file_name: document.name,
    })
    setExtracting(false)
    if (res.data?.success) {
      setExtractedData(res.data)
      // Try to auto-match customer
      const fn = res.data.fields?.first_name?.value
      const ln = res.data.fields?.last_name?.value
      if (fn && ln) {
        const found = customers.find(c =>
          c.first_name?.toLowerCase() === fn.toLowerCase() &&
          c.last_name?.toLowerCase() === ln.toLowerCase()
        )
        if (found) setMatchCustomer(found)
      }
    }
  }

  const getVal = (key) => {
    if (editedValues[key] !== undefined) return editedValues[key]
    return extractedData?.fields?.[key]?.value ?? ''
  }

  const handleSaveApplication = async () => {
    setSaving(true)
    let customerId = matchCustomer?.id

    // Create customer if needed
    if (createNew && !customerId) {
      const newCustomer = await base44.entities.Customer.create({
        first_name: getVal('first_name'),
        last_name: getVal('last_name'),
        birthdate: getVal('birthdate') || undefined,
        street: getVal('street') || undefined,
        zip_code: getVal('zip_code') || undefined,
        city: getVal('city') || undefined,
        canton: getVal('canton') || undefined,
        phone: getVal('phone') || undefined,
        mobile: getVal('mobile') || undefined,
        email: getVal('email') || undefined,
        ahv_number: getVal('ahv_number') || undefined,
        profession: getVal('profession') || undefined,
        status: 'active',
      })
      customerId = newCustomer.id
    }

    if (!customerId) {
      setSaving(false)
      return
    }

    const customer = customers.find(c => c.id === customerId)
    const customerName = customer
      ? `${customer.first_name} ${customer.last_name}`
      : `${getVal('first_name')} ${getVal('last_name')}`

    // Map insurance_type to sparte
    const insuranceTypeRaw = getVal('insurance_type')
    const sparteMatch = ALL_SPARTEN.find(s =>
      s.label.toLowerCase().includes((insuranceTypeRaw || '').toLowerCase()) ||
      s.value.toLowerCase() === (insuranceTypeRaw || '').toLowerCase()
    )
    const sparte = sparteMatch?.value || insuranceTypeRaw || ''

    await base44.entities.Application.create({
      customer_id: customerId,
      customer_name: customerName,
      insurer: getVal('insurer') || 'Andere',
      sparte,
      insurance_type: sparte,
      product: getVal('product') || '',
      policy_number: getVal('policy_number') || '',
      contract_start_date: getVal('contract_start_date') || '',
      contract_end_date: getVal('contract_end_date') || '',
      estimated_premium_monthly: getVal('estimated_premium_monthly') ? Number(getVal('estimated_premium_monthly')) : undefined,
      estimated_premium_yearly: getVal('estimated_premium_yearly') ? Number(getVal('estimated_premium_yearly')) : undefined,
      sparte_data: {
        franchise: getVal('franchise') || undefined,
        payment_interval: getVal('payment_interval') || undefined,
        company_name: getVal('company_name') || undefined,
      },
      status: 'draft',
      notes: `Automatisch aus Dokument extrahiert: ${document.name}`,
    })

    // Update document as linked
    await base44.entities.Document.update(document.id, {
      customer_id: customerId,
      customer_name: customerName,
    })

    queryClient.invalidateQueries({ queryKey: ['applications'] })
    queryClient.invalidateQueries({ queryKey: ['documents'] })
    setSaving(false)
    onSaved?.()
    onClose()
  }

  const fields = extractedData?.fields || {}
  const overallConf = extractedData?.overall_confidence || 0
  const lowConfFields = Object.values(fields).filter(f => f.confidence > 0 && f.confidence < CONFIDENCE_THRESHOLD).length

  const sections = [
    { key: 'person', label: 'Personendaten', fields: [
      { key: 'first_name', label: 'Vorname' },
      { key: 'last_name', label: 'Nachname' },
      { key: 'birthdate', label: 'Geburtsdatum' },
      { key: 'street', label: 'Strasse' },
      { key: 'zip_code', label: 'PLZ' },
      { key: 'city', label: 'Ort' },
      { key: 'canton', label: 'Kanton' },
      { key: 'phone', label: 'Telefon' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'email', label: 'E-Mail' },
      { key: 'ahv_number', label: 'AHV-Nummer' },
      { key: 'profession', label: 'Beruf' },
    ]},
    { key: 'insurance', label: 'Versicherung', fields: [
      { key: 'insurer', label: 'Gesellschaft' },
      { key: 'insurance_type', label: 'Versicherungsart' },
      { key: 'product', label: 'Produkt / Tarif' },
      { key: 'policy_number', label: 'Policennummer' },
      { key: 'contract_start_date', label: 'Vertragsbeginn' },
      { key: 'contract_end_date', label: 'Vertragsende' },
      { key: 'estimated_premium_monthly', label: 'Monatsprämie (CHF)' },
      { key: 'estimated_premium_yearly', label: 'Jahresprämie (CHF)' },
      { key: 'payment_interval', label: 'Zahlungsintervall' },
      { key: 'franchise', label: 'Franchise' },
    ]},
    { key: 'company', label: 'Firmendaten', fields: [
      { key: 'company_name', label: 'Firmenname' },
      { key: 'company_uid', label: 'UID' },
      { key: 'company_industry', label: 'Branche' },
      { key: 'company_contact', label: 'Ansprechpartner' },
    ]},
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div>
          <h2 className="font-semibold text-sm">{document.name}</h2>
          <p className="text-xs text-muted-foreground">KI-Datenextraktion & Antragserstellung</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document preview */}
        <div className="w-1/2 border-r flex flex-col bg-muted/20">
          <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground bg-muted/40">Originaldokument</div>
          <div className="flex-1 overflow-auto p-2">
            {document.file_url?.match(/\.(jpg|jpeg|png)$/i) ? (
              <img src={document.file_url} alt="Dokument" className="w-full rounded shadow" />
            ) : (
              <iframe
                src={document.file_url}
                className="w-full h-full rounded border"
                title="Dokument"
                style={{ minHeight: '500px' }}
              />
            )}
          </div>
        </div>

        {/* Right: Extracted data */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Extrahierte Daten</span>
            {extractedData && (
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${overallConf >= 0.9 ? 'text-green-600' : overallConf >= 0.7 ? 'text-amber-600' : 'text-red-600'}`}>
                  Ø {Math.round(overallConf * 100)}%
                </span>
                {lowConfFields > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                    {lowConfFields} Felder &lt;90%
                  </span>
                )}
              </div>
            )}
          </div>

          {!extractedData ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
              {extracting ? (
                <>
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="font-semibold">KI analysiert Dokument...</p>
                    <p className="text-sm text-muted-foreground mt-1">OCR & Datenextraktion läuft</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <FileCheck className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Daten automatisch extrahieren</p>
                    <p className="text-sm text-muted-foreground mt-1">KI erkennt alle Felder und befüllt die Antragsmaske vor</p>
                  </div>
                  <Button onClick={handleExtract} className="gap-2">
                    <FileCheck className="w-4 h-4" /> Extraktion starten
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              {/* Extraction notes */}
              {extractedData.extraction_notes && (
                <div className="mx-3 mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  {extractedData.extraction_notes}
                </div>
              )}

              {/* Section tabs */}
              <div className="flex border-b mt-2">
                {sections.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setActiveSection(s.key)}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeSection === s.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Fields */}
              <div className="p-3 grid grid-cols-2 gap-2">
                {sections.find(s => s.key === activeSection)?.fields.map(f => (
                  <FieldRow
                    key={f.key}
                    label={f.label}
                    fieldKey={f.key}
                    fieldData={fields[f.key]}
                    editedValues={editedValues}
                    onEdit={(k, v) => setEditedValues(prev => ({ ...prev, [k]: v }))}
                  />
                ))}
              </div>

              {/* Customer matching */}
              <div className="mx-3 mb-3 p-3 border rounded-lg bg-card">
                <p className="text-xs font-semibold mb-2">Kundenzuordnung</p>
                {matchCustomer ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 text-xs">
                      <p className="font-medium text-green-800">Kunde gefunden: {matchCustomer.first_name} {matchCustomer.last_name}</p>
                      <button
                        className="text-green-600 underline mt-0.5"
                        onClick={() => { setMatchCustomer(null); setCreateNew(false) }}
                      >Ändern</button>
                    </div>
                  </div>
                ) : createNew ? (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <UserPlus className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 text-xs">
                      <p className="font-medium text-blue-800">Neuer Kunde wird erstellt</p>
                      <button className="text-blue-600 underline" onClick={() => setCreateNew(false)}>Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Select onValueChange={v => setMatchCustomer(customers.find(c => c.id === v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Bestehendem Kunden zuordnen..." /></SelectTrigger>
                      <SelectContent>
                        {customers.filter(c => !c.is_family_member).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      className="text-xs text-primary underline flex items-center gap-1"
                      onClick={() => setCreateNew(true)}
                    >
                      <UserPlus className="w-3 h-3" /> Neuen Kunden anlegen
                    </button>
                  </div>
                )}
              </div>

              {/* Save action */}
              <div className="mx-3 mb-4">
                <Button
                  className="w-full gap-2"
                  onClick={handleSaveApplication}
                  disabled={saving || (!matchCustomer && !createNew)}
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Speichern...</>
                    : <><ChevronRight className="w-4 h-4" /> Antrag erstellen & speichern</>
                  }
                </Button>
                {!matchCustomer && !createNew && (
                  <p className="text-xs text-muted-foreground text-center mt-1">Bitte Kunden auswählen oder neu anlegen</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}