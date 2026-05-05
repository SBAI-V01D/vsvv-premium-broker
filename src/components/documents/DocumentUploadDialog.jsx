import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, Zap, Paperclip, Loader2 } from 'lucide-react'

export default function DocumentUploadDialog({ open, onOpenChange, onSuccess }) {
  const [uploadMode, setUploadMode] = useState(null)
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ name: '', notes: '', customer_id: '', contract_id: '' })
  const [uploading, setUploading] = useState(false)
  const [step, setStep] = useState('mode') // mode | form | uploading

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: open,
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(null, 1000),
    enabled: open,
  })

  const selectedCustomer = customers.find(c => c.id === form.customer_id)
  const customerContracts = contracts.filter(c => c.customer_id === form.customer_id)

  const reset = () => {
    setUploadMode(null)
    setFile(null)
    setForm({ name: '', notes: '', customer_id: '', contract_id: '' })
    setUploading(false)
    setStep('mode')
  }

  const handleClose = () => { reset(); onOpenChange(false) }

  const applyFile = (f) => {
    if (!f) return
    setFile(f)
    setForm(p => ({ ...p, name: p.name || f.name.replace(/\.[^.]+$/, '') }))
  }

  const handleModeSelect = (mode) => {
    setUploadMode(mode)
    setStep('form')
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setStep('uploading')

    const { file_url } = await base44.integrations.Core.UploadFile({ file })

    // For Antrag: trigger sparte classification and application extraction
    if (uploadMode === 'antrag') {
      try {
        // Extract text from document (using backend function)
        const extracted = await base44.functions.invoke('extractApplicationData', { 
          file_url,
          file_name: form.name
        })

        // Classify sparte from extracted data
        const classification = await base44.functions.invoke('classifySparteFromDocument', {
          extractedText: extracted.data?.structured?.versicherung?.sparte || ''
        })

        // Save document with classification metadata
        // Normalize confidence to 0-100 scale
        const rawConfidence = classification.data?.confidence ?? 0
        const normalizedConfidence = rawConfidence > 1 ? rawConfidence : rawConfidence * 100

        const doc = await base44.entities.Document.create({
          name: form.name,
          file_url,
          category: 'application',
          doc_type: 'antrag',
          classification_status: normalizedConfidence >= 80 ? 'klassifiziert' : 'ausstehend',
          classification_confidence: normalizedConfidence,
          notes: form.notes || undefined,
          uploaded_by: 'broker',
        })

        // Store classification metadata in document notes for debug & traceability
        if (classification.data?.sparte) {
          const debugInfo = `[KLASSIFIZIERUNG] Sparte: ${classification.data.sparte} | Regel: ${classification.data.rule} | Keywords: ${(classification.data.matchedKeywords || []).join(', ')}`
          await base44.entities.Document.update(doc.id, {
            notes: (form.notes ? form.notes + ' | ' : '') + debugInfo
          })
        }
      } catch (error) {
        console.error('Classification error:', error)
        // Fall back to basic document creation if classification fails
        await base44.entities.Document.create({
          name: form.name,
          file_url,
          category: 'application',
          doc_type: 'antrag',
          classification_status: 'ausstehend',
          notes: form.notes || undefined,
          uploaded_by: 'broker',
        })
      }
    } else {
      // For Anlage: save with optional customer & contract link
      await base44.entities.Document.create({
        name: form.name,
        file_url,
        category: 'other',
        doc_type: 'anlage',
        classification_status: 'klassifiziert',
        notes: form.notes || undefined,
        uploaded_by: 'broker',
        customer_id: form.customer_id || undefined,
        customer_name: selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : undefined,
        linked_contract_id: form.contract_id || undefined,
      })
    }

    setUploading(false)
    onSuccess()
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dokument hochladen</DialogTitle>
        </DialogHeader>

        {/* Step 1: Mode selection */}
        {step === 'mode' && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Was möchten Sie hochladen?</p>
            <button
              onClick={() => handleModeSelect('antrag')}
              className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-400 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Zap className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="font-semibold text-green-800">Versicherungsantrag</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Automatische KI-Extraktion, Kunden-Matching & Antragserstellung nach dem Upload.
                </p>
              </div>
            </button>
            <button
              onClick={() => handleModeSelect('anlage')}
              className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Paperclip className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">Anlage / Zusatzdokument</p>
                <p className="text-xs text-slate-500 mt-0.5">Keine automatische Verarbeitung. Nur Speicherung.</p>
              </div>
            </button>
          </div>
        )}

        {/* Step 2: File form */}
        {step === 'form' && (
          <form onSubmit={handleUpload} className="space-y-4">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${uploadMode === 'antrag' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
              {uploadMode === 'antrag' ? <Zap className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
              {uploadMode === 'antrag' ? 'Versicherungsantrag – KI verarbeitet automatisch' : 'Anlage / Zusatzdokument'}
              <button type="button" onClick={() => setStep('mode')} className="ml-auto text-xs underline opacity-60 hover:opacity-100">Ändern</button>
            </div>

            <div>
              <Label>Datei (PDF / JPG / PNG / DOCX)</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={e => applyFile(e.target.files[0])} required className="mt-1" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Dokumentname" className="mt-1" />
            </div>
            {uploadMode === 'anlage' && (
              <>
                <div>
                  <Label>Kunde (optional)</Label>
                  <Select value={form.customer_id} onValueChange={v => setForm(p => ({ ...p, customer_id: v, contract_id: '' }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Kunden auswählen..." /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.customer_id && customerContracts.length > 0 && (
                  <div>
                    <Label>Verknüpfter Vertrag (optional)</Label>
                    <Select value={form.contract_id} onValueChange={v => setForm(p => ({ ...p, contract_id: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Vertrag auswählen..." /></SelectTrigger>
                      <SelectContent>
                        {customerContracts.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.insurer} – {c.insurance_type || c.product || ''}
                            {c.policy_number ? ` (${c.policy_number})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div>
              <Label>Bemerkungen (optional)</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="mt-1" />
            </div>

            {uploadMode === 'antrag' && (
              <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
                Nach dem Upload wird die KI automatisch Daten extrahieren und den passenden Kunden zuordnen.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>Abbrechen</Button>
              <Button type="submit" disabled={uploading}>
                <Upload className="w-4 h-4 mr-2" /> Hochladen
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Uploading */}
        {step === 'uploading' && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div>
              <p className="font-semibold">Dokument wird hochgeladen...</p>
              <p className="text-sm text-muted-foreground mt-1">
                {uploadMode === 'antrag' ? 'Danach startet die automatische KI-Verarbeitung' : 'Wird gespeichert...'}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}