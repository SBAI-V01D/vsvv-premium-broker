import React, { useState, useMemo, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Edit, Archive, MoreHorizontal, AlertTriangle } from 'lucide-react'
import { formatCHF, formatDate, STATUS_META, STATUS_TRANSITIONS, checkEntryConsistency } from '@/lib/commissionEngine'

const PAGE_SIZE = 50

export default function CommissionTablePaginated({ entries, loading, onEdit, onArchive, onStatusChange }) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE))
  const paginated  = useMemo(() => entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [entries, page])

  const totals = useMemo(() => ({
    premium:    entries.reduce((s, e) => s + (e.premium_yearly || 0), 0),
    received:   entries.reduce((s, e) => s + (e.received_amount || 0), 0),
    commission: entries.reduce((s, e) => s + (e.commission_amount || 0), 0),
  }), [entries])

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
                  <th className="text-left py-3 px-4 font-semibold">Datum</th>
                  <th className="text-left py-3 px-4 font-semibold hidden md:table-cell">Gesellschaft</th>
                  <th className="text-left py-3 px-4 font-semibold hidden lg:table-cell">Berater</th>
                  <th className="text-left py-3 px-4 font-semibold">Kunde</th>
                  <th className="text-left py-3 px-4 font-semibold hidden xl:table-cell">Sparte</th>
                  <th className="text-right py-3 px-4 font-semibold hidden lg:table-cell">Jahresprämie</th>
                  <th className="text-right py-3 px-4 font-semibold text-blue-700">Courtage erh.</th>
                  <th className="text-right py-3 px-4 font-semibold hidden md:table-cell">Berater-%</th>
                  <th className="text-right py-3 px-4 font-semibold text-green-700">Provision Berater</th>
                  <th className="text-center py-3 px-4 font-semibold">Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="11" className="text-center py-10 text-muted-foreground">Lade Daten...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan="11" className="text-center py-10 text-muted-foreground">Keine Einträge für diesen Zeitraum</td></tr>
                ) : paginated.map(e => {
                  const sm           = STATUS_META[e.status] || STATUS_META.pending
                  const allowedNext  = STATUS_TRANSITIONS[e.status] || []
                  const warnings     = checkEntryConsistency(e)
                  const isOverdue    = e.status === 'invoiced' && e.invoiced_date &&
                    (Date.now() - new Date(e.invoiced_date).getTime()) / 86400000 > 60

                  return (
                    <tr key={e.id} className={`border-b transition-colors ${warnings.length > 0 ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-muted/30'}`}>
                      <td className="py-2.5 px-4 whitespace-nowrap text-muted-foreground text-xs">
                        {formatDate(e.entry_date)}
                        {isOverdue && <span className="ml-1 text-red-500" title="Überfällig (>60 Tage seit Einreichung)">⚠</span>}
                      </td>
                      <td className="py-2.5 px-4 font-medium hidden md:table-cell">{e.insurer}</td>
                      <td className="py-2.5 px-4 text-muted-foreground text-xs hidden lg:table-cell">{e.advisor_name || '–'}</td>
                      <td className="py-2.5 px-4">
                        <div>
                          <p className="font-medium text-xs leading-tight">{e.customer_name || '–'}</p>
                          <p className="text-xs text-muted-foreground md:hidden">{e.insurer}</p>
                          {warnings.length > 0 && (
                            <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3" /> Inkonsistenz
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground text-xs hidden xl:table-cell">{e.product_category || '–'}</td>
                      <td className="text-right py-2.5 px-4 text-muted-foreground text-xs hidden lg:table-cell">{formatCHF(e.premium_yearly)}</td>
                      <td className="text-right py-2.5 px-4 font-semibold text-blue-700 text-xs">
                        {e.received_amount ? formatCHF(e.received_amount) : <span className="text-amber-500">Ausstehend</span>}
                      </td>
                      <td className="text-right py-2.5 px-4 text-muted-foreground text-xs hidden md:table-cell">
                        {e.commission_percentage ? `${e.commission_percentage}%` : '–'}
                      </td>
                      <td className="text-right py-2.5 px-4 font-bold text-green-600 text-xs">{formatCHF(e.commission_amount)}</td>
                      <td className="text-center py-2.5 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${sm.color}`}>{sm.label}</span>
                      </td>
                      <td className="py-2.5 px-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(e)}>
                              <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                            </DropdownMenuItem>
                            {allowedNext.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1 text-xs text-muted-foreground font-semibold">Status wechseln</div>
                                {allowedNext.map(s => {
                                  const meta = STATUS_META[s]
                                  return (
                                    <DropdownMenuItem key={s} onClick={() => onStatusChange(e, s)}>
                                      <span className={`w-2 h-2 rounded-full mr-2 inline-block ${meta.color.split(' ')[0]}`} />
                                      → {meta.label}
                                    </DropdownMenuItem>
                                  )
                                })}
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
                              onClick={() => { if (confirm('Eintrag archivieren? Bleibt im Audit Log erhalten.')) onArchive(e) }}>
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
                  <tr className="bg-muted/40 font-semibold text-sm">
                    <td colSpan={5} className="py-3 px-4 hidden xl:table-cell">Total ({entries.length} Einträge)</td>
                    <td colSpan={5} className="py-3 px-4 xl:hidden">Total ({entries.length})</td>
                    <td className="text-right py-3 px-4 text-muted-foreground hidden lg:table-cell">{formatCHF(totals.premium)}</td>
                    <td className="text-right py-3 px-4 text-blue-700">{formatCHF(totals.received)}</td>
                    <td className="hidden md:table-cell"></td>
                    <td className="text-right py-3 px-4 text-green-600">{formatCHF(totals.commission)}</td>
                    <td colSpan="2"></td>
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