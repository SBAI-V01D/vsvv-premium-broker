import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Users, FileText, TrendingUp, Wallet, UserCheck, Building2,
  Target, Clock, CheckCircle2, AlertTriangle, RefreshCw, ArrowRight,
  ChevronRight
} from 'lucide-react'
import RevenueChart from '@/components/dashboard/RevenueChart'
import TopAdvisors from '@/components/dashboard/TopAdvisors'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import FinanceWidget from '@/components/dashboard/FinanceWidget'
import RenewalPipelineKanbanV2 from '@/components/dashboard/RenewalPipelineKanbanV2'
import SupportSection from '@/components/dashboard/SupportSection'

// ── Small KPI tile ─────────────────────────────────────────────────────────
function KpiTile({ label, value, sub, icon: Icon, accent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left w-full p-4 rounded-xl border bg-card shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 border-l-4 ${accent}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-bold mt-1 leading-none">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        {Icon && <Icon className="w-5 h-5 text-muted-foreground/60 flex-shrink-0 mt-0.5 group-hover:text-primary transition-colors" />}
      </div>
    </button>
  )
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, onNavigate, badge }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {badge && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">{badge}</span>}
        {onNavigate && (
          <button type="button" onClick={onNavigate} className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
            Alle <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [selectedTask, setSelectedTask] = useState(null)
  const [formData, setFormData] = useState({ status: '', notes: '', due_date: '' })
  const [filterOrg, setFilterOrg] = useState('all')
  const [filterAdvisor, setFilterAdvisor] = useState('all')
  const queryClient = useQueryClient()

  // ── Data fetching ──
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() })
  const { data: leads = [] } = useQuery({ queryKey: ['leads'], queryFn: () => base44.entities.Lead.list() })
  const { data: contracts = [] } = useQuery({ queryKey: ['contracts'], queryFn: () => base44.entities.Contract.list() })
  const { data: applications = [] } = useQuery({ queryKey: ['applications'], queryFn: () => base44.entities.Application.list() })
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => base44.entities.Task.list() })
  const { data: advisors = [] } = useQuery({ queryKey: ['advisors'], queryFn: () => base44.entities.Advisor.list() })
  const { data: organizations = [] } = useQuery({ queryKey: ['organizations'], queryFn: () => base44.entities.Organization.list() })
  const { data: commissionEntries = [] } = useQuery({ queryKey: ['commissionEntries'], queryFn: () => base44.entities.CommissionEntry.list() })
  const { data: documents = [] } = useQuery({ queryKey: ['documents'], queryFn: () => base44.entities.Document.list() })

  // ── Filters ──
  const filteredAdvisors = useMemo(() =>
    filterOrg === 'all' ? advisors : advisors.filter(a => a.organization_id === filterOrg),
    [advisors, filterOrg]
  )
  const filteredAdvisorEmails = useMemo(() => new Set(filteredAdvisors.map(a => a.email)), [filteredAdvisors])
  const activeAdvisorEmail = filterAdvisor === 'all' ? null : filterAdvisor

  const filteredContracts = useMemo(() => {
    let c = contracts
    if (filterOrg !== 'all') c = c.filter(x => filteredAdvisorEmails.has(x.assigned_broker))
    if (activeAdvisorEmail) c = c.filter(x => x.assigned_broker === activeAdvisorEmail)
    return c
  }, [contracts, filterOrg, filteredAdvisorEmails, activeAdvisorEmail])

  const filteredCommissions = useMemo(() => {
    let c = commissionEntries
    if (filterOrg !== 'all') c = c.filter(x => filteredAdvisorEmails.has(x.broker_email))
    if (activeAdvisorEmail) c = c.filter(x => x.broker_email === activeAdvisorEmail)
    return c
  }, [commissionEntries, filterOrg, filteredAdvisorEmails, activeAdvisorEmail])

  // ── KPI Calculations ──
  const activeContracts = filteredContracts.filter(c => c.status === 'active')
  const totalMonthlyPremium = activeContracts.reduce((sum, c) => sum + (c.premium_monthly || 0), 0)
  const totalYearlyPremium = activeContracts.reduce((sum, c) => sum + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)
  const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress')
  const pendingApplications = applications.filter(a => ['draft', 'submitted', 'under_review'].includes(a.status))

  // True leads (not yet converted to active customers)
  const activeContractCustomerIds = useMemo(() =>
    new Set(activeContracts.map(c => c.customer_id).filter(Boolean)),
    [activeContracts]
  )
  const trueLeads = useMemo(() =>
    leads.filter(l => !l.customer_id || !activeContractCustomerIds.has(l.customer_id)),
    [leads, activeContractCustomerIds]
  )
  const activeLeads = trueLeads.filter(l => ['new', 'contacted', 'qualified'].includes(l.status))
  const convertedLeads = leads.filter(l => l.status === 'converted')
  const conversionRate = leads.length > 0 ? ((convertedLeads.length / leads.length) * 100).toFixed(1) : '0.0'

  // Active customers (with at least one active contract)
  const activeCustomers = customers.filter(c => !c.is_family_member && activeContractCustomerIds.has(c.id))

  // Expiring contracts (next 90 days)
  const today = new Date()
  const in90 = new Date(today); in90.setDate(today.getDate() + 90)
  const expiringContracts = activeContracts.filter(c => {
    if (!c.end_date) return false
    const end = new Date(c.end_date)
    return end >= today && end <= in90
  })

  // Coverage gaps
  const REQUIRED_SPARTEN = ['kvg', 'haftpflicht_privat']
  const customersWithCriticalGaps = useMemo(() => {
    return activeCustomers.filter(customer => {
      const covered = new Set(
        contracts.filter(c => c.status === 'active' && (c.customer_id === customer.id || c.primary_customer_id === customer.id))
          .map(c => c.sparte || c.insurance_type).filter(Boolean)
      )
      return REQUIRED_SPARTEN.some(s => !covered.has(s))
    })
  }, [activeCustomers, contracts])

  // Missing documents
  const contractsWithoutDoc = activeContracts.filter(c => !c.policy_document_url).length

  // MTD commissions
  const nowStr = new Date().toISOString().slice(0, 7)
  const mtdCommissions = filteredCommissions
    .filter(ce => ce.entry_date?.slice(0, 7) === nowStr || ce.settlement_date?.slice(0, 7) === nowStr)
    .reduce((sum, ce) => sum + (ce.commission_amount || ce.gross_commission || 0), 0)

  // Yearly commission forecast
  const yearlyCommissionForecast = filteredContracts
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + ((c.premium_yearly || (c.premium_monthly || 0) * 12) * (c.commission_rate || 0) / 100), 0)

  // Task mutations
  const updateMutation = useMutation({
    mutationFn: async (data) => base44.entities.Task.update(selectedTask.id, {
      status: data.status ?? selectedTask.status,
      notes: data.notes ?? selectedTask.notes,
      due_date: data.due_date ?? selectedTask.due_date,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); setSelectedTask(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); setSelectedTask(null) },
  })
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); setSelectedTask(null) },
  })

  const handleTaskClick = (task) => {
    setSelectedTask(task)
    setFormData({ status: task.status, notes: task.notes || '', due_date: task.due_date || '' })
  }

  const handleSave = () => {
    if (selectedTask?.id) updateMutation.mutate(formData)
    else createMutation.mutate({ title: formData.title || 'Neue Aufgabe', status: formData.status || 'open', notes: formData.notes, due_date: formData.due_date })
  }

  return (
    <div className="space-y-8">

      {/* ── TOP BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{new Date().toLocaleDateString('de-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterOrg} onValueChange={v => { setFilterOrg(v); setFilterAdvisor('all') }}>
            <SelectTrigger className="w-40 h-8 text-xs bg-background"><SelectValue placeholder="Organisation" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Org.</SelectItem>
              {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAdvisor} onValueChange={setFilterAdvisor}>
            <SelectTrigger className="w-36 h-8 text-xs bg-background"><SelectValue placeholder="Berater" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Berater</SelectItem>
              {filteredAdvisors.map(a => <SelectItem key={a.id} value={a.email}>{a.firstname}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          A. SALES KPIs
      ══════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader title="Sales & Akquisition" onNavigate={() => navigate('/leads')} badge={`${activeLeads.length} aktiv`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile label="Aktive Leads" value={activeLeads.length} sub="in Pipeline" icon={Target} accent="border-l-blue-500" onClick={() => navigate('/leads')} />
          <KpiTile label="Conversion Rate" value={`${conversionRate}%`} sub={`${convertedLeads.length} konvertiert`} icon={TrendingUp} accent="border-l-green-500" onClick={() => navigate('/leads')} />
          <KpiTile label="Offene Anträge" value={pendingApplications.length} sub="in Bearbeitung" icon={FileText} accent="border-l-amber-500" onClick={() => navigate('/antraege')} />
          <KpiTile label="Neue Kunden (30T)" value={customers.filter(c => !c.is_family_member && new Date(c.created_date) > new Date(Date.now() - 30 * 86400000)).length} sub="letzten 30 Tage" icon={Users} accent="border-l-violet-500" onClick={() => navigate('/kunden')} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          B. CUSTOMER KPIs
      ══════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader title="Aktive Kunden" onNavigate={() => navigate('/kunden')} badge={`${activeCustomers.length} aktiv`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile label="Aktive Kunden" value={activeCustomers.length} sub="mit aktivem Vertrag" icon={Users} accent="border-l-blue-500" onClick={() => navigate('/kunden')} />
          <KpiTile label="Gesamtkunden" value={customers.filter(c => !c.is_family_member).length} sub="inkl. Prospects" icon={Users} accent="border-l-slate-400" onClick={() => navigate('/kunden')} />
          <KpiTile label="Deckungslücken" value={customersWithCriticalGaps.length} sub="Pflicht-Coverage fehlt" icon={AlertTriangle} accent="border-l-red-500" onClick={() => navigate('/coverage-intelligence')} />
          <KpiTile label="Berater" value={filteredAdvisors.length} sub={filterOrg !== 'all' ? organizations.find(o => o.id === filterOrg)?.name : 'Alle Org.'} icon={UserCheck} accent="border-l-purple-500" onClick={() => navigate('/berater-organisation')} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          C. REVENUE KPIs
      ══════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader title="Umsatz & Provision" onNavigate={() => navigate('/provisionen-courtagen')} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile label="Monatsprämien" value={`CHF ${totalMonthlyPremium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`} sub="aktive Verträge" icon={Wallet} accent="border-l-emerald-500" onClick={() => navigate('/vertraege')} />
          <KpiTile label="Jahresprämien" value={`CHF ${totalYearlyPremium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`} sub="aktive Verträge" icon={TrendingUp} accent="border-l-primary" onClick={() => navigate('/vertraege')} />
          <KpiTile label="Provision MTD" value={`CHF ${mtdCommissions.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`} sub="laufender Monat" icon={Wallet} accent="border-l-amber-500" onClick={() => navigate('/provisionen-courtagen')} />
          <KpiTile label="Provisions-Forecast" value={`CHF ${yearlyCommissionForecast.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`} sub="Jahreshochrechnung" icon={TrendingUp} accent="border-l-orange-500" onClick={() => navigate('/provisionen-courtagen')} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          D. RISK & COVERAGE KPIs
      ══════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader title="Risiko & Coverage" onNavigate={() => navigate('/coverage-intelligence')} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile label="Ablaufende Verträge" value={expiringContracts.length} sub="nächste 90 Tage" icon={RefreshCw} accent="border-l-orange-500" onClick={() => navigate('/vertraege')} />
          <KpiTile label="Krit. Deckungslücken" value={customersWithCriticalGaps.length} sub="Aktion erforderlich" icon={AlertTriangle} accent="border-l-red-500" onClick={() => navigate('/coverage-intelligence')} />
          <KpiTile label="Aktive Policen" value={activeContracts.length} sub={`von ${filteredContracts.length} gesamt`} icon={FileText} accent="border-l-green-500" onClick={() => navigate('/vertraege')} />
          <KpiTile label="Fehlende Dokumente" value={contractsWithoutDoc} sub="Policen ohne Datei" icon={AlertTriangle} accent="border-l-amber-400" onClick={() => navigate('/dokumente')} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          E. TASK & OPERATIONS KPIs
      ══════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader title="Aufgaben & Betrieb" onNavigate={() => navigate('/aufgaben')} badge={openTasks.length > 0 ? `${openTasks.length} offen` : undefined} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile label="Offene Aufgaben" value={openTasks.length} sub="pendent / in Bearb." icon={CheckCircle2} accent="border-l-blue-500" onClick={() => navigate('/aufgaben')} />
          <KpiTile label="Fällig heute" value={tasks.filter(t => t.due_date === new Date().toISOString().slice(0, 10) && t.status !== 'completed').length} sub="sofort bearbeiten" icon={Clock} accent="border-l-red-500" onClick={() => navigate('/aufgaben')} />
          <KpiTile label="Organisationen" value={organizations.filter(o => o.status === 'active').length} sub="aktiv" icon={Building2} accent="border-l-slate-400" onClick={() => navigate('/berater-organisation')} />
          <KpiTile label="Dokumente" value={documents.length} sub="total gespeichert" icon={FileText} accent="border-l-slate-300" onClick={() => navigate('/dokumente')} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          F. RENEWAL PIPELINE
      ══════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader title="Vertragsabläufe & Renewal Pipeline" onNavigate={() => navigate('/vertraege')} badge={`${expiringContracts.length} bald ablaufend`} />
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-5 rounded-xl border border-slate-200">
          <RenewalPipelineKanbanV2 contracts={filteredContracts} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          G. OFFENE AUFGABEN
      ══════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader title="Offene Aufgaben" onNavigate={() => navigate('/aufgaben')} />
        <SupportSection
          tasks={openTasks.slice(0, 8)}
          customers={customers}
          activities={[]}
          onTaskClick={handleTaskClick}
        />
      </div>

      {/* ══════════════════════════════════════════════════════
          H. REVENUE TREND + TOP ADVISORS
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <SectionHeader title="Umsatz-Trend" onNavigate={() => navigate('/provisionen-courtagen')} />
          <RevenueChart contracts={filteredContracts} commissionEntries={filteredCommissions} />
        </div>
        <div>
          <SectionHeader title="Berater Performance" onNavigate={() => navigate('/berater-organisation')} />
          <TopAdvisors advisors={filteredAdvisors} organizations={organizations} commissionEntries={filteredCommissions} contracts={filteredContracts} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          I. AKTIVITÄTEN
      ══════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader title="Letzte Aktivitäten" />
        <ActivityFeed customers={customers} contracts={filteredContracts} commissions={filteredCommissions} />
      </div>

      {/* TASK DIALOG */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTask?.id ? selectedTask?.title : 'Neue Aufgabe'}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              {!selectedTask.id && (
                <div>
                  <Label>Titel *</Label>
                  <Input value={formData.title || ''} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} className="mt-1" />
                </div>
              )}
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Pendent</SelectItem>
                    <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                    <SelectItem value="completed">Erledigt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fälligkeitsdatum</Label>
                <Input type="date" value={formData.due_date || ''} onChange={e => setFormData(p => ({ ...p, due_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Notizen</Label>
                <Textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className="mt-1" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            {selectedTask?.id && (
              <Button variant="destructive" size="sm" onClick={() => { if (confirm('Aufgabe löschen?')) deleteMutation.mutate(selectedTask.id) }}>Löschen</Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setSelectedTask(null)}>Abbrechen</Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending || createMutation.isPending}>Speichern</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}