import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Edit, Trash2, FileText, Calendar, Building2, Tag, Download, Upload, User, AlertTriangle, XCircle, Zap, ExternalLink } from 'lucide-react'
import DateQualityBadge from '@/components/contracts/DateQualityBadge'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ContractForm from '../components/contracts/ContractForm'
import ContractDocumentsPanel from '../components/contracts/ContractDocumentsPanel'
import CancellationPanel from '../components/contracts/CancellationPanel'
import PolicyUploadWizard from '../components/contracts/PolicyUploadWizard'
import { getSparteLabel } from '@/lib/insuranceSparten'
import StatusBadge from '@/components/status/StatusBadge'
import StatusChangeDialog from '@/components/status/StatusChangeDialog'
import PageHeader from '@/components/shared/PageHeader'
import FilterBar from '@/components/shared/FilterBar'
import EmptyState from '@/components/shared/EmptyState'
import ActionMenu from '@/components/shared/ActionMenu'

export default function Contracts() {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [showUploadWizard, setShowUploadWizard] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [filterReviewOnly, setFilterReviewOnly] = useState(false)
  const [statusChanging, setStatusChanging] = useState(null)
  const [expandedDocs, setExpandedDocs] = useState(null)
  const [expandedCancellation, setExpandedCancellation] = useState(null)
  const [importFile, setImportFile] = useState(null)
  const [importProgress, setImportProgress] = useState(null)
  const queryClient = useQueryClient()

  const { data: statusDefs = [] } = useQuery({
    queryKey: ['statusDefinitions'],
    queryFn: () => base44.entities.StatusDefinition.filter({ type: 'contract' }),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.filter({ archived: false }, '-created_date', 500),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, '-created_date', 500),
    staleTime: 5 * 60 * 1000,
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list('-created_date', 200),
    staleTime: 5 * 60 * 1000,
  })

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list('-created_date', 50),
    staleTime: 10 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contract.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contracts'] }); setShowForm(false); setEditing(null) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contracts'] }); setShowForm(false); setEditing(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contract.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  })

  const getCustomer = (id) => customers.find(c => c.id === id)

  const filtered = contracts.filter(c => {
    if (filterReviewOnly && !c.requires_review) return false
    if (!search.trim()) return true
    const customer = getCustomer(c.customer_id)
    const customerFullName = customer ? `${customer.first_name} ${customer.last_name}` : ''
    const customerCompanyName = customer?.company_name || ''
    const searchStr = `${c.customer_name} ${customerFullName} ${customerCompanyName} ${c.insurer} ${c.policy_number} ${c.product || ''}`.toLowerCase()
    return searchStr.includes(search.toLowerCase())
  })

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
    if (dateStr.startsWith('9999')) return 'Unbegrenzt'
    return new Date(dateStr).toLocaleDateString('de-CH')
  }

  const handleImport = async () => {
    if (!importFile) return
    setImportProgress('Datei wird hochgeladen...')
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const uploadRes = await fetch('https://api.base44.com/upload', { method: 'POST', body: formData })
      const { file_url } = await uploadRes.json()
      const result = await base44.functions.invoke('importEntityData', { entity_name: 'Contract', file_url })
      setImportProgress(`✓ ${result.data.successful} Verträge importiert`)
      if (result.data.failed > 0) setImportProgress(prev => `${prev} (${result.data.failed} Fehler)`)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['contracts'] })
        setShowImport(false); setImportFile(null); setImportProgress(null)
      }, 2000)
    } catch (error) {
      setImportProgress(`✗ Fehler: ${error.message}`)
    }
  }

  const handleExport = () => {
    if (filtered.length === 0) return
    const headers = ['ID', 'Kunde', 'Sparte', 'Versicherer', 'Produkt', 'Jahresprämie', 'Gültig ab', 'Gültig bis', 'Status']
    const rows = filtered.map(c => [
      c.id, c.customer_name, getSparteLabel(c.sparte || c.insurance_type) || '',
      c.insurer, c.product || '', c.premium_yearly || '',
      c.start_date ? new Date(c.start_date).toLocaleDateString('de-CH') : '',
      c.end_date ? new Date(c.end_date).toLocaleDateString('de-CH') : '', c.status
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `vertraege_export_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  const reviewCount = contracts.filter(c => c.requires_review).length

  return (
    <div className="page-enter flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[hsl(var(--primary))] tracking-tight">Verträge ({filtered.length})</h1>
              <p className="text-xs text-muted-foreground">{contracts.length} Verträge insgesamt</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="w-4 h-4 mr-1.5" /> Export</Button>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}><Upload className="w-4 h-4 mr-1.5" /> Import</Button>
            <Button variant="outline" size="sm" onClick={() => setShowUploadWizard(true)}><FileText className="w-4 h-4 mr-1.5" /> Police</Button>
            <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="w-4 h-4 mr-1.5" /> Neuer Vertrag</Button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Suche (Kunde, Versicherer, Police...)" />

      {reviewCount > 0 && (
        <div className="px-0 mb-3">
          <button
            onClick={() => setFilterReviewOnly(f => !f)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              filterReviewOnly
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Datumsprüfung ausstehend ({reviewCount})
            {filterReviewOnly && ' — Filter aktiv'}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="p-0">
          <div className="hidden md:grid grid-cols-[2fr_2fr_1.5fr_1.2fr_1fr_1fr_auto] gap-3 px-4 py-2 border-b border-border bg-muted/30 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wide">
            <div>Kunde</div>
            <div>Sparte / Versicherer</div>
            <div>Produkt / Tarif</div>
            <div>Vertragsdaten</div>
            <div>Jahresprämie</div>
            <div>Status</div>
            <div className="w-20"></div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Keine Verträge gefunden"
              description={search ? 'Suche anpassen oder Filter zurücksetzen.' : 'Noch keine Verträge erfasst.'}
            />
          ) : (
            filtered.map((contract, idx) => {
              const docsOpen = expandedDocs === contract.id
              const cancellationOpen = expandedCancellation === contract.id
              const hasCancellation = contract.cancellation_status && contract.cancellation_status !== 'none'
              const customer = getCustomer(contract.customer_id)
              return (
                <div key={contract.id} className={idx > 0 ? 'border-t border-border' : ''}>
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.5fr_1.2fr_1fr_1fr_auto] gap-3 px-4 py-1.5 items-center hover:bg-muted/20 transition-colors group">
                    {/* Kunde */}
                    <div className="min-w-0">
                      <p className="font-semibold text-xs truncate">
                        {contract.customer_name || (customer ? `${customer.first_name} ${customer.last_name}` : '–')}
                      </p>
                      {customer?.ahv_number && (
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">{customer.ahv_number}</p>
                      )}
                    </div>

                    {/* Sparte / Versicherer */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-primary flex-shrink-0" />
                        <p className="text-xs font-medium truncate">{getSparteLabel(contract.sparte || contract.insurance_type)}</p>
                      </div>
                      {contract.product && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{contract.product}</p>
                      )}
                      {contract.insurer && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <p className="text-xs text-muted-foreground truncate">{contract.insurer}</p>
                        </div>
                      )}
                    </div>

                    {/* Produkt / Tarif */}
                    <div className="min-w-0 space-y-0.5">
                      {contract.policy_number && (
                        <p className="text-xs font-mono text-muted-foreground">{contract.policy_number}</p>
                      )}
                      {contract.product && (
                        <p className="text-xs font-medium truncate">{contract.product}</p>
                      )}
                      {contract.sparte_data?.franchise && (
                        <p className="text-xs text-muted-foreground">Franchise: CHF {contract.sparte_data.franchise}</p>
                      )}
                      {contract.sparte_data?.model && (
                        <p className="text-xs text-muted-foreground">Modell: {contract.sparte_data.model}</p>
                      )}
                      {Array.isArray(contract.sparte_data?.produkte) && contract.sparte_data.produkte.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {contract.sparte_data.produkte.map((p, i) => (
                            <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.name || p}</span>
                          ))}
                        </div>
                      )}
                      {!contract.product && !contract.policy_number && !contract.sparte_data?.franchise && !contract.sparte_data?.model && (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </div>

                    {/* Vertragsdaten */}
                    <div>
                      {contract.acceptance_date && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <Calendar className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          <span className="text-xs text-blue-600 font-medium">Annahme: {formatDate(contract.acceptance_date)}</span>
                        </div>
                      )}
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
                      {!contract.acceptance_date && !contract.start_date && !contract.end_date && (
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
                      {contract.requires_review && (
                        <DateQualityBadge
                          dateQualityStatus={contract.date_quality_status}
                          requiresReview={contract.requires_review}
                          variant="compact"
                        />
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedCancellation(cancellationOpen ? null : contract.id)}
                        className={`h-7 w-7 flex items-center justify-center rounded hover:bg-red-50 transition-colors ${
                          hasCancellation ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
                        }`}
                        title="Kündigung"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => setExpandedDocs(docsOpen ? null : contract.id)}
                        title="Dokumente"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <ActionMenu items={[
                        ...(contract.customer_id ? [
                      { label: 'Kunde 360°', icon: ExternalLink, onClick: () => navigate(`/kunden/${contract.customer_id}/360`) },
                      { label: 'Kunde öffnen', icon: User, onClick: () => navigate(`/kunden/${contract.customer_id}`) },
                    ] : []),
                        { label: 'Status ändern', onClick: () => setStatusChanging(contract) },
                        { label: 'Bearbeiten', icon: Edit, onClick: () => { setEditing(contract); setShowForm(true) } },
                        { label: 'Löschen', icon: Trash2, variant: 'destructive', separator: true, onClick: () => { if (confirm('Vertrag wirklich löschen?')) deleteMutation.mutate(contract.id) } },
                      ]} />
                    </div>
                  </div>

                  {/* Cancellation Panel */}
                  {cancellationOpen && (
                    <div className="px-4 pb-4 border-t border-border bg-red-50/20">
                      <div className="pt-3">
                        <CancellationPanel
                          contract={contract}
                          onUpdated={() => queryClient.invalidateQueries({ queryKey: ['contracts'] })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Documents panel */}
                  <div className={`px-4 pb-4 border-t border-border bg-muted/20 ${docsOpen ? '' : 'hidden'}`}>
                    <ContractDocumentsPanel contract={contract} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

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
                <div><span className="font-mono bg-green-100 px-2 py-1 rounded">customer_id</span><p className="text-green-700 mt-1">Kunden-ID (erforderlich)</p></div>
                <div><span className="font-mono bg-green-100 px-2 py-1 rounded">insurer</span><p className="text-green-700 mt-1">Versicherer (erforderlich)</p></div>
                <div><span className="font-mono bg-green-100 px-2 py-1 rounded">insurance_type</span><p className="text-green-700 mt-1">Versicherungsart (erforderlich)</p></div>
                <div><span className="font-mono bg-green-100 px-2 py-1 rounded">organization_id</span><p className="text-green-700 mt-1">Org-ID (erforderlich)</p></div>
              </div>
              <p className="text-xs text-green-700 mt-3 font-medium">Optional: policy_number, product, premium_yearly, premium_monthly, start_date, end_date, status</p>
            </div>
            {importProgress && (
              <div className="p-3 bg-muted rounded text-sm text-center">{importProgress}</div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowImport(false); setImportFile(null); setImportProgress(null); }}>Abbrechen</Button>
              <Button onClick={handleImport} disabled={!importFile || !!importProgress}>Importieren</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}