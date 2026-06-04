import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import FilterBar from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import {
  Plus, CheckCircle2, Circle, Clock, AlertCircle,
  Calendar, User, Trash2, Pencil, ChevronRight, ClipboardCheck
} from 'lucide-react';
import { format, isToday, isPast, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const PRIORITY_CONFIG = {
  low:    { label: 'Niedrig',  className: 'badge-neutral' },
  medium: { label: 'Mittel',   className: 'badge-info' },
  high:   { label: 'Hoch',     className: 'badge-warning' },
  urgent: { label: 'Dringend', className: 'badge-danger' },
};

const STATUS_CONFIG = {
  open:        { label: 'Offen',        icon: Circle,       className: 'text-muted-foreground' },
  in_progress: { label: 'In Bearbeitung', icon: Clock,      className: 'text-blue-500' },
  completed:   { label: 'Erledigt',     icon: CheckCircle2, className: 'text-emerald-500' },
};

const TYPE_LABELS = {
  onboarding:        'Onboarding',
  renewal:           'Verlängerung',
  follow_up:         'Follow-up',
  consultation:      'Beratung',
  general:           'Allgemein',
  health_declaration:'Gesundheitserklärung',
};

const EMPTY_FORM = {
  title: '', description: '', priority: 'medium', status: 'open',
  task_type: 'general', due_date: '', assigned_to: '', customer_id: '', notes: '',
};

export default function Tasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterPriority, setFilterPriority] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const showFormRef = useRef(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date', 200),
  });

  // Manuelle Datumsprüfung — Verträge mit Platzhalter-Datum
  const { data: reviewContracts = [] } = useQuery({
    queryKey: ['tasks_date_review'],
    queryFn: () => base44.entities.Contract.filter({ archived: false }, '-updated_date', 500),
    staleTime: 5 * 60 * 1000,
  });
  const dateReviewItems = reviewContracts.filter(c =>
    c.end_date?.startsWith('9999') || c.end_date?.startsWith('0001') || !c.end_date
  );
  const [showAllDateReview, setShowAllDateReview] = useState(false);
  const DATE_REVIEW_LIMIT = 5;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: (newTask) => {
      queryClient.setQueryData(['tasks'], (old = []) => [newTask, ...old]);
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['tasks'], (old = []) =>
        old.map(t => t.id === updated.id ? updated : t)
      );
      // Only close form if the form dialog was open (not inline status toggles)
      if (showFormRef.current) closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData(['tasks'], (old = []) => old.filter(t => t.id !== id));
    },
  });

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); showFormRef.current = true; setShowForm(true); };
  const openEdit = (task) => { setEditing(task); setForm({ ...EMPTY_FORM, ...task }); showFormRef.current = true; setShowForm(true); };
  const closeForm = () => { showFormRef.current = false; setShowForm(false); setEditing(null); setForm(EMPTY_FORM); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const toggleStatus = (task) => {
    const next = task.status === 'open' ? 'in_progress' : task.status === 'in_progress' ? 'completed' : 'open';
    updateMutation.mutate({ id: task.id, data: { ...task, status: next } });
  };

  const activeTasks = tasks.filter(t => ['open', 'in_progress'].includes(t.status));
  const archivedTasks = tasks.filter(t => t.status === 'completed');

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = base44.entities.Task.subscribe((event) => {
      queryClient.setQueryData(['tasks'], (old = []) => {
        if (event.type === 'create') return [event.data, ...old];
        if (event.type === 'update') return old.map(t => t.id === event.id ? event.data : t);
        if (event.type === 'delete') return old.filter(t => t.id !== event.id);
        return old;
      });
    });
    return unsubscribe;
  }, [queryClient]);

  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === 'active' ? ['open', 'in_progress'].includes(t.status) :
      filterStatus === 'archive' ? t.status === 'completed' :
      filterStatus === 'all' ? true :
      t.status === filterStatus;
    const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const getDueDateStyle = (due) => {
    if (!due) return 'text-muted-foreground';
    const d = parseISO(due);
    if (isPast(d) && !isToday(d)) return 'text-rose-500 font-medium';
    if (isToday(d)) return 'text-amber-600 font-medium';
    return 'text-muted-foreground';
  };

  const extraFilters = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex rounded-lg border border-border/60 overflow-hidden">
        {[
          { key: 'active',  label: `Aktiv (${activeTasks.length})` },
          { key: 'open',    label: 'Offen' },
          { key: 'in_progress', label: 'In Bearb.' },
          { key: 'archive', label: `Archiv (${archivedTasks.length})` },
          { key: 'all',     label: 'Alle' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              filterStatus === tab.key
                ? tab.key === 'archive'
                  ? 'bg-slate-600 text-white'
                  : 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <Select value={filterPriority} onValueChange={setFilterPriority}>
        <SelectTrigger className="h-8 text-xs w-36 border-border/60">
          <SelectValue placeholder="Priorität" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Prioritäten</SelectItem>
          <SelectItem value="urgent">Dringend</SelectItem>
          <SelectItem value="high">Hoch</SelectItem>
          <SelectItem value="medium">Mittel</SelectItem>
          <SelectItem value="low">Niedrig</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="page-enter flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[hsl(var(--primary))] tracking-tight">Aufgaben</h1>
              <p className="text-xs text-muted-foreground">
                {filterStatus === 'archive'
                  ? `${filtered.length} erledigte Aufgabe${filtered.length !== 1 ? 'n' : ''} (Archiv)`
                  : `${filtered.length} Aufgabe${filtered.length !== 1 ? 'n' : ''}`}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Aufgabe erstellen
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Manuelle Datumsprüfung — separater Bereich, getrennt von klassischen Aufgaben */}
      {dateReviewItems.length > 0 && (
        <div className="surface overflow-hidden border-amber-200">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200/70 bg-amber-50/60 table-header">
            <ClipboardCheck className="w-4 h-4 text-amber-700" />
            <span className="font-semibold text-amber-800">Manuelle Datumsprüfung</span>
            <span className="text-xs text-amber-700 font-semibold bg-amber-200/60 px-1.5 py-0.5 rounded-full ml-1">{dateReviewItems.length}</span>
            <span className="ml-auto text-xs text-amber-600 hidden sm:block">Verträge mit Platzhalter-Ablaufdatum — bitte prüfen und korrigieren</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2.5 text-left font-semibold">Kunde</th>
                <th className="px-4 py-2.5 text-left font-semibold hidden md:table-cell">Versicherer</th>
                <th className="px-4 py-2.5 text-left font-semibold hidden lg:table-cell">Policen-Nr.</th>
                <th className="px-4 py-2.5 text-left font-semibold">Ablaufdatum</th>
                <th className="px-4 py-2.5 text-right font-semibold w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {(showAllDateReview ? dateReviewItems : dateReviewItems.slice(0, DATE_REVIEW_LIMIT)).map(c => (
                <tr key={c.id} className="table-row-hover group">
                  <td className="px-4 py-3 font-medium text-foreground">{c.customer_name || '–'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{c.insurer || '–'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs font-mono text-muted-foreground">{c.policy_number || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-amber-700 font-semibold">{c.end_date || 'Kein Datum'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.customer_id && (
                      <button
                        onClick={() => navigate(`/kunden/${c.customer_id}/360`)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 border border-amber-300 rounded text-amber-700 hover:bg-amber-100 transition-colors whitespace-nowrap"
                      >
                        Öffnen →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dateReviewItems.length > DATE_REVIEW_LIMIT && (
            <div className="px-4 py-2.5 border-t border-border/50 bg-muted/20">
              <button
                onClick={() => setShowAllDateReview(v => !v)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {showAllDateReview
                  ? 'Weniger anzeigen ↑'
                  : `Alle ${dateReviewItems.length} anzeigen (+${dateReviewItems.length - DATE_REVIEW_LIMIT} weitere) ↓`}
              </button>
            </div>
          )}
        </div>
      )}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Aufgabe oder Kunde suchen..."
        extra={extraFilters}
      />

      <div className="surface overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Laden...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Keine Aufgaben gefunden</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2.5 text-left font-semibold w-8"></th>
                <th className="px-4 py-2.5 text-left font-semibold">Aufgabe</th>
                <th className="px-4 py-2.5 text-left font-semibold hidden md:table-cell">Kunde</th>
                <th className="px-4 py-2.5 text-left font-semibold hidden lg:table-cell">Typ</th>
                <th className="px-4 py-2.5 text-left font-semibold">Priorität</th>
                <th className="px-4 py-2.5 text-left font-semibold hidden sm:table-cell">Fälligkeit</th>
                <th className="px-4 py-2.5 text-left font-semibold hidden lg:table-cell">Zugewiesen</th>
                <th className="px-4 py-2.5 text-right font-semibold w-20">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map(task => {
                const StatusIcon = STATUS_CONFIG[task.status]?.icon || Circle;
                const prio = PRIORITY_CONFIG[task.priority];
                return (
                  <tr key={task.id} className="table-row-hover group">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleStatus(task)}
                        className={`transition-colors ${STATUS_CONFIG[task.status]?.className || 'text-muted-foreground'} hover:opacity-70`}
                        title={STATUS_CONFIG[task.status]?.label}
                      >
                        <StatusIcon className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={task.status === 'completed' ? 'line-through text-muted-foreground' : 'font-medium text-foreground'}>
                        {task.title}
                      </span>
                      {task.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">{task.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {task.customer_id ? (
                        <Link to={`/kunden/${task.customer_id}/360`} className="hover:text-primary transition-colors flex items-center gap-1">
                          {task.customer_name || '—'}
                          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-60" />
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                      {TYPE_LABELS[task.task_type] || task.task_type || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {prio && <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${prio.className}`}>{prio.label}</span>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {task.due_date ? (
                        <span className={`text-xs flex items-center gap-1 ${getDueDateStyle(task.due_date)}`}>
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(task.due_date), 'd. MMM', { locale: de })}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {task.assigned_to ? (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />{task.assigned_to}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(task)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteMutation.mutate(task.id)} className="p-1.5 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Titel *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priorität</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Typ</Label>
                <Select value={form.task_type} onValueChange={v => setForm(f => ({ ...f, task_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fälligkeit</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Zugewiesen an</Label>
              <Input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="E-Mail" />
            </div>
            <div className="space-y-1.5">
              <Label>Beschreibung</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={closeForm}>Abbrechen</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? 'Speichern' : 'Erstellen'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}