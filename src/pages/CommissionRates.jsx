import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';

const INSURANCE_TYPES = ['KVG', 'VVG', 'Leben', 'Haftpflicht', 'Hausrat', 'Rechtsschutz', 'Motorfahrzeug', 'Gebäude', 'Unfall', 'Krankentaggeld', 'BVG', 'Säule 3a', 'Sonstige'];
const PROVIDERS = ['CSS', 'Helsana', 'Swica', 'Visana', 'Concordia', 'Sanitas', 'Groupe Mutuel', 'Sympany', 'Zurich', 'AXA', 'Helvetia', 'Mobiliar', 'Allianz', 'Generali', 'Baloise', 'Swiss Life', 'Vaudoise', 'Andere'];

export default function CommissionRates() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [form, setForm] = useState({ provider: '', insurance_type: '', commission_percentage: '', notes: '' });
  const [search, setSearch] = useState('');

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ['commissionRates'],
    queryFn: () => base44.entities.CommissionRate.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CommissionRate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissionRates'] });
      setForm({ provider: '', insurance_type: '', commission_percentage: '', notes: '' });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CommissionRate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissionRates'] });
      setEditingRate(null);
      setForm({ provider: '', insurance_type: '', commission_percentage: '', notes: '' });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CommissionRate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commissionRates'] }),
  });

  const filteredRates = rates.filter(r =>
    r.provider.toLowerCase().includes(search.toLowerCase()) ||
    r.insurance_type.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      provider: form.provider,
      insurance_type: form.insurance_type,
      commission_percentage: Number(form.commission_percentage),
      notes: form.notes || undefined,
      is_active: true,
    };

    if (editingRate) {
      updateMutation.mutate({ id: editingRate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (rate) => {
    setEditingRate(rate);
    setForm({
      provider: rate.provider,
      insurance_type: rate.insurance_type,
      commission_percentage: rate.commission_percentage,
      notes: rate.notes || '',
    });
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingRate(null);
    setForm({ provider: '', insurance_type: '', commission_percentage: '', notes: '' });
  };

  return (
    <div>
      <PageHeader 
        title="Provisionssätze"
        subtitle="Verwaltung der Provisionssätze pro Versicherer und Versicherungsart"
      >
        <Button onClick={() => { setEditingRate(null); setForm({ provider: '', insurance_type: '', commission_percentage: '', notes: '' }); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Neuer Satz
        </Button>
      </PageHeader>

      {/* Search */}
      <div className="mb-4">
        <Input 
          placeholder="Nach Versicherer oder Art suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm py-8">Laden...</p>
      ) : filteredRates.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <p className="text-sm">Keine Provisionssätze vorhanden</p>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 text-xs font-semibold">Versicherer</th>
                <th className="text-left p-3 text-xs font-semibold">Versicherungsart</th>
                <th className="text-right p-3 text-xs font-semibold">Provisionssatz</th>
                <th className="text-left p-3 text-xs font-semibold">Bemerkungen</th>
                <th className="text-right p-3 text-xs font-semibold">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRates.map(rate => (
                <tr key={rate.id} className="hover:bg-muted/50 transition-colors">
                  <td className="p-3 text-sm font-medium">{rate.provider}</td>
                  <td className="p-3 text-sm">{rate.insurance_type}</td>
                  <td className="p-3 text-sm text-right font-bold text-primary">{rate.commission_percentage}%</td>
                  <td className="p-3 text-sm text-muted-foreground">{rate.notes || '–'}</td>
                  <td className="p-3 text-right space-x-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleEdit(rate)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(rate.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRate ? 'Satz bearbeiten' : 'Neuer Provisionssatz'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Versicherer *</Label>
              <Select value={form.provider} onValueChange={(v) => setForm(p => ({ ...p, provider: v }))}>
                <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Versicherungsart *</Label>
              <Select value={form.insurance_type} onValueChange={(v) => setForm(p => ({ ...p, insurance_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
                  {INSURANCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Provisionssatz (%) *</Label>
              <Input 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                value={form.commission_percentage}
                onChange={(e) => setForm(p => ({ ...p, commission_percentage: e.target.value }))}
                required
                placeholder="z.B. 5.5"
              />
            </div>

            <div>
              <Label>Bemerkungen</Label>
              <Textarea 
                value={form.notes}
                onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="z.B. Sonderkonditionen, gültig ab..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>Abbrechen</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}