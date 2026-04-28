import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Clock, AlertTriangle, CalendarClock, Send, Loader2,
  CheckCircle, RefreshCw, Filter, ChevronDown, Mail, Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { format, differenceInDays, addMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import PageHeader from '../components/shared/PageHeader';
import { sendNotification } from '@/lib/notifications';
import { useToast } from '@/components/ui/use-toast';

const MONTHS = 6;

function urgencyBadge(days) {
  if (days <= 14)  return { label: `${days}T`, cls: 'bg-red-100 text-red-700 border-red-200' };
  if (days <= 30)  return { label: `${days}T`, cls: 'bg-orange-100 text-orange-700 border-orange-200' };
  if (days <= 60)  return { label: `${days}T`, cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  return           { label: `${days}T`, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
}

function brokerReminderBody({ brokerName, customerName, insuranceType, provider, endDate, cancellationDate, type }) {
  const typeLabel = type === 'cancellation' ? 'Kündigungsfrist' : 'Vertragsverlängerung';
  const dateLabel = type === 'cancellation' ? cancellationDate : endDate;
  return `Guten Tag ${brokerName || 'Kundenberater'},

dies ist eine automatische Wiedervorlage-Erinnerung für:

Kunde:            ${customerName}
Versicherungsart: ${insuranceType}
Anbieter:         ${provider}
${type === 'cancellation' ? `Kündigungsfrist: ${cancellationDate}` : `Vertragsende:    ${endDate}`}

Bitte nehmen Sie zeitnah Kontakt mit dem Kunden auf, um die ${typeLabel} zu besprechen.

Mit freundlichen Grüssen
BrokerCRM – Automatisches Wiedervorlage-System`;
}

function customerRenewalBody({ customerName, insuranceType, provider, endDate }) {
  return `Guten Tag ${customerName},

Ihr Versicherungsvertrag läuft bald aus:

Versicherungsart: ${insuranceType}
Anbieter:         ${provider}
Vertragsende:     ${endDate}

Ihr Berater wird sich in Kürze bei Ihnen melden, um die Verlängerung zu besprechen. Sie können uns auch jederzeit proaktiv kontaktieren.

Mit freundlichen Grüssen
Ihr Versicherungsbroker`;
}

export default function Wiedervorlage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterMonths, setFilterMonths] = useState('6');
  const [filterType, setFilterType]   = useState('all');
  const [sendingId, setSendingId]      = useState(null);
  const [dialog, setDialog]            = useState(null); // { contract, mode: 'broker'|'customer' }
  const [msgOverride, setMsgOverride]  = useState('');
  const [subjectOverride, setSubjectOverride] = useState('');

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 200),
  });

  const today = new Date();
  const horizon = addMonths(today, parseInt(filterMonths));

  // Build enriched contract list with all relevant dates
  const enriched = contracts
    .filter(c => c.status === 'aktiv')
    .map(c => {
      const customer = customers.find(cu => cu.id === c.customer_id);
      const brokerEmail = customer?.assigned_broker || c.assigned_broker;
      const endDays    = c.end_date ? differenceInDays(new Date(c.end_date), today) : null;
      const cancelDays = c.cancellation_deadline ? differenceInDays(new Date(c.cancellation_deadline), today) : null;
      return {
        ...c,
        customerEmail: customer?.email || '',
        brokerEmail,
        endDays,
        cancelDays,
      };
    });

  // Upcoming renewals
  const renewals = enriched
    .filter(c => c.endDays !== null && c.endDays >= 0 && new Date(c.end_date) <= horizon)
    .sort((a, b) => a.endDays - b.endDays);

  // Upcoming cancellation deadlines
  const cancellations = enriched
    .filter(c => c.cancelDays !== null && c.cancelDays >= 0 && new Date(c.cancellation_deadline) <= horizon)
    .sort((a, b) => a.cancelDays - b.cancelDays);

  // All items merged for "all" view
  const allItems = [
    ...renewals.map(c => ({ ...c, _type: 'renewal', _days: c.endDays })),
    ...cancellations
      .filter(c => !renewals.find(r => r.id === c.id)) // avoid dups if both match
      .map(c => ({ ...c, _type: 'cancellation', _days: c.cancelDays })),
  ].sort((a, b) => a._days - b._days);

  const displayList = filterType === 'renewal'      ? renewals.map(c => ({ ...c, _type: 'renewal', _days: c.endDays }))
                    : filterType === 'cancellation'  ? cancellations.map(c => ({ ...c, _type: 'cancellation', _days: c.cancelDays }))
                    : allItems;

  // Stats
  const urgent     = allItems.filter(i => i._days <= 14).length;
  const thisMonth  = allItems.filter(i => i._days <= 30).length;
  const sentToday  = notifications.filter(n => n.created_date && differenceInDays(today, new Date(n.created_date)) === 0).length;

  async function sendBrokerReminder(item) {
    setSendingId(item.id + '_broker');
    const brokerEmail = item.brokerEmail || item.assigned_broker;
    if (!brokerEmail) {
      toast({ title: 'Kein Berater hinterlegt', description: 'Dem Kunden ist kein Berater zugewiesen.', variant: 'destructive' });
      setSendingId(null);
      return;
    }
    const body = brokerReminderBody({
      brokerName: brokerEmail,
      customerName: item.customer_name,
      insuranceType: item.insurance_type,
      provider: item.provider,
      endDate: item.end_date ? format(new Date(item.end_date), 'dd.MM.yyyy') : '–',
      cancellationDate: item.cancellation_deadline ? format(new Date(item.cancellation_deadline), 'dd.MM.yyyy') : '–',
      type: item._type,
    });
    await sendNotification({
      type: 'contract_expiry',
      recipientEmail: brokerEmail,
      recipientName: brokerEmail,
      subject: `⏰ Wiedervorlage: ${item._type === 'cancellation' ? 'Kündigungsfrist' : 'Vertragsverlängerung'} – ${item.customer_name} (${item.insurance_type})`,
      body,
      referenceId: item.id,
      referenceType: 'contract',
    });
    setSendingId(null);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    toast({ title: 'Erinnerung gesendet', description: `An ${brokerEmail}` });
  }

  async function sendCustomerReminder(item) {
    setSendingId(item.id + '_customer');
    const email = item.customerEmail;
    if (!email) {
      toast({ title: 'Keine E-Mail', description: 'Kunde hat keine E-Mail-Adresse.', variant: 'destructive' });
      setSendingId(null);
      return;
    }
    const body = customerRenewalBody({
      customerName: item.customer_name,
      insuranceType: item.insurance_type,
      provider: item.provider,
      endDate: item.end_date ? format(new Date(item.end_date), 'dd.MM.yyyy') : '–',
    });
    await sendNotification({
      type: 'contract_expiry',
      recipientEmail: email,
      recipientName: item.customer_name,
      subject: `Ihr Vertrag läuft bald ab – ${item.insurance_type} bei ${item.provider}`,
      body,
      referenceId: item.id,
      referenceType: 'contract',
    });
    setSendingId(null);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    toast({ title: 'Kundenerinnerung gesendet', description: `An ${email}` });
  }

  function openDialog(item, mode) {
    const isBroker = mode === 'broker';
    const body = isBroker
      ? brokerReminderBody({
          brokerName: item.brokerEmail || '',
          customerName: item.customer_name,
          insuranceType: item.insurance_type,
          provider: item.provider,
          endDate: item.end_date ? format(new Date(item.end_date), 'dd.MM.yyyy') : '–',
          cancellationDate: item.cancellation_deadline ? format(new Date(item.cancellation_deadline), 'dd.MM.yyyy') : '–',
          type: item._type,
        })
      : customerRenewalBody({
          customerName: item.customer_name,
          insuranceType: item.insurance_type,
          provider: item.provider,
          endDate: item.end_date ? format(new Date(item.end_date), 'dd.MM.yyyy') : '–',
        });
    const subject = isBroker
      ? `⏰ Wiedervorlage: ${item._type === 'cancellation' ? 'Kündigungsfrist' : 'Vertragsverlängerung'} – ${item.customer_name} (${item.insurance_type})`
      : `Ihr Vertrag läuft bald ab – ${item.insurance_type} bei ${item.provider}`;
    setDialog({ item, mode });
    setMsgOverride(body);
    setSubjectOverride(subject);
  }

  async function sendDialogMsg() {
    if (!dialog) return;
    const { item, mode } = dialog;
    setSendingId('dialog');
    const email = mode === 'broker' ? (item.brokerEmail || '') : item.customerEmail;
    const name  = mode === 'broker' ? (item.brokerEmail || 'Berater') : item.customer_name;
    await sendNotification({
      type: 'contract_expiry',
      recipientEmail: email,
      recipientName: name,
      subject: subjectOverride,
      body: msgOverride,
      referenceId: item.id,
      referenceType: 'contract',
    });
    setSendingId(null);
    setDialog(null);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    toast({ title: 'Nachricht gesendet', description: `An ${email}` });
  }

  return (
    <div>
      <PageHeader
        title="Wiedervorlage"
        subtitle="Vertragsverlängerungen und Kündigungsfristen der nächsten 6 Monate"
      >
        <Select value={filterMonths} onValueChange={setFilterMonths}>
          <SelectTrigger className="w-40">
            <CalendarClock className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 Monat</SelectItem>
            <SelectItem value="2">2 Monate</SelectItem>
            <SelectItem value="3">3 Monate</SelectItem>
            <SelectItem value="6">6 Monate</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Dringend (≤14T)', value: urgent,           icon: AlertTriangle, color: 'text-red-500 bg-red-50'  },
          { label: 'Diesen Monat',    value: thisMonth,         icon: Clock,         color: 'text-orange-500 bg-orange-50' },
          { label: 'Total Wiedervorl.', value: allItems.length, icon: CalendarClock, color: 'text-primary bg-primary/10' },
          { label: 'Gesendet heute',  value: sentToday,         icon: Mail,          color: 'text-emerald-500 bg-emerald-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter + Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Wiedervorlage-Liste
          </CardTitle>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Einträge</SelectItem>
              <SelectItem value="renewal">Nur Verlängerungen</SelectItem>
              <SelectItem value="cancellation">Nur Kündigungsfristen</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Laden...
            </div>
          ) : displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <CheckCircle className="w-10 h-10 text-emerald-300" />
              <p className="text-sm">Keine Einträge im gewählten Zeitraum</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {displayList.map(item => {
                const badge = urgencyBadge(item._days);
                const isSendingBroker   = sendingId === item.id + '_broker';
                const isSendingCustomer = sendingId === item.id + '_customer';
                const dateLabel = item._type === 'cancellation' && item.cancellation_deadline
                  ? format(new Date(item.cancellation_deadline), 'dd.MM.yyyy')
                  : item.end_date ? format(new Date(item.end_date), 'dd.MM.yyyy') : '–';

                return (
                  <div key={item.id + item._type} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                    {/* Left */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{item.customer_name}</p>
                          <Badge variant="outline" className={`text-xs ${item._type === 'cancellation' ? 'border-red-200 text-red-700' : 'border-blue-200 text-blue-700'}`}>
                            {item._type === 'cancellation' ? '⚠️ Kündigungsfrist' : '🔄 Verlängerung'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.insurance_type} · {item.provider}
                          {' · '}
                          <span className="font-medium text-foreground">{dateLabel}</span>
                          {item.brokerEmail && <span className="ml-2 text-muted-foreground">· {item.brokerEmail}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8"
                        disabled={!!sendingId}
                        onClick={() => sendBrokerReminder(item)}
                      >
                        {isSendingBroker ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Berater erinnern
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8"
                        disabled={!!sendingId}
                        onClick={() => sendCustomerReminder(item)}
                      >
                        {isSendingCustomer ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                        Kunde informieren
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-8"
                        onClick={() => openDialog(item, 'broker')}
                      >
                        Anpassen
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom message dialog */}
      <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'broker' ? 'Berater-Erinnerung anpassen' : 'Kundennachricht anpassen'}
            </DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-4">
              <div>
                <Label>Empfänger</Label>
                <Input
                  value={dialog.mode === 'broker'
                    ? (dialog.item.brokerEmail || 'Kein Berater hinterlegt')
                    : dialog.item.customerEmail}
                  disabled
                />
              </div>
              <div>
                <Label>Betreff</Label>
                <Input value={subjectOverride} onChange={e => setSubjectOverride(e.target.value)} />
              </div>
              <div>
                <Label>Nachricht</Label>
                <Textarea value={msgOverride} onChange={e => setMsgOverride(e.target.value)} rows={12} />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openDialog(dialog.item, 'customer')} className={dialog.mode === 'customer' ? 'bg-primary/10' : ''}>
                  Kundenversion
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openDialog(dialog.item, 'broker')} className={dialog.mode === 'broker' ? 'bg-primary/10' : ''}>
                  Beraterversion
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Abbrechen</Button>
            <Button
              disabled={sendingId === 'dialog' || !msgOverride.trim()}
              onClick={sendDialogMsg}
              className="gap-2"
            >
              {sendingId === 'dialog' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}