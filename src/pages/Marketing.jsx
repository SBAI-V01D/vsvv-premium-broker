import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Mail, Plus, Send, Clock, CheckCircle2, FileText, Trash2,
  Copy, BarChart2, Users, AlertCircle, ChevronRight, LayoutTemplate
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import PageHeader from '../components/shared/PageHeader';
import CampaignForm from '../components/campaigns/CampaignForm';

const STATUS_STYLES = {
  entwurf: 'bg-slate-100 text-slate-600 border-slate-200',
  geplant: 'bg-amber-50 text-amber-700 border-amber-200',
  gesendet: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  abgebrochen: 'bg-red-50 text-red-700 border-red-200',
};
const STATUS_LABEL = { entwurf: 'Entwurf', geplant: 'Geplant', gesendet: 'Gesendet', abgebrochen: 'Abgebrochen' };
const STATUS_ICON = { entwurf: FileText, geplant: Clock, gesendet: CheckCircle2, abgebrochen: AlertCircle };

const CAT_STYLES = {
  newsletter: 'bg-blue-50 text-blue-700',
  information: 'bg-purple-50 text-purple-700',
  aktion: 'bg-orange-50 text-orange-700',
  erinnerung: 'bg-amber-50 text-amber-700',
  sonstiges: 'bg-slate-100 text-slate-600',
};

export default function Marketing() {
  const [showForm, setShowForm] = useState(false);
  const [editCampaign, setEditCampaign] = useState(null);
  const [sending, setSending] = useState(null);
  const [sentResult, setSentResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['email-campaigns'],
    queryFn: () => base44.entities.EmailCampaign.list('-created_date'),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EmailCampaign.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EmailCampaign.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }); setEditCampaign(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EmailCampaign.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
  });

  const handleSend = async (campaign) => {
    setSending(campaign.id);
    setSentResult(null);
    const res = await base44.functions.invoke('sendEmailCampaign', { campaign_id: campaign.id });
    setSending(null);
    setSentResult({ id: campaign.id, ...res.data });
    queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
  };

  const handleSchedule = async (campaign) => {
    await base44.entities.EmailCampaign.update(campaign.id, { status: 'geplant' });
    queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
  };

  const handleDuplicate = (campaign) => {
    setEditCampaign({
      ...campaign,
      id: undefined,
      name: `${campaign.name} (Kopie)`,
      status: 'entwurf',
      sent_at: null,
      sent_count: 0,
      failed_count: 0,
      recipients_count: 0,
    });
    setShowForm(true);
  };

  const regularCampaigns = campaigns.filter(c => !c.is_template);
  const templates = campaigns.filter(c => c.is_template);

  const totalSent = campaigns.filter(c => c.status === 'gesendet').reduce((s, c) => s + (c.sent_count || 0), 0);
  const totalRecipients = campaigns.filter(c => c.status === 'gesendet').reduce((s, c) => s + (c.recipients_count || 0), 0);

  const CampaignCard = ({ c }) => {
    const Icon = STATUS_ICON[c.status] || FileText;
    const isSending = sending === c.id;
    const result = sentResult?.id === c.id ? sentResult : null;
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold text-foreground truncate">{c.name}</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_STYLES[c.status]}`}>
                    <Icon className="w-3 h-3" />
                    {STATUS_LABEL[c.status]}
                  </span>
                  {c.template_category && (
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${CAT_STYLES[c.template_category] || CAT_STYLES.sonstiges}`}>
                      {c.template_category}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{c.subject}</p>
                <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-muted-foreground">
                  {c.scheduled_at && c.status !== 'gesendet' && (
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(c.scheduled_at), 'dd.MM.yyyy HH:mm', { locale: de })}</span>
                  )}
                  {c.status === 'gesendet' && (
                    <>
                      <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> {c.sent_count || 0} gesendet</span>
                      {(c.failed_count || 0) > 0 && <span className="flex items-center gap-1 text-red-500"><AlertCircle className="w-3 h-3" /> {c.failed_count} fehlgeschlagen</span>}
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.recipients_count || 0} Empfänger</span>
                      {c.sent_at && <span>{format(new Date(c.sent_at), 'dd.MM.yyyy HH:mm', { locale: de })}</span>}
                    </>
                  )}
                  <span>Filter: {c.filter_status === 'alle' ? 'Alle Kunden' : c.filter_status}{c.filter_canton ? ` · ${c.filter_canton}` : ''}</span>
                </div>

                {/* Result bar after sending */}
                {result && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                    <p className="font-medium text-emerald-800">✅ Kampagne versendet!</p>
                    <p className="text-emerald-700">{result.sent} von {result.total} E-Mails erfolgreich gesendet{result.failed > 0 ? `, ${result.failed} fehlgeschlagen` : ''}.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {c.status === 'entwurf' && (
                <>
                  {c.scheduled_at && (
                    <Button size="sm" variant="outline" onClick={() => handleSchedule(c)} className="text-amber-600 border-amber-200 hover:bg-amber-50">
                      <Clock className="w-3.5 h-3.5 mr-1" /> Planen
                    </Button>
                  )}
                  <Button size="sm" onClick={() => handleSend(c)} disabled={isSending}>
                    {isSending ? <span className="animate-pulse">Sendet…</span> : <><Send className="w-3.5 h-3.5 mr-1" /> Senden</>}
                  </Button>
                </>
              )}
              {c.status === 'geplant' && (
                <Button size="sm" onClick={() => handleSend(c)} disabled={isSending} variant="outline">
                  {isSending ? 'Sendet…' : <><Send className="w-3.5 h-3.5 mr-1" /> Jetzt senden</>}
                </Button>
              )}
              <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => handleDuplicate(c)} title="Duplizieren">
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(c.id)} title="Löschen">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader title="Marketing" subtitle="E-Mail-Kampagnen & Vorlagen">
        <Button onClick={() => { setEditCampaign(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Neue Kampagne
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><Mail className="w-4 h-4 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Kampagnen</p><p className="text-xl font-bold">{regularCampaigns.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
          <div><p className="text-xs text-muted-foreground">Gesendet</p><p className="text-xl font-bold">{totalSent.toLocaleString('de-CH')}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center"><Clock className="w-4 h-4 text-amber-600" /></div>
          <div><p className="text-xs text-muted-foreground">Geplant</p><p className="text-xl font-bold">{regularCampaigns.filter(c => c.status === 'geplant').length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><LayoutTemplate className="w-4 h-4 text-slate-600" /></div>
          <div><p className="text-xs text-muted-foreground">Vorlagen</p><p className="text-xl font-bold">{templates.length}</p></div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="kampagnen">
        <TabsList className="mb-4">
          <TabsTrigger value="kampagnen">Kampagnen</TabsTrigger>
          <TabsTrigger value="vorlagen">Vorlagen</TabsTrigger>
          <TabsTrigger value="historie">Versandhistorie</TabsTrigger>
        </TabsList>

        <TabsContent value="kampagnen">
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl" />)}</div>
          ) : regularCampaigns.filter(c => c.status !== 'gesendet').length === 0 ? (
            <Card className="p-12 text-center">
              <Mail className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="font-medium">Noch keine Kampagnen</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Erstellen Sie Ihre erste Kampagne.</p>
              <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Neue Kampagne</Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {regularCampaigns.filter(c => c.status !== 'gesendet').map(c => <CampaignCard key={c.id} c={c} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="vorlagen">
          {templates.length === 0 ? (
            <Card className="p-12 text-center">
              <LayoutTemplate className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="font-medium">Noch keine Vorlagen</p>
              <p className="text-sm text-muted-foreground mt-1">Aktivieren Sie beim Erstellen «Als Vorlage speichern».</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {templates.map(c => <CampaignCard key={c.id} c={c} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historie">
          {regularCampaigns.filter(c => c.status === 'gesendet').length === 0 ? (
            <Card className="p-12 text-center">
              <BarChart2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="font-medium">Noch keine gesendeten Kampagnen</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {regularCampaigns.filter(c => c.status === 'gesendet').map(c => (
                <Card key={c.id}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-sm text-muted-foreground">{c.subject}</p>
                        {c.sent_at && <p className="text-xs text-muted-foreground mt-1">{format(new Date(c.sent_at), 'dd.MM.yyyy HH:mm', { locale: de })}</p>}
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <p className="text-xl font-bold text-foreground">{c.recipients_count || 0}</p>
                          <p className="text-xs text-muted-foreground">Empfänger</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-emerald-600">{c.sent_count || 0}</p>
                          <p className="text-xs text-muted-foreground">Gesendet</p>
                        </div>
                        {(c.failed_count || 0) > 0 && (
                          <div className="text-center">
                            <p className="text-xl font-bold text-red-500">{c.failed_count}</p>
                            <p className="text-xs text-muted-foreground">Fehlgeschlagen</p>
                          </div>
                        )}
                        <div className="text-center">
                          <p className="text-xl font-bold text-primary">
                            {c.recipients_count ? Math.round((c.sent_count / c.recipients_count) * 100) : 0}%
                          </p>
                          <p className="text-xs text-muted-foreground">Erfolgsrate</p>
                        </div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    {c.recipients_count > 0 && (
                      <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${Math.round((c.sent_count / c.recipients_count) * 100)}%` }} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditCampaign(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCampaign?.id ? 'Kampagne bearbeiten' : 'Neue Kampagne erstellen'}</DialogTitle>
          </DialogHeader>
          <CampaignForm
            initial={editCampaign || {}}
            loading={createMutation.isPending || updateMutation.isPending}
            onCancel={() => { setShowForm(false); setEditCampaign(null); }}
            onSubmit={(data) => {
              if (editCampaign?.id) {
                updateMutation.mutate({ id: editCampaign.id, data });
              } else {
                createMutation.mutate(data);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}