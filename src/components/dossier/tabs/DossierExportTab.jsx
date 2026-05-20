/**
 * DossierExportTab — Phase 4/5 (Hardening)
 * PDF-Infrastruktur: Snapshot-Erstellung, Vorschau, window.print().
 *
 * Hardening-Änderungen:
 * - SnapshotRow: deserializeSnapshot nur einmal (memo), nicht auf jedem Render
 * - Stabile Versionsnummer via nextSnapshotVersion() statt snapshots.length + 1
 * - Ladezustände für Customer/Contracts bei Live-Preview klar kommuniziert
 * - Snapshot-Deserialization-Fehler werden dem User angezeigt (kein stiller null)
 * - created_date Fallback auf created_date (ISO-String von Base44)
 * - Kein Mailversand, keine Automationen, keine produktiven Exporte
 */
import React, { useState, useMemo, memo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Printer, Eye, Save, Clock, FileText, ChevronDown, ChevronUp,
  Shield, AlertCircle, Loader2,
} from 'lucide-react';
import DossierPrintTemplate from '@/components/dossier/print/DossierPrintTemplate';
import {
  buildSnapshot, serializeSnapshot, deserializeSnapshot,
  getSnapshotMeta, nextSnapshotVersion,
} from '@/lib/dossierSnapshot';
import { fmtDate } from '@/lib/dossierCalc';

// ── Memoized SnapshotRow — deserialization nur bei Prop-Änderung ──────────────
const SnapshotRow = memo(function SnapshotRow({ snap, onPreview }) {
  // Deserialisierung einmal pro snap.id, nicht bei jedem Re-Render des Parents
  const parsed = useMemo(() => deserializeSnapshot(snap.snapshot_data), [snap.snapshot_data]);
  const meta   = useMemo(() => getSnapshotMeta(parsed), [parsed]);

  return (
    <div className="border border-border rounded-xl px-5 py-3 bg-card flex items-center justify-between gap-3 hover:shadow-card-md transition-shadow">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            Version {snap.version}
            {snap.notes ? ` — ${snap.notes}` : meta?.title ? ` — ${meta.title}` : ''}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
            <Clock className="w-3 h-3 shrink-0" />
            <span>{fmtDate(snap.created_date)}</span>
            {snap.created_by_name && <span>· {snap.created_by_name}</span>}
            {meta?.entry_count != null && (
              <span>· {meta.entry_count} Vergleichseinträge</span>
            )}
            {!parsed && (
              <span className="text-amber-600">· Snapshot-Daten nicht lesbar</span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={() => parsed ? onPreview(parsed) : null}
        disabled={!parsed}
        className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Eye className="w-3.5 h-3.5" />
        Vorschau
      </button>
    </div>
  );
});

// ── Print CSS ────────────────────────────────────────────────────────────────
// Screen: #dossier-print-only ist mit visibility:hidden+height:0 versteckt
// (NICHT display:none — sonst ignoriert Browser beim Print!)
// Print: alles ausblenden, nur #dossier-print-only zeigen
const PRINT_ONLY_STYLE = `
  @media print {
    body > * { display: none !important; visibility: hidden !important; }
    #dossier-print-only,
    #dossier-print-only * {
      display: revert !important;
      visibility: visible !important;
      position: static !important;
      overflow: visible !important;
      height: auto !important;
      clip: auto !important;
    }
  }
`;

// ── Print-Vorschau Modal ──────────────────────────────────────────────────────
function PrintPreviewModal({ snapshot, onClose }) {
  // Injiziere Print-CSS in <head>, entferne beim Unmount
  useEffect(() => {
    const tag = document.createElement('style');
    tag.id = 'dossier-print-style';
    tag.textContent = PRINT_ONLY_STYLE;
    document.head.appendChild(tag);
    return () => { document.getElementById('dossier-print-style')?.remove(); };
  }, []);

  const handlePrint = () => window.print();

  return (
    <>
      {/* Print-only: im body-Flow, aber auf Screen versteckt via visibility+height
          WICHTIG: kein display:none — Browser würde es dann auch beim Drucken ignorieren */}
      <div
        id="dossier-print-only"
        style={{
          visibility: 'hidden',
          position: 'absolute',
          left: '-9999px',
          top: 0,
          height: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <DossierPrintTemplate snapshot={snapshot} />
      </div>

      {/* Screen-Modal: fixed overlay für die Vorschau, nie im Print */}
      <div className="fixed inset-0 z-50 flex flex-col bg-background" style={{ overflow: 'hidden' }}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {snapshot.dossier?.title ?? 'Dossier'}
              </p>
              <p className="text-xs text-muted-foreground">
                Druckvorschau · v{snapshot.dossier_version ?? 1}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Drucken / Als PDF speichern
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border text-sm font-medium rounded-lg hover:bg-muted transition-colors"
            >
              Schliessen
            </button>
          </div>
        </div>

        {/* Hinweis */}
        <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Für PDF-Export: Drucken → Ziel «Als PDF speichern» · A4 Querformat, Ränder Normal, Hintergrundgrafiken aktivieren.
        </div>

        {/* Scrollbare Screen-Vorschau */}
        <div className="flex-1 overflow-auto bg-slate-100 p-6">
          <div className="max-w-5xl mx-auto bg-white shadow-modal rounded-xl overflow-hidden p-4">
            <DossierPrintTemplate snapshot={snapshot} />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Ladeindikator ─────────────────────────────────────────────────────────────
function DataReadinessBar({ customer, familyMembers, contracts, entries }) {
  const items = [
    { label: 'Kundendaten',          ok: !!customer },
    { label: 'Familienmitglieder',   ok: true },  // leere Liste ist ok
    { label: 'Verträge',             ok: true },
    { label: 'Vergleichseinträge',   ok: entries.length > 0 },
  ];
  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      {items.map(item => (
        <span key={item.label} className={`flex items-center gap-1 ${item.ok ? 'text-emerald-700' : 'text-muted-foreground'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
          {item.label}
        </span>
      ))}
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">{entries.length} Einträge · {contracts.length} Verträge · {familyMembers.length} Familienmitglieder</span>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function DossierExportTab({ dossier }) {
  const [previewSnapshot, setPreviewSnapshot] = useState(null);
  const [snapshotNote,    setSnapshotNote]    = useState('');
  const [showSnapshots,   setShowSnapshots]   = useState(true);
  const [previewError,    setPreviewError]    = useState(null);

  const dossierId  = dossier?.id;
  const customerId = dossier?.customer_id;
  const qc         = useQueryClient();

  // ── Data fetching (alle read-only) ──
  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['dossier_customer_ro', customerId],
    queryFn:  () => base44.entities.Customer.filter({ id: customerId }).then(r => r?.[0] ?? null),
    enabled:  !!customerId,
    staleTime: 60_000,
  });

  const { data: familyMembers = [] } = useQuery({
    queryKey: ['dossier_family_ro', customerId],
    queryFn:  () => base44.entities.Customer.filter({ primary_customer_id: customerId }),
    enabled:  !!customerId,
    staleTime: 60_000,
  });

  const allCustomerIds = useMemo(() => {
    if (!customerId) return [];
    return [customerId, ...familyMembers.map(m => m.id)];
  }, [customerId, familyMembers]);

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['dossier_contracts_ro', allCustomerIds],
    queryFn:  async () => {
      if (allCustomerIds.length === 0) return [];
      const results = await Promise.all(
        allCustomerIds.map(id => base44.entities.Contract.filter({ customer_id: id }))
      );
      return results.flat().filter(c => c.status !== 'archived');
    },
    enabled:  allCustomerIds.length > 0,
    staleTime: 60_000,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['dossier_comparison', dossierId],
    queryFn:  () => base44.entities.ComparisonEntry.filter({ dossier_id: dossierId }),
    enabled:  !!dossierId,
    staleTime: 30_000,
  });

  const { data: verkaufschance } = useQuery({
    queryKey: ['dossier_vs_ro', dossier?.linked_verkaufschance_id],
    queryFn:  () => base44.entities.Verkaufschance.filter({ id: dossier.linked_verkaufschance_id }).then(r => r?.[0] ?? null),
    enabled:  !!dossier?.linked_verkaufschance_id,
    staleTime: 60_000,
  });

  const { data: snapshots = [], isLoading: snapsLoading } = useQuery({
    queryKey: ['dossier_snapshots', dossierId],
    queryFn:  () => base44.entities.DossierSnapshot.filter({ dossier_id: dossierId }, '-created_date', 50),
    enabled:  !!dossierId,
  });

  // ── Snapshot erstellen ──
  const createSnapMutation = useMutation({
    mutationFn: async () => {
      const snap = buildSnapshot({
        dossier, customer, familyMembers, contracts, entries, verkaufschance,
      });
      const version  = nextSnapshotVersion(snapshots); // stabile Versionsnummer
      const jsonBlob = serializeSnapshot(snap);
      await base44.entities.DossierSnapshot.create({
        dossier_id:    dossierId,
        version,
        snapshot_data: jsonBlob,
        notes:         snapshotNote.trim() || null,
      });
      return snap;
    },
    onSuccess: (snap) => {
      qc.invalidateQueries({ queryKey: ['dossier_snapshots', dossierId] });
      setSnapshotNote('');
      setPreviewSnapshot(snap);
    },
  });

  // ── Live-Vorschau ──
  const handleLivePreview = () => {
    setPreviewError(null);
    try {
      const snap = buildSnapshot({
        dossier, customer, familyMembers, contracts, entries, verkaufschance,
      });
      setPreviewSnapshot(snap);
    } catch (err) {
      setPreviewError(err.message);
    }
  };

  if (!dossierId) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Bitte zuerst das Dossier speichern (Stammdaten-Tab).</p>
      </div>
    );
  }

  const isDataLoading = loadingCustomer || loadingContracts;

  return (
    <>
      {previewSnapshot && (
        <PrintPreviewModal
          snapshot={previewSnapshot}
          onClose={() => setPreviewSnapshot(null)}
        />
      )}

      <div className="space-y-5">
        {/* Isolation notice */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border border-border/60 rounded-lg px-3 py-2">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          PDF-Infrastruktur Phase 4 · Kein Mailversand · Keine Automationen · Snapshot read-only gegenüber CRM
        </div>

        {/* Fehler-Anzeige */}
        {previewError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {previewError}
          </div>
        )}

        {/* Live-Vorschau */}
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-muted/30 border-b border-border/60 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-foreground">Live-Vorschau</p>
              <p className="text-xs text-muted-foreground">Aktueller Dossierstatus — nicht gespeichert</p>
            </div>
            <button
              onClick={handleLivePreview}
              disabled={isDataLoading || !dossier}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isDataLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Eye className="w-4 h-4" />}
              {isDataLoading ? 'Lade Daten…' : 'Vorschau öffnen'}
            </button>
          </div>
          <div className="px-5 py-3 bg-white">
            <DataReadinessBar
              customer={customer}
              familyMembers={familyMembers}
              contracts={contracts}
              entries={entries}
            />
          </div>
        </div>

        {/* Snapshot erstellen */}
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-muted/30 border-b border-border/60">
            <p className="text-sm font-semibold text-foreground">Snapshot speichern</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Versionierten Datenzustand sichern — reproduzierbar, unveränderlich.
              Nächste Version: {nextSnapshotVersion(snapshots)}
            </p>
          </div>
          <div className="px-5 py-4 flex items-center gap-3 flex-wrap">
            <input
              value={snapshotNote}
              onChange={e => setSnapshotNote(e.target.value)}
              placeholder="Optionale Notiz (z.B. «Nach Beratungsgespräch 19.05.2026»)"
              className="flex-1 min-w-48 border border-input bg-transparent rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
            <button
              onClick={() => createSnapMutation.mutate()}
              disabled={createSnapMutation.isPending || !dossier || isDataLoading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {createSnapMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Save className="w-4 h-4" />}
              {createSnapMutation.isPending ? 'Speichern…' : 'Snapshot erstellen & Vorschau'}
            </button>
          </div>
          {createSnapMutation.isError && (
            <div className="px-5 pb-4 text-xs text-destructive flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Fehler: {createSnapMutation.error?.message ?? 'Snapshot konnte nicht gespeichert werden.'}
            </div>
          )}
        </div>

        {/* Snapshot-Verlauf */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowSnapshots(s => !s)}
            className="w-full px-5 py-4 bg-muted/30 border-b border-border/60 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <p className="text-sm font-semibold text-foreground text-left">
              Snapshot-Verlauf
              <span className="ml-2 text-xs font-normal text-muted-foreground">({snapshots.length} Versionen)</span>
            </p>
            {showSnapshots
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showSnapshots && (
            <div className="p-4 space-y-2">
              {snapsLoading ? (
                [1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)
              ) : snapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border rounded-xl">
                  <Clock className="w-6 h-6 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Noch keine Snapshots gespeichert.</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Erstellen Sie einen Snapshot, um den Dossierstatus zu versionieren.
                  </p>
                </div>
              ) : (
                snapshots.map(snap => (
                  <SnapshotRow
                    key={snap.id}
                    snap={snap}
                    onPreview={setPreviewSnapshot}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}