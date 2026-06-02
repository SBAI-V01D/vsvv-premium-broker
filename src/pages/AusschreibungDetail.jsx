import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Sparkles, FileText, Edit } from 'lucide-react';
import OfferteForm from '@/components/ausschreibung/OfferteForm';
import VergleichsMatrix from '@/components/ausschreibung/VergleichsMatrix';
import KIEmpfehlung from '@/components/ausschreibung/KIEmpfehlung';
import RisikoFormular from '@/components/ausschreibung/RisikoFormular';
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

export default function AusschreibungDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ausschreibung, setAusschreibung] = useState(null);
  const [offerten, setOfferten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOfferteDialog, setShowOfferteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingOfferte, setEditingOfferte] = useState(null);

  const load = async () => {
    const [list, o] = await Promise.all([
      base44.entities.Ausschreibung.filter({ id }),
      base44.entities.Offerte.filter({ ausschreibung_id: id }),
    ]);
    setAusschreibung(list[0] || null);
    setOfferten(o);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const saveOfferte = async (data) => {
    if (editingOfferte?.id) await base44.entities.Offerte.update(editingOfferte.id, data);
    else await base44.entities.Offerte.create(data);
    setShowOfferteDialog(false);
    setEditingOfferte(null);
    load();
  };

  const saveAusschreibung = async (data) => {
    await base44.entities.Ausschreibung.update(id, data);
    setShowEditDialog(false);
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!ausschreibung) return <div className="p-8 text-center text-muted-foreground">Ausschreibung nicht gefunden.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ausschreibungen')}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-heading">{ausschreibung.titel}</h1>
              <Badge className={STATUS_COLORS[ausschreibung.status]}>{STATUS_LABELS[ausschreibung.status]}</Badge>
            </div>
            <p className="text-body-sm text-muted-foreground">{ausschreibung.ausschreibung_nummer} · {ausschreibung.customer_name} · {(ausschreibung.sparten||[]).join(', ')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)} className="gap-1"><Edit className="w-3.5 h-3.5" />Bearbeiten</Button>
          <Button size="sm" onClick={() => { setEditingOfferte(null); setShowOfferteDialog(true); }} className="gap-1"><Plus className="w-3.5 h-3.5" />Offerte</Button>
        </div>
      </div>

      <Tabs defaultValue="uebersicht">
        <TabsList>
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
          <TabsTrigger value="risiko">Risikodaten</TabsTrigger>
          <TabsTrigger value="offerten">Offerten ({offerten.length})</TabsTrigger>
          <TabsTrigger value="vergleich">Vergleich</TabsTrigger>
          <TabsTrigger value="analyse">KI Analyse</TabsTrigger>
        </TabsList>

        <TabsContent value="uebersicht" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Offerten', value: offerten.filter(o => o.status !== 'ausstehend').length + ' / ' + offerten.length },
              { label: 'Fristdatum', value: ausschreibung.fristdatum || '—' },
              { label: 'Priorität', value: ausschreibung.prioritaet || '—' },
              { label: 'Laufende Prämie', value: ausschreibung.laufende_praemie ? `CHF ${Number(ausschreibung.laufende_praemie).toLocaleString('de-CH')}` : '—' },
            ].map(kpi => (
              <div key={kpi.label} className="surface p-4">
                <p className="text-caption text-muted-foreground mb-1">{kpi.label}</p>
                <p className="text-lg font-semibold">{kpi.value}</p>
              </div>
            ))}
          </div>
          {ausschreibung.bemerkungen && (
            <div className="surface p-4"><h3 className="font-semibold mb-2">Bemerkungen</h3><p className="text-sm text-slate-700 whitespace-pre-wrap">{ausschreibung.bemerkungen}</p></div>
          )}
          {ausschreibung.ki_empfehlung_text && (
            <div className="surface p-4 border-l-4 border-l-primary">
              <h3 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />KI-Empfehlung</h3>
              <p className="text-sm text-slate-700">{ausschreibung.ki_empfehlung_text}</p>
              {ausschreibung.ki_empfohlener_versicherer && <Badge className="badge-success mt-2">{ausschreibung.ki_empfohlener_versicherer}</Badge>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="risiko" className="mt-4">
          <div className="surface p-6">
            <h3 className="text-subheading mb-4">Risikoerfassung</h3>
            <RisikoFormular sparten={ausschreibung.sparten || []} data={ausschreibung.risiko_daten || {}}
              onChange={async (d) => { await base44.entities.Ausschreibung.update(id, { risiko_daten: d }); load(); }} />
          </div>
        </TabsContent>

        <TabsContent value="offerten" className="mt-4 space-y-3">
          {offerten.length === 0 ? (
            <div className="text-center py-12 surface">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-muted-foreground mb-3">Noch keine Offerten erfasst.</p>
              <Button size="sm" onClick={() => setShowOfferteDialog(true)}>Erste Offerte erfassen</Button>
            </div>
          ) : offerten.map(o => (
            <div key={o.id} className="surface p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-semibold">{o.versicherer_name}</p>
                  <p className="text-xs text-muted-foreground">{o.offert_nummer} · {o.laufzeit}</p>
                </div>
                {o.ki_score != null && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">KI Score</p>
                    <p className={`font-bold ${o.ki_score >= 75 ? 'text-emerald-600' : o.ki_score >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{Math.round(o.ki_score)}</p>
                  </div>
                )}
                {o.ist_empfohlen && <Badge className="badge-success gap-1"><Sparkles className="w-3 h-3" />Empfohlen</Badge>}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold">{o.praemie_jaehrlich ? `CHF ${Number(o.praemie_jaehrlich).toLocaleString('de-CH')}` : '—'}</p>
                  <p className="text-xs text-muted-foreground">/ Jahr</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setEditingOfferte(o); setShowOfferteDialog(true); }}>Bearbeiten</Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="vergleich" className="mt-4">
          <div className="surface p-6">
            <h3 className="text-subheading mb-4">Vergleichsmatrix</h3>
            <VergleichsMatrix offerten={offerten} />
          </div>
        </TabsContent>

        <TabsContent value="analyse" className="mt-4">
          <div className="surface p-6">
            <KIEmpfehlung ausschreibung={ausschreibung} offerten={offerten} onUpdate={async (res) => {
              await base44.entities.Ausschreibung.update(id, {
                ki_analyse: res, ki_empfehlung_text: res.broker_fazit,
                ki_empfohlener_versicherer: res.empfohlener_versicherer, status: 'in_analyse',
              });
              load();
            }} />
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showOfferteDialog} onOpenChange={v => { setShowOfferteDialog(v); if (!v) setEditingOfferte(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingOfferte ? 'Offerte bearbeiten' : 'Offerte erfassen'}</DialogTitle></DialogHeader>
          <OfferteForm ausschreibung={ausschreibung} offerte={editingOfferte} onSave={saveOfferte} onCancel={() => { setShowOfferteDialog(false); setEditingOfferte(null); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ausschreibung bearbeiten</DialogTitle></DialogHeader>
          <AusschreibungForm ausschreibung={ausschreibung} onSave={saveAusschreibung} onCancel={() => setShowEditDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}