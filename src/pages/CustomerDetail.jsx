import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { useParams, useNavigate } from 'react-router-dom'
import html2pdf from 'html2pdf.js'
import { useAccessControl } from '@/hooks/useAccessControl'
import { Edit, Users, FileText, Clock, Shield, Bot, Tag, Building2, Calendar, Trash2, Plus, XCircle } from 'lucide-react'
import AiInsightsPanel from '../components/customers/AiInsightsPanel'
import ActivityTimeline from '../components/customers/ActivityTimeline'
import HouseholdContractsCockpit from '../components/customers/HouseholdContractsCockpit'
import FamilyMemberCard from '../components/customers/FamilyMemberCard'
import ContractsBySparteGroup from '../components/contracts/ContractsBySparteGroup'
import CoverageGapsPanel from '../components/contracts/CoverageGapsPanel'
import CustomerDashboardCompact from '../components/customers/CustomerDashboardCompact'
import CustomerExecutiveHeader from '../components/customers/CustomerExecutiveHeader'
import HealthScoreDetail from '../components/customers/HealthScoreDetail'
import HouseholdIntelligencePanel from '../components/customers/HouseholdIntelligencePanel'
import { StandardModal, ActionMenu } from '@/components/shared'
import CustomerForm from '../components/customers/CustomerForm'
import DocumentsTab from '../components/documents/DocumentsTab'
import ContractForm from '../components/contracts/ContractForm'
import StatusChangeDialog from '@/components/status/StatusChangeDialog'
import { calculateCustomerHealthScore } from '@/lib/customerHealthScore'
import { FAMILY_ROLE_LABELS, label } from '@/lib/labels'
import { getSparteLabel } from '@/lib/insuranceSparten'
import StatusBadge from '@/components/status/StatusBadge'
import PortalActivationPanel from '@/components/customers/PortalActivationPanel'
import AddFamilyMemberDialog from '@/components/customers/AddFamilyMemberDialog'
import AdvisorAssignmentPanel from '@/components/advisors/AdvisorAssignmentPanel'
import DateQualityBadge from '@/components/contracts/DateQualityBadge'
import ContractDocumentsPanel from '@/components/contracts/ContractDocumentsPanel'
import CancellationPanel from '@/components/contracts/CancellationPanel'
import ApplicationDocumentsPanel from '@/components/applications/ApplicationDocumentsPanel'
import ApplicationForm from '@/components/applications/ApplicationForm'
import { HouseholdPrintExport } from '@/components/customers/HouseholdPrintExport'
import CustomerStammdatenCard from '../components/customers/CustomerStammdatenCard'
import { StickyNav, EnterpriseCard, EmptySection, SectionHeader } from '@/components/ui/ds'
import EmailLink from '@/components/common/EmailLink'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const exportRef = useRef(null)
  const { checkCustomerAccess, isAdmin } = useAccessControl()
  const urlParams = new URLSearchParams(window.location.search)
  const [showEdit, setShowEdit] = useState(urlParams.get('edit') === 'true')
  const [editingContract, setEditingContract] = useState(null)
  const [statusChangingContract, setStatusChangingContract] = useState(null)
  const [showAddFamilyMember, setShowAddFamilyMember] = useState(false)
  const [accessChecked, setAccessChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [activeSection, setActiveSection] = useState('uebersicht')
  const [expandedContractDocs, setExpandedContractDocs] = useState(null)
  const [expandedContractCancellation, setExpandedContractCancellation] = useState(null)
  const [expandedApplicationDocs, setExpandedApplicationDocs] = useState(null)
  const [showAppForm, setShowAppForm] = useState(false)
  const [editingApp, setEditingApp] = useState(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribe = base44.entities.Contract.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        const cid = event.data?.customer_id
        if (cid) {
          queryClient.invalidateQueries({ queryKey: ['contracts', cid] })
          queryClient.invalidateQueries({ queryKey: ['household-contracts', cid] })
        }
      }
    })
    return unsubscribe
  }, [queryClient])

  // Fast: nur aktuellen Kunden laden
  const { data: customerDirect } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => base44.entities.Customer.filter({ id }, null, 1).then(r => r?.[0]),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })

  // Alle Kunden nur laden wenn ein Formular geöffnet wird
  const [needAllCustomers, setNeedAllCustomers] = useState(false)
  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
    enabled: needAllCustomers,
    staleTime: 5 * 60 * 1000,
  })

  const { data: allAdvisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.list(),
  })

  useQuery({
    queryKey: ['customerAccess', id],
    queryFn: async () => {
      const canAccess = await checkCustomerAccess(id)
      setHasAccess(canAccess)
      setAccessChecked(true)
      if (!canAccess && !isAdmin) navigate('/kunden')
      return canAccess
    },
    enabled: !!id,
  })

  const customer = customerDirect || allCustomers.find(x => x.id === id)

  const { data: relatedContracts = [] } = useQuery({
    queryKey: ['contracts', id],
    queryFn: () => base44.entities.Contract.filter({ customer_id: id, archived: false }),
    enabled: !!id,
  })

  const { data: relatedApplications = [] } = useQuery({
    queryKey: ['applications', id],
    queryFn: () => base44.entities.Application.filter({ customer_id: id }),
    enabled: !!id,
  })

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => base44.entities.Message.filter({ customer_id: id }),
    enabled: !!id,
  })

  const { data: relatedDocuments = [] } = useQuery({
    queryKey: ['documents', id],
    queryFn: () => base44.entities.Document.filter({ customer_id: id }),
    enabled: !!id,
  })

  const { data: statusDefs = [] } = useQuery({
    queryKey: ['statusDefinitions'],
    queryFn: () => base44.entities.StatusDefinition.filter({ type: 'contract' }),
  })

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list(),
  })

  const { data: custTasks = [] } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => base44.entities.Task.filter({ customer_id: id }),
    enabled: !!id,
  })

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['verkaufschancen', id],
    queryFn: () => base44.entities.Verkaufschance.filter({ customer_id: id }),
    enabled: !!id,
  })

  const primaryCustomerId = customer?.is_family_member ? customer?.primary_customer_id : customer?.id
  const primaryCustomer = allCustomers.find(c => c.id === primaryCustomerId) || customer
  const householdMembers = allCustomers.filter(c =>
    c.id === primaryCustomerId || c.primary_customer_id === primaryCustomerId
  )
  const familyMembers = householdMembers
  const householdCustomerIds = householdMembers.map(m => m.id).filter(Boolean)

  const { data: householdContractsExtra = [] } = useQuery({
    queryKey: ['household-contracts', primaryCustomerId],
    queryFn: async () => {
      const otherIds = householdCustomerIds.filter(mid => mid !== id)
      if (!otherIds.length) return []
      const results = await Promise.all(
        otherIds.map(mid => base44.entities.Contract.filter({ customer_id: mid, archived: false }))
      )
      return results.flat()
    },
    enabled: !!primaryCustomerId && householdCustomerIds.length > 1,
    staleTime: 5 * 60 * 1000,
  })

  const allHouseholdContracts = [...relatedContracts, ...householdContractsExtra]

  const downloadPDFMutation = useMutation({
    mutationFn: async () => {
      if (!exportRef.current) throw new Error('Export-Container nicht gefunden')
      const opt = {
        margin: 10,
        filename: `Haushaltsübersicht_${customer.last_name}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' }
      }
      return html2pdf().set(opt).from(exportRef.current).save()
    },
  })

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id: cid, data }) => base44.entities.Customer.update(cid, data),
    onSuccess: (_, { data }) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', id] })
      setShowEdit(false)
      navigate(`/kunden/${id}/360`, { replace: true })
    },
  })

  const createAppMutation = useMutation({
    mutationFn: (data) => base44.entities.Application.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['applications', id] }); setShowAppForm(false); setEditingApp(null) },
  })

  const updateAppMutation = useMutation({
    mutationFn: ({ id: aid, data }) => base44.entities.Application.update(aid, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['applications', id] }); setShowAppForm(false); setEditingApp(null) },
  })

  const updateContractMutation = useMutation({
    mutationFn: ({ id: cid, data }) => base44.entities.Contract.update(cid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', id] })
      queryClient.invalidateQueries({ queryKey: ['household-contracts', id] })
      setEditingContract(null)
    },
  })

  const handleContractStatusChange = async ({ status, statusDef, note, metadata }) => {
    if (!statusChangingContract) return
    const contract = statusChangingContract
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
    queryClient.invalidateQueries({ queryKey: ['contracts', id] })
    setStatusChangingContract(null)
  }

  if (!accessChecked && !hasAccess) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
  }
  if (!hasAccess) {
    return <div className="flex items-center justify-center h-64"><p className="text-destructive">Kein Zugriff auf diesen Kunden</p></div>
  }
  if (!customer) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
  }

  const formatDate = (d) => {
    if (!d) return '–'
    if (d.startsWith('9999')) return 'Unbegrenzt'
    return new Date(d).toLocaleDateString('de-CH')
  }

  const NAV_ITEMS = [
    { id: 'uebersicht', label: 'Übersicht', icon: Shield },
    { id: 'vertraege', label: 'Verträge', icon: FileText, count: relatedContracts.length },
    { id: 'antraege', label: 'Anträge', icon: FileText, count: relatedApplications.length },
    { id: 'dokumente', label: 'Dokumente', icon: FileText, count: relatedDocuments.length },
    { id: 'familie', label: 'Familie', icon: Users, count: familyMembers.length > 1 ? familyMembers.length - 1 : 0 },
    { id: 'betreuung', label: 'Betreuung', icon: Shield },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'ki-analyse', label: 'KI-Analyse', icon: Bot },
  ]

  return (
    <div className="min-h-screen bg-background -mx-6 -mt-6">
      {/* Hidden PDF export */}
      <div style={{ display: 'none' }}>
        <HouseholdPrintExport
          ref={exportRef}
          customer={primaryCustomer}
          familyMembers={householdMembers.filter(m => m.id !== primaryCustomerId)}
          contracts={allHouseholdContracts}
          advisors={allAdvisors.filter(a => a.id === (primaryCustomer?.advisor_id || customer?.advisor_id))}
          organization={organizations.find(o => o.id === (primaryCustomer?.organization_id || customer?.organization_id))}
        />
      </div>

      {/* Executive Header */}
      <CustomerExecutiveHeader
        customer={customer}
        contracts={relatedContracts}
        tasks={custTasks}
        documents={relatedDocuments}
        advisors={allAdvisors}
        onEdit={() => { setNeedAllCustomers(true); setShowEdit(true) }}
        onAddFamilyMember={() => { setNeedAllCustomers(true); setShowAddFamilyMember(true) }}
        onDownloadPDF={() => downloadPDFMutation.mutate()}
        isDownloading={downloadPDFMutation.isPending}
      />

      {/* Sticky Nav */}
      <StickyNav items={NAV_ITEMS} active={activeSection} onChange={setActiveSection} />

      {/* Content — increased vertical rhythm */}
      <div className="px-6 py-8 max-w-7xl mx-auto space-y-8">

        {/* ── Übersicht ─────────────────────────────────────────────── */}
        {activeSection === 'uebersicht' && (
          <div className="space-y-8">
            {/* Health Score — organisch eingebettet */}
            <div className="space-y-3">
              <SectionHeader
                title="Gesundheitsstatus"
                subtitle="Basierend auf Verträgen, Dokumenten, Tasks und Renewals"
              />
              <div className="relative">
                {(() => {
                  const health = calculateCustomerHealthScore(customer, relatedContracts, relatedDocuments, custTasks)
                  return (
                    <HealthScoreDetail
                      state={health.state}
                      score={health.score}
                      factors={health.factors}
                      showDetails
                    />
                  )
                })()}
              </div>
            </div>

            {/* Household Intelligence */}
            {(familyMembers.length > 1 || relatedContracts.length > 0) && (
              <div className="space-y-3">
                <SectionHeader
                  title="Haushalt & Beziehungen"
                  subtitle="Beziehungen, gemeinsame Policen und Cross-Selling Potenzial"
                />
                <HouseholdIntelligencePanel
                  primaryCustomer={primaryCustomer}
                  familyMembers={familyMembers.filter(m => m.id !== id)}
                  contracts={allHouseholdContracts}
                  opportunities={verkaufschancen}
                />
              </div>
            )}

            {/* Stammdaten */}
            <div className="space-y-3">
              <SectionHeader
                title="Stammdaten"
                subtitle="Persönliche Angaben, Kontakt und Finanzen"
              />
              <CustomerStammdatenCard customer={customer} />
            </div>

            <CustomerDashboardCompact
              customer={customer}
              familyMembers={familyMembers.filter(m => m.id !== id)}
              contracts={relatedContracts}
              tasks={custTasks}
              opportunities={verkaufschancen}
              onDownloadPDF={() => downloadPDFMutation.mutate()}
              onNewOpportunity={() => {}}
              onNewFamilyMember={() => setShowAddFamilyMember(true)}
              isDownloading={downloadPDFMutation.isPending}
            />
            {relatedContracts.length > 0 && (
              <div className="space-y-6">
                <CoverageGapsPanel contracts={relatedContracts} onAddCoverage={() => {}} />
                <ContractsBySparteGroup
                  contracts={relatedContracts}
                  familyMembers={familyMembers.filter(m => m.id !== id)}
                  primaryCustomer={customer}
                  onStartReview={() => {}}
                  onCreateOpportunity={() => {}}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Verträge ──────────────────────────────────────────────── */}
        {activeSection === 'vertraege' && (
          <EnterpriseCard noPad>
            {relatedContracts.length === 0 ? (
              <EmptySection icon={FileText} title="Keine Verträge" subtitle="Noch keine Verträge für diesen Kunden erfasst." />
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="hidden md:grid grid-cols-[2fr_2fr_1.5fr_1.2fr_1fr_1fr_auto] gap-3 px-4 py-2 border-b border-border bg-muted/30 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wide">
                  <div>Kunde</div><div>Sparte / Versicherer</div><div>Produkt / Tarif</div>
                  <div>Vertragsdaten</div><div>Jahresprämie</div><div>Status</div><div className="w-20" />
                </div>
                {relatedContracts.map((c, idx) => {
                  const docsOpen = expandedContractDocs === c.id
                  const cancellationOpen = expandedContractCancellation === c.id
                  const hasCancellation = c.cancellation_status && c.cancellation_status !== 'none'
                  return (
                    <div key={c.id} className={idx > 0 ? 'border-t border-border' : ''}>
                      <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.5fr_1.2fr_1fr_1fr_auto] gap-3 px-4 py-1.5 items-center hover:bg-muted/20 transition-colors">
                        <div className="min-w-0">
                          <p className="font-semibold text-xs truncate">{customer.company_name || `${customer.first_name} ${customer.last_name}`}</p>
                          {customer.ahv_number && <p className="text-xs font-mono text-muted-foreground mt-0.5">{customer.ahv_number}</p>}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3 h-3 text-primary flex-shrink-0" />
                            <p className="text-xs font-medium truncate">{getSparteLabel(c.sparte || c.insurance_type)}</p>
                          </div>
                          {c.insurer && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <p className="text-xs text-muted-foreground truncate">{c.insurer}</p>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          {c.policy_number && <p className="text-xs font-mono text-muted-foreground">{c.policy_number}</p>}
                          {c.product && <p className="text-xs font-medium truncate">{c.product}</p>}
                          {c.sparte_data?.franchise && <p className="text-xs text-muted-foreground">Franchise: CHF {c.sparte_data.franchise}</p>}
                          {c.sparte_data?.model && <p className="text-xs text-muted-foreground">Modell: {c.sparte_data.model}</p>}
                          {!c.product && !c.policy_number && <span className="text-xs text-muted-foreground">–</span>}
                        </div>
                        <div>
                          {c.start_date && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <Calendar className="w-3 h-3 text-green-600 flex-shrink-0" />
                              <span className="text-xs text-green-600 font-medium">{formatDate(c.start_date)}</span>
                            </div>
                          )}
                          {c.end_date && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-green-600 flex-shrink-0" />
                              <span className="text-xs text-green-600 font-medium">{formatDate(c.end_date)}</span>
                            </div>
                          )}
                          {!c.start_date && !c.end_date && <span className="text-xs text-muted-foreground">–</span>}
                        </div>
                        <div>
                          {c.premium_yearly ? <p className="text-xs font-semibold">CHF {c.premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/J.</p> : null}
                          {c.premium_monthly ? <p className="text-xs text-muted-foreground">CHF {c.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/M.</p> : null}
                          {!c.premium_yearly && !c.premium_monthly && <span className="text-xs text-muted-foreground">–</span>}
                        </div>
                        <div>
                          <button onClick={() => setStatusChangingContract(c)} className="hover:opacity-80 transition-opacity mb-1">
                            <StatusBadge
                              statusDef={statusDefs.find(s => s.key === (c.custom_status || '').toLowerCase().trim()) || statusDefs.find(s => s.key === (c.status || '').toLowerCase().trim())}
                              label={c.custom_status || c.status}
                            />
                          </button>
                          {c.requires_review && (
                            <DateQualityBadge dateQualityStatus={c.date_quality_status} requiresReview={c.requires_review} variant="compact" />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setExpandedContractCancellation(cancellationOpen ? null : c.id)}
                            className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${
                              hasCancellation ? 'text-red-500 hover:bg-red-50' : 'text-muted-foreground hover:bg-muted'
                            }`}
                            title="Kündigung"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setExpandedContractDocs(docsOpen ? null : c.id)}
                            className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground"
                            title="Dokumente"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <ActionMenu items={[
                            { label: 'Bearbeiten', icon: Edit, onClick: () => { setNeedAllCustomers(true); setEditingContract(c) } },
                            { label: 'Status ändern', onClick: () => setStatusChangingContract(c) },
                          ]} />
                        </div>
                      </div>
                      {cancellationOpen && (
                        <div className="px-4 pb-4 border-t border-border bg-red-50/20">
                          <div className="pt-3">
                            <CancellationPanel
                              contract={c}
                              onUpdated={() => queryClient.invalidateQueries({ queryKey: ['contracts', id] })}
                            />
                          </div>
                        </div>
                      )}
                      {docsOpen && (
                        <div className="px-4 pb-4 border-t border-border bg-muted/20">
                          <ContractDocumentsPanel contract={c} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </EnterpriseCard>
        )}

        {/* ── Anträge ───────────────────────────────────────────────── */}
        {activeSection === 'antraege' && (
          <EnterpriseCard noPad>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(var(--border-subtle))]">
              <p className="text-label">{relatedApplications.length} Anträge</p>
              <button
                onClick={() => { setEditingApp(null); setShowAppForm(true); }}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80"
              >
                <Plus className="w-3.5 h-3.5" /> Neuer Antrag
              </button>
            </div>
            {relatedApplications.length === 0 ? (
              <EmptySection icon={FileText} title="Keine Anträge" subtitle="Noch keine Anträge für diesen Kunden vorhanden." />
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="hidden md:grid grid-cols-[2fr_2fr_1.5fr_1.2fr_1fr_1fr_auto] gap-3 px-4 py-2 border-b border-border bg-muted/30 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wide">
                  <div>Kunde / Berater</div><div>Sparte / Versicherer</div><div>Produkt / Tarif</div>
                  <div>Vertragsdaten</div><div>Jahresprämie</div><div>Status</div><div className="w-20" />
                </div>
                {relatedApplications.map((a, idx) => {
                  const docsOpen = expandedApplicationDocs === a.id
                  const appStatus = (a.custom_status || a.status || '').toLowerCase().trim()
                  const appStatusDef = statusDefs.find(s => s.key === appStatus)
                  const ACCEPTED_KEYS = ['angenommen', 'policiert', 'approved', 'angenommen_vorbehalt', 'bewilligung_erteilt']
                  const OPEN_KEYS = ['neu', 'new', 'eingereicht', 'in_pruefung', 'rueckfrage', 'vorbehalt', 'risikopruefung', 'under_review', 'in_progress']
                  return (
                    <div key={a.id} className={idx > 0 ? 'border-t border-border' : ''}>
                      <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.5fr_1.2fr_1fr_1fr_auto] gap-3 px-4 py-1.5 items-center hover:bg-muted/20 transition-colors">
                        <div className="min-w-0">
                          <p className="font-semibold text-xs truncate">{customer.company_name || `${customer.first_name} ${customer.last_name}`}</p>
                          {customer.ahv_number && <p className="text-xs font-mono text-muted-foreground mt-0.5">{customer.ahv_number}</p>}
                          {a.assigned_broker && <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.assigned_broker}</p>}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3 h-3 text-primary flex-shrink-0" />
                            <p className="text-xs font-medium truncate">{getSparteLabel(a.sparte || a.insurance_type)}</p>
                          </div>
                          {a.insurer && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <p className="text-xs text-muted-foreground truncate">{a.insurer}</p>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          {a.product && <p className="text-xs font-medium truncate">{a.product}</p>}
                          {a.policy_number && <p className="text-xs font-mono text-muted-foreground">Police: {a.policy_number}</p>}
                          {a.sparte_data?.franchise && <p className="text-xs text-muted-foreground">Fr. {a.sparte_data.franchise}</p>}
                          {!a.product && !a.policy_number && <span className="text-xs text-muted-foreground">–</span>}
                        </div>
                        <div>
                          {(a.contract_start_date || a.requested_start_date) && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <Calendar className="w-3 h-3 text-green-600 flex-shrink-0" />
                              <span className="text-xs text-green-600 font-medium">{formatDate(a.contract_start_date || a.requested_start_date)}</span>
                            </div>
                          )}
                          {a.contract_end_date && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-green-600 flex-shrink-0" />
                              <span className="text-xs text-green-600 font-medium">{formatDate(a.contract_end_date)}</span>
                            </div>
                          )}
                          {!a.contract_start_date && !a.requested_start_date && !a.contract_end_date && <span className="text-xs text-muted-foreground">–</span>}
                        </div>
                        <div>
                          {a.estimated_premium_yearly ? <p className="text-xs font-semibold">CHF {a.estimated_premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/J.</p> : null}
                          {a.estimated_premium_monthly ? <p className="text-xs text-muted-foreground">CHF {a.estimated_premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/M.</p> : null}
                          {!a.estimated_premium_yearly && !a.estimated_premium_monthly && <span className="text-xs text-muted-foreground">–</span>}
                        </div>
                        <div>
                          <button onClick={() => setStatusChangingContract(null)} className="hover:opacity-80 transition-opacity mb-1">
                            <StatusBadge statusDef={appStatusDef} label={appStatusDef?.label || appStatus} />
                          </button>
                          {OPEN_KEYS.includes(appStatus) && (
                            <button
                              onClick={async () => {
                                const result = await base44.functions.invoke('acceptApplicationAndCreateContract', { application_id: a.id })
                                if (result.data?.success) {
                                  queryClient.invalidateQueries({ queryKey: ['applications', id] })
                                  queryClient.invalidateQueries({ queryKey: ['contracts', id] })
                                }
                              }}
                              className="text-xs px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-semibold"
                            >
                              ✓ Annehmen
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setExpandedApplicationDocs(docsOpen ? null : a.id)}
                            className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground"
                            title="Dokumente"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <ActionMenu items={[
                            { label: 'Bearbeiten', icon: Edit, onClick: () => { setNeedAllCustomers(true); setEditingApp(a); setShowAppForm(true) } },
                          ]} />
                        </div>
                      </div>
                      {docsOpen && (
                        <div className="px-4 pb-4 border-t border-border bg-muted/20">
                          <ApplicationDocumentsPanel application={a} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </EnterpriseCard>
        )}

        {/* ── Dokumente ─────────────────────────────────────────────── */}
        {activeSection === 'dokumente' && (
          <DocumentsTab
            customerId={id}
            customerName={`${customer.first_name} ${customer.last_name}`}
            contracts={relatedContracts}
          />
        )}

        {/* ── Familie ───────────────────────────────────────────────── */}
        {activeSection === 'familie' && (
          familyMembers.length <= 1 ? (
            <EnterpriseCard>
              <EmptySection icon={Users} title="Keine Familienmitglieder" subtitle="Noch keine Familienmitglieder für diesen Haushalt erfasst." />
            </EnterpriseCard>
          ) : (
            <div className="space-y-6">
              <SectionHeader title={`Haushalt · ${familyMembers.length} Personen`} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {familyMembers.filter(m => m.id !== id).map(member => (
                  <FamilyMemberCard
                    key={member.id}
                    member={member}
                    memberContracts={relatedContracts.filter(c => c.customer_id === member.id)}
                    onEdit={() => navigate(`/kunden/${member.id}`)}
                  />
                ))}
              </div>
              <HouseholdContractsCockpit contracts={relatedContracts} familyMembers={familyMembers.filter(m => m.id !== id)} />
            </div>
          )
        )}

        {/* ── Betreuung ─────────────────────────────────────────────── */}
        {activeSection === 'betreuung' && (
          <div className="space-y-6">
            <AdvisorAssignmentPanel customerId={id} />
          </div>
        )}

        {/* ── Timeline ──────────────────────────────────────────────── */}
        {activeSection === 'timeline' && (
          <div className="max-w-3xl">
            <ActivityTimeline
              customer={customer}
              contracts={relatedContracts}
              applications={relatedApplications}
              documents={relatedDocuments}
              tasks={custTasks}
              messages={[]}
              verkaufschancen={verkaufschancen}
              limit={50}
            />
          </div>
        )}

        {/* ── KI-Analyse ────────────────────────────────────────────── */}
        {activeSection === 'ki-analyse' && (
          <div className="max-w-3xl">
            <AiInsightsPanel customerId={id} />
          </div>
        )}

      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}
      <StandardModal open={showEdit} onOpenChange={setShowEdit} title="Kunde bearbeiten" size="lg" hideFooter>
        <div className="space-y-6">
          <CustomerForm
            customer={customer}
            primaryCustomers={allCustomers.filter(c => !c.is_family_member)}
            onSave={(data) => updateCustomerMutation.mutate({ id: customer.id, data })}
            onCancel={() => setShowEdit(false)}
            saving={updateCustomerMutation.isPending}
          />
          <div className="border-t pt-6">
            <PortalActivationPanel customer={customer} />
          </div>
        </div>
      </StandardModal>

      <StandardModal open={!!editingContract} onOpenChange={(open) => { if (!open) setEditingContract(null) }} title="Vertrag bearbeiten" size="lg" hideFooter>
        <ContractForm
          contract={editingContract}
          customers={allCustomers}
          onSave={(data) => updateContractMutation.mutate({ id: editingContract.id, data })}
          onCancel={() => setEditingContract(null)}
          saving={updateContractMutation.isPending}
        />
      </StandardModal>

      <StandardModal open={showAppForm} onOpenChange={setShowAppForm} title={editingApp ? 'Antrag bearbeiten' : 'Neuer Antrag'} size="lg" hideFooter>
        <ApplicationForm
          application={editingApp}
          customers={allCustomers}
          brokers={[]}
          onSave={(data) => {
            if (editingApp) updateAppMutation.mutate({ id: editingApp.id, data })
            else createAppMutation.mutate({ ...data, customer_id: id, customer_name: `${customer?.first_name} ${customer?.last_name}` })
          }}
          onCancel={() => { setShowAppForm(false); setEditingApp(null) }}
          saving={createAppMutation.isPending || updateAppMutation.isPending}
        />
      </StandardModal>

      <StatusChangeDialog
        open={!!statusChangingContract}
        onOpenChange={(open) => { if (!open) setStatusChangingContract(null) }}
        statusDefinitions={statusDefs}
        currentStatus={statusChangingContract ? (statusChangingContract.custom_status || statusChangingContract.status || '').toLowerCase().trim() : ''}
        onSave={handleContractStatusChange}
        title="Vertragsstatus ändern"
      />

      <AddFamilyMemberDialog
        customer={customer}
        open={showAddFamilyMember}
        onOpenChange={setShowAddFamilyMember}
      />
    </div>
  )
}