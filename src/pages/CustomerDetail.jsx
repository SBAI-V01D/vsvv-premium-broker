import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import html2pdf from 'html2pdf.js'
import { useAccessControl } from '@/hooks/useAccessControl'
import { ArrowLeft, Plus, Edit, Mail, Phone, MapPin, LayoutDashboard, ExternalLink, MoreHorizontal, Landmark } from 'lucide-react'
import AiInsightsPanel from '../components/customers/AiInsightsPanel'
import ActivityTimeline from '../components/customers/ActivityTimeline'
import AutoAISummary from '../components/customers/AutoAISummary'
import FamilyOverviewPanel from '../components/customers/FamilyOverviewPanel'
import HouseholdContractsCockpit from '../components/customers/HouseholdContractsCockpit'
import HouseholdSummaryStats from '../components/customers/HouseholdSummaryStats'
import FamilyMemberCard from '../components/customers/FamilyMemberCard'
import HouseholdActionStrip from '../components/customers/HouseholdActionStrip'
import ContractsBySparteGroup from '../components/contracts/ContractsBySparteGroup'
import CoverageGapsPanel from '../components/contracts/CoverageGapsPanel'
import CustomerDashboardCompact from '../components/customers/CustomerDashboardCompact'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import CustomerForm from '../components/customers/CustomerForm'
import DocumentsTab from '../components/documents/DocumentsTab'
import ContractForm from '../components/contracts/ContractForm'
import StatusChangeDialog from '@/components/status/StatusChangeDialog'
import EmailLink from '../components/common/EmailLink'
import { STATUS_LABELS, INSURANCE_TYPE_LABELS, FAMILY_ROLE_LABELS, label } from '@/lib/labels'
import { getSparteLabel } from '@/lib/insuranceSparten'
import StatusBadge from '@/components/status/StatusBadge'
import PortalActivationPanel from '@/components/customers/PortalActivationPanel'
import AddFamilyMemberDialog from '@/components/customers/AddFamilyMemberDialog'
import AdvisorAssignmentPanel from '@/components/advisors/AdvisorAssignmentPanel'
import { Download, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { HouseholdPrintExport } from '@/components/customers/HouseholdPrintExport'

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
   const queryClient = useQueryClient()

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const { data: allAdvisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.list(),
  })

  // Prüfe Kundenzugriff
  useQuery({
    queryKey: ['customerAccess', id],
    queryFn: async () => {
      const canAccess = await checkCustomerAccess(id);
      setHasAccess(canAccess);
      setAccessChecked(true);
      if (!canAccess && !isAdmin) {
        navigate('/kunden');
      }
      return canAccess;
    },
    enabled: !!id,
  });

  const customer = allCustomers.find(x => x.id === id)

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(null, 1000),
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => base44.entities.Application.list(null, 1000),
  })

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => base44.entities.Message.filter({ customer_id: id }),
    enabled: !!id,
  })

  const { data: allDocuments = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list(null, 1000),
  })

  const { data: statusDefs = [] } = useQuery({
    queryKey: ['statusDefinitions'],
    queryFn: () => base44.entities.StatusDefinition.filter({ type: 'contract' }),
  })

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list(),
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list(null, 1000),
  })

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['verkaufschancen', id],
    queryFn: () => base44.entities.Verkaufschance.filter({ customer_id: id }),
    enabled: !!id,
  })

  const downloadPDFMutation = useMutation({
    mutationFn: async () => {
      if (!customer?.id) throw new Error('Kunde nicht geladen');
      if (!exportRef.current) throw new Error('Export-Container nicht gefunden');
      
      // Debug: prüfen ob Inhalt vorhanden ist
      console.log('PDF Export Container:', {
        hasRef: !!exportRef.current,
        innerHTML: exportRef.current?.innerHTML?.length || 0,
        textContent: exportRef.current?.textContent?.length || 0,
      });

      const element = exportRef.current;
      const opt = {
        margin: 10,
        filename: `Haushaltsübersicht_${customer.last_name}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' }
      };

      return new Promise((resolve, reject) => {
        html2pdf().set(opt).from(element).save().then(() => {
          console.log('PDF erfolgreich erstellt');
          resolve({ success: true });
        }).catch(err => {
          console.error('html2pdf Fehler:', err);
          reject(err);
        });
      });
    },
    onSuccess: () => {
      console.log('PDF-Download erfolgreich');
    },
    onError: (error) => {
      console.error('PDF-Generierung fehlgeschlagen:', error);
      alert(`PDF-Fehler: ${error.message}`);
    }
  })

  // Echter Hauptkontakt: immer stabil, unabhängig davon wer geöffnet ist
  const primaryCustomerId = customer?.is_family_member
    ? customer?.primary_customer_id
    : customer?.id
  const primaryCustomer = (Array.isArray(allCustomers) ? allCustomers : []).find(c => c.id === primaryCustomerId) || customer

  // Alle Haushaltsmitglieder: Hauptkontakt + alle seine Familienmitglieder
  const householdMembers = (Array.isArray(allCustomers) ? allCustomers : []).filter(c =>
    c.id === primaryCustomerId || c.primary_customer_id === primaryCustomerId
  )
  // familyMembers bleibt kompatibel (wird in bestehenden Komponenten genutzt)
  const familyMembers = householdMembers

  // Alle Verträge des gesamten Haushalts (für PDF & Hauptkontakt-Ansicht)
  const householdCustomerIds = householdMembers.map(m => m.id).filter(Boolean)
  const allHouseholdContracts = contracts.filter(c => householdCustomerIds.includes(c.customer_id))

  // Für Tab-Ansicht: Familienmitglied sieht nur eigene Verträge; Hauptkontakt sieht alle
  const customerIds = customer?.is_family_member
    ? [customer?.id].filter(Boolean)
    : householdCustomerIds
  const relatedContracts = contracts.filter(c => customerIds.includes(c.customer_id))
  const relatedApplications = applications.filter(a => customerIds.includes(a.customer_id))
  const relatedMessages = (Array.isArray(allCustomers) ? allCustomers : []).filter(c => customerIds.includes(c.id)).flatMap(c => c.messages || [])
  const relatedDocuments = allDocuments.filter(d => customerIds.includes(d.customer_id))
  const custTasks = tasks.filter(t => t.customer_id === customer?.id && ['open', 'in_progress', 'waiting'].includes(t.status))

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setShowEdit(false); },
  })

  const updateContractMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contracts'] }); setEditingContract(null); },
  })

  const handleContractSave = (data) => {
    if (editingContract) {
      updateContractMutation.mutate({ id: editingContract.id, data })
    }
  }

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
    queryClient.invalidateQueries({ queryKey: ['contracts'] })
    setStatusChangingContract(null)
  }

  if (!accessChecked) {
    return <div className="flex items-center justify-center h-64"><p>Prüfe Zugriff...</p></div>
  }

  if (!hasAccess) {
    return <div className="flex items-center justify-center h-64"><p className="text-destructive">Kein Zugriff auf diesen Kunden</p></div>
  }

  if (!customer) {
    return <div className="flex items-center justify-center h-64"><p>Laden...</p></div>
  }

  return (
    <div>
      <Link to="/kunden" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Zurück
      </Link>

      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
            {customer.company_name ? customer.company_name[0] : `${customer.first_name?.[0] || ''}${customer.last_name?.[0] || ''}`}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{customer.company_name || `${customer.first_name} ${customer.last_name}`}</h1>
              {customer.customer_number && (
                <span className="text-lg bg-primary/10 text-primary px-3 py-1 rounded-lg font-mono font-bold">
                  {customer.customer_number}
                </span>
              )}
            </div>
            {customer.company_name && (customer.contact_person_firstname || customer.contact_person_lastname) && (
              <p className="text-sm text-muted-foreground">Kontakt: {customer.contact_person_firstname} {customer.contact_person_lastname}</p>
            )}
            <p className="text-muted-foreground mt-1"><EmailLink email={customer.email} /></p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" onClick={() => navigate(`/kunden/${id}/360`)}>
            <LayoutDashboard className="w-4 h-4 mr-2" /> 360° Ansicht
          </Button>
          {!customer?.is_family_member && (
            <Button variant="outline" onClick={() => setShowAddFamilyMember(true)}>
              <Plus className="w-4 h-4 mr-2" /> Familienmitglied
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowEdit(true)}>
            <Edit className="w-4 h-4 mr-2" /> Bearbeiten
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 space-y-2">
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <EmailLink email={customer.email} />
              </div>
            )}
            {customer.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /> {customer.phone}</div>}
            {customer.mobile && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /> {customer.mobile}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            {customer.street && <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground" /> {customer.street}, {customer.zip_code} {customer.city}</div>}
            {customer.canton && <div className="text-sm text-muted-foreground">Kanton {customer.canton}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            {customer.birthdate && <div className="text-sm"><span className="text-muted-foreground">Geburtsdatum:</span> {new Date(customer.birthdate).toLocaleDateString('de-CH')}</div>}
            {customer.profession && <div className="text-sm"><span className="text-muted-foreground">Beruf:</span> {customer.profession}</div>}
            {customer.advisor_id && (() => {
              const advisor = allAdvisors.find(a => a.id === customer.advisor_id);
              return advisor ? <div className="text-sm"><span className="text-muted-foreground">Berater:</span> {advisor.firstname} {advisor.lastname}</div> : null;
            })()}
            <div className="text-sm"><span className="text-muted-foreground">Status:</span> {label(STATUS_LABELS, customer.status)}</div>
          </CardContent>
        </Card>
        {customer.bank_account && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Landmark className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-muted-foreground text-xs">Bank- oder Postkontoverbindung</div>
                  <div className="font-mono text-sm font-semibold">{customer.bank_account}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* HIDDEN EXPORT CONTAINER – Nur für PDF */}
      <div style={{ display: 'none' }}>
        <HouseholdPrintExport 
          ref={exportRef}
          customer={primaryCustomer}
          familyMembers={householdMembers.filter(m => m.id !== primaryCustomerId)}
          contracts={allHouseholdContracts}
          advisors={allAdvisors}
        />
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
          <TabsTrigger value="betreuung">👥 Betreuung</TabsTrigger>
          <TabsTrigger value="vertraege">Verträge ({relatedContracts.length})</TabsTrigger>
          <TabsTrigger value="antraege">Anträge ({relatedApplications.length})</TabsTrigger>
          <TabsTrigger value="familie">Familie ({familyMembers.length > 1 ? familyMembers.length - 1 : 0})</TabsTrigger>
          <TabsTrigger value="dokumente">Dokumente ({relatedDocuments.length})</TabsTrigger>
          <TabsTrigger value="kommunikation">Kommunikation</TabsTrigger>
          <TabsTrigger value="timeline">📜 Timeline</TabsTrigger>
          <TabsTrigger value="ki-analyse">🤖 KI-Analyse</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <div className="space-y-4">
            {/* Compact Dashboard - Priorisiert & Verdichtet */}
            <CustomerDashboardCompact
              customer={customer}
              familyMembers={familyMembers.filter(m => m.id !== id)}
              contracts={relatedContracts}
              tasks={custTasks}
              opportunities={verkaufschancen}
              onDownloadPDF={() => {
                if (!customer?.id) {
                  alert('Bitte warten Sie, bis alle Daten geladen sind.');
                  return;
                }
                downloadPDFMutation.mutate();
              }}
              onNewOpportunity={() => {/* TODO: open new opportunity dialog */}}
              onNewFamilyMember={() => {/* TODO: open add family member dialog */}}
              isDownloading={downloadPDFMutation.isPending}
            />

            {/* Weitere Details (einklappbar via Tabs) */}
            <Tabs defaultValue="contracts" className="mt-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="contracts">Verträge</TabsTrigger>
                <TabsTrigger value="family">Familie</TabsTrigger>
                <TabsTrigger value="cockpit">Cockpit</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="contracts" className="space-y-4">
                {relatedContracts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">📋 Bestands- & Beratungs-Cockpit</h3>
                    <div className="mb-4">
                      <CoverageGapsPanel 
                        contracts={relatedContracts}
                        onAddCoverage={(sparte) => {/* TODO: open new opportunity dialog with sparte */}}
                      />
                    </div>
                    <ContractsBySparteGroup 
                      contracts={relatedContracts}
                      familyMembers={familyMembers.filter(m => m.id !== id)}
                      primaryCustomer={customer}
                      onStartReview={(contract) => {/* TODO: start review workflow */}}
                      onCreateOpportunity={(contract) => {/* TODO: create opportunity from contract */}}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="family" className="space-y-4">
                {familyMembers.filter(m => m.id !== id).length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">👨‍👩‍👧‍👦 Haushalt ({familyMembers.length} Personen)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <Card className="p-4 border-l-4 border-l-primary bg-primary/5">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-sm">{customer.first_name} {customer.last_name}</h4>
                            <p className="text-xs text-muted-foreground">Hauptkontakt</p>
                          </div>
                          <Badge variant="outline" className="bg-green-100 text-green-700 border-0 text-xs">
                            ✓ Aktiv
                          </Badge>
                        </div>
                        {customer.birthdate && (
                          <p className="text-xs text-muted-foreground mb-2">
                            <strong>Geb.:</strong> {customer.birthdate}
                          </p>
                        )}
                      </Card>

                      {familyMembers.filter(m => m.id !== id).map(member => (
                        <FamilyMemberCard 
                          key={member.id}
                          member={member}
                          memberContracts={relatedContracts.filter(c => c.customer_id === member.id)}
                          onEdit={() => {/* TODO: open member detail */}}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="cockpit">
                <HouseholdContractsCockpit 
                  contracts={relatedContracts}
                  familyMembers={familyMembers.filter(m => m.id !== id)}
                />
              </TabsContent>

              <TabsContent value="timeline">
                <ActivityTimeline 
                  customer={customer}
                  documents={relatedDocuments}
                  contracts={relatedContracts}
                  tasks={custTasks}
                />
              </TabsContent>
            </Tabs>


          </div>
        </TabsContent>

        <TabsContent value="betreuung">
          <div className="space-y-4">
            <AdvisorAssignmentPanel customerId={id} />
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <ActivityTimeline
            customer={customer}
            contracts={relatedContracts}
            applications={relatedApplications}
            documents={relatedDocuments}
            tasks={tasks.filter(t => t.customer_id === customer?.id)}
            messages={relatedMessages}
            verkaufschancen={verkaufschancen}
            limit={50}
          />
        </TabsContent>

        <TabsContent value="vertraege">
          {relatedContracts.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Keine Verträge vorhanden</CardContent></Card>
          ) : (
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
                {relatedContracts.map((c, idx) => {
                  const relatedCustomer = (Array.isArray(allCustomers) ? allCustomers : []).find(x => x.id === c.customer_id)
                  const formatDate = (dateStr) => {
                    if (!dateStr) return '–'
                    return new Date(dateStr).toLocaleDateString('de-CH')
                  }
                  return (
                    <div key={c.id} className={idx > 0 ? 'border-t border-border' : ''}>
                      <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.2fr_1.2fr_1.2fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-muted/30 transition-colors">
                        {/* Kunde */}
                        <div className="min-w-0">
                          <p className="font-semibold text-xs truncate">{relatedCustomer ? (relatedCustomer.company_name || `${relatedCustomer.first_name} ${relatedCustomer.last_name}`) : c.customer_name}</p>
                          {relatedCustomer?.ahv_number && (
                            <p className="text-xs font-mono text-muted-foreground mt-0.5">{relatedCustomer.ahv_number}</p>
                          )}
                        </div>

                        {/* Versicherer / Sparte */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium truncate">{c.insurer}</p>
                          </div>
                          {c.sparte || c.insurance_type ? (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{getSparteLabel(c.sparte || c.insurance_type)}</p>
                          ) : null}
                          {c.sparte_data?.franchise && (
                            <p className="text-xs text-muted-foreground mt-0.5">Franchise: CHF {c.sparte_data.franchise}</p>
                          )}
                          {c.sparte_data?.model && (
                            <p className="text-xs text-muted-foreground mt-0.5">Modell: {c.sparte_data.model}</p>
                          )}
                        </div>

                        {/* Policen-Nr */}
                        <div className="min-w-0">
                          {c.policy_number && (
                            <p className="text-xs font-medium">{c.policy_number}</p>
                          )}
                          {!c.policy_number && <span className="text-xs text-muted-foreground">–</span>}
                        </div>

                        {/* Produkt / Tarif */}
                        <div className="min-w-0">
                          {c.product && (
                            <p className="text-xs font-medium">{c.product}</p>
                          )}
                          {!c.product && <span className="text-xs text-muted-foreground">–</span>}
                        </div>

                        {/* Vertragsdaten */}
                        <div>
                          {c.start_date && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-xs text-green-600 font-medium">{formatDate(c.start_date)}</span>
                            </div>
                          )}
                          {c.end_date && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-green-600 font-medium">{formatDate(c.end_date)}</span>
                            </div>
                          )}
                          {!c.start_date && !c.end_date && (
                            <span className="text-xs text-muted-foreground">–</span>
                          )}
                        </div>

                        {/* Jahresprämie */}
                        <div>
                          {c.premium_yearly ? (
                            <p className="text-xs font-semibold text-foreground">
                              CHF {c.premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/J.
                            </p>
                          ) : null}
                          {c.premium_monthly ? (
                            <p className="text-xs text-muted-foreground">
                              CHF {c.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/M.
                            </p>
                          ) : null}
                          {!c.premium_yearly && !c.premium_monthly && (
                            <span className="text-xs text-muted-foreground">–</span>
                          )}
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-2">
                          <button onClick={() => setStatusChangingContract(c)} className="hover:opacity-80 transition-opacity">
                            <StatusBadge statusDef={{ label: c.custom_status || label(STATUS_LABELS, c.status) }} label={c.custom_status || label(STATUS_LABELS, c.status)} />
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingContract(c)}>
                                <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setStatusChangingContract(c)}>Status ändern</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="antraege">
          {relatedApplications.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Keine Anträge vorhanden</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {relatedApplications.map(a => {
                const relatedCustomer = (Array.isArray(allCustomers) ? allCustomers : []).find(x => x.id === a.customer_id)
                const premiumMonthly = a.estimated_premium_monthly
                const premiumYearly = a.estimated_premium_yearly || (premiumMonthly ? Math.round(premiumMonthly * 12) : null)
                const ageGroup = a.sparte_data?.age_group
                const franchise = a.sparte_data?.franchise
                const model = a.sparte_data?.model
                const produkte = a.sparte_data?.produkte || []
                const productType = a.product || a.sparte_data?.product_type
                const statusKey = a.custom_status || a.status
                const statusColors = {
                  angenommen: 'bg-green-100 text-green-700',
                  policiert: 'bg-green-100 text-green-700',
                  approved: 'bg-green-100 text-green-700',
                  eingereicht: 'bg-blue-100 text-blue-700',
                  in_bearbeitung: 'bg-blue-100 text-blue-700',
                  in_pruefung: 'bg-amber-100 text-amber-700',
                  pruefung_erforderlich: 'bg-amber-100 text-amber-700',
                  abgelehnt: 'bg-red-100 text-red-700',
                }
                return (
                  <Card key={a.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{relatedCustomer ? (relatedCustomer.company_name || `${relatedCustomer.first_name} ${relatedCustomer.last_name}`) : a.customer_name}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm">{a.insurer || '–'}</p>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                {getSparteLabel(a.sparte || a.insurance_type) || a.insurance_type}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                            {franchise && <span>Franchise: CHF {franchise}</span>}
                            {model && <span>Modell: {model}</span>}
                            {a.contract_start_date && <span>ab {new Date(a.contract_start_date).toLocaleDateString('de-CH')}</span>}
                          </div>
                          {ageGroup && <p className="text-xs text-muted-foreground mt-1">{ageGroup}</p>}
                          {produkte.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {produkte.map((p, i) => (
                                <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {p.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {productType && (
                            <p className="text-xs text-muted-foreground mb-2">{productType}</p>
                          )}
                          {premiumMonthly && (
                            <p className="text-sm text-muted-foreground">CHF {premiumMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/M.</p>
                          )}
                          {premiumYearly && (
                            <p className="font-bold text-sm">CHF {premiumYearly.toLocaleString('de-CH', { minimumFractionDigits: 0 })}/J.</p>
                          )}
                          <p className="text-xs mt-1">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${statusColors[statusKey] || 'bg-muted text-muted-foreground'}`}>
                              {statusKey}
                            </span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="familie">
          {familyMembers.length <= 1 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Keine Familienmitglieder vorhanden
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {familyMembers.filter(m => m.id !== id).map(member => (
                <Card key={member.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{member.first_name} {member.last_name}</p>
                        <p className="text-sm text-muted-foreground mt-1"><EmailLink email={member.email} /> • {label(FAMILY_ROLE_LABELS, member.family_role)}</p>
                        <p className="text-xs text-muted-foreground mt-2">{member.city}, {member.canton}</p>
                      </div>
                      <a href={`/kunden/${member.id}`} className="text-primary hover:underline text-sm font-medium">
                        Öffnen →
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dokumente">
          <DocumentsTab
            customerId={id}
            customerName={`${customer.first_name} ${customer.last_name}`}
            contracts={relatedContracts}
          />
        </TabsContent>

        <TabsContent value="ki-analyse">
          <div className="max-w-lg">
            <AiInsightsPanel customerId={id} />
          </div>
        </TabsContent>

        <TabsContent value="kommunikation">
          {messages.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Keine Kommunikation vorhanden
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {messages.map(msg => (
                <Card key={msg.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium text-sm">{msg.sender_name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(msg.created_date).toLocaleDateString('de-CH')}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{msg.content}</p>
                    {msg.reference_title && (
                      <p className="text-xs bg-muted p-2 rounded">📎 Bezug: {msg.reference_title}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
         <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>Kunde bearbeiten</DialogTitle>
           </DialogHeader>
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
         </DialogContent>
       </Dialog>

       <Dialog open={!!editingContract} onOpenChange={(open) => { if (!open) setEditingContract(null) }}>
         <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>Vertrag bearbeiten</DialogTitle>
           </DialogHeader>
           <ContractForm
             contract={editingContract}
             customers={allCustomers}
             onSave={handleContractSave}
             onCancel={() => setEditingContract(null)}
             saving={updateContractMutation.isPending}
           />
         </DialogContent>
       </Dialog>

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