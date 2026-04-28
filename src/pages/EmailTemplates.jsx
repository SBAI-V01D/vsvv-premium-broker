import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit, Trash2, Copy } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const CATEGORIES = {
  kundigung: { label: 'Kündigung', color: 'bg-red-50 text-red-700' },
  erneuerung: { label: 'Erneuerung', color: 'bg-blue-50 text-blue-700' },
  termin: { label: 'Termin', color: 'bg-purple-50 text-purple-700' },
  dokumentanfrage: { label: 'Dokumentanfrage', color: 'bg-yellow-50 text-yellow-700' },
  schadenmeldung: { label: 'Schadenmeldung', color: 'bg-orange-50 text-orange-700' },
  allgemein: { label: 'Allgemein', color: 'bg-slate-50 text-slate-700' },
};

const PLACEHOLDERS = ['customer_name', 'customer_firstname', 'customer_email', 'customer_phone', 'customer_city', 'customer_zip', 'contract_type', 'contract_provider', 'contract_policy', 'contract_premium', 'contract_start', 'contract_end'];

export default function EmailTemplates() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', category: 'allgemein', subject: '', body: '', description: '', is_default: false });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: () => base44.entities.EmailTemplate.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EmailTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      toast.success('Vorlage erstellt');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EmailTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      toast.success('Vorlage aktualisiert');
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EmailTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      toast.success('Vorlage gelöscht');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (template) => base44.entities.EmailTemplate.create({ ...template, id: undefined, name: `${template.name} (Kopie)` }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      toast.success('Vorlage dupliziert');
    },
  });

  const resetForm = () => {
    setForm({ name: '', category: 'allgemein', subject: '', body: '', description: '', is_default: false });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (template) => {
    setForm(template);
    setEditingId(template.id);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form, placeholders: PLACEHOLDERS };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader 
        title="E-Mail-Vorlagen" 
        subtitle="Verwaltung von Standard-E-Mail-Vorlagen mit Platzhaltern"
      >
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Neue Vorlage
        </Button>
      </PageHeader>

      <div className="mb-4">
        <Input
          placeholder="Vorlagen durchsuchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Laden...</p>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Keine Vorlagen vorhanden
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.map(template => (
            <Card key={template.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{template.name}</h3>
                      <Badge className={CATEGORIES[template.category]?.color}>
                        {CATEGORIES[template.category]?.label}
                      </Badge>
                      {template.is_default && <Badge variant="outline">Standard</Badge>}
                    </div>
                    {template.description && <p className="text-xs text-muted-foreground mb-2">{template.description}</p>}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground"><strong>Betreff:</strong> {template.subject}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2"><strong>Nachricht:</strong> {template.body}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => duplicateMutation.mutate(template)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(template.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <Label>Kategorie</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Beschreibung</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Wofür wird diese Vorlage verwendet?" />
            </div>

            <div>
              <Label>Betreff *</Label>
              <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="z.B. Kündigungsbestätigung für {{ customer_name }}" required />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Nachricht *</Label>
                <p className="text-xs text-muted-foreground">Verfügbare Platzhalter:</p>
              </div>
              <Textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={8} className="font-mono text-xs" required />
              <div className="flex flex-wrap gap-1 mt-2">
                {PLACEHOLDERS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, body: prev.body + `{{ ${p} }}` }))}
                    className="text-xs bg-muted hover:bg-primary/10 hover:text-primary px-2 py-0.5 rounded transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button type="button" variant="outline" onClick={resetForm}>Abbrechen</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? 'Aktualisieren' : 'Erstellen'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}