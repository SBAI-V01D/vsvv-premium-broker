import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown, Clock, CheckCircle2, AlertCircle, Landmark, UserCheck, ShieldAlert } from 'lucide-react'
import { calcKPIs, formatCHF, formatPct } from '@/lib/commissionEngine'

function KpiCard({ label, value, sub, icon: Icon, color, bg, warn }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${bg ? `${bg} border-transparent` : 'bg-card border-border/60'} ${warn ? 'ring-1 ring-orange-200' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-tight truncate pr-1">{label}</p>
        <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0 opacity-70`} />
      </div>
      <p className={`text-base font-semibold ${color} leading-tight`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight truncate">{sub}</p>
    </div>
  )
}

function SectionDivider({ label, color }) {
  return (
    <div className={`flex items-center gap-2 mt-1`}>
      <div className={`h-px flex-1 ${color}`} />
      <span className={`text-xs font-bold uppercase tracking-widest ${color.replace('bg-', 'text-')}`}>{label}</span>
      <div className={`h-px flex-1 ${color}`} />
    </div>
  )
}

export default function CommissionKPIBar({ entries, filteredEntries, period: periodRange }) {
  const global = useMemo(() => calcKPIs(entries), [entries])
  const period = useMemo(() => calcKPIs(filteredEntries), [filteredEntries])

  return (
    <div className="space-y-4">

      {/* Overdue Alert — compact inline */}
      {global.overdueCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200/80 rounded-lg text-xs text-rose-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            <strong>{global.overdueCount} überfällige Positionen</strong> · Offen: <strong>{formatCHF(global.totalOverdueCourtage)}</strong>
          </span>
        </div>
      )}

      {/* PROVISION Block — PRIMARY */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" /> Provisionen
          </span>
          <div className="h-px flex-1 bg-emerald-100" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <KpiCard
            label="Ges.provision" value={formatCHF(period.totalProvisionReceived)}
            sub="Von Versicherung – Basis" icon={Landmark} color="text-emerald-700" bg="bg-emerald-50/70"
          />
          <KpiCard
            label="Beraterprovision Brutto" value={formatCHF(period.totalAdvisorProvision)}
            sub={`${period.nonCancelledCount} Abrechnungen`} icon={UserCheck} color="text-emerald-700" bg="bg-emerald-50/50"
          />
          <KpiCard
            label="Stornoreserve" value={formatCHF(period.totalProvisionReserve)}
            sub="Einbehalt ausstehend"
            icon={ShieldAlert} color="text-orange-600" bg="bg-orange-50/60"
            warn={period.totalProvisionReserve > 0}
          />
          <KpiCard
            label="Netto Provision" value={formatCHF(period.totalProvisionPayout)}
            sub="Brutto − Reserve"
            icon={TrendingUp} color="text-emerald-700" bg="bg-emerald-50/70"
          />
          <KpiCard
            label="Ausbezahlt" value={formatCHF(period.totalProvisionPaid)}
            sub="Netto bereits ausbezahlt"
            icon={CheckCircle2}
            color={period.totalProvisionPaid > 0 ? 'text-green-700' : 'text-muted-foreground'}
            bg={period.totalProvisionPaid > 0 ? 'bg-green-50/70' : ''}
          />
          <KpiCard
            label="Offen" value={formatCHF(period.openProvision)}
            sub="Netto ausstehend"
            icon={Clock}
            color={period.openProvision > 0 ? 'text-amber-700' : 'text-green-700'}
            bg={period.openProvision > 0 ? 'bg-amber-50/60' : 'bg-green-50/60'}
          />
        </div>
      </div>

      {/* COURTAGE Block — SECONDARY */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
            <Landmark className="w-3 h-3" /> Courtagen
          </span>
          <div className="h-px flex-1 bg-blue-100" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <KpiCard
            label="Ges.courtage" value={formatCHF(period.totalCourtageReceived)}
            sub="Von Versicherung – Basis" icon={Landmark} color="text-blue-600" bg="bg-blue-50/60"
          />
          <KpiCard
            label="Beratercourtage Brutto" value={formatCHF(period.totalAdvisorCourtage)}
            sub={`Ges.courtage × %`}
            icon={UserCheck} color="text-blue-600" bg="bg-blue-50/50"
          />
          <KpiCard
            label="Stornoreserve" value={formatCHF(period.totalCourtageReserve)}
            sub="Einbehalt ausstehend"
            icon={ShieldAlert} color="text-orange-500" bg="bg-orange-50/50"
            warn={period.totalCourtageReserve > 0}
          />
          <KpiCard
            label="Netto Courtage" value={formatCHF(period.totalCourtagePayout)}
            sub="Brutto − Reserve"
            icon={TrendingUp} color="text-blue-600" bg="bg-blue-50/60"
          />
          <KpiCard
            label="Ausbezahlt" value={formatCHF(period.totalCourtagePaid)}
            sub={`${formatPct(period.courtagePayout, 0)} Auszahlungsquote`}
            icon={CheckCircle2}
            color={period.totalCourtagePaid > 0 ? 'text-green-700' : 'text-muted-foreground'}
            bg={period.totalCourtagePaid > 0 ? 'bg-green-50/70' : ''}
          />
          <KpiCard
            label="Offen" value={formatCHF(period.openCourtage)}
            sub="Netto ausstehend"
            icon={Clock}
            color={period.openCourtage > 0 ? 'text-amber-600' : 'text-green-700'}
            bg={period.openCourtage > 0 ? 'bg-amber-50/60' : 'bg-green-50/60'}
          />
        </div>
      </div>

      {/* Footer row: Reserve + Storno rate */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {periodRange && (
          <div className="col-span-2 md:col-span-2 flex items-center gap-2 px-3 py-2 bg-slate-50 border border-border/60 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">
              Periode: <span className="font-medium text-foreground">
                {periodRange.start.toLocaleDateString('de-CH')} – {periodRange.end.toLocaleDateString('de-CH')}
              </span>
            </span>
          </div>
        )}
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${period.totalReserveOpen > 0 ? 'bg-orange-50/60 border-orange-200/60' : 'bg-slate-50 border-border/60'}`}>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Offene Reserve</p>
            <p className={`text-sm font-semibold ${period.totalReserveOpen > 0 ? 'text-orange-700' : 'text-muted-foreground'}`}>
              {formatCHF(period.totalReserveOpen)}
            </p>
          </div>
          <ShieldAlert className={`w-5 h-5 ${period.totalReserveOpen > 0 ? 'text-orange-300' : 'text-muted-foreground/20'}`} />
        </div>
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${period.stornoRate > 10 ? 'bg-rose-50/60 border-rose-200/60' : period.stornoRate > 5 ? 'bg-amber-50/60 border-amber-200/60' : 'bg-green-50/60 border-green-200/60'}`}>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Stornoquote</p>
            <p className={`text-sm font-semibold ${period.stornoRate > 10 ? 'text-rose-700' : period.stornoRate > 5 ? 'text-amber-700' : 'text-green-700'}`}>
              {formatPct(period.stornoRate)} <span className="text-[10px] font-normal text-muted-foreground">({period.cancelledCount}/{period.count})</span>
            </p>
          </div>
          <TrendingDown className={`w-5 h-5 ${period.stornoRate > 10 ? 'text-rose-300' : period.stornoRate > 5 ? 'text-amber-300' : 'text-green-300'}`} />
        </div>
      </div>
    </div>
  )
}