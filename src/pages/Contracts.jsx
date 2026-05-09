import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Search, MoreHorizontal, Edit, Trash2, FileText, Calendar, Building2, Tag, Download, Upload } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import ContractForm from '../components/contracts/ContractForm'
import ContractDocumentsPanel from '../components/contracts/ContractDocumentsPanel'
import PolicyUploadWizard from '../components/contracts/PolicyUploadWizard'
import { getSparteLabel } from '@/lib/insuranceSparten'
import StatusBadge from '@/components/status/StatusBadge'
import StatusChangeDialog from '@/components/status/StatusChangeDialog'

export default function Contracts() {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [showUploadWizard, setShowUploadWizard] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [statusChanging, setStatusChanging] = useState(null)
  const [expandedDocs, setExpandedDocs] = useState(null)
  const [importFile, setImportFile] = useState(null)
  const [importProgress, setImportProgress] = useState(null)
  const queryClient = useQueryClient()

  const { data: statusDefs = [] } = useQuery({
    queryKey: ['statusDefinitions'],
    queryFn: () => base44.entities.StatusDefinition.filter({ type: 'contract' }),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date'),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list(null, 1000),
  })

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contract.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      setShowForm(false)
      setEditing(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      setShowForm(false)
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contract.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  })

  const filtered = contracts.filter(c =>
    `${c.customer_name} ${c.insurer} ${c.policy_number}`.toLowerCase().includes(search.toLowerCase())
  )

  const getCustomer = (id) => customers.find(c => c.id === id)
  const getContractDocuments = (contractId) => documents.filter(d => d.linked_contract_id === contractId)

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleStatusChange = async ({ status, statusDef, note, metadata }) => {
    if (!statusChanging) return
    const contract = statusChanging
    await base44.entities.StatusHistory.create({
      entity_type: 'contract',
      entity_id: contract.id,
      customer_id: contract.customer_id,
      from_status: contract.custom_status || contract.status,
      to_status: status,
      to_status_label: statusDef?.label || status,
      note,
      metadata: JSON.stringify(metadata),
    })
    await base44.entities.Contract.update(contract.id, { custom_status: status })
    queryClient.invalidateQueries({ queryKey: ['contracts'] })
    setStatusChanging(null)
  }

  const getStatusDef = (contract) => {
    const key = contract.custom_status || contract.status
    return statusDefs.find(s => s.key === key)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    return new Date(dateStr).toLocaleDateString('de-CH')
  }

  const handleImport = async () => {
    if (!importFile) return
    
    setImportProgress('Datei wird hochgeladen...')
    try {
      // Upload file first
      const formData = new FormData()
      formData.append('file', importFile)
      const uploadRes = await fetch('https://api.base44.com/upload', {
        method: 'POST',
        body: formData,
      })
      const { file_url } = await uploadRes.json()

      // Call import function
      const result = await base44.functions.invoke('importEntityData', {
        entity_name: 'Contract',
        file_url
      })

      setImportProgress(`✓ ${result.data.successful} Verträge importiert`)
      if (result.data.failed > 0) {
        setImportProgress(prev => `${prev} (${result.data.failed} Fehler)`)
      }
      
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['contracts'] })
        setShowImport(false)
        setImportFile(null)
        setImportProgress(null)
      }, 2000)
    } catch (error) {
      setImportProgress(`✗ Fehler: ${error.message}`)
    }
  }

  const handleExport = () => {
    if (filtered.length === 0) return
    const headers = ['ID', 'Kunde', 'Versicherer', 'Police', 'Produkt', 'Jahresprämie', 'Gültig bis', 'Status']
    const rows = filtered.map(c => [
      c.id,
      c.customer_name,
      c.insurer,
      c.policy_number || '',
      c.product || '',
      c.premium_yearly || '',
      c.end_date ? new Date(c.end_date).toLocaleDateString('de-CH') : '',
      c.status
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `vertraege_export_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Verträge ({filtered.length})</h1>
          <p className="text-muted-foreground mt-1">{contracts.length} Verträge insgesamt</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Exportieren
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-2" /> Importieren
          </Button>
          <Button variant="outline" onClick={() => setShowUploadWizard(true)} className="gap-2">
            <FileText className="w-4 h-4" /> Police hochladen
          </Button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Neuer Vertrag
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suche (Kunde, Versicherer, Police...)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:grid grid-cols-[2fr_2fr_1.2fr_1.2fr_1.2fr_1fr_1fr_auto] gap-3 px-4 py-2 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <div>Kunde</div>
            <div>Versicherer / Sparte</div>
            <div>Policen-Nr</div>
            <div>Produkt / Tarif</div>
            <div>Vertragsdaten</div>
            <div>Jahresprämie</div>
            <div>Status</div>
            <div className="w-20"></div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Keine Verträge gefunden</div>
          ) : (
            filtered.map((contract, idx) => {
              const docsOpen = expandedDocs === contract.id
              const contractDocs = getContractDocuments(contract.id)
              const customer = getCustomer(contract.customer_id)
              return (
                <div key={contract.id} className={idx > 0 ? 'border-t border-border' : ''}>
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.2fr_1.2fr_1.2fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-muted/30 transition-colors group">
                    {/* Kunde */}
                    <div className="min-w-0">
                      <p className="font-semibold text-xs truncate">{contract.customer_name || '–'}</p>
                      {customer?.ahv_number && (
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">{customer.ahv_number}</p>
                      )}
                    </div>

                    {/* Versicherer / Sparte */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <p className="text-xs font-medium truncate">{contract.insurer}</p>
                      </div>
                      {contract.sparte || contract.insurance_type ? (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{getSparteLabel(contract.sparte || contract.insurance_type)}</p>
                      ) : null}
                      {contract.sparte_data?.franchise && (
                        <p className="text-xs text-muted-foreground mt-0.5">Franchise: CHF {contract.sparte_data.franchise}</p>
                      )}
                      {contract.sparte_data?.model && (
                        <p className="text-xs text-muted-foreground mt-0.5">Modell: {contract.sparte_data.model}</p>
                      )}
                    </div>

                    {/* Policen-Nr */}
                    <div className="min-w-0">
                      {contract.policy_number && (
                        <p className="text-xs font-medium">{contract.policy_number}</p>
                      )}
                      {!contract.policy_number && <span className="text-xs text-muted-foreground">–</span>}
                    </div>

                    {/* Produkt / Tarif */}
                    <div className="min-w-0">
                      {contract.product && (
                        <p className="text-xs font-medium">{contract.product}</p>
                      )}
                      {!contract.product && <span className="text-xs text-muted-foreground">–</span>}
                    </div>

                    {/* Vertragsdaten */}
                    <div>
                      {contract.start_date && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <Calendar className="w-3 h-3 text-green-600 flex-shrink-0" />
                          <span className="text-xs text-green-600 font-medium">{formatDate(contract.start_date)}</span>
                        </div>
                      )}
                      {contract.end_date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-green-600 flex-shrink-0" />
                          <span className="text-xs text-green-600 font-medium">{formatDate(contract.end_date)}</span>
                        </div>
                      )}
                      {!contract.start_date && !contract.end_date && (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </div>

                    {/* Jahresprämie */}
                    <div>
                      {contract.premium_yearly ? (
                        <p className="text-xs font-semibold text-foreground">
                          CHF {contract.premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/J.
                        </p>
                      ) : null}
                      {contract.premium_monthly ? (
                        <p className="text-xs text-muted-foreground">
                          CHF {contract.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/M.
                        </p>
                      ) : null}
                      {!contract.premium_yearly && !contract.premium_monthly && (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      <button onClick={() => setStatusChanging(contract)} className="hover:opacity-80 transition-opacity mb-1">
                        <StatusBadge statusDef={getStatusDef(contract)} label={getStatusDef(contract)?.label || contract.status} />
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => setExpandedDocs(docsOpen ? null : contract.id)}
                        title="Dokumente"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {contract.customer_id && (
                            <DropdownMenuItem onClick={() => navigate(`/kunden/${contract.customer_id}`)}>
                              👤 Kunde öffnen
                            </DropdownMenuItem>
                          )}
                          {customer?.email && (
                            <DropdownMenuItem onClick={() => window.location.href = `mailto:${customer.email}`}>
                              ✉️ E-Mail
                            </DropdownMenuItem>
                          )}
                          {customer?.phone && (
                            <DropdownMenuItem onClick={() => window.location.href = `tel:${customer.phone}`}>
                              ☎️ Anrufen
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setStatusChanging(contract)}>Status ändern</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditing(contract); setShowForm(true) }}>
                            <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { if (confirm('Vertrag wirklich löschen?')) deleteMutation.mutate(contract.id) }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Documents panel */}
                  <div className={`px-4 pb-4 border-t border-border bg-muted/20 ${docsOpen ? '' : 'hidden'}`}>
                    <ContractDocumentsPanel contract={contract} />
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <StatusChangeDialog
        open={!!statusChanging}
        onOpenChange={(open) => { if (!open) setStatusChanging(null) }}
        statusDefinitions={statusDefs}
        currentStatus={statusChanging ? (statusChanging.custom_status || statusChanging.status || '').toLowerCase().trim() : ''}
        onSave={handleStatusChange}
        title="Vertragsstatus ändern"
      />

      <PolicyUploadWizard
        open={showUploadWizard}
        onClose={() => setShowUploadWizard(false)}
        customers={customers}
        organizations={organizations}
        onContractCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['contracts'] })
          queryClient.invalidateQueries({ queryKey: ['customers'] })
          queryClient.invalidateQueries({ queryKey: ['documents'] })
        }}
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Vertrag bearbeiten' : 'Neuer Vertrag'}</DialogTitle>
          </DialogHeader>
          <ContractForm
            contract={editing}
            customers={customers}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            saving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Verträge importieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">CSV- oder Excel-Datei</label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0])}
                className="mt-2 w-full p-2 border rounded"
              />
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-900 mb-2">📋 Erforderliche Spalten:</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-green-800">
                <div>
                  <span className="font-mono bg-green-100 px-2 py-1 rounded">customer_id</span>
                  <p className="text-green-700 mt-1">Kunden-ID (erforderlich)</p>
                </div>
                <div>
                  <span className="font-mono bg-green-100 px-2 py-1 rounded">insurer</span>
                  <p className="text-green-700 mt-1">Versicherer (erforderlich)</p>
                </div>
                <div>
                  <span className="font-mono bg-green-100 px-2 py-1 rounded">insurance_type</span>
                  <p className="text-green-700 mt-1">Versicherungsart (erforderlich)</p>
                </div>
                <div>
                  <span className="font-mono bg-green-100 px-2 py-1 rounded">organization_id</span>
                  <p className="text-green-700 mt-1">Org-ID (erforderlich)</p>
                </div>
              </div>
              <p className="text-xs text-green-700 mt-3 font-medium">Optional: policy_number, product, premium_yearly, premium_monthly, start_date, end_date, status</p>
            </div>
            {importProgress && (
              <div className="p-3 bg-muted rounded text-sm text-center">
                {importProgress}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowImport(false); setImportFile(null); setImportProgress(null); }}>
                Abbrechen
              </Button>
              <Button onClick={handleImport} disabled={!importFile || !!importProgress}>
                Importieren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}