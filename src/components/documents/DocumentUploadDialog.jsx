import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, Zap, Paperclip, Loader2, AlertTriangle, CheckCircle2, Users } from 'lucide-react'

export default function DocumentUploadDialog({ open, onOpenChange, onSuccess }) {
  const [uploadMode, setUploadMode] = useState(null)
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ name: '', notes: '' })
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [classificationResult, setClassificationResult] = useState(null)
  const [step, setStep] = useState('mode') // mode | customer | form | classifying | result

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.filter({ is_family_member: false }),
  })

  const reset = () => {
    setUploadMode(null)
    setFile(null)
    setForm({ name: '', notes: '' })
    setSelectedCustomerId(null)
    setUploading(false)
    setClassificationResult(null)
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
    // Antrag requires customer, Anlage goes straight to form
    setStep(mode === 'antrag' ? 'customer' : 'form')
  }

  const handleUploadAndClassify = async (e) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    const { file_url } = await base44.integrations.Core.UploadFile({ file })
    setUploading(false)

    if (uploadMode === 'antrag') {
      setStep('classifying')
      const res = await base44.functions.invoke('classifyDocument', { file_url, file_name: file.name })
      setClassificationResult({ ...res.data, file_url })
      setStep('result')
    } else {
      await saveDocument(file_url, 'anlage', 'klassifiziert', null, null)
    }
  }

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

  const saveDocument = async (file_url, doc_type, classification_status, confidence, reason) => {
    const categoryMap = { antrag: 'application', anlage: 'other' }
    await base44.entities.Document.create({
      name: form.name,
      file_url,
      category: categoryMap[doc_type] || 'other',
      doc_type,
      classification_status,
      classification_confidence: confidence,
      classification_reason: reason,
      notes: form.notes || undefined,
      uploaded_by: 'broker',
      customer_id: selectedCustomerId || undefined,
      customer_name: selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : undefined,
    })
    onSuccess()
    handleClose()
  }

  const handleConfirmClassification = async (overrideType) => {
    const r = classificationResult
    const finalType = overrideType || r.document_type
    const status = overrideType ? 'manuell' : r.status
    await saveDocument(r.file_url, finalType, status, r.confidence, r.reason)
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
                <p className="text-xs text-green-700 mt-0.5">Automatische Klassifizierung & Datenextraktion. Kundenzuordnung erforderlich.</p>
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

        {/* Step 2: Customer selection (Antrag only – PFLICHT) */}
        {step === 'customer' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium">
              <Zap className="w-4 h-4" /> Versicherungsantrag
              <button type="button" onClick={() => setStep('mode')} className="ml-auto text-xs underline opacity-60 hover:opacity-100">Ändern</button>
            </div>

            <div className="p-3 rounded-lg border-2 border-amber-200 bg-amber-50 flex items-start gap-2">
              <Users className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 font-medium">Pflicht: Wählen Sie den Kunden dem dieser Antrag gehört. Ohne Zuordnung kann kein Antrag verarbeitet werden.</p>
            </div>

            <div>
              <Label>Kunde auswählen *</Label>
              <Select value={selectedCustomerId || ''} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Kunden suchen und auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                      {c.birthdate ? ` (${new Date(c.birthdate).getFullYear()})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCustomer && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-green-800">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                  <p className="text-green-600">{selectedCustomer.email}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('mode')}>Zurück</Button>
              <Button onClick={() => setStep('form')} disabled={!selectedCustomerId}>
                Weiter →
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: File + name form */}
        {step === 'form' && (
          <form onSubmit={handleUploadAndClassify} className="space-y-4">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${uploadMode === 'antrag' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
              {uploadMode === 'antrag' ? <Zap className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
              {uploadMode === 'antrag' ? 'Versicherungsantrag' : 'Anlage / Zusatzdokument'}
              {uploadMode === 'antrag' && selectedCustomer && (
                <span className="ml-auto text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
                  {selectedCustomer.first_name} {selectedCustomer.last_name}
                </span>
              )}
            </div>

            <div>
              <Label>Datei (PDF / JPG / PNG / DOCX)</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={e => applyFile(e.target.files[0])} required className="mt-1" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Dokumentname" className="mt-1" />
            </div>
            <div>
              <Label>Bemerkungen (optional)</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>Abbrechen</Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Hochladen...</> : <><Upload className="w-4 h-4 mr-2" /> Hochladen</>}
              </Button>
            </div>
          </form>
        )}

        {/* Step 4: Classifying */}
        {step === 'classifying' && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div>
              <p className="font-semibold">Dokument wird analysiert...</p>
              <p className="text-sm text-muted-foreground mt-1">KI prüft ob es sich um einen Antrag handelt</p>
            </div>
          </div>
        )}

        {/* Step 5: Classification result */}
        {step === 'result' && classificationResult && (
          <div className="space-y-4 py-2">
            {classificationResult.status === 'pruefung_erforderlich' ? (
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800">Prüfung erforderlich</p>
                  <p className="text-sm text-amber-700 mt-0.5">Konfidenz: {Math.round((classificationResult.confidence || 0) * 100)}%</p>
                  <p className="text-xs text-amber-600 mt-1">{classificationResult.reason}</p>
                </div>
              </div>
            ) : (
              <div className={`flex items-start gap-3 p-4 rounded-xl border ${classificationResult.document_type === 'antrag' ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                <CheckCircle2 className={`w-5 h-5 flex-shrink-0 mt-0.5 ${classificationResult.document_type === 'antrag' ? 'text-green-600' : 'text-slate-500'}`} />
                <div>
                  <p className={`font-semibold ${classificationResult.document_type === 'antrag' ? 'text-green-800' : 'text-slate-700'}`}>
                    Erkannt als: {classificationResult.document_type === 'antrag' ? 'ANTRAG' : 'ANLAGE'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{classificationResult.reason}</p>
                  <p className="text-xs text-muted-foreground">Konfidenz: {Math.round((classificationResult.confidence || 0) * 100)}%</p>
                </div>
              </div>
            )}

            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Klassifizierung bestätigen oder korrigieren:</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => handleConfirmClassification('antrag')}>Als ANTRAG speichern</Button>
                <Button variant="outline" size="sm" className="flex-1 border-slate-300 text-slate-600 hover:bg-slate-50"
                  onClick={() => handleConfirmClassification('anlage')}>Als ANLAGE speichern</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}