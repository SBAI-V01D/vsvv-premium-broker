import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, XCircle, CheckCircle2, Clock, Edit, FileText, ExternalLink, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_CONFIG = {
  none:         { label: 'Keine Kündigung',       color: 'bg-slate-100 text-slate-600 border-slate-200', icon: null },
  submitted:    { label: 'Kündigung eingereicht', color: 'bg-amber-50 text-amber-700 border-amber-200',  icon: Clock },
  confirmed:    { label: 'Kündigung bestätigt',   color: 'bg-orange-50 text-orange-700 border-orange-200', icon: CheckCircle2 },
  rejected:     { label: 'Kündigung abgelehnt',   color: 'bg-red-50 text-red-700 border-red-200',        icon: XCircle },
  completed:    { label: 'Kündigung abgeschlossen',color: 'bg-slate-100 text-slate-500 border-slate-200', icon: CheckCircle2 },
  switch_planned:{ label: 'Wechsel geplant',      color: 'bg-blue-50 text-blue-700 border-blue-200',     icon: ArrowRightLeft },
};

const CANCELLATION_TYPES = [
  { value: 'customer_initiated', label: 'Durch Kunden gekündigt' },
  { value: 'insurer_initiated',  label: 'Durch Gesellschaft gekündigt' },
  { value: 'mutual',             label: 'Gegenseitige Auflösung' },
  { value: 'legal',              label: 'Rechtliche Kündigung' },
  { value: 'death',              label: 'Todesfall' },
  { value: 'internal_switch',    label: 'Interner Produktwechsel' },
];

const CANCELLATION_REASONS = [
  { value: 'premium_too_high',        label: 'Prämie zu hoch' },
  { value: 'switch_competitor',       label: 'Wechsel Konkurrenz' },
  { value: 'service_dissatisfaction', label: 'Leistungsunzufriedenheit' },
  { value: 'double_coverage',         label: 'Doppelversicherung' },
  { value: 'relocation',              label: 'Wegzug' },
  { value: 'death',                   label: 'Todesfall' },
  { value: 'internal_product_switch', label: 'Produktwechsel intern' },
  { value: 'advisor_dissatisfaction', label: 'Beratung unzufrieden' },
  { value: 'financial_hardship',      label: 'Finanzielle Schwierigkeiten' },
  { value: 'coverage_not_needed',     label: 'Deckung nicht mehr benötigt' },
  { value: 'other',                   label: 'Sonstiges' },
];

const RETENTION_RESULTS = [
  { value: 'none',                label: 'Kein Ergebnis' },
  { value: 'retained',            label: 'Gehalten' },
  { value: 'internal_switch',     label: 'Interner Wechsel' },
  { value: 'lost_external',       label: 'Verloren (extern)' },
  { value: 'lost_no_replacement', label: 'Verloren (kein Ersatz)' },
];

export default function CancellationPanel({ contract, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({});
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const openDialog = () => {
    setForm({
      cancellation_status:            contract.cancellation_status || 'none',
      cancellation_type:              contract.cancellation_type || '',
      cancellation_structured_reason: contract.cancellation_structured_reason || '',
      cancellation_submitted_at:      contract.cancellation_submitted_at || '',
      cancellation_effective_date:    contract.cancellation_effective_date || '',
      cancellation_notice_period_days: contract.cancellation_notice_period_days || '',
      cancellation_confirmed_by_insurer: contract.cancellation_confirmed_by_insurer || false,
      cancellation_confirmation_date: contract.cancellation_confirmation_date || '',
      cancellation_doc_url:           contract.cancellation_doc_url || '',
      cancellation_notes:             contract.cancellation_notes || '',
      retention_attempted:            contract.retention_attempted || false,
      retention_counter_offer_created: contract.retention_counter_offer_created || false,
      retention_result:               contract.retention_result || 'none',
      retention_notes:                contract.retention_notes || '',
    });
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      cancellation_status:            form.cancellation_status,
      cancellation_type:              form.cancellation_type || null,
      cancellation_structured_reason: form.cancellation_structured_reason || null,
      cancellation_submitted_at:      form.cancellation_submitted_at || null,
      cancellation_effective_date:    form.cancellation_effective_date || null,
      cancellation_notice_period_days: form.cancellation_notice_period_days ? Number(form.cancellation_notice_period_days) : null,
      cancellation_confirmed_by_insurer: form.cancellation_confirmed_by_insurer,
      cancellation_confirmation_date: form.cancellation_confirmation_date || null,
      cancellation_doc_url:           form.cancellation_doc_url || null,
      cancellation_notes:             form.cancellation_notes || null,
      retention_attempted:            form.retention_attempted,
      retention_counter_offer_created: form.retention_counter_offer_created,
      retention_result:               form.retention_result,
      retention_notes:                form.retention_notes || null,
    };
    // Auto-set contract status to cancelled if completed
    if (form.cancellation_status === 'completed') payload.status = 'cancelled';

    await base44.entities.Contract.update(contract.id, payload);
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    setOpen(false);
    setSaving(false);
    onUpdated?.();
  };

  const status = contract.cancellation_status || 'none';
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.none;
  const StatusIcon = cfg.icon;
  const hasActiveCancellation = status !== 'none';
  const reason = CANCELLATION_REASONS.find(r => r.value === contract.cancellation_structured_reason);
  const type = CANCELLATION_TYPES.find(t => t.value === contract.cancellation_type);
  const retentionResult = RETENTION_RESULTS.find(r => r.value === contract.retention_result);

  return (
    <>
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-slate-50/50">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kündigung / Vertragsbeendigung</p>
          </div>
          <Button variant="ghost" size="sm" onClick={openDialog} className="h-7 px-2 text-xs gap-1">
            <Edit className="w-3 h-3" /> Erfassen
          </Button>
        </div>

        <div className="p-4 space-y-3">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
              {StatusIcon && <StatusIcon className="w-3 h-3" />}
              {cfg.label}
            </span>
          </div>

          {hasActiveCancellation && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Kündigungsdetails */}
              <div className="space-y-2">
                {type && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Kündigungsart</p>
                    <p className="text-sm font-medium mt-0.5">{type.label}</p>
                  </div>
                )}
                {reason && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Kündigungsgrund</p>
                    <p className="text-sm font-medium mt-0.5">{reason.label}</p>
                  </div>
                )}
                {contract.cancellation_submitted_at && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Eingereicht am</p>
                    <p className="text-sm font-medium mt-0.5">{format(new Date(contract.cancellation_submitted_at), 'dd.MM.yyyy')}</p>
                  </div>
                )}
                {contract.cancellation_effective_date && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Gültig per</p>
                    <p className="text-sm font-medium text-red-600 mt-0.5">{format(new Date(contract.cancellation_effective_date), 'dd.MM.yyyy')}</p>
                  </div>
                )}
              </div>

              {/* Bestätigung & Retention */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  {contract.cancellation_confirmed_by_insurer ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                      <ShieldCheck className="w-3 h-3" /> Durch Gesellschaft bestätigt
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                      <Clock className="w-3 h-3" /> Bestätigung ausstehend
                    </span>
                  )}
                </div>
                {contract.cancellation_confirmation_date && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Bestätigt am</p>
                    <p className="text-sm font-medium mt-0.5">{format(new Date(contract.cancellation_confirmation_date), 'dd.MM.yyyy')}</p>
                  </div>
                )}
                {contract.cancellation_doc_url && (
                  <a href={contract.cancellation_doc_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <FileText className="w-3 h-3" />
                    Kündigungsdokument ansehen
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Retention */}
          {hasActiveCancellation && (
            <div className="border-t border-border pt-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-2">Retention</p>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${contract.retention_attempted ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                  {contract.retention_attempted ? '✓ Retention versucht' : '— Kein Retention-Versuch'}
                </span>
                {contract.retention_counter_offer_created && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-violet-50 text-violet-700 border-violet-200">
                    ✓ Gegenangebot erstellt
                  </span>
                )}
                {retentionResult && contract.retention_result !== 'none' && (
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${
                    contract.retention_result === 'retained' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    contract.retention_result === 'internal_switch' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {retentionResult.label}
                  </span>
                )}
              </div>
              {contract.retention_notes && (
                <p className="text-xs text-muted-foreground mt-2">{contract.retention_notes}</p>
              )}
            </div>
          )}

          {!hasActiveCancellation && (
            <p className="text-xs text-muted-foreground">Keine aktive Kündigung erfasst.</p>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              Kündigung erfassen
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Status & Art */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kündigungsstatus</Label>
                <Select value={form.cancellation_status} onValueChange={v => set('cancellation_status', v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Kündigungsart</Label>
                <Select value={form.cancellation_type || ''} onValueChange={v => set('cancellation_type', v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Auswählen" /></SelectTrigger>
                  <SelectContent>
                    {CANCELLATION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Grund */}
            <div>
              <Label className="text-xs">Kündigungsgrund (strukturiert)</Label>
              <Select value={form.cancellation_structured_reason || ''} onValueChange={v => set('cancellation_structured_reason', v)}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Grund auswählen" /></SelectTrigger>
                <SelectContent>
                  {CANCELLATION_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Daten */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Eingereicht am</Label>
                <Input type="date" value={form.cancellation_submitted_at} onChange={e => set('cancellation_submitted_at', e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Gültig per</Label>
                <Input type="date" value={form.cancellation_effective_date} onChange={e => set('cancellation_effective_date', e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Kündigungsfrist (Tage)</Label>
                <Input type="number" value={form.cancellation_notice_period_days} onChange={e => set('cancellation_notice_period_days', e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Bestätigungsdatum</Label>
                <Input type="date" value={form.cancellation_confirmation_date} onChange={e => set('cancellation_confirmation_date', e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
            </div>

            {/* Bestätigung */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.cancellation_confirmed_by_insurer}
                onChange={e => set('cancellation_confirmed_by_insurer', e.target.checked)}
                className="w-3.5 h-3.5 accent-primary" />
              <span className="text-sm">Durch Versicherungsgesellschaft bestätigt</span>
            </label>

            {/* Dokument */}
            <div>
              <Label className="text-xs">Kündigungsdokument URL</Label>
              <Input type="url" value={form.cancellation_doc_url} onChange={e => set('cancellation_doc_url', e.target.value)} placeholder="https://..." className="mt-1 h-8 text-sm" />
            </div>

            {/* Notizen */}
            <div>
              <Label className="text-xs">Notizen zur Kündigung</Label>
              <Textarea value={form.cancellation_notes} onChange={e => set('cancellation_notes', e.target.value)} rows={2} className="mt-1 text-sm" />
            </div>

            {/* Retention */}
            <div className="rounded-lg border border-border p-3 space-y-3 bg-blue-50/30">
              <p className="text-xs font-semibold text-foreground">Retention</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form.retention_attempted}
                    onChange={e => set('retention_attempted', e.target.checked)}
                    className="w-3.5 h-3.5 accent-primary" />
                  <span className="text-sm">Retention-Versuch unternommen</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form.retention_counter_offer_created}
                    onChange={e => set('retention_counter_offer_created', e.target.checked)}
                    className="w-3.5 h-3.5 accent-primary" />
                  <span className="text-sm">Gegenangebot erstellt</span>
                </label>
              </div>
              <div>
                <Label className="text-xs">Ergebnis Retention</Label>
                <Select value={form.retention_result || 'none'} onValueChange={v => set('retention_result', v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RETENTION_RESULTS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Retention-Notizen</Label>
                <Textarea value={form.retention_notes} onChange={e => set('retention_notes', e.target.value)} rows={2} className="mt-1 text-sm" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}