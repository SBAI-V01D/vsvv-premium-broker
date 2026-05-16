import React, { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Edit, Archive, MoreHorizontal, AlertTriangle } from 'lucide-react'
import { formatCHF, formatDate, STATUS_META, STATUS_TRANSITIONS, checkEntryConsistency, calcKPIs, normalizeLegacyEntry } from '@/lib/commissionEngine'

const PAGE_SIZE = 50

export default function CommissionTablePaginated({ entries, loading, onEdit, onArchive, onStatusChange }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE))
  const normalized = useMemo(() => entries.map(normalizeLegacyEntry), [entries])
  const paginated  = useMemo(() => normalized.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [normalized, page])

  // 🔴 CRITICAL: Use central calcKPIs engine (no local reduce)
  const kpi = useMemo(() => calcKPIs(entries), [entries])
  const totals = useMemo(() => ({
    premium:          kpi.count > 0 ? entries.reduce((s, e) => s + (e.premium_yearly || 0), 0) : 0,  // Non-financial aggregation
    compCourtage:     kpi.totalCourtageReceived,
    advisorCourtage:  kpi.totalAdvisorCourtage,   // Brutto
    courtageReserve:  kpi.totalCourtageReserve,
    courtagePayout:   kpi.totalCourtagePayout,    // Netto
    compProvision:    kpi.totalProvisionReceived,
    advisorProvision: kpi.totalAdvisorProvision,  // Brutto
    provisionReserve: kpi.totalProvisionReserve,
    provisionPayout:  kpi.totalProvisionPayout,   // Netto
  }), [kpi, entries])

  React.useEffect(() => { setPage(1) }, [entries.length])

  return (
    <div className="space-y-3">
      {entries.length > PAGE_SIZE && (
        <p className="text-xs text-muted-foreground">
          Zeige {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, entries.length)} von {entries.length} Einträgen
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-3 px-3 font-semibold">Datum</th>
                  <th className="text-left py-3 px-3 font-semibold hidden md:table-cell">Gesellschaft</th>
                  <th className="text-left py-3 px-3 font-semibold hidden lg:table-cell">Berater</th>
                  <th className="text-left py-3 px-3 font-semibold">Kunde</th>
                  <th className="text-left py-3 px-3 font-semibold hidden xl:table-cell">Sparte</th>
                  <th className="text-right py-3 px-3 font-semibold hidden lg:table-cell">Jahresprämie</th>
                  {/* COURTAGE Gruppe */}
                  <th className="text-right py-3 px-3 font-semibold text-blue-700 bg-blue-50/40 border-l border-blue-200 hidden md:table-cell">Ges.courtage</th>
                  <th className="text-right py-3 px-3 font-semibold text-blue-600 bg-blue-50/40 hidden lg:table-cell">Brutto</th>
                  <th className="text-right py-3 px-3 font-semibold text-orange-600 bg-blue-50/40 hidden xl:table-cell">Reserve</th>
                  <th className="text-right py-3 px-3 font-semibold text-blue-800 bg-blue-50/40">Netto C.</th>
                  <th className="text-center py-3 px-3 font-semibold text-blue-600 bg-blue-50/40 hidden lg:table-cell">C-Status</th>
                  {/* PROVISION Gruppe */}
                  <th className="text-right py-3 px-3 font-semibold text-emerald-700 bg-emerald-50/40 border-l border-emerald-200 hidden md:table-cell">Ges.provision</th>
                  <th className="text-right py-3 px-3 font-semibold text-emerald-600 bg-emerald-50/40 hidden lg:table-cell">Brutto P.</th>
                  <th className="text-right py-3 px-3 font-semibold text-orange-600 bg-emerald-50/40 hidden lg:table-cell">Reserve P.</th>
                  <th className="text-right py-3 px-3 font-semibold text-emerald-800 bg-emerald-50/40 hidden md:table-cell">Netto P.</th>
                  <th className="text-center py-3 px-3 font-semibold text-emerald-600 bg-emerald-50/40 hidden lg:table-cell">P-Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="15" className="text-center py-10 text-muted-foreground">Lade Daten...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan="15" className="text-center py-10 text-muted-foreground">Keine Einträge</td></tr>
                ) : paginated.map(e => {
                  const origEntry = entries.find(x => x.id === e.id) || e
                  const cStatus  = e.courtage_status || e.status || 'pending'
                  const pStatus  = e.provision_status || 'pending'
                  const cMeta    = STATUS_META[cStatus] || STATUS_META.pending
                  const pMeta    = STATUS_META[pStatus] || STATUS_META.pending
                  const allowedC = STATUS_TRANSITIONS[cStatus] || []
                  const warnings = checkEntryConsistency(origEntry)
                  const isOverdue = cStatus === 'invoiced' && (e.courtage_invoiced_date || e.invoiced_date) &&
                    (Date.now() - new Date(e.courtage_invoiced_date || e.invoiced_date).getTime()) / 86400000 > 60
                  const hasProvision = (e.company_provision_amount || 0) !== 0
                  const isStorno = e.is_storno === true

                  return (
                    <tr key={e.id} className={`border-b transition-colors ${isStorno ? 'bg-red-50/50 hover:bg-red-50' : warnings.length > 0 ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-muted/30'}`}>
                      <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-xs">
                        {formatDate(e.entry_date)}
                        {isOverdue && <span className="ml-1 text-red-500" title="Courtage überfällig">⚠</span>}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-xs hidden md:table-cell">{e.insurer}</td>
                      <td className="py-2.5 px-3 text-muted-foreground text-xs hidden lg:table-cell">{e.advisor_name || '–'}</td>
                      <td className="py-2.5 px-3">
                        <div>
                          <p className="font-medium text-xs leading-tight flex items-center gap-1">
                            {e.customer_name || '–'}
                            {isStorno && <span className="text-xs bg-red-100 text-red-700 px-1 rounded font-bold">STORNO</span>}
                          </p>
                          <p className="text-xs text-muted-foreground md:hidden">{e.insurer}</p>
                          {warnings.length > 0 && !isStorno && (
                            <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3" /> Inkonsistenz
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-xs hidden xl:table-cell">{e.product_category || '–'}</td>
                      <td className="text-right py-2.5 px-3 text-muted-foreground text-xs hidden lg:table-cell">{formatCHF(e.premium_yearly)}</td>
                      {/* COURTAGE */}
                      <td className="text-right py-2.5 px-3 text-blue-700 text-xs bg-blue-50/20 border-l border-blue-100 hidden md:table-cell">
                        {e.company_courtage_amount ? formatCHF(e.company_courtage_amount) : <span className="text-muted-foreground">–</span>}
                      </td>
                      <td className="text-right py-2.5 px-3 text-blue-600 text-xs bg-blue-50/20 hidden lg:table-cell" title="Brutto Beratercourtage">
                        {e.advisor_courtage_amount ? formatCHF(e.advisor_courtage_amount) : '–'}
                      </td>
                      <td className="text-right py-2.5 px-3 text-orange-500 text-xs bg-blue-50/20 hidden xl:table-cell" title="Stornoreserve">
                        {e.courtage_storno_amount > 0
                          ? <span>−{formatCHF(e.courtage_storno_amount)} <span className="text-muted-foreground">({e.courtage_storno_percentage ?? 10}%)</span></span>
                          : '–'}
                      </td>
                      <td className="text-right py-2.5 px-3 font-bold text-blue-800 text-xs bg-blue-50/20" title="Netto auszahlbar">
                        {e.courtage_payout_amount != null && e.courtage_payout_amount !== 0
                          ? <span className={e.courtage_payout_amount < 0 ? 'text-red-600' : ''}>{formatCHF(e.courtage_payout_amount)}</span>
                          : <span className="text-amber-500">Ausstehend</span>}
                      </td>
                      <td className="text-center py-2.5 px-3 bg-blue-50/20 hidden lg:table-cell">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${cMeta.color}`}>{cMeta.label}</span>
                      </td>
                      {/* PROVISION */}
                      <td className="text-right py-2.5 px-3 text-emerald-700 text-xs bg-emerald-50/20 border-l border-emerald-100 hidden md:table-cell">
                        {e.company_provision_amount ? formatCHF(e.company_provision_amount) : <span className="text-muted-foreground">–</span>}
                      </td>
                      <td className="text-right py-2.5 px-3 text-emerald-600 text-xs bg-emerald-50/20 hidden lg:table-cell" title="Brutto">
                        {e.advisor_provision_amount ? formatCHF(e.advisor_provision_amount) : '–'}
                      </td>
                      <td className="text-right py-2.5 px-3 text-orange-500 text-xs bg-emerald-50/20 hidden lg:table-cell" title="Reserve">
                        {e.provision_storno_amount > 0 ? `−${formatCHF(e.provision_storno_amount)}` : '–'}
                      </td>
                      <td className="text-right py-2.5 px-3 font-semibold text-emerald-800 text-xs bg-emerald-50/20 hidden md:table-cell" title="Netto auszahlbar">
                        {e.provision_payout_amount != null && e.provision_payout_amount !== 0
                          ? <span className={e.provision_payout_amount < 0 ? 'text-red-600' : ''}>{formatCHF(e.provision_payout_amount)}</span>
                          : <span className="text-muted-foreground">–</span>}
                      </td>
                      <td className="text-center py-2.5 px-3 bg-emerald-50/20 hidden lg:table-cell">
                        {hasProvision
                          ? <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${pMeta.color}`}>{pMeta.label}</span>
                          : <span className="text-xs text-muted-foreground">–</span>}
                      </td>
                      <td className="py-2.5 px-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(origEntry)}>
                              <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                            </DropdownMenuItem>
                            {allowedC.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1 text-xs text-blue-700 font-semibold">Courtage Status</div>
                                {allowedC.map(s => (
                                  <DropdownMenuItem key={s} onClick={() => onStatusChange(origEntry, s, 'courtage')}>
                                    <span className={`w-2 h-2 rounded-full mr-2 inline-block ${STATUS_META[s].color.split(' ')[0]}`} />
                                    → {STATUS_META[s].label}
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                            {warnings.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1 text-xs text-amber-600 font-semibold">
                                  {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                                </div>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-amber-600"
                              onClick={() => { if (confirm('Eintrag archivieren?')) onArchive(origEntry) }}>
                              <Archive className="w-4 h-4 mr-2" /> Archivieren
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {entries.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/40 font-semibold text-xs">
                    <td colSpan={6} className="py-3 px-3">Total ({entries.length})</td>
                    <td className="text-right py-3 px-3 text-blue-700 bg-blue-50/20 border-l border-blue-100 hidden md:table-cell">{formatCHF(totals.compCourtage)}</td>
                    <td className="text-right py-3 px-3 text-blue-600 bg-blue-50/20 hidden lg:table-cell">{formatCHF(totals.advisorCourtage)}</td>
                    <td className="text-right py-3 px-3 text-orange-500 bg-blue-50/20 hidden xl:table-cell">−{formatCHF(totals.courtageReserve)}</td>
                    <td className="text-right py-3 px-3 text-blue-800 font-bold bg-blue-50/20">{formatCHF(totals.courtagePayout)}</td>
                    <td className="bg-blue-50/20 hidden lg:table-cell"></td>
                    <td className="text-right py-3 px-3 text-emerald-700 bg-emerald-50/20 border-l border-emerald-100 hidden md:table-cell">{formatCHF(totals.compProvision)}</td>
                    <td className="text-right py-3 px-3 text-emerald-600 bg-emerald-50/20 hidden lg:table-cell">{formatCHF(totals.advisorProvision)}</td>
                    <td className="text-right py-3 px-3 text-orange-500 bg-emerald-50/20 hidden lg:table-cell">−{formatCHF(totals.provisionReserve)}</td>
                    <td className="text-right py-3 px-3 text-emerald-800 font-bold bg-emerald-50/20 hidden md:table-cell">{formatCHF(totals.provisionPayout)}</td>
                    <td className="bg-emerald-50/20 hidden lg:table-cell"></td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">Seite {page} von {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(1)}>«</Button>
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</Button>
            <span className="px-3 py-1.5 text-xs bg-muted rounded border">{page}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</Button>
          </div>
        </div>
      )}
    </div>
  )
}