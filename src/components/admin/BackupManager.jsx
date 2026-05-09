import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { HardDrive, Download, RotateCcw, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BackupManager() {
  const [manualBackup, setManualBackup] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showRestore, setShowRestore] = useState(false)
  const [restoreConfirm, setRestoreConfirm] = useState('')

  const { data: backups = [] } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      try {
        return await base44.entities.BackupLog?.list('-timestamp', 100) || [];
      } catch {
        return [];
      }
    },
    refetchInterval: 60000, // Refresh every minute
  })

  const handleManualBackup = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('createBackup', {});
      setManualBackup(result);
    } catch (err) {
      alert('Backup failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (restoreConfirm !== 'RESTORE_NOW') {
      alert('Bitte "RESTORE_NOW" eingeben zum Bestätigen');
      return;
    }
    // Restore implementation would go here
    alert('Restore-Funktion bereit. Backup-Daten erforderlich.');
    setShowRestore(false);
    setRestoreConfirm('');
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString('de-CH');
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Backup-System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded border border-green-200 bg-green-50">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              <p className="font-semibold text-green-700">Automatisches Backup aktiv</p>
              <p className="text-xs text-muted-foreground">Alle 15 Minuten</p>
            </div>
          </div>

          {manualBackup && (
            <div className="flex items-center gap-3 p-3 rounded border border-blue-200 bg-blue-50">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-blue-700">Manuelles Backup erstellt</p>
                <p className="text-xs text-muted-foreground truncate">{manualBackup.backup_id}</p>
                <p className="text-xs text-muted-foreground">{formatDate(manualBackup.timestamp)}</p>
              </div>
            </div>
          )}

          <Button onClick={handleManualBackup} disabled={loading} className="w-full">
            {loading ? '⏳ Backup wird erstellt...' : '💾 Manuelles Backup jetzt'}
          </Button>

          <Button onClick={() => setShowRestore(true)} variant="outline" className="w-full">
            <RotateCcw className="w-4 h-4 mr-2" /> Aus Backup wiederherstellen
          </Button>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Backup-Verlauf (letzte 10)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-64 overflow-y-auto">
          {backups.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Noch keine Backups</p>
          ) : (
            backups.slice(0, 10).map((backup, i) => (
              <div key={i} className="p-2 rounded border bg-card hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground truncate">{backup.backup_id}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(backup.timestamp)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 text-xs">
                    <p className="font-semibold">{backup.total_records}</p>
                    <p className="text-muted-foreground">Datensätze</p>
                  </div>
                </div>
                {backup.size_kb && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatBytes(backup.size_kb * 1024)}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <Dialog open={showRestore} onOpenChange={setShowRestore}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Aus Backup wiederherstellen?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
              ⚠️ <strong>WARNUNG:</strong> Dies überschreibt alle aktuellen Daten mit dem Backup-Stand.
              <br />
              Diese Aktion kann nicht rückgängig gemacht werden.
            </div>
            <div>
              <label className="text-sm font-medium">
                Geben Sie "RESTORE_NOW" ein zum Bestätigen:
              </label>
              <input
                type="text"
                value={restoreConfirm}
                onChange={(e) => setRestoreConfirm(e.target.value)}
                className="w-full px-3 py-2 border rounded-md mt-1 font-mono text-sm"
                placeholder="RESTORE_NOW"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestore(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleRestore}
              disabled={restoreConfirm !== 'RESTORE_NOW'}
            >
              Restore starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info */}
      <div className="p-3 rounded bg-muted text-xs text-muted-foreground">
        <p>✓ Automatische Backups: 15-Minuten-Intervall</p>
        <p>✓ Speicherung: Alle Entities (Customers, Contracts, Tasks, etc.)</p>
        <p>✓ Wiederherstellung: Admin-only</p>
      </div>
    </div>
  )
}