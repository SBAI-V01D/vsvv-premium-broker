import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, TrendingUp, Users, Clock, Search, Target, AlertCircle } from 'lucide-react'
import LeadForm from '@/components/leads/LeadForm'
import LeadImportExport from '@/components/leads/LeadImportExport'
import { PageHeader, KpiCard, StandardTable, StatusBadge } from '@/components/shared'

// Only ACTIVE pipeline stages — converted/lost are excluded from the main view
const PIPELINE_STAGES = [
  { key: 'new',       label: 'Neu',           color: 'bg-slate-100 text-slate-700 border-slate-300',   dot: 'bg-slate-400' },
  { key: 'contacted', label: 'Kontaktiert',   color: 'bg-blue-100 text-blue-700 border-blue-300',      dot: 'bg-blue-500' },
  { key: 'qualified', label: 'Qualifiziert',  color: 'bg-violet-100 text-violet-700 border-violet-300', dot: 'bg-violet-500' },
]

const ALL_STATUS_LABELS = {
  new: 'Neu', contacted: 'Kontaktiert', qualified: 'Qualifiziert', converted: 'Konvertiert', lost: 'Verloren',
}
const ALL_STATUS_COLORS = {
  new: 'bg-slate-100 text-slate-700 border-slate-300',
  contacted: 'bg-blue-100 text-blue-700 border-blue-300',
  qualified: 'bg-violet-100 text-violet-700 border-violet-300',
  converted: 'bg-green-100 text-green-700 border-green-300',
  lost: 'bg-red-100 text-red-700 border-red-300',
}
const SOURCE_LABELS = {
  website: 'Website', referral: 'Empfehlung', campaign: 'Kampagne', manual: 'Manuell', import: 'Import',
}

export default function Leads() {
  const navigate = useNavigate()
  const [filterStatus, setFilterStatus] = useState('active') // 'active' = only pipeline leads
  const [filterAdvisor, setFilterAdvisor] = useState('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const queryClient = useQueryClient()

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date'),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  })

  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.list(),
  })

  // Customer IDs who already have at least one active contract → exclude from leads
  const activeContractCustomerIds = useMemo(() => {
    return new Set(
      contracts
        .filter(c => c.status === 'active')
        .map(c => c.customer_id)
        .filter(Boolean)
    )
  }, [contracts])

  // TRUE leads: not converted to active customers, no active contracts
  const trueLeads = useMemo(() => {
    return leads.filter(l => {
      // Exclude already converted with active contract
      if (l.customer_id && activeContractCustomerIds.has(l.customer_id)) return false
      return true
    })
  }, [leads, activeContractCustomerIds])

  const activePipelineLeads = useMemo(() =>
    trueLeads.filter(l => ['new', 'contacted', 'qualified'].includes(l.status)),
    [trueLeads]
  )

  const filteredLeads = useMemo(() => {
    let base = filterStatus === 'active' ? activePipelineLeads : trueLeads
    if (filterStatus !== 'active' && filterStatus !== 'all') {
      base = base.filter(l => l.status === filterStatus)
    }
    if (filterAdvisor !== 'all') base = base.filter(l => l.advisor_id === filterAdvisor)
    if (search.trim()) {
      const q = search.toLowerCase()
      base = base.filter(l =>
        `${l.first_name} ${l.last_name} ${l.name || ''} ${l.email}`.toLowerCase().includes(q)
      )
    }
    return base
  }, [trueLeads, activePipelineLeads, filterStatus, filterAdvisor, search])

  const funnel = useMemo(() => ({
    new: activePipelineLeads.filter(l => l.status === 'new').length,
    contacted: activePipelineLeads.filter(l => l.status === 'contacted').length,
    qualified: activePipelineLeads.filter(l => l.status === 'qualified').length,
  }), [activePipelineLeads])

  const converted = leads.filter(l => l.status === 'converted').length
  const conversionRate = leads.length > 0 ? ((converted / leads.length) * 100).toFixed(1) : 0
  const excludedCount = leads.length - trueLeads.length

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); setShowForm(false); setEditingLead(null) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); setShowForm(false); setEditingLead(null) },
  })

  const handleFormSubmit = (formData) => {
    const payload = { ...formData, advisor_id: formData.advisor_id === 'none' ? '' : formData.advisor_id }
    if (editingLead) updateMutation.mutate({ id: editingLead.id, data: payload })
    else createMutation.mutate(payload)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Pipeline"
        titleClassName="text-[hsl(var(--primary))]"
        subtitle="Nur echte Akquisitions-Leads – aktive Kunden werden automatisch ausgeblendet"
        actions={
          <>
            <LeadImportExport leads={trueLeads} onImport={async (records) => {
              for (const r of records) await createMutation.mutateAsync(r).catch(() => {})
              queryClient.invalidateQueries({ queryKey: ['leads'] })
            }} />
            <Button onClick={() => { setEditingLead(null); setShowForm(true) }} className="gap-2">
              <Plus className="w-4 h-4" /> Neuer Lead
            </Button>
          </>
        }
      />

      {/* EXCLUDED NOTICE */}
      {excludedCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{excludedCount}</strong> Lead{excludedCount !== 1 ? 's' : ''} haben bereits aktive Verträge und wurden in die Kundenverwaltung verschoben.</span>
        </div>
      )}

      {/* FUNNEL STAGES */}
      <div className="grid grid-cols-3 gap-4">
        {PIPELINE_STAGES.map(stage => (
          <button key={stage.key} type="button"
            onClick={() => setFilterStatus(filterStatus === stage.key ? 'active' : stage.key)}
            className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${filterStatus === stage.key ? 'border-primary bg-primary/5 shadow-md' : 'border-border bg-card hover:border-primary/40'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stage.label}</span>
            </div>
            <p className="text-3xl font-bold">{funnel[stage.key]}</p>
          </button>
        ))}
      </div>

      {/* KPI ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Pipeline" value={activePipelineLeads.length} icon={Users} color="blue" />
        <KpiCard label="Conversion Rate" value={`${conversionRate}%`} icon={Target} color="green" />
        <KpiCard label="Konvertiert" value={converted} icon={TrendingUp} color="green" />
        <KpiCard label="Ø Tage im Funnel" value="–" icon={Clock} color="amber" />
      </div>

      {/* FILTERS + LIST */}
      <div>
        <div className="flex gap-3 mb-4 flex-wrap items-end">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Lead suchen..." className="pl-8 h-9 text-sm" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktive Pipeline</SelectItem>
              <SelectItem value="all">Alle (inkl. Verloren)</SelectItem>
              {Object.entries(ALL_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterAdvisor} onValueChange={setFilterAdvisor}>
            <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Berater" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Berater</SelectItem>
              {advisors.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.firstname} {a.lastname}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <StandardTable
          data={filteredLeads}
          emptyTitle="Keine Leads in dieser Ansicht"
          emptyDescription="Filter anpassen oder neuen Lead erfassen."
          onRowClick={(lead) => { setEditingLead(lead); setShowForm(true) }}
          columns={[
            {
              key: 'first_name',
              label: 'Name',
              render: (_, lead) => (
                <span className="font-medium text-primary">
                  {lead.first_name ? `${lead.first_name} ${lead.last_name}` : lead.name}
                </span>
              ),
            },
            { key: 'email', label: 'E-Mail', render: (v) => <span className="text-muted-foreground">{v}</span> },
            {
              key: 'source',
              label: 'Quelle',
              render: (v) => (
                <span className="px-2 py-0.5 rounded-full bg-muted text-xs">{SOURCE_LABELS[v] || v}</span>
              ),
            },
            { key: 'advisor_name', label: 'Berater', render: (v) => <span className="text-xs text-muted-foreground">{v || '—'}</span> },
            {
              key: 'status',
              label: 'Status',
              render: (v) => <StatusBadge status={v} label={ALL_STATUS_LABELS[v]} />,
            },
          ]}
        />
      </div>

      <LeadForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingLead(null) }}
        onSubmit={handleFormSubmit}
        lead={editingLead}
        advisors={advisors}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
}