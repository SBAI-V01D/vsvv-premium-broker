import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, Send, Clock, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { format, differenceInDays } from 'date-fns';
import PageHeader from '../components/shared/PageHeader';
import { sendNotification, contractExpiryEmailBody } from '@/lib/notifications';
import { useToast } from '@/components/ui/use-toast';

const EXPIRY_DAYS = 60; // Warn if contract ends within 60 days

export default function Notifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [manualDialog, setManualDialog] = useState(null); // contract object
  const [customMsg, setCustomMsg] = useState('');
  const [sending, setSending] = useState(null); // id of contract being sent

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: notifications = [], isLoading: notifLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 50),
  });

  // Contracts expiring within EXPIRY_DAYS
  const today = new Date();
  const expiringContracts = contracts.filter(c => {
    if (!c.end_date || c.status !== 'aktiv') return false;
    const days = differenceInDays(new Date(c.end_date), today);
    return days >= 0 && days <= EXPIRY_DAYS;
  }).map(c => {
    const days = differenceInDays(new Date(c.end_date), today);
    const customer = customers.find(cu => cu.id === c.customer_id);
    return { ...c, daysLeft: days, customerEmail: customer?.email || c.customer_email };
  }).sort((a, b) => a.daysLeft - b.daysLeft);

  const handleSendExpiry = async (contract) => {
    setSending(contract.id);
    const body = contractExpiryEmailBody({
      customerName: contract.customer_name,
      insuranceType: contract.insurance_type,
      provider: contract.provider,
      endDate: format(new Date(contract.end_date), 'dd.MM.yyyy'),
    });
    await sendNotification({
      type: 'contract_expiry',
      recipientEmail: contract.customerEmail,
      recipientName: contract.customer_name,
      subject: `Ihr Vertrag läuft bald ab – ${contract.insurance_type} bei ${contract.provider}`,
      body,
      referenceId: contract.id,
      referenceType: 'contract',
    });
    setSending(null);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    toast({ title: 'Benachrichtigung gesendet', description: `E-Mail an ${contract.customerEmail}` });
  };

  const handleManualSend = async () => {
    if (!manualDialog || !customMsg.trim()) return;
    setSending('manual');
    await sendNotification({
      type: 'manual',
      recipientEmail: manualDialog.customerEmail,
      recipientName: manualDialog.customer_name,
      subject: `Nachricht zu Ihrem Vertrag – ${manualDialog.insurance_type}`,
      body: customMsg,
      referenceId: manualDialog.id,
      referenceType: 'contract',
    });
    setSending(null);
    setManualDialog(null);
    setCustomMsg('');
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    toast({ title: 'Benachrichtigung gesendet' });
  };

  const typeConfig = {
    claim_status: { label: 'Schadenstatus', icon: AlertCircle, color: 'text-amber-600 bg-amber-50' },
    contract_expiry: { label: 'Vertragsablauf', icon: Clock, color: 'text-blue-600 bg-blue-50' },
    new_document: { label: 'Neues Dokument', icon: FileText, color: 'text-purple-600 bg-purple-50' },
    manual: { label: 'Manuell', icon: Bell, color: 'text-slate-600 bg-slate-100' },
  };

  return (
    <div>
      <PageHeader title="Benachrichtigungen" subtitle="Kunden automatisch und manuell informieren" />

      {/* Expiring contracts alert section */}
      <Card className="mb-6 border-amber-200 bg-amber-50/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            Verträge mit nahendem Ablaufdatum
            {expiringContracts.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 ml-1">{expiringContracts.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expiringContracts.length === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" /> Keine Verträge laufen in den nächsten {EXPIRY_DAYS} Tagen ab.
            </p>
          ) : (
            <div className="space-y-2">
              {expiringContracts.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-white rounded-lg border border-amber-100 px-4 py-3 gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{c.insurance_type} · {c.provider} · endet {format(new Date(c.end_date), 'dd.MM.yyyy')}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.daysLeft <= 14 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.daysLeft === 0 ? 'Heute' : `${c.daysLeft} Tage`}
                    </span>
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={sending === c.id} onClick={() => handleSendExpiry(c)}>
                      {sending === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      E-Mail senden
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setManualDialog(c); setCustomMsg(contractExpiryEmailBody({ customerName: c.customer_name, insuranceType: c.insurance_type, provider: c.provider, endDate: format(new Date(c.end_date), 'dd.MM.yyyy') })); }}>
                      Anpassen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" /> Verlauf gesendeter Benachrichtigungen
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ</TableHead>
                <TableHead>Empfänger</TableHead>
                <TableHead className="hidden md:table-cell">Betreff</TableHead>
                <TableHead className="hidden lg:table-cell">Datum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : notifications.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Noch keine Benachrichtigungen gesendet</TableCell></TableRow>
              ) : notifications.map(n => {
                const cfg = typeConfig[n.type] || typeConfig.manual;
                const Icon = cfg.icon;
                return (
                  <TableRow key={n.id}>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{n.recipient_name || '–'}</div>
                      <div className="text-xs text-muted-foreground">{n.recipient_email}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[240px]">{n.subject}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {n.created_date ? format(new Date(n.created_date), 'dd.MM.yyyy HH:mm') : '–'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manual message dialog */}
      <Dialog open={!!manualDialog} onOpenChange={(o) => !o && setManualDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Manuelle Benachrichtigung</DialogTitle></DialogHeader>
          {manualDialog && (
            <div className="space-y-4">
              <div>
                <Label>Empfänger</Label>
                <Input value={`${manualDialog.customer_name} <${manualDialog.customerEmail}>`} disabled />
              </div>
              <div>
                <Label>Nachricht</Label>
                <Textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={10} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setManualDialog(null)}>Abbrechen</Button>
                <Button disabled={sending === 'manual' || !customMsg.trim()} onClick={handleManualSend} className="gap-2">
                  {sending === 'manual' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Senden
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}