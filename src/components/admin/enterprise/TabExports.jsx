import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Hash, ExternalLink, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';

function fmtDt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-CH', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function TabExports() {
  const [signedLoading, setSignedLoading] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['enterprise_export_logs'],
    queryFn: () => base44.entities.PdfExportLog.list('-exported_at', 100),
    staleTime: 30_000,
  });

  const openPdf = async (log) => {
    if (!log.file_uri) return;
    setSignedLoading(log.id);
    const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: log.file_uri, expires_in: 300 });
    setSignedLoading(null);
    if (res?.signed_url) window.open(res.signed_url, '_blank');
  };

  const withHash    = logs.filter(l => l.pdf_hash);
  const withoutHash = logs.filter(l => !l.pdf_hash);

  return (
    <div className="max-w-4xl space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Gesamt-Exporte', logs.length, 'text-foreground'],
          ['Mit Hash ✓',     withHash.length,    'text-emerald-600'],
          ['Ohne Hash ⚠',    withoutHash.length, withoutHash.length > 0 ? 'text-amber-600' : 'text-muted-foreground'],
        ].map(([l, v, c]) => (
          <div key={l} className="border border-border rounded-xl px-4 py-3 text-center bg-card">
            <div className={`text-2xl font-bold ${c}`}>{v}</div>
            <div className="text-xs text-muted-foreground mt-1">{l}</div>
          </div>
        ))}
      </div>

      {/* Export-Tabelle */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-muted/30 border-b border-border/60">
          <p className="text-sm font-semibold">PDF-Export-Protokoll</p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Noch keine Exporte.</div>
        ) : (
          <div className="divide-y divide-border/60 max-h-96 overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="px-5 py-3 flex items-center gap-3 text-xs">
                <div className="shrink-0">
                  {log.pdf_hash
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">PDF v{log.pdf_version}</span>
                    <span className="text-muted-foreground">{log.dossier_title || log.customer_name}</span>
                    {log.generated_by_name && <span className="text-muted-foreground">· {log.generated_by_name}</span>}
                  </div>
                  {log.pdf_hash && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Hash className="w-2.5 h-2.5 text-muted-foreground/60" />
                      <span className="font-mono text-muted-foreground/60">{log.pdf_hash.slice(0, 24)}…</span>
                    </div>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0">{fmtDt(log.exported_at)}</span>
                {log.file_uri && (
                  <button
                    onClick={() => openPdf(log)}
                    disabled={signedLoading === log.id}
                    className="shrink-0 text-primary hover:underline disabled:opacity-50"
                  >
                    {signedLoading === log.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}