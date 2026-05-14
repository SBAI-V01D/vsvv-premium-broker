import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Clock, CheckCircle2, AlertCircle, Landmark, UserCheck, ShieldAlert } from 'lucide-react'
import { calcKPIs, formatCHF, formatPct } from '@/lib/commissionEngine'

function KpiCard({ label, value, sub, icon: Icon, color, bg, warn }) {
  return (
    <Card className={`${bg ? `border-0 ${bg}` : ''} ${warn ? 'ring-1 ring-red-300' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">{label}</p>
          <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
        </div>
        <p className={`text-lg font-bold ${color} leading-tight`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
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
    <div className="space-y-3">

      {/* Overdue Alert */}
      {global.overdueCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>{global.overdueCount} überfällige Positionen</strong> (Courtage eingereicht vor über 60 Tagen) ·
            Offen: <strong>{formatCHF(global.totalOverdueCourtage)}</strong>
          </span>
        </div>
      )}

      {/* COURTAGE Block */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1 bg-blue-200" />
          <span className="text-xs font-bold text-blue-700 uppercase tracking-widest flex items-center gap-1">
            <Landmark className="w-3.5 h-3.5" /> Courtage
          </span>
          <div className="h-px flex-1 bg-blue-200" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <KpiCard
            label="Ges.courtage (Periode)" value={formatCHF(period.totalCourtageReceived)}
            sub="Von Versicherung – Basis" icon={Landmark} color="text-blue-700" bg="bg-blue-50"
          />
          <KpiCard
            label="Beratercourtage Brutto" value={formatCHF(period.totalAdvisorCourtage)}
            sub={`Ges.courtage × % · ${period.nonCancelledCount} Abrechnungen`}
            icon={UserCheck} color="text-blue-600" bg="bg-blue-50/60"
          />
          <KpiCard
            label="Stornoreserve Courtage" value={formatCHF(period.totalCourtageReserve)}
            sub="Einbehalt – noch nicht freigegeben"
            icon={ShieldAlert} color="text-orange-600" bg="bg-orange-50"
            warn={period.totalCourtageReserve > 0}
          />
          <KpiCard
            label="Netto Courtage" value={formatCHF(period.totalCourtagePayout)}
            sub="Brutto − Reserve = auszahlbar"
            icon={TrendingUp} color="text-blue-700" bg="bg-blue-50"
          />
          <KpiCard
            label="Courtage ausbezahlt" value={formatCHF(period.totalCourtagePaid)}
            sub={`${formatPct(period.courtagePayout, 0)} Auszahlungsquote (Netto-Basis)`}
            icon={CheckCircle2}
            color={period.totalCourtagePaid > 0 ? 'text-green-700' : 'text-muted-foreground'}
            bg={period.totalCourtagePaid > 0 ? 'bg-green-50' : ''}
          />
          <KpiCard
            label="Offene Courtage" value={formatCHF(period.openCourtage)}
            sub="Netto noch nicht ausbezahlt"
            icon={Clock}
            color={period.openCourtage > 0 ? 'text-amber-700' : 'text-green-700'}
            bg={period.openCourtage > 0 ? 'bg-amber-50' : 'bg-green-50'}
          />
        </div>
      </div>

      {/* PROVISION Block */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1 bg-emerald-200" />
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Provision
          </span>
          <div className="h-px flex-1 bg-emerald-200" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <KpiCard
            label="Ges.provision (Periode)" value={formatCHF(period.totalProvisionReceived)}
            sub="Von Versicherung – Basis" icon={Landmark} color="text-emerald-700" bg="bg-emerald-50"
          />
          <KpiCard
            label="Beraterprovision Brutto" value={formatCHF(period.totalAdvisorProvision)}
            sub="Ges.provision × %" icon={UserCheck} color="text-emerald-600" bg="bg-emerald-50/60"
          />
          <KpiCard
            label="Stornoreserve Provision" value={formatCHF(period.totalProvisionReserve)}
            sub="Einbehalt – noch nicht freigegeben"
            icon={ShieldAlert} color="text-orange-600" bg="bg-orange-50"
            warn={period.totalProvisionReserve > 0}
          />
          <KpiCard
            label="Netto Provision" value={formatCHF(period.totalProvisionPayout)}
            sub="Brutto − Reserve = auszahlbar"
            icon={TrendingUp} color="text-emerald-700" bg="bg-emerald-50"
          />
          <KpiCard
            label="Provision ausbezahlt" value={formatCHF(period.totalProvisionPaid)}
            sub="Netto bereits ausbezahlt"
            icon={CheckCircle2}
            color={period.totalProvisionPaid > 0 ? 'text-green-700' : 'text-muted-foreground'}
            bg={period.totalProvisionPaid > 0 ? 'bg-green-50' : ''}
          />
          <KpiCard
            label="Offene Provision" value={formatCHF(period.openProvision)}
            sub="Netto noch nicht ausbezahlt"
            icon={Clock}
            color={period.openProvision > 0 ? 'text-amber-700' : 'text-green-700'}
            bg={period.openProvision > 0 ? 'bg-amber-50' : 'bg-green-50'}
          />
        </div>
      </div>

      {/* Period Summary + Reserve + Storno */}
      <div className="space-y-2">
        {periodRange && (
          <Card className="border-0 bg-slate-50">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Zeitraum</p>
              <p className="text-sm font-semibold text-foreground">
                {periodRange.start.toLocaleDateString('de-CH')} – {periodRange.end.toLocaleDateString('de-CH')}
              </p>
            </CardContent>
          </Card>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Card className={`border-0 ${period.totalReserveOpen > 0 ? 'bg-orange-50 ring-1 ring-orange-200' : 'bg-muted/30'}`}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Offene Reserve (Periode)</p>
                <p className={`text-xl font-bold ${period.totalReserveOpen > 0 ? 'text-orange-700' : 'text-muted-foreground'}`}>
                  {formatCHF(period.totalReserveOpen)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Courtage + Provision</p>
              </div>
              <ShieldAlert className={`w-8 h-8 ${period.totalReserveOpen > 0 ? 'text-orange-300' : 'text-muted-foreground/30'}`} />
            </CardContent>
          </Card>
          <Card className={`border-0 ${period.stornoRate > 10 ? 'bg-red-50 ring-1 ring-red-300' : period.stornoRate > 5 ? 'bg-amber-50' : 'bg-green-50'}`}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Stornoquote (Periode)</p>
                <p className={`text-xl font-bold ${period.stornoRate > 10 ? 'text-red-700' : period.stornoRate > 5 ? 'text-amber-700' : 'text-green-700'}`}>
                  {formatPct(period.stornoRate)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{period.cancelledCount} von {period.count}</p>
              </div>
              <TrendingDown className={`w-8 h-8 ${period.stornoRate > 10 ? 'text-red-300' : period.stornoRate > 5 ? 'text-amber-300' : 'text-green-300'}`} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}