import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, CheckCircle2, Circle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';

const priorityIcons = {
  dringend: <AlertTriangle className="w-4 h-4 text-red-500" />,
  hoch: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  mittel: <Clock className="w-4 h-4 text-amber-500" />,
  niedrig: <Circle className="w-4 h-4 text-slate-400" />,
};

export default function Tasks() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('offen');
  const [form, setForm] = useState({ title: '', description: '', priority: 'mittel', status: 'offen', task_type: 'allgemein', due_date: '', assigned_to: '' });
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); setShowForm(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const resetForm = () => setForm({ title: '', description: '', priority: 'mittel', status: 'offen', task_type: 'allgemein', due_date: '', assigned_to: '' });

  const filtered = tasks.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchTab = tab === 'alle' || t.status === tab;
    return matchSearch && matchTab;
  });

  const toggleStatus = (task) => {
    const next = task.status === 'erledigt' ? 'offen' : task.status === 'offen' ? 'in_bearbeitung' : 'erledigt';
    updateMutation.mutate({ id: task.id, data: { status: next } });
  };

  return (
    <div>
      <PageHeader title="Aufgaben" subtitle={`${tasks.filter(t => t.status !== 'erledigt').length} offen`}>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Neue Aufgabe
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="offen">Offen</TabsTrigger>
            <TabsTrigger value="in_bearbeitung">In Arbeit</TabsTrigger>
            <TabsTrigger value="erledigt">Erledigt</TabsTrigger>
            <TabsTrigger value="alle">Alle</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">Keine Aufgaben gefunden</Card>
        ) : filtered.map(task => (
          <Card key={task.id} className="p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-3">
              <button onClick={() => toggleStatus(task)} className="mt-0.5 flex-shrink-0">
                {task.status === 'erledigt' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : task.status === 'in_bearbeitung' ? (
                  <Clock className="w-5 h-5 text-primary" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${task.status === 'erledigt' ? 'line-through text-muted-foreground' : ''}`}>
                    {task.title}
                  </p>
                  {priorityIcons[task.priority]}
                </div>
                {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                <div className="flex items-center gap-3 mt-1.5">
                  {task.customer_name && <span className="text-xs text-muted-foreground">{task.customer_name}</span>}
                  {task.due_date && (
                    <span className="text-xs text-muted-foreground">
                      Fällig: {format(new Date(task.due_date), 'dd.MM.yyyy')}
                    </span>
                  )}
                  <StatusBadge status={task.task_type} />
                </div>
              </div>
              <StatusBadge status={task.status} />
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Aufgabe</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div>
              <Label>Titel *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priorität</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="niedrig">Niedrig</SelectItem>
                    <SelectItem value="mittel">Mittel</SelectItem>
                    <SelectItem value="hoch">Hoch</SelectItem>
                    <SelectItem value="dringend">Dringend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Typ</Label>
                <Select value={form.task_type} onValueChange={v => setForm(p => ({ ...p, task_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allgemein">Allgemein</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="erneuerung">Erneuerung</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="beratung">Beratung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Fälligkeitsdatum</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
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