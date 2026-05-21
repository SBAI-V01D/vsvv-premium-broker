import EnterpriseIntegrityPanel from '@/components/admin/EnterpriseIntegrityPanel';

export default function TabIntegrity() {
  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-xs text-muted-foreground">
        Vollständige Prüfung aller Enterprise-Invarianten: PDF-Governance, Approval-Integrität,
        Snapshot-Koppelung, Reapproval-Konsistenz und Confidence-Compliance.
      </p>
      <EnterpriseIntegrityPanel />
    </div>
  );
}