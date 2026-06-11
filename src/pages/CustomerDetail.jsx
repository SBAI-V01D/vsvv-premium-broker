import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { useParams, useNavigate } from 'react-router-dom'
import html2pdf from 'html2pdf.js'
import { useAccessControl } from '@/hooks/useAccessControl'
import { Edit, Users, FileText, Clock, Shield, Bot, Tag, Building2, Calendar, Trash2, Plus, XCircle, Phone, Mail, MapPin, Smartphone, CreditCard, CheckCircle2 } from 'lucide-react'
import AiInsightsPanel from '../components/customers/AiInsightsPanel'
import ActivityTimeline from '../components/customers/ActivityTimeline'
import FamilyMemberCard from '../components/customers/FamilyMemberCard'
import HouseholdContractsCockpit from '../components/customers/HouseholdContractsCockpit'
import CustomerExecutiveHeader from '../components/customers/CustomerExecutiveHeader'
import { StandardModal, ActionMenu } from '@/components/shared'
import CustomerForm from '../components/customers/CustomerForm'
import DocumentsTab from '../components/documents/DocumentsTab'
import ContractForm from '../components/contracts/ContractForm'
import StatusChangeDialog from '@/components/status/StatusChangeDialog'
import { calculateCustomerHealthScore } from '@/lib/customerHealthScore'
import { useCustomerDetailDiagnose } from '@/components/customers/CustomerDetailDiagnose'
import { FAMILY_ROLE_LABELS, CIVIL_STATUS_LABELS, label } from '@/lib/labels'
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
import CustomerDetailDiagnose from '@/components/customers/CustomerDetailDiagnose'

export default function CustomerDetail() {
  const { customerId: id } = useParams()
  const navigate = useNavigate()
  const exportRef = useRef(null)
  const { checkCustomerAccess, isAdmin } = useAccessControl()
  const urlParams = new URLSearchParams(window.location.search)
  const backTo = urlParams.get('from') || '/kunden'
  const backLabel = backTo === '/neukunden' ? 'Neukunden' : backTo === '/kunden?view=private' ? 'Privatkunden' : backTo === '/kunden?view=business' ? 'Unternehmen' : 'Kundenübersicht'
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

  // Diagnose-Tool für Ladezeiten und Datenfluss
  const { diagnose, markLoaded, checkDataFlow } = useCustomerDetailDiagnose(id)

  // Globale Real-time Subscriptions sind in lib/query-client.js registriert —
  // keine lokale Subscription notwendig.

  // Fast: nur aktuellen Kunden laden
  const { data: customerDirect, isLoading: customerLoading, isSuccess: customerSuccess } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => base44.entities.Customer.filter({ id }, null, 1).then(r => r?.[0]),
    enabled: !!id,
    staleTime: 0,
  })

  // Track customer load time
  useEffect(() => {
    if (customerSuccess && id) markLoaded('customerLoaded')
  }, [customerSuccess, id])

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

  // primaryCustomerId FRÜH definieren
  const primaryCustomerId = customer?.is_family_member ? customer?.primary_customer_id : customer?.id

  // NUR den aktuellen Kunden laden (schnell)
  const { data: relatedContracts = [], isSuccess: contractsSuccess } = useQuery({
    queryKey: ['contracts', id],
    queryFn: () => base44.entities.Contract.filter({ customer_id: id, archived: false }),
    enabled: !!id,
    staleTime: 0,
  })

  useEffect(() => { if (contractsSuccess && id) markLoaded('contractsLoaded') }, [contractsSuccess, id])

  const { data: relatedApplications = [], isSuccess: applicationsSuccess } = useQuery({
    queryKey: ['applications', id],
    queryFn: () => base44.entities.Application.filter({ customer_id: id }),
    enabled: !!id,
    staleTime: 0,
  })

  useEffect(() => { if (applicationsSuccess && id) markLoaded('applicationsLoaded') }, [applicationsSuccess, id])

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => base44.entities.Message.filter({ customer_id: id }),
    enabled: !!id,
    staleTime: 60 * 1000,
  })

  const { data: relatedDocuments = [], isSuccess: documentsSuccess } = useQuery({
    queryKey: ['documents', id],
    queryFn: () => base44.entities.Document.filter({ customer_id: id }),
    enabled: !!id,
    staleTime: 0,
  })

  useEffect(() => { if (documentsSuccess && id) markLoaded('documentsLoaded') }, [documentsSuccess, id])

  const { data: statusDefs = [] } = useQuery({
    queryKey: ['statusDefinitions'],
    queryFn: () => base44.entities.StatusDefinition.filter({ type: 'contract' }),
    staleTime: 10 * 60 * 1000,
  })

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list(),
    staleTime: 10 * 60 * 1000,
  })

  const { data: custTasks = [] } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => base44.entities.Task.filter({ customer_id: id }),
    enabled: !!id,
    staleTime: 3 * 60 * 1000,
  })

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['verkaufschancen', id],
    queryFn: () => base44.entities.Verkaufschance.filter({ customer_id: id }),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })

  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const runAiAnalysis = async () => {
    setIsAnalyzing(true)
    try {
      // Bei Hauptkontakt: Analyse für gesamte Familie, bei Familienmitglied: nur individuell
      const analysisCustomerId = customer?.is_family_member ? id : primaryCustomerId
      const result = await base44.functions.invoke('aiCustomerInsights', { customer_id: analysisCustomerId })
      setAiAnalysis(result.data)
    } catch (error) {
      console.error('AI Analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Familienmitglieder: direkte Query, unabhängig von allCustomers
  const { data: familyMembersRaw = [] } = useQuery({
    queryKey: ['family', primaryCustomerId],
    queryFn: async () => {
      if (!primaryCustomerId) return []
      const [primary, members] = await Promise.all([
        base44.entities.Customer.filter({ id: primaryCustomerId }, null, 1),
        base44.entities.Customer.filter({ primary_customer_id: primaryCustomerId }),
      ])
      return [...(primary || []), ...(members || [])].filter((c, i, a) => a.findIndex(x => x.id === c.id) === i)
    },
    enabled: !!primaryCustomerId,
    staleTime: 0,
  })
  const familyMembers = familyMembersRaw.length > 0 ? familyMembersRaw : (customer ? [customer] : [])
  const householdMembers = familyMembers
  const primaryCustomer = familyMembers.find(c => c.id === primaryCustomerId) || customer
  // Verträge: nur direkte Kundenverträge
  const allHouseholdContracts = relatedContracts

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications', id] })
      setShowAppForm(false); setEditingApp(null)
    },
  })

  const updateAppMutation = useMutation({
    mutationFn: ({ id: aid, data }) => base44.entities.Application.update(aid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications', id] })
      setShowAppForm(false); setEditingApp(null)
    },
  })

  const updateContractMutation = useMutation({
    mutationFn: ({ id: cid, data }) => base44.entities.Contract.update(cid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', id] })
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
    { id: 'uebersicht', label: 'Stammdaten', icon: Shield },
    { id: 'vertraege', label: 'Verträge', icon: FileText, count: relatedContracts.length },
    { id: 'antraege', label: 'Anträge', icon: FileText, count: relatedApplications.length },
    { id: 'aufgaben', label: 'Aufgaben', icon: Clock, count: custTasks.filter(t => t.status !== 'completed').length },
    { id: 'dokumente', label: 'Dokumente', icon: FileText, count: relatedDocuments.length },
    { id: 'familie', label: 'Familie', icon: Users, count: familyMembers.length > 1 ? familyMembers.length : 0 },
    { id: 'betreuung', label: 'Betreuung', icon: Shield },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'beratungspotential', label: 'Beratungspotential', icon: Bot, count: verkaufschancen.length > 0 ? verkaufschancen.length : 0 },
  ]

  // Alter aus Geburtsdatum berechnen
  const calcAge = (birthdate) => {
    if (!birthdate) return null
    const birth = new Date(birthdate)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  // KK-Verträge aus relatedContracts ermitteln
  const kkContracts = relatedContracts.filter(c => {
    const t = (c.sparte || c.insurance_type || '').toLowerCase()
    return t.includes('health') || t.includes('kranken') || t.includes('kk') || t.includes('okp') || t.includes('grundversicherung')
  })
  const otherContracts = relatedContracts.filter(c => !kkContracts.includes(c))

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
        backTo={backTo}
        backLabel={backLabel}
      />



      {/* Sticky Nav + 360° Button */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border flex items-center gap-0">
        <div className="flex-1 overflow-x-auto scrollbar-none">
          <StickyNav items={NAV_ITEMS} active={activeSection} onChange={setActiveSection} />
        </div>
        <div className="shrink-0 px-4 border-l border-border">
          <button
            onClick={() => navigate(`/kunden/${id}/360`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            <Shield className="w-3 h-3" />
            360° Ansicht
          </button>
        </div>
      </div>

      {/* Content — increased vertical rhythm */}
      <div className="px-6 py-8 max-w-7xl mx-auto space-y-8">

        {/* ── Stammdaten (Hauptansicht) ──────────────────────────────── */}
        {activeSection === 'uebersicht' && (
          <div className="space-y-6">
            {/* Zeile 1: Persönliche Daten + Kontakt */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Persönliche Stammdaten */}
              <div className="surface p-6">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Persönliche Daten</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Vorname</p>
                      <p className="text-sm font-medium text-slate-800">{customer.first_name || '–'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Nachname</p>
                      <p className="text-sm font-medium text-slate-800">{customer.last_name || '–'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Geburtsdatum</p>
                      <p className="text-sm text-slate-700">{customer.birthdate ? formatDate(customer.birthdate) : '–'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Alter</p>
                      <p className="text-sm text-slate-700">{calcAge(customer.birthdate) !== null ? `${calcAge(customer.birthdate)} Jahre` : '–'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Familienstand</p>
                      <p className="text-sm text-slate-700">{customer.civil_status ? (CIVIL_STATUS_LABELS[customer.civil_status] || customer.civil_status) : '–'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Nationalität</p>
                      <p className="text-sm text-slate-700">{customer.nationality || '–'}</p>
                    </div>
                  </div>
                  {customer.profession && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Beruf</p>
                      <p className="text-sm text-slate-700">{customer.profession}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/40">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Kundenstatus</p>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded font-semibold ${
                        customer.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        customer.status === 'inactive' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {customer.status === 'active' ? 'Aktiv' : customer.status === 'inactive' ? 'Inaktiv' : 'Interessent'}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Mandat</p>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded font-semibold ${
                        customer.mandate_status === 'valid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        customer.mandate_status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-red-50 text-red-600 border border-red-200'
                      }`}>
                        {customer.mandate_status === 'valid' ? 'Gültig' : customer.mandate_status === 'pending' ? 'Ausstehend' : customer.mandate_status === 'expired' ? 'Abgelaufen' : 'Ungültig'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kontakt & Adresse */}
              <div className="surface p-6">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Kontakt & Adresse</h3>
                <div className="space-y-3">
                  {customer.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Telefon</p>
                        <a href={`tel:${customer.phone}`} className="text-sm text-primary hover:underline">{customer.phone}</a>
                      </div>
                    </div>
                  )}
                  {customer.mobile && (
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Mobile</p>
                        <a href={`tel:${customer.mobile}`} className="text-sm text-primary hover:underline">{customer.mobile}</a>
                      </div>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">E-Mail</p>
                        <EmailLink email={customer.email} className="text-sm" />
                      </div>
                    </div>
                  )}
                  {customer.street && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Adresse</p>
                        <p className="text-sm text-slate-700">{customer.street}</p>
                        {(customer.zip_code || customer.city) && (
                          <p className="text-sm text-slate-700">{[customer.zip_code, customer.city].filter(Boolean).join(' ')}</p>
                        )}
                        {customer.canton && <p className="text-xs text-muted-foreground">Kanton {customer.canton}</p>}
                      </div>
                    </div>
                  )}
                  {customer.bank_account && (
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">IBAN / Konto</p>
                        <p className="text-sm font-mono text-slate-700">{customer.bank_account}</p>
                      </div>
                    </div>
                  )}
                  {!customer.phone && !customer.mobile && !customer.email && !customer.street && (
                    <p className="text-xs text-muted-foreground">Keine Kontaktdaten hinterlegt</p>
                  )}
                </div>
              </div>
            </div>

            {/* Zeile 2: Versicherungsübersicht (KK) */}
            <div className="surface p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Versicherungsübersicht — Krankenkasse</h3>
                <button onClick={() => setActiveSection('vertraege')} className="text-xs text-primary hover:underline">
                  Alle Verträge →
                </button>
              </div>
              {kkContracts.length > 0 ? (
                <div className="space-y-3">
                  {kkContracts.map(c => (
                    <div key={c.id} className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50/40 border border-blue-100 rounded-xl">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Krankenkasse</p>
                        <p className="text-sm font-semibold text-slate-800">{c.insurer || '–'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Modell</p>
                        <p className="text-sm text-slate-700">{c.sparte_data?.model || c.product || '–'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Franchise</p>
                        <p className="text-sm text-slate-700">{c.sparte_data?.franchise ? `CHF ${c.sparte_data.franchise}` : '–'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Monatsprämie</p>
                        <p className="text-sm font-semibold text-slate-800">
                          {c.premium_monthly ? `CHF ${c.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '–'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-3">Keine Krankenversicherung erfasst</p>
              )}
              {/* Zusatzversicherungen */}
              {otherContracts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/40">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Zusatzversicherungen & weitere Policen ({otherContracts.length})</p>
                  <div className="space-y-2">
                    {otherContracts.map(c => (
                      <div key={c.id} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{c.insurer} {c.product ? `· ${c.product}` : ''}</p>
                            <p className="text-[10px] text-muted-foreground">{getSparteLabel(c.sparte || c.insurance_type)}</p>
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-slate-700">
                          {c.premium_monthly ? `CHF ${c.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}/M.` :
                           c.premium_yearly ? `CHF ${c.premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}/J.` : '–'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Zeile 3: Aktivitäten + Notizen + Haushalt */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Aktivitäten / Recent */}
              <div className="lg:col-span-2 surface p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Letzte Aktivitäten</h3>
                  <button onClick={() => setActiveSection('timeline')} className="text-xs text-primary hover:underline">Alle →</button>
                </div>
                <div className="space-y-2">
                  {[...relatedContracts.slice(0, 2).map(c => ({
                    type: 'Vertrag', label: `${c.insurer} · ${getSparteLabel(c.sparte || c.insurance_type)}`, date: c.start_date || c.created_date, icon: FileText,
                  })), ...relatedApplications.slice(0, 2).map(a => ({
                    type: 'Antrag', label: `${a.insurer} · ${getSparteLabel(a.sparte || a.insurance_type)}`, date: a.status_changed_at || a.created_date, icon: FileText,
                  })), ...custTasks.filter(t => t.status !== 'completed').slice(0, 2).map(t => ({
                    type: 'Aufgabe', label: t.title, date: t.due_date, icon: Clock,
                  }))]
                  .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                  .slice(0, 5)
                  .map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <item.icon className="w-3 h-3 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.type}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground shrink-0">{item.date ? formatDate(item.date) : ''}</p>
                    </div>
                  ))}
                  {relatedContracts.length === 0 && relatedApplications.length === 0 && custTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground">Keine Aktivitäten vorhanden</p>
                  )}
                </div>
              </div>

              {/* Notizen + Haushalt */}
              <div className="space-y-6">
                {customer.notes && (
                  <div className="surface p-5">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Notizen</h3>
                    <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{customer.notes}</p>
                  </div>
                )}
                <div className="surface p-5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Haushalt</h3>
                  {familyMembers.length > 1 ? (
                    <div className="space-y-2">
                      {familyMembers.filter(m => m.id !== id).map(member => (
                        <button
                          key={member.id}
                          onClick={() => navigate(`/kunden/${member.id}/detail`)}
                          className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors text-left"
                        >
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {member.first_name?.[0]}{member.last_name?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{member.first_name} {member.last_name}</p>
                            <p className="text-[10px] text-muted-foreground">{FAMILY_ROLE_LABELS[member.family_role] || 'Familie'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Keine Haushaltsmitglieder</p>
                  )}
                </div>
              </div>
            </div>
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
                         {(c.assigned_broker || c.advisor_id) && (
                           <p className="text-xs text-muted-foreground mt-0.5 truncate">
                             {(() => {
                               // assigned_broker kann E-Mail ODER Advisor-ID sein
                               const advisor = allAdvisors.find(a => a.id === c.assigned_broker || a.id === c.advisor_id)
                               return advisor?.email || c.assigned_broker || ''
                             })()}
                           </p>
                         )}
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

        {/* ── Aufgaben ─────────────────────────────────────────────── */}
        {activeSection === 'aufgaben' && (
          <EnterpriseCard noPad>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(var(--border-subtle))]">
              <p className="text-label">{custTasks.filter(t => t.status !== 'completed').length} offene Aufgaben</p>
              <button
                onClick={() => navigate('/aufgaben')}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80"
              >
                <Plus className="w-3.5 h-3.5" /> Alle Aufgaben
              </button>
            </div>
            {custTasks.filter(t => t.status !== 'completed').length === 0 ? (
              <EmptySection icon={Clock} title="Keine offenen Aufgaben" subtitle="Für diesen Kunden sind keine offenen Aufgaben vorhanden." />
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="hidden md:grid grid-cols-[2fr_1.5fr_1.5fr_1fr_auto] gap-3 px-4 py-2 border-b border-border bg-muted/30 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wide">
                  <div>Aufgabe</div><div>Fälligkeit</div><div>Priorität</div><div>Status</div><div className="w-20" />
                </div>
                {custTasks.filter(t => t.status !== 'completed').map((task, idx) => (
                  <div key={task.id} className={idx > 0 ? 'border-t border-border' : ''}>
                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1.5fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-muted/20 transition-colors">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{task.title}</p>
                        {task.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>}
                      </div>
                      <div>
                        {task.due_date && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span className={`text-xs font-medium ${
                              new Date(task.due_date) < new Date() ? 'text-red-600' : 'text-slate-600'
                            }`}>
                              {formatDate(task.due_date)}
                            </span>
                          </div>
                        )}
                        {!task.due_date && <span className="text-xs text-muted-foreground">–</span>}
                      </div>
                      <div>
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${
                          task.priority === 'urgent' ? 'bg-red-50 text-red-600' :
                          task.priority === 'high' ? 'bg-amber-50 text-amber-600' :
                          task.priority === 'low' ? 'bg-blue-50 text-blue-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {task.priority === 'urgent' ? 'Dringend' :
                           task.priority === 'high' ? 'Hoch' :
                           task.priority === 'low' ? 'Niedrig' : 'Mittel'}
                        </span>
                      </div>
                      <div>
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${
                          task.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {task.status === 'in_progress' ? 'In Arbeit' : 'Offen'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ActionMenu items={[
                          { label: 'Bearbeiten', icon: Edit, onClick: () => navigate(`/aufgaben?edit=${task.id}`) },
                          { label: 'Als erledigt markieren', icon: CheckCircle2, onClick: async () => {
                            await base44.entities.Task.update(task.id, { status: 'completed', completion_date: new Date().toISOString().split('T')[0] })
                            queryClient.invalidateQueries({ queryKey: ['tasks', id] })
                          }},
                        ]} />
                      </div>
                    </div>
                  </div>
                ))}
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
                {familyMembers.map(member => (
                  <FamilyMemberCard
                    key={member.id}
                    member={member}
                    memberContracts={allHouseholdContracts.filter(c => c.customer_id === member.id)}
                    onEdit={() => navigate(`/kunden/${member.id}`)}
                  />
                ))}
              </div>
              <HouseholdContractsCockpit contracts={allHouseholdContracts} familyMembers={familyMembers} />
            </div>
          )
        )}

        {/* ── Betreuung ─────────────────────────────────────────────── */}
        {activeSection === 'betreuung' && (
          <div className="space-y-6">
            <div className="surface p-5">
              <p className="text-xs font-semibold text-muted-foreground mb-4">
                <strong className="font-bold text-foreground">Zuständiger Berater:</strong> {(() => {
                  const aid = customer.primary_advisor_id || customer.advisor_id
                  const adv = allAdvisors.find(a => a.id === aid || a.email === aid)
                  return adv ? `${adv.firstname} ${adv.lastname} (${adv.email})` : 'Kein Berater im Kundenstamm hinterlegt'
                })()}
              </p>
              
              <p className="text-xs font-semibold text-muted-foreground mb-4">
                <strong className="font-bold text-foreground">Betreuungsteam:</strong> Alle Berater die in Verträgen oder Anträgen dieses Kunden eingetragen sind.
              </p>

              {relatedContracts.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Aus Verträgen ({relatedContracts.length})
                  </p>
                  <div className="space-y-1.5">
                    {relatedContracts.map(c => {
                      const adv = allAdvisors.find(a => a.id === c.advisor_id || a.email === c.advisor_id || a.id === c.assigned_broker || a.email === c.assigned_broker)
                      if (!adv) return null
                      return (
                        <div key={c.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                              {adv.firstname?.[0]}{adv.lastname?.[0]}
                            </div>
                            <div>
                              <p className="text-xs font-semibold">{adv.firstname} {adv.lastname}</p>
                              <p className="text-[10px] text-muted-foreground">{c.insurer} · {getSparteLabel(c.sparte || c.insurance_type)}</p>
                            </div>
                          </div>
                          {adv.phone && (
                            <a href={`tel:${adv.phone}`} className="p-1.5 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded transition-colors">
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {relatedApplications.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Aus Anträgen ({relatedApplications.length})
                  </p>
                  <div className="space-y-1.5">
                    {relatedApplications.map(a => {
                      const adv = allAdvisors.find(a2 => a2.id === a.advisor_id || a2.email === a.advisor_id || a2.id === a.assigned_broker || a2.email === a.assigned_broker)
                      if (!adv) return null
                      return (
                        <div key={a.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                              {adv.firstname?.[0]}{adv.lastname?.[0]}
                            </div>
                            <div>
                              <p className="text-xs font-semibold">{adv.firstname} {adv.lastname}</p>
                              <p className="text-[10px] text-muted-foreground">{a.insurer} · {getSparteLabel(a.sparte || a.insurance_type)}</p>
                            </div>
                          </div>
                          {adv.phone && (
                            <a href={`tel:${adv.phone}`} className="p-1.5 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded transition-colors">
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {relatedContracts.length === 0 && relatedApplications.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Keine Verträge oder Anträge vorhanden</p>
              )}
            </div>

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

        {/* ── Beratungspotential ────────────────────────────────────────────── */}
        {activeSection === 'beratungspotential' && (
          <div className="space-y-6">
            {/* KI Analyse Button */}
            <div className="surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">KI-Beratungsanalyse</h3>
                  <p className="text-xs text-muted-foreground">
                    {customer?.is_family_member 
                      ? 'Individuelle Analyse für diese Person'
                      : familyMembers.length > 1 
                        ? `Gesamtanalyse für ${familyMembers.length} Haushaltsmitglieder`
                        : 'Analyse für diesen Kunden'}
                  </p>
                </div>
                <button
                  onClick={runAiAnalysis}
                  disabled={isAnalyzing}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span className="text-sm font-medium">Analysiere...</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4" />
                      <span className="text-sm font-medium">Analyse starten</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* KI Analyse Ergebnisse */}
            {aiAnalysis && aiAnalysis.insights && (
              <div className="space-y-4">
                {/* Zusammenfassung */}
                <div className="surface p-4 border-l-4 border-l-primary">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-bold text-foreground">KI-Analyse Zusammenfassung</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${
                        aiAnalysis.insights.risk_level === 'kritisch' ? 'bg-red-50 text-red-600' :
                        aiAnalysis.insights.risk_level === 'hoch' ? 'bg-amber-50 text-amber-600' :
                        aiAnalysis.insights.risk_level === 'mittel' ? 'bg-blue-50 text-blue-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        Risiko: {aiAnalysis.insights.risk_level}
                      </span>
                      <span className="text-xs font-bold text-primary">Score: {aiAnalysis.insights.priority_score}/100</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 mb-3">{aiAnalysis.insights.summary}</p>
                  {aiAnalysis.insights.next_review_days && (
                    <p className="text-xs text-muted-foreground">
                      Nächster Review empfohlen in <span className="font-semibold">{aiAnalysis.insights.next_review_days} Tagen</span>
                    </p>
                  )}
                </div>

                {/* Risk Flags */}
                {aiAnalysis.insights.risk_flags && aiAnalysis.insights.risk_flags.length > 0 && (
                  <div className="surface p-4 border-l-4 border-l-red-500">
                    <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                      <span className="text-red-600">⚠</span> Kritische Hinweise
                    </h3>
                    <ul className="text-xs space-y-1">
                      {aiAnalysis.insights.risk_flags.map((flag, i) => (
                        <li key={i} className="text-red-700 flex items-start gap-1.5">
                          <span>•</span>
                          <span>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Deckungslücken */}
                {aiAnalysis.insights.coverage_gaps && aiAnalysis.insights.coverage_gaps.length > 0 && (
                  <div className="surface p-4">
                    <h3 className="text-sm font-bold text-foreground mb-3">Fehlende Deckungen</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {aiAnalysis.insights.coverage_gaps.map((gap, idx) => (
                        <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-xs font-bold text-amber-800 mb-1">{gap.coverage}</p>
                          <p className="text-xs text-amber-700 mb-2">{gap.reason}</p>
                          {gap.estimated_premium && (
                            <p className="text-xs text-amber-600 font-semibold">~CHF {gap.estimated_premium.toLocaleString('de-CH')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upsell Opportunities */}
                {aiAnalysis.insights.upsell_opportunities && aiAnalysis.insights.upsell_opportunities.length > 0 && (
                  <div className="surface p-4">
                    <h3 className="text-sm font-bold text-foreground mb-3">Upsell-Potenziale</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {aiAnalysis.insights.upsell_opportunities.map((opp, idx) => (
                        <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs font-bold text-green-800 mb-1">{opp.product}</p>
                          <p className="text-xs text-green-700 mb-2">{opp.reason}</p>
                          {opp.estimated_premium && (
                            <p className="text-xs text-green-600 font-semibold">~CHF {opp.estimated_premium.toLocaleString('de-CH')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sofortmassnahmen */}
                {aiAnalysis.insights.immediate_actions && aiAnalysis.insights.immediate_actions.length > 0 && (
                  <div className="surface p-4">
                    <h3 className="text-sm font-bold text-foreground mb-3">Sofortmassnahmen</h3>
                    <div className="space-y-2">
                      {aiAnalysis.insights.immediate_actions.map((action, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className={`w-2 h-2 rounded-full mt-1 ${
                            action.urgency === 'high' ? 'bg-red-500' :
                            action.urgency === 'medium' ? 'bg-amber-500' :
                            'bg-blue-500'
                          }`} />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-700">{action.action}</p>
                            {action.deadline && (
                              <p className="text-xs text-muted-foreground mt-1">Frist: {action.deadline}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Verkaufschancen aus Entity */}
            {verkaufschancen.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3">Erkannte Verkaufschancen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {verkaufschancen.map(chance => (
                    <div key={chance.id} className="surface p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-bold text-foreground">{chance.title}</h3>
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${
                          chance.priority === 'high' ? 'bg-red-50 text-red-600' :
                          chance.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          {chance.priority === 'high' ? 'Hoch' : chance.priority === 'medium' ? 'Mittel' : 'Niedrig'}
                        </span>
                      </div>
                      {chance.description && <p className="text-xs text-muted-foreground mb-2">{chance.description}</p>}
                      {chance.estimated_premium && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Potenzial:</span>
                          <span className="font-semibold text-green-600">CHF {chance.estimated_premium.toLocaleString('de-CH')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!aiAnalysis && verkaufschancen.length === 0 && (
              <EmptySection
                icon={Bot}
                title="Beratungspotential analysieren"
                subtitle="Klicke auf 'Analyse starten' um KI-gestützte Empfehlungen für diesen Kunden zu erhalten."
              />
            )}
          </div>
        )}

      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}
      <StandardModal open={showEdit} onOpenChange={setShowEdit} title="Kunde bearbeiten" size="lg" hideFooter>
        <div className="space-y-6">
          <CustomerForm
            customer={customer}
            primaryCustomers={allCustomers.filter(c => !c.is_family_member)}
            onSave={(data) => {
              const safeData = {
                ...data,
                organization_id: data.organization_id || customer.organization_id,
                assigned_advisors: customer.assigned_advisors,
                assigned_assistants: customer.assigned_assistants,
                primary_advisor_id: customer.primary_advisor_id,
                access_level: customer.access_level,
              }
              updateCustomerMutation.mutate({ id: customer.id, data: safeData })
            }}
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

      {/* Diagnose-Tool */}
      <CustomerDetailDiagnose customerId={id} diagnose={diagnose} checkDataFlow={checkDataFlow} />
    </div>
  )
}