import React, { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, Zap, Paperclip, Loader2, CheckCircle2, AlertCircle, FileText, Shield, ClipboardList, Scale, ScrollText } from 'lucide-react'

const MAX_FILE_SIZE_MB = 50
const MAX_ANTRAG_SIZE_MB = 10 // LLM-Limit für KI-Extraktion
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']

const sanitizeFilename = (name) =>
  name.replace(/[^\w\s.\-_()äöüÄÖÜ]/g, '_').replace(/\s+/g, '_')

export default function DocumentUploadDialog({ open, onOpenChange, onSuccess }) {
  const [uploadMode, setUploadMode] = useState(null)
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [form, setForm] = useState({ name: '', notes: '', customer_id: '', contract_id: '', primary_customer_id: '', is_family_member: false })
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0) // 0-100
  const [uploadError, setUploadError] = useState('')
  const [step, setStep] = useState('mode') // mode | form | uploading | success
  const [dragOver, setDragOver] = useState(false)

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
  const selectedPrimaryCustomer = customers.find(c => c.id === form.primary_customer_id)
  const customerContracts = contracts.filter(c => c.customer_id === form.customer_id)
  const primaryCustomerContracts = contracts.filter(c => c.customer_id === form.primary_customer_id)

  const reset = () => {
    setUploadMode(null)
    setFile(null)
    setFileError('')
    setForm({ name: '', notes: '', customer_id: '', contract_id: '', primary_customer_id: '', is_family_member: false })
    setUploading(false)
    setUploadProgress(0)
    setUploadError('')
    setStep('mode')
    setDragOver(false)
  }

  const handleClose = () => { reset(); onOpenChange(false) }

  const validateFile = (f, mode = uploadMode) => {
    if (!f) return 'Keine Datei ausgewählt.'
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) return `Dateityp nicht erlaubt. Erlaubt: ${ALLOWED_EXTENSIONS.join(', ')}`
    if (f.size === 0) return 'Datei ist leer.'
    if (mode === 'antrag' && f.size > MAX_ANTRAG_SIZE_MB * 1024 * 1024)
      return `Versicherungsanträge dürfen max. ${MAX_ANTRAG_SIZE_MB} MB gross sein (für KI-Verarbeitung). Aktuelle Grösse: ${(f.size / 1024 / 1024).toFixed(1)} MB. Bitte PDF komprimieren.`
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) return `Datei zu gross. Maximum: ${MAX_FILE_SIZE_MB} MB`
    return ''
  }

  const applyFile = (f) => {
    if (!f) return
    const err = validateFile(f, uploadMode)
    setFileError(err)
    if (!err) {
      setFile(f)
      setForm(p => ({ ...p, name: p.name || sanitizeFilename(f.name.replace(/\.[^.]+$/, '')) }))
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    applyFile(e.dataTransfer.files[0])
  }, [])

  const handleModeSelect = (mode) => {
    setUploadMode(mode)
    setStep('form')
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    const err = validateFile(file, uploadMode)
    if (err) { setFileError(err); return }

    setUploading(true)
    setUploadError('')
    setUploadProgress(10)
    setStep('uploading')

    try {
      // Step 1: Upload file
      setUploadProgress(30)
      const { file_url } = await base44.integrations.Core.UploadFile({ file })
      setUploadProgress(60)

      if (uploadMode === 'antrag') {
        const doc = await base44.entities.Document.create({
          name: form.name,
          file_url,
          category: 'application',
          doc_type: 'antrag',
          classification_status: 'ausstehend',
          notes: form.notes || undefined,
          uploaded_by: 'broker',
        })
        setUploadProgress(85)
        base44.entities.AutomationQueue.create({
          job_type: 'ki_extraction',
          status: 'pending',
          related_document_id: doc.id,
          related_entity_type: 'Document',
          related_entity_id: doc.id,
          payload: JSON.stringify({ file_url, file_name: form.name, document_id: doc.id }),
        }).catch(err => console.error('Queue creation failed:', err))
      } else {
        // Kategorie je nach Modus
        const docCategory =
          uploadMode === 'police'    ? 'contract' :
          uploadMode === 'mandat'    ? 'correspondence' :
          uploadMode === 'vag45'     ? 'correspondence' :
          uploadMode === 'antrag_dok'? 'application' :
          'other'
        const docType = 'anlage'
        await base44.entities.Document.create({
          name: form.name,
          file_url,
          category: docCategory,
          doc_type: docType,
          classification_status: 'klassifiziert',
          notes: form.notes || undefined,
          uploaded_by: 'broker',
          customer_id: form.customer_id || undefined,
          customer_name: selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : undefined,
          linked_contract_id: form.contract_id || undefined,
          primary_customer_id: form.primary_customer_id || undefined,
          is_family_member: form.is_family_member,
        })
        setUploadProgress(90)
      }

      setUploadProgress(100)
      setStep('success')
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 1200)
    } catch (uploadErr) {
      console.error('[DocumentUpload] Upload failed:', uploadErr)
      const status = uploadErr?.response?.status || uploadErr?.status
      let msg = uploadErr?.response?.data?.message || uploadErr?.message || 'Unbekannter Fehler'
      if (status === 413 || msg.toLowerCase().includes('size') || msg.toLowerCase().includes('too large')) {
        msg = `Die Datei ist zu gross für die KI-Verarbeitung (max. ${MAX_ANTRAG_SIZE_MB} MB). Bitte komprimieren Sie das PDF und versuchen Sie es erneut.`
      }
      setUploadError(msg)
      setStep('form')
      setUploading(false)
      setUploadProgress(0)
    }
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
              onClick={() => handleModeSelect('police')}
              className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <p className="font-semibold text-blue-800">Police / Vertragsdokument</p>
                <p className="text-xs text-blue-700 mt-0.5">Wird als Kategorie «Vertrag» gespeichert. Kein Schaden-Bezug.</p>
              </div>
            </button>
            <button
              onClick={() => handleModeSelect('mandat')}
              className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-400 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ClipboardList className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <p className="font-semibold text-amber-800">Mandat</p>
                <p className="text-xs text-amber-700 mt-0.5">Vollmacht / Maklermandat – Kategorie: Korrespondenz.</p>
              </div>
            </button>
            <button
              onClick={() => handleModeSelect('vag45')}
              className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-violet-200 bg-violet-50 hover:bg-violet-100 hover:border-violet-400 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Scale className="w-5 h-5 text-violet-700" />
              </div>
              <div>
                <p className="font-semibold text-violet-800">VAG 45 (Kundeninformation)</p>
                <p className="text-xs text-violet-700 mt-0.5">Gesetzliche Kundeninformation gemäss VAG Art. 45.</p>
              </div>
            </button>
            <button
              onClick={() => handleModeSelect('antrag_dok')}
              className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ScrollText className="w-5 h-5 text-orange-700" />
              </div>
              <div>
                <p className="font-semibold text-orange-800">Antrag (Dokument)</p>
                <p className="text-xs text-orange-700 mt-0.5">Ausgefüllter Antrag ohne KI-Verarbeitung – Kategorie: Antrag.</p>
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
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              uploadMode === 'antrag'     ? 'bg-green-50 text-green-700' :
              uploadMode === 'police'     ? 'bg-blue-50 text-blue-700' :
              uploadMode === 'mandat'     ? 'bg-amber-50 text-amber-700' :
              uploadMode === 'vag45'      ? 'bg-violet-50 text-violet-700' :
              uploadMode === 'antrag_dok' ? 'bg-orange-50 text-orange-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {uploadMode === 'antrag'     ? <Zap className="w-4 h-4" /> :
               uploadMode === 'police'     ? <Shield className="w-4 h-4" /> :
               uploadMode === 'mandat'     ? <ClipboardList className="w-4 h-4" /> :
               uploadMode === 'vag45'      ? <Scale className="w-4 h-4" /> :
               uploadMode === 'antrag_dok' ? <ScrollText className="w-4 h-4" /> :
               <Paperclip className="w-4 h-4" />}
              {uploadMode === 'antrag'     ? 'Versicherungsantrag – KI verarbeitet automatisch' :
               uploadMode === 'police'     ? 'Police / Vertragsdokument' :
               uploadMode === 'mandat'     ? 'Mandat / Vollmacht' :
               uploadMode === 'vag45'      ? 'VAG 45 – Kundeninformation' :
               uploadMode === 'antrag_dok' ? 'Antrag (Dokument)' :
               'Anlage / Zusatzdokument'}
              <button type="button" onClick={() => setStep('mode')} className="ml-auto text-xs underline opacity-60 hover:opacity-100">Ändern</button>
            </div>

            {/* Drag & Drop File Area */}
            <div>
              <Label>Datei (PDF / JPG / PNG / DOCX) — max. {uploadMode === 'antrag' ? MAX_ANTRAG_SIZE_MB : MAX_FILE_SIZE_MB} MB{uploadMode === 'antrag' ? ' (KI-Limit)' : ''}</Label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                className={`mt-1 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-primary bg-primary/5' :
                  fileError ? 'border-red-400 bg-red-50' :
                  file ? 'border-emerald-400 bg-emerald-50' :
                  'border-border hover:border-primary/40 hover:bg-muted/30'
                }`}
                onClick={() => document.getElementById('doc-file-input').click()}
              >
                <input
                  id="doc-file-input"
                  type="file"
                  accept={ALLOWED_EXTENSIONS.join(',')}
                  className="hidden"
                  onChange={e => applyFile(e.target.files[0])}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-emerald-800">{file.name}</p>
                      <p className="text-xs text-emerald-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-2" />
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Datei hier ablegen oder <span className="text-primary font-medium">auswählen</span></p>
                    <p className="text-xs text-muted-foreground/70 mt-1">{ALLOWED_EXTENSIONS.join(' · ')}</p>
                  </div>
                )}
              </div>
              {fileError && (
                <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-xs text-red-700 font-medium">{fileError}</p>
                </div>
              )}
            </div>

            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Dokumentname" className="mt-1" />
            </div>
            {(uploadMode === 'anlage' || uploadMode === 'police' || uploadMode === 'mandat' || uploadMode === 'vag45' || uploadMode === 'antrag_dok') && (
              <>
                <div>
                  <Label>Kunde (optional)</Label>
                  <Select value={form.customer_id} onValueChange={v => setForm(p => ({ ...p, customer_id: v, contract_id: '', is_family_member: false, primary_customer_id: '' }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Kunden auswählen..." /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name}
                          {c.is_family_member ? ` (Familienmitglied)` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {form.customer_id && selectedCustomer?.is_family_member && (
                  <div>
                    <Label>Dem Hauptkontakt zuweisen</Label>
                    <Select value={form.primary_customer_id} onValueChange={v => setForm(p => ({ ...p, primary_customer_id: v, is_family_member: !!v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Hauptkontakt auswählen..." /></SelectTrigger>
                      <SelectContent>
                        {customers.filter(c => c.id === selectedCustomer.primary_customer_id).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
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

            {uploadError && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-xs text-red-700 font-medium">{uploadError}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>Abbrechen</Button>
              <Button type="submit" disabled={uploading || !!fileError || !file}>
                <Upload className="w-4 h-4 mr-2" /> Hochladen
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Uploading with progress */}
        {step === 'uploading' && (
          <div className="py-8 flex flex-col items-center gap-5 text-center">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--primary))" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - uploadProgress / 100)}`}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-primary">{uploadProgress}%</span>
            </div>
            <div>
              <p className="font-semibold">Dokument wird hochgeladen...</p>
              <p className="text-sm text-muted-foreground mt-1">
                {uploadProgress < 60 ? 'Datei wird übertragen...' :
                 uploadProgress < 90 ? 'Dokument wird gespeichert...' :
                 uploadMode === 'antrag' ? 'KI-Verarbeitung wird gestartet...' : 'Fast fertig...'}
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-emerald-800">Erfolgreich gespeichert!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {uploadMode === 'antrag' ? 'KI-Verarbeitung läuft im Hintergrund.' : 'Dokument wurde gespeichert.'}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}