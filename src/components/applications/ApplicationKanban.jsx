import React from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Building2, User, TrendingUp } from 'lucide-react'
import { getSparteLabel } from '@/lib/insuranceSparten'

const COLUMNS = [
  { key: 'neu', label: 'Neu', altKeys: ['new', 'draft'], color: 'bg-slate-50', headerColor: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  { key: 'in_pruefung', label: 'In Prüfung', altKeys: ['eingereicht', 'submitted', 'under_review', 'in_progress', 'offen'], color: 'bg-amber-50/50', headerColor: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  { key: 'risikopruefung', label: 'Risiko / Rückfrage', altKeys: ['rueckfrage', 'vorbehalt', 'waiting'], color: 'bg-orange-50/50', headerColor: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-400' },
  { key: 'angenommen', label: 'Angenommen ✓', altKeys: ['policiert', 'approved', 'bewilligung_erteilt', 'angenommen_vorbehalt'], color: 'bg-emerald-50/50', headerColor: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  { key: 'abgelehnt', label: 'Abgelehnt', altKeys: ['rejected', 'storniert', 'cancelled'], color: 'bg-red-50/30', headerColor: 'bg-red-100 text-red-600 border-red-200', dot: 'bg-red-400' },
]

function getColumn(app) {
  const st = (app.custom_status || app.status || '').toLowerCase().trim()
  return COLUMNS.find(col => col.key === st || (col.altKeys || []).includes(st)) || COLUMNS[0]
}

function AppCard({ app, navigate }) {
  const col = getColumn(app)
  return (
    <div
      onClick={() => app.customer_id && navigate(`/kunden/${app.customer_id}`)}
      className="bg-white border border-border rounded-xl p-3.5 cursor-pointer hover:shadow-card-md hover:border-primary/30 transition-all group select-none"
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Building2 className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors leading-tight">
            {app.customer_name || '–'}
          </p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            {getSparteLabel(app.sparte || app.insurance_type) || '–'}
          </p>
        </div>
      </div>

      {app.insurer && (
        <p className="text-[10px] text-muted-foreground truncate mb-1.5 pl-9">
          🏛 {app.insurer}
        </p>
      )}

      {(app.estimated_premium_yearly || app.estimated_premium_monthly) && (
        <div className="flex items-center gap-1 pl-9 mb-1">
          <TrendingUp className="w-2.5 h-2.5 text-emerald-600" />
          <p className="text-[10px] font-bold text-emerald-700">
            {app.estimated_premium_yearly
              ? `CHF ${app.estimated_premium_yearly.toLocaleString('de-CH')}/J.`
              : `CHF ${app.estimated_premium_monthly.toLocaleString('de-CH')}/M.`}
          </p>
        </div>
      )}

      {app.status_changed_at && (
        <p className="text-[10px] text-muted-foreground pl-9">
          {new Date(app.status_changed_at).toLocaleDateString('de-CH')}
        </p>
      )}
    </div>
  )
}

export default function ApplicationKanban({ applications, getCustomer }) {
  const navigate = useNavigate()
  const totalPremium = applications.reduce((s, a) => s + (a.estimated_premium_yearly || 0), 0)

  return (
    <div className="space-y-3">
      {totalPremium > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          <span>Gesamtpotenzial: <strong className="text-emerald-700 font-bold">CHF {totalPremium.toLocaleString('de-CH')}/J.</strong></span>
          <span className="ml-2">{applications.length} Anträge sichtbar</span>
        </div>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
        {COLUMNS.map(col => {
          const colApps = applications.filter(a => getColumn(a).key === col.key)
          const colPremium = colApps.reduce((s, a) => s + (a.estimated_premium_yearly || 0), 0)
          return (
            <div key={col.key} className="flex-shrink-0 w-60">
              {/* Column header */}
              <div className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg border mb-3',
                col.headerColor
              )}>
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', col.dot)} />
                  <span className="text-[11px] font-bold">{col.label}</span>
                </div>
                <span className="text-[10px] font-bold opacity-60 tabular-nums">{colApps.length}</span>
              </div>
              {colPremium > 0 && (
                <p className="text-[10px] text-muted-foreground px-1 mb-2 font-semibold">
                  CHF {colPremium.toLocaleString('de-CH')}/J.
                </p>
              )}

              {/* Cards */}
              <div className="space-y-2 min-h-[80px]">
                {colApps.map(app => (
                  <AppCard key={app.id} app={app} navigate={navigate} />
                ))}
                {colApps.length === 0 && (
                  <div className={cn('rounded-xl border-2 border-dashed border-border/50 p-5 text-center', col.color)}>
                    <p className="text-[11px] text-muted-foreground/60">Keine Anträge</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}