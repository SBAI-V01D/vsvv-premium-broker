import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { useParams, useNavigate } from 'react-router-dom'
import html2pdf from 'html2pdf.js'
import { useAccessControl } from '@/hooks/useAccessControl'
import { Edit, Users, FileText, Clock, Shield, Bot } from 'lucide-react'
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
import { HouseholdPrintExport } from '@/components/customers/HouseholdPrintExport'
import { StickyNav, EnterpriseCard, EmptySection, SectionHeader } from '@/components/ui/ds'
import EmailLink from '@/components/common/EmailLink'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const exportRef = useRef(null)
  const { checkCustomerAccess, isAdmin } = useAccessControl()
  const [showEdit, setShowEdit] = useState(false)
  const [editingContract, setEditingContract] = useState(null)
  const [statusChangingContract, setStatusChangingContract] = useState(null)
  const [showAddFamilyMember, setShowAddFamilyMember] = useState(false)
  const [accessChecked, setAccessChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [activeSection, setActiveSection] = useState('uebersicht')
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

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
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

  const customer = allCustomers.find(x => x.id === id)

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
      const customerType = data?.customer_type || customer?.customer_type
      if (customerType === 'business') {
        navigate('/kunden?filter=business', { replace: true })
      } else {
        navigate('/kunden?filter=private', { replace: true })
      }
    },
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
        onEdit={() => setShowEdit(true)}
        onAddFamilyMember={() => setShowAddFamilyMember(true)}
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
          relatedContracts.length === 0 ? (
            <EnterpriseCard>
              <EmptySection icon={FileText} title="Keine Verträge" subtitle="Noch keine Verträge für diesen Kunden erfasst." />
            </EnterpriseCard>
          ) : (
            <EnterpriseCard noPad>
              <div className="hidden md:grid grid-cols-[2fr_2fr_1.2fr_1.2fr_1.2fr_1fr_1fr_auto] gap-3 px-5 py-3 border-b border-[hsl(var(--border-subtle))] text-label">
                <div>Versicherter</div><div>Versicherer / Sparte</div><div>Policen-Nr</div>
                <div>Produkt</div><div>Laufzeit</div><div>Jahresprämie</div><div>Status</div><div className="w-16" />
              </div>
              {relatedContracts.map((c, idx) => (
                <div key={c.id} className={idx > 0 ? 'border-t border-[hsl(var(--border-subtle))]' : ''}>
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.2fr_1.2fr_1.2fr_1fr_1fr_auto] gap-3 px-5 py-4 items-center hover:bg-[hsl(var(--surface-2))]/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-body-sm font-semibold truncate">{customer.company_name || `${customer.first_name} ${customer.last_name}`}</p>
                      {customer.ahv_number && <p className="text-caption font-mono mt-0.5">{customer.ahv_number}</p>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-body-sm font-medium truncate">{c.insurer}</p>
                      {(c.sparte || c.insurance_type) && <p className="text-caption mt-0.5">{getSparteLabel(c.sparte || c.insurance_type)}</p>}
                      {c.sparte_data?.franchise && <p className="text-caption mt-0.5">Fr. {c.sparte_data.franchise}</p>}
                    </div>
                    <div><p className="text-body-sm">{c.policy_number || '–'}</p></div>
                    <div><p className="text-body-sm">{c.product || '–'}</p></div>
                    <div>
                      {c.start_date && <p className="text-caption text-emerald-600">{formatDate(c.start_date)}</p>}
                      {c.end_date && <p className="text-caption text-slate-500">{formatDate(c.end_date)}</p>}
                      {!c.start_date && !c.end_date && <span className="text-caption">–</span>}
                    </div>
                    <div>
                      {c.premium_yearly && <p className="text-body-sm font-semibold">CHF {c.premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 0 })}</p>}
                      {c.premium_monthly && <p className="text-caption">CHF {c.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 0 })}/M.</p>}
                      {!c.premium_yearly && !c.premium_monthly && <span className="text-caption">–</span>}
                    </div>
                    <div>
                      <button onClick={() => setStatusChangingContract(c)} className="hover:opacity-80 transition-opacity">
                        <StatusBadge
                          statusDef={statusDefs.find(s => s.key === (c.custom_status || '').toLowerCase().trim()) || statusDefs.find(s => s.key === (c.status || '').toLowerCase().trim())}
                          label={c.custom_status || c.status}
                        />
                      </button>
                    </div>
                    <ActionMenu items={[
                      { label: 'Bearbeiten', icon: Edit, onClick: () => setEditingContract(c) },
                      { label: 'Status ändern', onClick: () => setStatusChangingContract(c) },
                    ]} />
                  </div>
                </div>
              ))}
            </EnterpriseCard>
          )
        )}

        {/* ── Anträge ───────────────────────────────────────────────── */}
        {activeSection === 'antraege' && (
          relatedApplications.length === 0 ? (
            <EnterpriseCard>
              <EmptySection icon={FileText} title="Keine Anträge" subtitle="Noch keine Anträge für diesen Kunden vorhanden." />
            </EnterpriseCard>
          ) : (
            <EnterpriseCard noPad>
              <div className="hidden md:grid grid-cols-[2fr_2fr_1.2fr_1.2fr_1.2fr_1fr_1fr] gap-3 px-5 py-3 border-b border-[hsl(var(--border-subtle))] text-label">
                <div>Versicherter</div><div>Versicherer / Sparte</div><div>Policen-Nr</div>
                <div>Produkt</div><div>Laufzeit</div><div>Jahresprämie</div><div>Status</div>
              </div>
              {relatedApplications.map((a, idx) => {
                const premiumYearly = a.estimated_premium_yearly || (a.estimated_premium_monthly ? Math.round(a.estimated_premium_monthly * 12) : null)
                const statusColors = {
                  approved: 'bg-emerald-50 text-emerald-700', angenommen: 'bg-emerald-50 text-emerald-700',
                  in_progress: 'bg-blue-50 text-blue-700', waiting: 'bg-amber-50 text-amber-700',
                  rejected: 'bg-rose-50 text-rose-600',
                }
                const sk = a.custom_status || a.status
                return (
                  <div key={a.id} className={idx > 0 ? 'border-t border-[hsl(var(--border-subtle))]' : ''}>
                    <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.2fr_1.2fr_1.2fr_1fr_1fr] gap-3 px-5 py-4 items-center hover:bg-[hsl(var(--surface-2))]/40 transition-colors">
                      <div><p className="text-body-sm font-semibold truncate">{customer.company_name || `${customer.first_name} ${customer.last_name}`}</p></div>
                      <div>
                        <p className="text-body-sm font-medium truncate">{a.insurer || '–'}</p>
                        {(a.sparte || a.insurance_type) && <p className="text-caption mt-0.5">{getSparteLabel(a.sparte || a.insurance_type)}</p>}
                        {a.sparte_data?.franchise && <p className="text-caption mt-0.5">Fr. {a.sparte_data.franchise}</p>}
                      </div>
                      <div><p className="text-body-sm">{a.policy_number || '–'}</p></div>
                      <div><p className="text-body-sm">{a.product || '–'}</p></div>
                      <div>
                        {a.contract_start_date && <p className="text-caption text-emerald-600">{formatDate(a.contract_start_date)}</p>}
                        {a.contract_end_date && <p className="text-caption text-slate-500">{formatDate(a.contract_end_date)}</p>}
                        {!a.contract_start_date && !a.contract_end_date && <span className="text-caption">–</span>}
                      </div>
                      <div>
                        {premiumYearly ? <p className="text-body-sm font-semibold">CHF {premiumYearly.toLocaleString('de-CH', { minimumFractionDigits: 0 })}</p> : <span className="text-caption">–</span>}
                        {a.estimated_premium_monthly ? <p className="text-caption">CHF {a.estimated_premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 0 })}/M.</p> : null}
                      </div>
                      <div>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusColors[sk] || 'bg-slate-100 text-slate-600'}`}>{sk}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </EnterpriseCard>
          )
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