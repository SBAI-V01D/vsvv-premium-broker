/**
 * DossierExportTab — Phase 4
 * PDF-Infrastruktur: Snapshot-Erstellung, Vorschau, window.print().
 * Kein direktes PDF aus Tabellenkomponenten.
 * Kein Mailversand, keine Automationen, keine produktiven Exporte.
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Printer, Eye, Save, Clock, FileText, ChevronDown, ChevronUp, Shield, AlertCircle,
} from 'lucide-react';
import DossierPrintTemplate from '@/components/dossier/print/DossierPrintTemplate';
import { buildSnapshot, serializeSnapshot, deserializeSnapshot, getSnapshotMeta } from '@/lib/dossierSnapshot';

// ── Snapshot-Listeneintrag ────────────────────────────────────────────────────
function SnapshotRow({ snap, onPreview }) {
  const meta = getSnapshotMeta(deserializeSnapshot(snap.snapshot_data));
  return (
    <div className="border border-border rounded-xl px-5 py-3 bg-card flex items-center justify-between gap-3 hover:shadow-card-md transition-shadow">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            Version {snap.version} — {snap.notes || meta?.title || 'Snapshot'}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
            <Clock className="w-3 h-3" />
            <span>{new Date(snap.created_date).toLocaleDateString('de-CH')}</span>
            {snap.created_by_name && <span>· {snap.created_by_name}</span>}
            {meta?.entry_count != null && <span>· {meta.entry_count} Vergleichseinträge</span>}
          </div>
        </div>
      </div>
      <button
        onClick={() => onPreview(snap)}
        className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors shrink-0"
      >
        <Eye className="w-3.5 h-3.5" />
        Vorschau / Drucken
      </button>
    </div>
  );
}

// ── Print-Vorschau Modal ──────────────────────────────────────────────────────
function PrintPreviewModal({ snapshot, onClose }) {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{snapshot.dossier?.title}</p>
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

      {/* Print hint */}
      <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 flex items-center gap-2 print:hidden">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        Für PDF-Export: Drucken → Ziel «Als PDF speichern» · Empfohlen: A4, Ränder Normal, Hintergrundgrafiken aktivieren.
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto bg-slate-100 print:bg-white p-6 print:p-0">
        <div className="max-w-4xl mx-auto bg-white shadow-modal rounded-xl print:shadow-none print:rounded-none overflow-hidden">
          <DossierPrintTemplate snapshot={snapshot} />
        </div>
      </div>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function DossierExportTab({ dossier }) {
  const [previewSnapshot, setPreviewSnapshot] = useState(null);
  const [snapshotNote, setSnapshotNote] = useState('');
  const [showSnapshots, setShowSnapshots] = useState(true);
  const dossierId = dossier?.id;
  const customerId = dossier?.customer_id;
  const qc = useQueryClient();

  // ── Data fetching ──
  const { data: customer } = useQuery({
    queryKey: ['dossier_customer_ro', customerId],
    queryFn: () => base44.entities.Customer.filter({ id: customerId }).then(r => r[0]),
    enabled: !!customerId,
  });

  const { data: familyMembers = [] } = useQuery({
    queryKey: ['dossier_family_ro', customerId],
    queryFn: () => base44.entities.Customer.filter({ primary_customer_id: customerId }),
    enabled: !!customerId,
  });

  const allCustomerIds = useMemo(() => {
    if (!customerId) return [];
    return [customerId, ...familyMembers.map(m => m.id)];
  }, [customerId, familyMembers]);

  const { data: contracts = [] } = useQuery({
    queryKey: ['dossier_contracts_ro', allCustomerIds],
    queryFn: async () => {
      const results = await Promise.all(
        allCustomerIds.map(id => base44.entities.Contract.filter({ customer_id: id }))
      );
      return results.flat().filter(c => c.status !== 'archived');
    },
    enabled: allCustomerIds.length > 0,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['dossier_comparison', dossierId],
    queryFn: () => base44.entities.ComparisonEntry.filter({ dossier_id: dossierId }),
    enabled: !!dossierId,
  });

  const { data: verkaufschance } = useQuery({
    queryKey: ['dossier_vs_ro', dossier?.linked_verkaufschance_id],
    queryFn: () => base44.entities.Verkaufschance.filter({ id: dossier.linked_verkaufschance_id }).then(r => r[0]),
    enabled: !!dossier?.linked_verkaufschance_id,
  });

  const { data: snapshots = [], isLoading: snapsLoading } = useQuery({
    queryKey: ['dossier_snapshots', dossierId],
    queryFn: () => base44.entities.DossierSnapshot.filter({ dossier_id: dossierId }, '-created_date', 20),
    enabled: !!dossierId,
  });

  // ── Snapshot erstellen ──
  const createSnapMutation = useMutation({
    mutationFn: async () => {
      const snap = buildSnapshot({
        dossier, customer, familyMembers, contracts, entries, verkaufschance,
        createdByName: '', // kein User-Namen im Frontend ohne separaten Lookup
      });
      const jsonBlob = serializeSnapshot(snap);
      const newSnap = await base44.entities.DossierSnapshot.create({
        dossier_id:      dossierId,
        version:         (snapshots.length + 1),
        snapshot_data:   jsonBlob,
        notes:           snapshotNote || null,
      });
      return { snap, record: newSnap };
    },
    onSuccess: ({ snap }) => {
      qc.invalidateQueries({ queryKey: ['dossier_snapshots', dossierId] });
      setSnapshotNote('');
      // Direkt Vorschau öffnen
      setPreviewSnapshot(snap);
    },
  });

  const handlePreviewSnapshot = (snapRecord) => {
    const parsed = deserializeSnapshot(snapRecord.snapshot_data);
    if (parsed) setPreviewSnapshot(parsed);
  };

  const handleLivePreview = () => {
    const snap = buildSnapshot({
      dossier, customer, familyMembers, contracts, entries, verkaufschance,
      createdByName: '',
    });
    setPreviewSnapshot(snap);
  };

  if (!dossierId) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Bitte zuerst das Dossier speichern (Stammdaten-Tab).</p>
      </div>
    );
  }

  return (
    <>
      {/* Print Preview Modal */}
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
          PDF-Infrastruktur Phase 4 · Kein Mailversand · Keine Automationen · Snapshot read-only gegenüber CRM.
        </div>

        {/* Live-Vorschau */}
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-muted/30 border-b border-border/60 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Live-Vorschau</p>
              <p className="text-xs text-muted-foreground">Aktueller Dossierstatus — nicht gespeichert</p>
            </div>
            <button
              onClick={handleLivePreview}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Eye className="w-4 h-4" />
              Vorschau öffnen
            </button>
          </div>
          <div className="px-5 py-3 text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
            <span>{entries.length} Vergleichseinträge</span>
            <span>·</span>
            <span>{contracts.length} Verträge</span>
            <span>·</span>
            <span>{familyMembers.length} Familienmitglieder</span>
          </div>
        </div>

        {/* Snapshot erstellen */}
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-muted/30 border-b border-border/60">
            <p className="text-sm font-semibold text-foreground">Snapshot speichern</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Versionierten Datenzustand sichern — reproduzierbar, unveränderlich.
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
              disabled={createSnapMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {createSnapMutation.isPending ? 'Speichern…' : 'Snapshot erstellen & Vorschau'}
            </button>
          </div>
        </div>

        {/* Snapshot-Verlauf */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowSnapshots(s => !s)}
            className="w-full px-5 py-4 bg-muted/30 border-b border-border/60 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <div>
              <p className="text-sm font-semibold text-foreground text-left">
                Snapshot-Verlauf
                <span className="ml-2 text-xs font-normal text-muted-foreground">({snapshots.length} Versionen)</span>
              </p>
            </div>
            {showSnapshots ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showSnapshots && (
            <div className="p-4 space-y-2">
              {snapsLoading ? (
                [1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)
              ) : snapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border rounded-xl">
                  <Clock className="w-6 h-6 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Noch keine Snapshots gespeichert.</p>
                  <p className="text-xs text-muted-foreground">Erstellen Sie einen Snapshot, um den Dossierstatus zu versionieren.</p>
                </div>
              ) : (
                snapshots.map(snap => (
                  <SnapshotRow key={snap.id} snap={snap} onPreview={handlePreviewSnapshot} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}