import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Download, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import StatCard from '../components/shared/StatCard';

export default function Commissions() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    contract_id: '', customer_name: '', broker_name: '', broker_email: '',
    type: 'einmalig', amount: '', insurance_type: '', provider: '',
    date: format(new Date(), 'yyyy-MM-dd'), status: 'offen',
  });
  const queryClient = useQueryClient();

  const { data: commissions = [] } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => base44.entities.Commission.list('-created_date'),
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Commission.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['commissions'] }); setShowForm(false); },
  });

  const totalPaid = commissions.filter(c => c.status === 'bezahlt').reduce((s, c) => s + (c.amount || 0), 0);
  const totalOpen = commissions.filter(c => c.status === 'offen').reduce((s, c) => s + (c.amount || 0), 0);
  const recurring = commissions.filter(c => c.type === 'wiederkehrend').reduce((s, c) => s + (c.amount || 0), 0);

  const filtered = commissions.filter(c =>
    `${c.customer_name} ${c.broker_name} ${c.provider}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleContractSelect = (contractId) => {
    const c = contracts.find(x => x.id === contractId);
    if (c) {
      setForm(prev => ({
        ...prev,
        contract_id: contractId,
        customer_name: c.customer_name || '',
        customer_id: c.customer_id || '',
        insurance_type: c.insurance_type || '',
        provider: c.provider || '',
      }));
    }
  };

  const exportCSV = () => {
    const headers = ['Datum', 'Kunde', 'Broker', 'Typ', 'Betrag', 'Art', 'Anbieter', 'Status'];
    const rows = commissions.map(c => [c.date, c.customer_name, c.broker_name, c.type, c.amount, c.insurance_type, c.provider, c.status]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `provisionen_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div>
      <PageHeader title="Provisionen" subtitle="Übersicht aller Provisionen">
        <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" /> CSV Export</Button>
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> Neue Provision</Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Bezahlt (CHF)" value={totalPaid.toLocaleString('de-CH')} icon={Wallet} />
        <StatCard title="Offen (CHF)" value={totalOpen.toLocaleString('de-CH')} icon={Wallet} />
        <StatCard title="Wiederkehrend (CHF)" value={recurring.toLocaleString('de-CH')} icon={Wallet} />
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead className="hidden md:table-cell">Broker</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Betrag</TableHead>
                <TableHead className="hidden lg:table-cell">Art</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Keine Provisionen</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm">{c.date ? format(new Date(c.date), 'dd.MM.yy') : '–'}</TableCell>
                  <TableCell className="font-medium text-sm">{c.customer_name || '–'}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{c.broker_name || '–'}</TableCell>
                  <TableCell className="text-sm">{c.type === 'einmalig' ? 'Einmalig' : 'Wiederk.'}</TableCell>
                  <TableCell className="font-semibold text-sm">CHF {c.amount?.toLocaleString('de-CH')}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{c.insurance_type}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Provision</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, amount: Number(form.amount) }); }} className="space-y-4">
            <div>
              <Label>Vertrag</Label>
              <Select value={form.contract_id} onValueChange={handleContractSelect}>
                <SelectTrigger><SelectValue placeholder="Vertrag wählen..." /></SelectTrigger>
                <SelectContent>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.customer_name} – {c.insurance_type} ({c.provider})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Typ</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="einmalig">Einmalig</SelectItem>
                    <SelectItem value="wiederkehrend">Wiederkehrend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Betrag (CHF) *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Broker Name</Label>
                <Input value={form.broker_name} onChange={e => setForm(p => ({ ...p, broker_name: e.target.value }))} />
              </div>
              <div>
                <Label>Datum</Label>
                <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="offen">Offen</SelectItem>
                  <SelectItem value="bezahlt">Bezahlt</SelectItem>
                  <SelectItem value="storniert">Storniert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
              <Button type="submit" disabled={createMutation.isPending}>Erstellen</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}