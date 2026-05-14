import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Clock, CheckCircle2, AlertTriangle, AlertCircle, Landmark, UserCheck } from 'lucide-react'
import { calcKPIs, formatCHF, formatPct } from '@/lib/commissionEngine'

export default function CommissionKPIBar({ entries, filteredEntries }) {
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
            <Landmark className="w-3.5 h-3.5" /> Courtage (Gesellschaft → Firma → Berater)
          </span>
          <div className="h-px flex-1 bg-blue-200" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-0 bg-blue-50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-blue-600 uppercase tracking-wide leading-tight">Gesellschaftscourtage (Periode)</p>
                <Landmark className="w-4 h-4 text-blue-600 flex-shrink-0" />
              </div>
              <p className="text-xl font-bold text-blue-800 leading-tight">{formatCHF(period.totalCourtageReceived)}</p>
              <p className="text-xs text-blue-600 mt-0.5">Von Versicherung erhalten · Berechnungsgrundlage</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-blue-50/60">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-blue-600 uppercase tracking-wide leading-tight">Beratercourtage (Periode)</p>
                <UserCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
              </div>
              <p className="text-xl font-bold text-blue-700 leading-tight">{formatCHF(period.totalAdvisorCourtage)}</p>
              <p className="text-xs text-blue-500 mt-0.5">Ges.courtage × Berater-% · {period.nonCancelledCount} Abrechnungen</p>
            </CardContent>
          </Card>
          <Card className={`border-0 ${period.totalCourtagePaid > 0 ? 'bg-green-50' : 'bg-muted/30'}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">Courtage ausbezahlt</p>
                <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${period.totalCourtagePaid > 0 ? 'text-green-600' : 'text-muted-foreground'}`} />
              </div>
              <p className={`text-xl font-bold leading-tight ${period.totalCourtagePaid > 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                {formatCHF(period.totalCourtagePaid)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatPct(period.courtagePayout, 0)} Auszahlungsquote</p>
            </CardContent>
          </Card>
          <Card className={`border-0 ${period.openCourtage > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">Offene Courtage</p>
                <Clock className={`w-4 h-4 flex-shrink-0 ${period.openCourtage > 0 ? 'text-amber-600' : 'text-green-600'}`} />
              </div>
              <p className={`text-xl font-bold leading-tight ${period.openCourtage > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                {formatCHF(period.openCourtage)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Berater noch nicht ausbezahlt</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PROVISION Block */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1 bg-emerald-200" />
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Provision (Einmalige Vergütung → Berater)
          </span>
          <div className="h-px flex-1 bg-emerald-200" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-0 bg-emerald-50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-emerald-600 uppercase tracking-wide leading-tight">Gesellschaftsprovision (Periode)</p>
                <Landmark className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              </div>
              <p className="text-xl font-bold text-emerald-800 leading-tight">{formatCHF(period.totalProvisionReceived)}</p>
              <p className="text-xs text-emerald-600 mt-0.5">Von Versicherung erhalten · Berechnungsgrundlage</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-emerald-50/60">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-emerald-600 uppercase tracking-wide leading-tight">Beraterprovision (Periode)</p>
                <UserCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              </div>
              <p className="text-xl font-bold text-emerald-700 leading-tight">{formatCHF(period.totalAdvisorProvision)}</p>
              <p className="text-xs text-emerald-500 mt-0.5">Ges.provision × Berater-%</p>
            </CardContent>
          </Card>
          <Card className={`border-0 ${period.totalProvisionPaid > 0 ? 'bg-green-50' : 'bg-muted/30'}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">Provision ausbezahlt</p>
                <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${period.totalProvisionPaid > 0 ? 'text-green-600' : 'text-muted-foreground'}`} />
              </div>
              <p className={`text-xl font-bold leading-tight ${period.totalProvisionPaid > 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                {formatCHF(period.totalProvisionPaid)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Berater ausbezahlt</p>
            </CardContent>
          </Card>
          <Card className={`border-0 ${period.openProvision > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">Offene Provision</p>
                <Clock className={`w-4 h-4 flex-shrink-0 ${period.openProvision > 0 ? 'text-amber-600' : 'text-green-600'}`} />
              </div>
              <p className={`text-xl font-bold leading-tight ${period.openProvision > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                {formatCHF(period.openProvision)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Berater noch nicht ausbezahlt</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Storno */}
      <div className="grid grid-cols-1">
        <Card className={`border-0 ${global.stornoRate > 10 ? 'bg-red-50 ring-1 ring-red-300' : global.stornoRate > 5 ? 'bg-amber-50' : 'bg-green-50'}`}>
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Stornoquote (Gesamtbestand)</p>
              <p className={`text-2xl font-bold ${global.stornoRate > 10 ? 'text-red-700' : global.stornoRate > 5 ? 'text-amber-700' : 'text-green-700'}`}>
                {formatPct(global.stornoRate)}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{global.cancelledCount} storniert von {global.count} gesamt</p>
              {global.stornoRate > 10 && <p className="text-red-600 font-semibold mt-0.5">⚠ Hohe Stornoquote!</p>}
            </div>
            <TrendingDown className={`w-8 h-8 ${global.stornoRate > 10 ? 'text-red-400' : global.stornoRate > 5 ? 'text-amber-400' : 'text-green-400'}`} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}