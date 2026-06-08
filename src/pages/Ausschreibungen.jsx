import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, FileText, Clock, Trophy, BarChart3, Sparkles, AlertCircle, CheckCircle2, ChevronRight, Calendar, Building2 } from 'lucide-react';
import AusschreibungForm from '@/components/ausschreibung/AusschreibungForm';

const STATUS_LABELS = {
  entwurf:'Entwurf', vorbereitung:'In Vorbereitung', versendet:'Versendet',
  offerten_ausstehend:'Offerten ausstehend', teilweise_erhalten:'Teilweise erhalten',
  vollstaendig_erhalten:'Vollständig erhalten', in_analyse:'In Analyse',
  praesentation_erstellt:'Präsentation erstellt', praesentiert:'Präsentiert',
  entscheidung_ausstehend:'Entscheidung ausstehend', gewonnen:'Gewonnen',
  verloren:'Verloren', abgeschlossen:'Abgeschlossen',
};
const STATUS_COLORS = {
  entwurf:'badge-neutral', vorbereitung:'badge-info', versendet:'badge-info',
  offerten_ausstehend:'badge-warning', teilweise_erhalten:'badge-warning',
  vollstaendig_erhalten:'badge-success', in_analyse:'badge-purple',
  praesentation_erstellt:'badge-purple', praesentiert:'badge-purple',
  entscheidung_ausstehend:'badge-warning', gewonnen:'badge-success',
  verloren:'badge-danger', abgeschlossen:'badge-neutral',
};
const PRIO_COLORS = {
  dringend:'text-rose-600 bg-rose-50 border border-rose-200',
  hoch:'text-amber-600 bg-amber-50 border border-amber-200',
  mittel:'text-blue-600 bg-blue-50 border border-blue-200',
  niedrig:'text-slate-500 bg-slate-50 border border-slate-200',
};

export default function Ausschreibungen() {
  const navigate = useNavigate();
  const [ausschreibungen, setAusschreibungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');

  const load = async () => {
    const data = await base44.entities.Ausschreibung.list('-created_date', 200);
    setAusschreibungen(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createAusschreibung = async (data) => {
    const user = await base44.auth.me();
    let organization_id = data.organization_id;
    if (!organization_id && data.customer_id) {
      const customer = await base44.entities.Customer.get(data.customer_id).catch(() => null);
      organization_id = customer?.organization_id;
    }
    if (!organization_id) {
      // Fallback: erste Organisation laden
      const orgs = await base44.entities.Organization.list(null, 1);
      organization_id = orgs?.[0]?.id;
    }
    await base44.entities.Ausschreibung.create({ ...data, broker_name: user?.full_name, broker_id: user?.id, organization_id });
    setShowForm(false);
    load();
  };

  const filtered = ausschreibungen.filter(a => {
    const matchSearch = !search || (a.titel + ' ' + (a.customer_name||'') + ' ' + (a.ausschreibung_nummer||'')).toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'alle' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const offen = ausschreibungen.filter(a => !['gewonnen','verloren','abgeschlossen'].includes(a.status)).length;
  const laufend = ausschreibungen.filter(a => ['versendet','offerten_ausstehend','teilweise_erhalten','vollstaendig_erhalten','in_analyse'].includes(a.status)).length;
  const gewonnen = ausschreibungen.filter(a => a.status === 'gewonnen').length;
  const abgeschlossen = ausschreibungen.filter(a => ['gewonnen','verloren'].includes(a.status)).length;
  const successRate = abgeschlossen > 0 ? Math.round(gewonnen / abgeschlossen * 100) : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading">Ausschreibungen</h1>
          <p className="text-body-sm text-muted-foreground">Versicherungsausschreibungen & KI-Offertvergleich</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" />Neue Ausschreibung</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: FileText, label: 'Offen', value: offen, color: 'text-blue-600' },
          { icon: Clock, label: 'Laufend', value: laufend, color: 'text-amber-600' },
          { icon: Trophy, label: 'Gewonnen', value: gewonnen, color: 'text-emerald-600' },
          { icon: BarChart3, label: 'Erfolgsquote', value: successRate !== null ? successRate + '%' : '—', color: 'text-purple-600' },
        ].map(kpi => (
          <div key={kpi.label} className="surface p-4 flex items-center gap-3">
            <kpi.icon className={`w-7 h-7 ${kpi.color} opacity-80`} />
            <div><p className="text-caption text-muted-foreground">{kpi.label}</p><p className="text-2xl font-bold">{kpi.value}</p></div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 surface">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">Keine Ausschreibungen gefunden.</p>
          <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>Erste Ausschreibung erstellen</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const today = new Date();
            const frist = a.fristdatum ? new Date(a.fristdatum) : null;
            const daysTillFrist = frist ? Math.ceil((frist - today) / 86400000) : null;
            const fristDringend = daysTillFrist !== null && daysTillFrist <= 7 && daysTillFrist >= 0;
            const fristAbgelaufen = daysTillFrist !== null && daysTillFrist < 0;
            const offertenErhalten = (a.offerten_count || 0);
            const versichererCount = (a.ausgewaehlte_versicherer || []).length;
            const offerten_ausstehend = versichererCount > 0 ? Math.max(0, versichererCount - offertenErhalten) : null;

            return (
              <div key={a.id} onClick={() => navigate('/ausschreibungen/' + a.id)}
                className="surface p-0 cursor-pointer hover:shadow-card-md transition-all group overflow-hidden">
                {/* Farbbalken oben je Priorität */}
                <div className={`h-1 w-full ${a.prioritaet === 'dringend' ? 'bg-rose-500' : a.prioritaet === 'hoch' ? 'bg-amber-400' : a.prioritaet === 'mittel' ? 'bg-blue-400' : 'bg-slate-200'}`} />

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Links: Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{a.titel}</p>
                        {a.ki_empfohlener_versicherer && <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" title="KI-Empfehlung vorhanden" />}
                      </div>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" />{a.customer_name || '—'}
                        </span>
                        {a.ausschreibung_nummer && (
                          <span className="text-xs font-mono text-muted-foreground">{a.ausschreibung_nummer}</span>
                        )}
                        {(a.sparten||[]).slice(0,3).map(s => (
                          <span key={s} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                        {(a.sparten||[]).length > 3 && (
                          <span className="text-xs text-muted-foreground">+{a.sparten.length - 3}</span>
                        )}
                      </div>
                    </div>

                    {/* Rechts: Status + Ampel */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Offerten-Ampel */}
                      {offerten_ausstehend !== null && (
                        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
                          offerten_ausstehend === 0 ? 'bg-emerald-50 text-emerald-700' :
                          offerten_ausstehend <= 1 ? 'bg-amber-50 text-amber-700' :
                          'bg-rose-50 text-rose-700'
                        }`}>
                          {offerten_ausstehend === 0
                            ? <><CheckCircle2 className="w-3 h-3" /> Alle erhalten</>
                            : <><AlertCircle className="w-3 h-3" /> {offerten_ausstehend} ausstehend</>
                          }
                        </div>
                      )}

                      {/* Frist-Badge */}
                      {frist && (
                        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                          fristAbgelaufen ? 'bg-rose-100 text-rose-700 font-semibold' :
                          fristDringend ? 'bg-amber-100 text-amber-700 font-semibold' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          <Calendar className="w-3 h-3" />
                          {fristAbgelaufen ? `Frist abgelaufen` :
                           fristDringend ? `Frist in ${daysTillFrist}d` :
                           a.fristdatum}
                        </div>
                      )}

                      <Badge className={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>

                  {/* Laufende Prämie wenn vorhanden */}
                  {a.laufende_praemie > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-4">
                      <span className="text-xs text-muted-foreground">Laufende Jahresprämie:</span>
                      <span className="text-xs font-semibold text-slate-700">CHF {Number(a.laufende_praemie).toLocaleString('de-CH')}</span>
                      {a.ki_empfohlener_versicherer && (
                        <span className="text-xs text-primary flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Empfehlung: {a.ki_empfohlener_versicherer}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Neue Ausschreibung</DialogTitle></DialogHeader>
          <AusschreibungForm onSave={createAusschreibung} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}