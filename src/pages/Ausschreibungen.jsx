import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, FileText, Clock, Trophy, BarChart3, Sparkles } from 'lucide-react';
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
    await base44.entities.Ausschreibung.create({ ...data, broker_name: user?.full_name, broker_id: user?.id });
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
        <div className="space-y-2">
          {filtered.map(a => (
            <div key={a.id} onClick={() => navigate('/ausschreibungen/' + a.id)}
              className="surface p-4 flex items-center justify-between cursor-pointer hover:shadow-card-md transition-all group">
              <div className="flex items-center gap-4 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold truncate group-hover:text-primary transition-colors">{a.titel}</p>
                    {a.ki_empfohlener_versicherer && <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{a.customer_name} · {a.ausschreibung_nummer} · {(a.sparten||[]).slice(0,3).join(', ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIO_COLORS[a.prioritaet] || PRIO_COLORS.mittel}`}>{a.prioritaet}</span>
                <Badge className={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                {a.fristdatum && <span className="text-xs text-muted-foreground hidden lg:block">{a.fristdatum}</span>}
              </div>
            </div>
          ))}
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