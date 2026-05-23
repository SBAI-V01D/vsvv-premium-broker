/**
 * DocumentAnalysisStatus — Queue Visibility Component
 * 
 * Zeigt Analyse-Status für Dokumente:
 * - Warteschlange
 * - In Verarbeitung
 * - Analysiert
 * - Fehler
 * - Validierung erforderlich
 * 
 * MIT:
 * - Progress Indicator
 * - Estimated Time
 * - Retry Option
 * - Error Details
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, AlertCircle, Clock, RefreshCw, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const STATUS_CONFIG = {
  pending: { 
    label: 'In Warteschlange', 
    icon: Clock, 
    color: 'text-amber-600', 
    bg: 'bg-amber-50 border-amber-200',
    progress: 'waiting'
  },
  processing: { 
    label: 'In Verarbeitung', 
    icon: Loader2, 
    color: 'text-blue-600', 
    bg: 'bg-blue-50 border-blue-200',
    progress: 'running',
    spin: true
  },
  completed: { 
    label: 'Analysiert', 
    icon: CheckCircle2, 
    color: 'text-emerald-600', 
    bg: 'bg-emerald-50 border-emerald-200',
    progress: 'done'
  },
  failed: { 
    label: 'Fehler', 
    icon: AlertCircle, 
    color: 'text-rose-600', 
    bg: 'bg-rose-50 border-rose-200',
    progress: 'error'
  },
  needs_review: { 
    label: 'Validierung erforderlich', 
    icon: FileText, 
    color: 'text-violet-600', 
    bg: 'bg-violet-50 border-violet-200',
    progress: 'review'
  },
};

export default function DocumentAnalysisStatus({ documentId, onRetry }) {
  const [estimatedTime, setEstimatedTime] = useState(null);

  const { data: queueEntry, isLoading } = useQuery({
    queryKey: ['document_analysis_queue', documentId],
    queryFn: async () => {
      const queues = await base44.entities.AutomationQueue.filter({
        queue_name: 'document_analysis',
        'payload.document_id': documentId,
      }, '-created_date', 1);
      return queues[0] || null;
    },
    enabled: !!documentId,
    refetchInterval: 5000, // Alle 5s updaten wenn pending/processing
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (queueEntry?.status === 'processing' && queueEntry.started_at) {
      const elapsed = Date.now() - new Date(queueEntry.started_at).getTime();
      const estimated = Math.max(0, 120000 - elapsed); // ~2 Min estimated
      setEstimatedTime(Math.ceil(estimated / 1000));
    } else {
      setEstimatedTime(null);
    }
  }, [queueEntry]);

  if (isLoading || !queueEntry) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Status wird geladen...
      </div>
    );
  }

  const status = queueEntry.status;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  const handleRetry = async () => {
    if (onRetry) {
      await onRetry();
    } else {
      // Reset queue entry
      await base44.entities.AutomationQueue.update(queueEntry.id, {
        status: 'pending',
        retry_count: 0,
        error_message: null,
        scheduled_at: new Date().toISOString(),
      });
    }
  };

  return (
    <div className={cn(
      'rounded-lg border p-3 text-xs transition-all',
      config.bg
    )}>
      <div className="flex items-start gap-2">
        <Icon className={cn(
          'w-4 h-4 flex-shrink-0 mt-0.5',
          config.color,
          config.spin && 'animate-spin'
        )} />
        <div className="flex-1 min-w-0">
          <p className={cn('font-semibold', config.color)}>{config.label}</p>
          
          {/* Progress Info */}
          {status === 'pending' && (
            <p className="text-slate-600 mt-1">
              Analyse startet in Kürze
            </p>
          )}
          
          {status === 'processing' && (
            <div className="space-y-1 mt-1">
              <p className="text-slate-600">
                KI analysiert Dokument...
              </p>
              {estimatedTime !== null && (
                <p className="text-[10px] text-slate-500">
                  Geschätzte Zeit: {estimatedTime}s
                </p>
              )}
              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, (1 - estimatedTime / 120) * 100)}%` 
                  }}
                />
              </div>
            </div>
          )}
          
          {status === 'completed' && queueEntry.result && (
            <div className="space-y-1 mt-1">
              <p className="text-slate-600">
                {queueEntry.result.customerMatches || 0} Kunden gefunden, 
                {queueEntry.result.policiesDetected || 0} Policen erkannt
              </p>
              <p className="text-[10px] text-slate-500">
                Verarbeitungszeit: {(queueEntry.result.processing_time_ms / 1000).toFixed(1)}s
              </p>
            </div>
          )}
          
          {status === 'failed' && (
            <div className="space-y-2 mt-1">
              <p className="text-rose-700">
                {queueEntry.error_message || 'Analyse fehlgeschlagen'}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                className="h-7 text-[10px]"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Erneut versuchen
              </Button>
            </div>
          )}
          
          {status === 'needs_review' && (
            <p className="text-violet-700 mt-1">
              Manuelle Prüfung erforderlich
            </p>
          )}
        </div>
      </div>
    </div>
  );
}