import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { TrendingUp, AlertTriangle, Clock, Target, Wallet, Zap, ArrowRight } from 'lucide-react'
import { formatCHF } from '@/lib/commissionEngine'
import { cn } from '@/lib/utils'

function FinanceKpi({ label, value, sub, icon: Icon, colorClass }) {
  return (
    <div className={cn('rounded-xl border p-4 flex items-center gap-3', colorClass)}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-current/70 uppercase tracking-wide truncate">{label}</p>
        <p className="text-xl font-bold text-current leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-current/60 truncate mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function PipelineRow({ item, type, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group"
    >
      {type === 'lead' && (
        <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center font-semibold text-violet-700 text-xs flex-shrink-0">
          {item.first_name?.[0]}{item.last_name?.[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-semibold truncate">
          {type === 'lead' ? `${item.first_name} ${item.last_name}` : (item.title || item.customer_name)}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {type === 'lead' ? item.company || item.email || '–' : item.customer_name}
        </p>
      </div>
      {type === 'opp' && item.estimated_value > 0 && (
        <span className="text-xs font-bold text-emerald-700 flex-shrink-0">
          {formatCHF(item.estimated_value)}
        </span>
      )}
      {type === 'lead' && item.lead_score > 0 && (
        <span className="text-xs font-bold text-violet-700 flex-shrink-0">{item.lead_score}%</span>
      )}
      <ArrowRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
    </button>
  )
}

export default function MoneyDashboard() {
  const navigate = useNavigate()

  const { data: entries = [] } = useQuery({
    queryKey: ['commissionEntries'],
    queryFn: () => base44.entities.CommissionEntry.filter({ archived: false }, '-entry_date', 500),
    staleTime: 2 * 60 * 1000,
  })
  const { data: leads = [] } = useQuery({
    queryKey: ['leads-hot'],
    queryFn: () => base44.entities.Lead.filter({ status: ['new', 'contacted', 'qualified'] }, '-lead_score', 50),
    staleTime: 5 * 60 * 1000,
  })
  const { data: opps = [] } = useQuery({
    queryKey: ['opportunities-top'],
    queryFn: () => base44.entities.Verkaufschance.filter({ status: ['neu', 'in_ausschreibung', 'offerten_erhalten'] }, '-estimated_value', 50),
    staleTime: 5 * 60 * 1000,
  })
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-renewal'],
    queryFn: () => base44.entities.Contract.filter({ status: 'active' }, '-renewal_date', 200),
    staleTime: 5 * 60 * 1000,
  })

  const kpis = useMemo(() => {
    const courtageOpen = entries.filter(e => e.courtage_status !== 'paid').reduce((s, e) => s + (e.courtage_payout_amount || 0), 0)
    const provisionOpen = entries.filter(e => e.provision_status !== 'paid').reduce((s, e) => s + (e.provision_payout_amount || 0), 0)
    const renewalNext30 = contracts.filter(e => {
      if (!e.renewal_date) return false
      const d = (new Date(e.renewal_date).getTime() - Date.now()) / 86400000
      return d > 0 && d < 30
    }).length
    const hotLeads = leads.filter(l => (l.lead_score || 0) >= 70)
    const risks = contracts.filter(c => c.churn_risk === 'high' || c.pricing_status === 'high').length
    return { courtageOpen, provisionOpen, totalOpen: courtageOpen + provisionOpen, renewalNext30, hotLeads, risks }
  }, [entries, leads, opps, contracts])

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary/70" />
          <h2 className="text-[13px] font-bold text-foreground">Finanzen & Pipeline</h2>
        </div>
        <button
          onClick={() => navigate('/provisionen-courtagen')}
          className="text-[11px] text-primary/70 hover:text-primary font-medium flex items-center gap-1 transition-colors"
        >
          Details <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Finance KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FinanceKpi
            label="Offene Courtagen"
            value={formatCHF(kpis.courtageOpen)}
            sub={`${entries.filter(e => e.courtage_status !== 'paid').length} Abrechnungen`}
            icon={TrendingUp}
            colorClass="bg-blue-50/70 border-blue-200/60 text-blue-800"
          />
          <FinanceKpi
            label="Offene Provisionen"
            value={formatCHF(kpis.provisionOpen)}
            sub={`${entries.filter(e => e.provision_status !== 'paid').length} Abrechnungen`}
            icon={TrendingUp}
            colorClass="bg-emerald-50/70 border-emerald-200/60 text-emerald-800"
          />
          <FinanceKpi
            label="Total Offen"
            value={formatCHF(kpis.totalOpen)}
            sub="Courtage + Provision"
            icon={Target}
            colorClass="bg-amber-50/70 border-amber-200/60 text-amber-800"
          />
        </div>

        {/* Pipeline Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">

          {/* Hot Leads */}
          <div className="rounded-xl border border-border bg-background/50">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[11.5px] font-bold text-foreground">Hot Leads</span>
              </div>
              <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full border border-violet-200/60">
                {kpis.hotLeads.length}
              </span>
            </div>
            <div className="p-1">
              {kpis.hotLeads.length === 0 ? (
                <p className="text-center text-[11px] text-muted-foreground py-4">Keine Hot Leads</p>
              ) : kpis.hotLeads.slice(0, 4).map(l => (
                <PipelineRow key={l.id} item={l} type="lead" onClick={() => navigate('/leads')} />
              ))}
            </div>
          </div>

          {/* Top Opportunities */}
          <div className="rounded-xl border border-border bg-background/50">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11.5px] font-bold text-foreground">Opportunities</span>
              </div>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200/60">
                {opps.length}
              </span>
            </div>
            <div className="p-1">
              {opps.length === 0 ? (
                <p className="text-center text-[11px] text-muted-foreground py-4">Keine Opportunities</p>
              ) : opps.slice(0, 4).map(o => (
                <PipelineRow key={o.id} item={o} type="opp" onClick={() => navigate('/verkaufschancen')} />
              ))}
            </div>
          </div>

          {/* Renewals */}
          <div className="rounded-xl border border-border bg-background/50">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11.5px] font-bold text-foreground">Renewals</span>
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200/60">
                {kpis.renewalNext30}
              </span>
            </div>
            <div className="p-3">
              {kpis.renewalNext30 === 0 ? (
                <p className="text-center text-[11px] text-muted-foreground py-2">Keine in 30 Tagen</p>
              ) : (
                <button
                  onClick={() => navigate('/vertragsablaeufe')}
                  className="w-full text-left group"
                >
                  <p className="text-[12px] text-amber-800 font-semibold">
                    {kpis.renewalNext30} Vertrag{kpis.renewalNext30 > 1 ? 'e' : ''} läuft in 30 Tagen ab
                  </p>
                  <p className="text-[11px] text-primary/70 group-hover:text-primary font-medium mt-1 flex items-center gap-1 transition-colors">
                    Anzeigen <ArrowRight className="w-3 h-3" />
                  </p>
                </button>
              )}
            </div>
          </div>

          {/* Risks */}
          <div className="rounded-xl border border-border bg-background/50">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-[11.5px] font-bold text-foreground">Risiken</span>
              </div>
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                kpis.risks > 0
                  ? 'text-rose-600 bg-rose-50 border-rose-200/60'
                  : 'text-slate-500 bg-slate-50 border-slate-200/60'
              )}>
                {kpis.risks}
              </span>
            </div>
            <div className="p-3">
              {kpis.risks === 0 ? (
                <p className="text-center text-[11px] text-muted-foreground py-2">Keine Risiken</p>
              ) : (
                <button
                  onClick={() => navigate('/vertraege')}
                  className="w-full text-left group"
                >
                  <p className="text-[12px] text-rose-700 font-semibold">
                    {kpis.risks} Vertrag{kpis.risks > 1 ? 'e' : ''} mit erhöhtem Risiko
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    Verträge mit hohem Churn-Risiko oder überhöhter Prämie (pricing_status = high).
                  </p>
                  <p className="text-[11px] text-primary/70 group-hover:text-primary font-medium mt-1.5 flex items-center gap-1 transition-colors">
                    Verträge anzeigen <ArrowRight className="w-3 h-3" />
                  </p>
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}