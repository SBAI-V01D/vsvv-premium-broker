import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertCircle, Search, Edit, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';

const statusLabels = {
  eingereicht: 'Eingereicht',
  in_pruefung: 'In Prüfung',
  genehmigt: 'Genehmigt',
  abgelehnt: 'Abgelehnt',
  ausbezahlt: 'Ausbezahlt',
};

export default function Claims() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['claims'],
    queryFn: () => base44.entities.Claim.list('-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Claim.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['claims'] }); setEditing(null); },
  });

  const filtered = claims.filter(c =>
    `${c.customer_name} ${c.title} ${c.claim_number || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = claims.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader title="Schadensmeldungen" subtitle={`${claims.length} Meldungen insgesamt`} />

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="flex items-center gap-1.5 bg-white border border-border rounded-full px-3 py-1.5 text-xs font-medium">
            <StatusBadge status={status} />
            <span className="text-muted-foreground ml-1">{count}</span>
          </div>
        ))}
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
                <TableHead>Kunde</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead className="hidden md:table-cell">Schadendatum</TableHead>
                <TableHead className="hidden lg:table-cell">Betrag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Keine Schadensmeldungen</TableCell></TableRow>
              ) : filtered.map(claim => (
                <TableRow key={claim.id}>
                  <TableCell className="font-medium text-sm">{claim.customer_name}</TableCell>
                  <TableCell className="text-sm">
                    <div>{claim.title}</div>
                    {claim.insurance_type && <div className="text-xs text-muted-foreground">{claim.insurance_type} · {claim.provider}</div>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {claim.incident_date ? format(new Date(claim.incident_date), 'dd.MM.yyyy') : '–'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {claim.amount_claimed ? `CHF ${claim.amount_claimed.toLocaleString('de-CH')}` : '–'}
                  </TableCell>
                  <TableCell><StatusBadge status={claim.status} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(claim)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schadensmeldung bearbeiten</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ id: editing.id, data: { status: editing.status, amount_approved: editing.amount_approved ? Number(editing.amount_approved) : undefined, claim_number: editing.claim_number, broker_notes: editing.broker_notes } }); }} className="space-y-4">
              <div>
                <Label>Schadennummer</Label>
                <Input value={editing.claim_number || ''} onChange={e => setEditing(p => ({ ...p, claim_number: e.target.value }))} placeholder="z.B. SCH-2024-001" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={v => setEditing(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(editing.status === 'genehmigt' || editing.status === 'ausbezahlt') && (
                <div>
                  <Label>Genehmigter Betrag (CHF)</Label>
                  <Input type="number" step="0.01" value={editing.amount_approved || ''} onChange={e => setEditing(p => ({ ...p, amount_approved: e.target.value }))} />
                </div>
              )}
              <div>
                <Label>Notiz an Kunden</Label>
                <Textarea value={editing.broker_notes || ''} onChange={e => setEditing(p => ({ ...p, broker_notes: e.target.value }))} rows={3} placeholder="Diese Notiz wird dem Kunden im Portal angezeigt." />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Abbrechen</Button>
                <Button type="submit" disabled={updateMutation.isPending}>Speichern</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}