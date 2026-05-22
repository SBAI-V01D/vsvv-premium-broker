import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit, UserPlus, LayoutDashboard, Download,
  Mail, Phone, MapPin, Shield, Users, FileText, AlertTriangle
} from 'lucide-react'
import { HealthScore, SemanticBadge, QuickAction } from '@/components/ui/ds'
import EmailLink from '@/components/common/EmailLink'
import { label, STATUS_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'

function KpiPill({ label: lbl, value, sub, warn }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{lbl}</span>
      <span className={cn(
        'text-lg font-bold tracking-tight leading-none mt-0.5',
        warn ? 'text-amber-600' : 'text-slate-800'
      )}>
        {value}
        {sub && <span className="text-xs font-normal text-slate-400 ml-1">{sub}</span>}
      </span>
    </div>
  )
}

function computeHealthScore(customer, contracts, tasks, documents) {
  let score = 100
  if (!customer.advisor_id && !customer.primary_advisor_id) score -= 20
  if (!customer.email) score -= 8
  const urgentOpen = tasks.filter(t => t.status !== 'completed' && t.priority === 'urgent').length
  score -= Math.min(urgentOpen * 10, 20)
  const today = new Date()
  const expiringRisk = contracts.filter(c => {
    if (!c.renewal_date || c.status === 'cancelled') return false
    const days = (new Date(c.renewal_date) - today) / 86400000
    return days < 90 && days > 0 && (!c.renewal_status || c.renewal_status === 'none')
  }).length
  score -= expiringRisk * 8
  if (documents.length === 0 && contracts.length > 0) score -= 5
  if (customer.mandate_status === 'invalid' || customer.mandate_status === 'expired') score -= 10
  return Math.max(0, Math.round(score))
}

export default function CustomerExecutiveHeader({
  customer,
  contracts = [],
  tasks = [],
  documents = [],
  advisors = [],
  onEdit,
  onAddFamilyMember,
  onDownloadPDF,
  isDownloading,
}) {
  const navigate = useNavigate()

  const healthScore = useMemo(
    () => computeHealthScore(customer, contracts, tasks, documents),
    [customer, contracts, tasks, documents]
  )

  const advisor = useMemo(() => {
    const aid = customer.advisor_id || customer.primary_advisor_id
    return advisors.find(a => a.id === aid)
  }, [customer, advisors])

  const activeContracts = contracts.filter(c => c.status === 'active')
  const totalPremium = activeContracts.reduce((s, c) => s + (c.premium_yearly || 0), 0)
  const openTasks = tasks.filter(t => t.status !== 'completed').length
  const expiringCount = contracts.filter(c => {
    if (!c.renewal_date) return false
    const days = (new Date(c.renewal_date) - new Date()) / 86400000
    return days < 90 && days > 0
  }).length

  const displayName = customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
  const initials = customer.company_name
    ? customer.company_name[0]
    : `${customer.first_name?.[0] || ''}${customer.last_name?.[0] || ''}`

  const isBusiness = customer.customer_type === 'business' || !!customer.company_name
  const isFamilyMember = customer.is_family_member

  return (
    <div className="bg-white border-b border-[hsl(var(--border-subtle))]">
      {/* Back nav */}
      <div className="px-6 pt-4">
        <button
          onClick={() => navigate('/kunden')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Kundenübersicht
        </button>
      </div>

      {/* Main header row */}
      <div className="px-6 pb-5 flex items-start gap-5 flex-wrap">
        {/* Avatar */}
        <div className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0',
          isBusiness
            ? 'bg-violet-50 text-violet-700'
            : 'bg-primary/10 text-primary'
        )}>
          {initials}
        </div>

        {/* Identity block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
            <h1 className="text-heading-xl truncate">{displayName}</h1>
            {customer.customer_number && (
              <span className="font-mono text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                {customer.customer_number}
              </span>
            )}
            {isFamilyMember && (
              <SemanticBadge variant="info" icon={Users}>Familienmitglied</SemanticBadge>
            )}
            {isBusiness && (
              <SemanticBadge variant="purple">Firma</SemanticBadge>
            )}
            {customer.status === 'active' && (
              <SemanticBadge variant="success">Aktiv</SemanticBadge>
            )}
            {customer.status === 'inactive' && (
              <SemanticBadge variant="neutral">Inaktiv</SemanticBadge>
            )}
            {customer.status === 'prospect' && (
              <SemanticBadge variant="warning">Interessent</SemanticBadge>
            )}
            {!customer.advisor_id && (
              <SemanticBadge variant="critical" icon={AlertTriangle}>Kein Berater</SemanticBadge>
            )}
          </div>

          {/* Contact row */}
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-caption">
            {customer.email && (
              <span className="flex items-center gap-1.5 text-slate-500">
                <Mail className="w-3 h-3" />
                <EmailLink email={customer.email} />
              </span>
            )}
            {customer.phone && (
              <span className="flex items-center gap-1.5 text-slate-500">
                <Phone className="w-3 h-3" /> {customer.phone}
              </span>
            )}
            {(customer.city || customer.canton) && (
              <span className="flex items-center gap-1.5 text-slate-500">
                <MapPin className="w-3 h-3" /> {[customer.zip_code, customer.city, customer.canton].filter(Boolean).join(' ')}
              </span>
            )}
            {advisor && (
              <span className="flex items-center gap-1.5 text-slate-500">
                <Shield className="w-3 h-3" /> {advisor.firstname} {advisor.lastname}
              </span>
            )}
          </div>
        </div>

        {/* KPI strip — reduced visual weight */}
        <div className="hidden lg:flex items-center gap-6 px-5 py-2.5 bg-[hsl(var(--surface-2))] rounded-xl border border-[hsl(var(--border-subtle))]">
          <KpiPill
            label="Policen"
            value={activeContracts.length}
            sub={`/${contracts.length}`}
          />
          <div className="w-px h-7 bg-[hsl(var(--border-default))]" />
          <KpiPill
            label="Jahresprämie"
            value={totalPremium > 0 ? `CHF ${Math.round(totalPremium).toLocaleString('de-CH')}` : '–'}
          />
          <div className="w-px h-7 bg-[hsl(var(--border-default))]" />
          <KpiPill
            label="Tasks"
            value={openTasks}
            warn={openTasks > 2}
          />
          <div className="w-px h-7 bg-[hsl(var(--border-default))]" />
          <KpiPill
            label="Renewal"
            value={expiringCount > 0 ? `${expiringCount}` : '—'}
            warn={expiringCount > 0}
          />
        </div>

        {/* Health + Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-center gap-0.5">
            <HealthScore score={healthScore} size="lg" />
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Score</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <QuickAction icon={Edit} label="Bearbeiten" onClick={onEdit} />
            {!customer.is_family_member && (
              <QuickAction icon={UserPlus} label="Familie" onClick={onAddFamilyMember} />
            )}
            <QuickAction icon={LayoutDashboard} label="360°" onClick={() => navigate(`/kunden/${customer.id}/360`)} />
            <QuickAction icon={Download} label={isDownloading ? '...' : 'Export'} onClick={onDownloadPDF} disabled={isDownloading} variant="primary" />
          </div>
        </div>
      </div>

      {/* Mobile KPIs */}
      <div className="lg:hidden flex items-center gap-4 px-6 pb-4 overflow-x-auto scrollbar-none">
        <KpiPill label="Policen" value={activeContracts.length} sub={`/${contracts.length}`} />
        <div className="w-px h-5 bg-[hsl(var(--border-default))]" shrink-0 />
        <KpiPill label="Prämie" value={totalPremium > 0 ? `CHF ${Math.round(totalPremium / 1000)}k` : '–'} />
        <div className="w-px h-5 bg-[hsl(var(--border-default))]" shrink-0 />
        <KpiPill label="Tasks" value={openTasks} warn={openTasks > 2} />
        <div className="w-px h-5 bg-[hsl(var(--border-default))]" shrink-0 />
        <KpiPill label="Renewal" value={expiringCount > 0 ? expiringCount : '—'} warn={expiringCount > 0} />
      </div>
    </div>
  )
}