import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingDown, CheckCircle2, X, BarChart2, Loader2, Trash2, Pencil } from 'lucide-react';

function fmt(n) { return n != null ? `CHF ${Number(n).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '–'; }
function fmtJ(n) { return n != null ? `CHF ${Math.round(n).toLocaleString('de-CH')}` : '–'; }

const STATUS_CONFIG = {
  analyse_laeuft:     { label: 'Laufend',    color: 'bg-blue-50 text-blue-700 border-blue-200' },
  beratung_erfolgt:   { label: 'Beraten',     color: 'bg-amber-50 text-amber-700 border-amber-200' },
  umgesetzt:          { label: 'Abgeschlossen', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  abgelehnt:          { label: 'Abgelehnt',  color: 'bg-red-50 text-red-600 border-red-200' },
  ueberpruefung:      { label: 'Prüfung',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function VergleichsAnalysenListe() {
  const [filterStatus, setFilterStatus] = useState('all');
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingWahlId, setEditingWahlId] = useState(null);
  const [wahlDraft, setWahlDraft] = useState('');
  const queryClient = useQueryClient();

  const { data: analysen = [], isLoading } = useQuery({
    queryKey: ['vergleichs-analysen'],
    queryFn: () => base44.entities.VergleichsAnalyse.list('-created_date', 200),
    staleTime: 30 * 1000,
  });

  const filtered = filterStatus === 'all' ? analysen : analysen.filter(a => a.status === filterStatus);

  const handleDelete = async (analyse) => {
    if (!window.confirm(`Offerte von ${analyse.persoenliche_daten?.nachname || analyse.customer_name || 'diesem Kunden'} wirklich löschen?`)) return;
    setDeletingId(analyse.id);
    try {
      await base44.entities.VergleichsAnalyse.delete(analyse.id);
      queryClient.invalidateQueries({ queryKey: ['vergleichs-analysen'] });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveWahl = async (analyse) => {
    await base44.entities.VergleichsAnalyse.update(analyse.id, {
      beratungsergebnis: { ...analyse.beratungsergebnis, abschluss_wahl: wahlDraft },
    });
    queryClient.invalidateQueries({ queryKey: ['vergleichs-analysen'] });
    setEditingWahlId(null);
  };

  const handleToggleAbgeschlossen = async (analyse) => {
    const newStatus = analyse.status === 'umgesetzt' ? 'beratung_erfolgt' : 'umgesetzt';
    setTogglingId(analyse.id);
    try {
      await base44.entities.VergleichsAnalyse.update(analyse.id, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['vergleichs-analysen'] });
    } finally {
      setTogglingId(null);
    }
  };

  // Statistiken
  const total = analysen.length;
  const umgesetzt = analysen.filter(a => a.status === 'umgesetzt').length;
  const totalErsparnis = analysen.reduce((s, a) => s + (a.empfehlung?.ersparnis_jaehrlich || 0), 0);
  const convRate = total > 0 ? Math.round((umgesetzt / total) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            Vergleichs-Auswertung
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Alle gespeicherten Krankenkassenvergleiche</p>
        </div>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Vergleiche', value: total, Icon: BarChart2, color: 'blue' },
          { label: 'Abgeschlossen', value: umgesetzt, Icon: CheckCircle2, color: 'emerald' },
          { label: 'Konversionsrate', value: `${convRate}%`, Icon: TrendingDown, color: 'primary' },
          { label: 'Gesamtersparnis/J.', value: fmtJ(totalErsparnis), Icon: TrendingDown, color: 'green' },
        ].map(({ label, value, Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className={`w-4 h-4 text-${color}-500`} />
              </div>
              <p className="text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {[{ key: 'all', label: `Alle (${total})` }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({
          key: k, label: `${v.label} (${analysen.filter(a => a.status === k).length})`
        }))].map(({ key, label }) => (
          <button key={key} onClick={() => setFilterStatus(key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              filterStatus === key
                ? 'bg-primary text-white border-primary'
                : 'bg-white border-border text-muted-foreground hover:bg-accent'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tabelle */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Laden...</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Keine Vergleiche vorhanden
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Datum', 'Name', 'Ort', 'Aktuell', 'Empfehlung', 'Abschluss-Wahl', 'Ersparnis/J.', 'Status', 'Abgeschlossen', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(a => {
                    const ers = a.empfehlung?.ersparnis_jaehrlich;
                    const statusCfg = STATUS_CONFIG[a.status] || STATUS_CONFIG['beratung_erfolgt'];
                    const ort = a.persoenliche_daten?.plz
                      ? `${a.persoenliche_daten.plz}${a.persoenliche_daten.kanton ? ` ${a.persoenliche_daten.kanton}` : ''}`
                      : '–';
                    const abgeschlossen = a.status === 'umgesetzt';

                    return (
                      <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 text-[11px] text-muted-foreground whitespace-nowrap">
                          {a.analyse_datum ? new Date(a.analyse_datum).toLocaleDateString('de-CH') : '–'}
                        </td>
                        <td className="px-3 py-2 text-[11px] font-medium whitespace-nowrap">
                          {a.persoenliche_daten?.nachname || ''}{a.persoenliche_daten?.vorname ? `, ${a.persoenliche_daten.vorname}` : a.customer_name || '–'}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-muted-foreground">{ort}</td>
                        <td className="px-3 py-2 text-[11px]">
                          <p className="font-medium">{a.ausgangslage?.krankenkasse || '–'}</p>
                          {a.ausgangslage?.praemie_aktuell > 0 && (
                            <p className="text-muted-foreground">{fmt(a.ausgangslage.praemie_aktuell)}/M.</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[11px]">
                          <p className="font-medium">{a.empfehlung?.empfohlene_krankenkasse || '–'}</p>
                          {a.empfehlung?.praemie_empfohlen > 0 && (
                            <p className="text-muted-foreground">{fmt(a.empfehlung.praemie_empfohlen)}/M.</p>
                          )}
                        </td>
                        {/* Abschluss-Wahl */}
                        <td className="px-3 py-2 text-[11px] min-w-[120px]">
                          {editingWahlId === a.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                value={wahlDraft}
                                onChange={e => setWahlDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveWahl(a); if (e.key === 'Escape') setEditingWahlId(null); }}
                                className="w-full border border-primary rounded px-1.5 py-0.5 text-xs focus:outline-none"
                                placeholder="Kasse / Produkt..."
                              />
                              <button onClick={() => handleSaveWahl(a)} className="text-emerald-600 hover:text-emerald-700 shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditingWahlId(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group cursor-pointer"
                              onClick={() => { setEditingWahlId(a.id); setWahlDraft(a.beratungsergebnis?.abschluss_wahl || ''); }}>
                              <span className={a.beratungsergebnis?.abschluss_wahl ? 'font-medium text-foreground' : 'text-muted-foreground italic'}>
                                {a.beratungsergebnis?.abschluss_wahl || 'Nicht erfasst'}
                              </span>
                              <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[11px] font-bold whitespace-nowrap">
                         {ers != null ? (
                           <span className={ers >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                             {ers >= 0 ? '+' : ''}{fmtJ(ers)}/J.
                           </span>
                         ) : '–'}
                        </td>
                        <td className="px-3 py-2">
                         <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${statusCfg.color}`}>
                           {statusCfg.label}
                         </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleToggleAbgeschlossen(a)}
                            disabled={togglingId === a.id}
                            title={abgeschlossen ? 'Als offen markieren' : 'Als abgeschlossen markieren'}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                              abgeschlossen
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {togglingId === a.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : abgeschlossen
                                ? <><CheckCircle2 className="w-3 h-3" />Ja</>
                                : <><X className="w-3 h-3" />Nein</>
                            }
                          </button>
                        </td>
                        {/* Löschen */}
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleDelete(a)}
                            disabled={deletingId === a.id}
                            title="Offerte löschen"
                            className="inline-flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            {deletingId === a.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}