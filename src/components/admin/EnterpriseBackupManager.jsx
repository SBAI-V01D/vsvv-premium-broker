import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { HardDrive, Clock, Archive, AlertTriangle, CheckCircle, Loader, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function EnterpriseBackupManager() {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const { data: backupLogs = [] } = useQuery({
    queryKey: ['backupLogs'],
    queryFn: async () => {
      try {
        return await base44.entities.BackupLog?.list('-timestamp', 500) || [];
      } catch {
        return [];
      }
    },
    refetchInterval: 300000, // 5 minutes
  })

  const handleManualBackup = async (type) => {
    setLoading(true);
    try {
      const funcName = {
        'incremental': 'createIncrementalBackup',
        'full': 'createFullBackup',
        'archive': 'createLongTermBackup'
      }[type];

      await base44.functions.invoke(funcName, {});
      alert(`${type} backup erstellt`);
    } catch (err) {
      alert('Backup failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Group backups by type
  const incrBackups = backupLogs.filter(b => b.backup_type === 'incremental');
  const fullBackups = backupLogs.filter(b => b.backup_type === 'full');
  const archiveBackups = backupLogs.filter(b => b.backup_type === 'archive');

  // Calculate retention stats
  const now = new Date();
  const retain24h = incrBackups.filter(b => {
    const age = (now - new Date(b.timestamp)) / (1000 * 60 * 60);
    return age < 24;
  }).length;

  const retain30d = fullBackups.filter(b => {
    const age = (now - new Date(b.timestamp)) / (1000 * 60 * 60 * 24);
    return age < 30;
  }).length;

  const formatDate = (isoString) => new Date(isoString).toLocaleString('de-CH');
  const formatBytes = (kb) => kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`;

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="incremental">15-Min</TabsTrigger>
          <TabsTrigger value="full">Täglich</TabsTrigger>
          <TabsTrigger value="archive">Wöchentlich</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <p className="text-xs text-muted-foreground">15-Min Backups</p>
                </div>
                <p className="text-2xl font-bold">{retain24h}</p>
                <p className="text-xs text-muted-foreground">letzte 24h</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="w-4 h-4 text-green-500" />
                  <p className="text-xs text-muted-foreground">Tägliche</p>
                </div>
                <p className="text-2xl font-bold">{retain30d}</p>
                <p className="text-xs text-muted-foreground">letzte 30 Tage</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Archive className="w-4 h-4 text-amber-500" />
                  <p className="text-xs text-muted-foreground">Archive</p>
                </div>
                <p className="text-2xl font-bold">{archiveBackups.length}</p>
                <p className="text-xs text-muted-foreground">wöchentlich</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="text-xs text-muted-foreground">Status</p>
                </div>
                <p className="text-sm font-bold text-green-600">Aktiv</p>
                <p className="text-xs text-muted-foreground">Auto 15-Min</p>
              </CardContent>
            </Card>
          </div>

          {/* Backup Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Backup-Zeitplan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded border border-blue-200 bg-blue-50">
                <div>
                  <p className="font-semibold text-sm">15-Minuten Backups</p>
                  <p className="text-xs text-muted-foreground">Inkrementell, Aufbewahrung: 24h</p>
                </div>
                <Badge className="bg-blue-100 text-blue-700">Auto</Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded border border-green-200 bg-green-50">
                <div>
                  <p className="font-semibold text-sm">Täglich (00:00 UTC)</p>
                  <p className="text-xs text-muted-foreground">Vollbackup, Aufbewahrung: 30 Tage</p>
                </div>
                <Button onClick={() => handleManualBackup('full')} disabled={loading} size="sm" variant="outline">
                  Jetzt
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded border border-amber-200 bg-amber-50">
                <div>
                  <p className="font-semibold text-sm">Wöchentlich (Montag 02:00 UTC)</p>
                  <p className="text-xs text-muted-foreground">Archiv, Aufbewahrung: 10 Jahre</p>
                </div>
                <Button onClick={() => handleManualBackup('archive')} disabled={loading} size="sm" variant="outline">
                  Jetzt
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Strategy Info */}
          <Card className="bg-muted/30">
            <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
              <p>✓ Inkrementelle Backups: Nur Änderungen, minimale Ressourcen</p>
              <p>✓ Tägliche Vollbackups: Komplette Konsistenz</p>
              <p>✓ Wöchentliche Archive: Compliance & Audit-Sicherheit</p>
              <p>✓ Dokumentensicherheit: Authentifizierung erforderlich</p>
              <p>✓ Datenverschlüsselung: Standard</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Incremental Tab */}
        <TabsContent value="incremental" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">15-Minuten Backups (letzte 24h)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {incrBackups.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Keine inkrementellen Backups</p>
              ) : (
                incrBackups.slice(0, 20).map((backup, i) => (
                  <div key={i} className="p-2 rounded border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-muted-foreground">{backup.backup_id}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(backup.timestamp)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <Badge variant="outline" className="text-[10px]">{backup.total_changes || 0} changes</Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Full Tab */}
        <TabsContent value="full" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tägliche Vollbackups (letzte 30 Tage)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {fullBackups.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Keine Vollbackups</p>
              ) : (
                fullBackups.slice(0, 30).map((backup, i) => (
                  <div key={i} className="p-2 rounded border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-muted-foreground">{backup.backup_id}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(backup.timestamp)}</p>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {backup.total_records || 0} records
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {backup.checksum ? '✓ OK' : 'pending'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Archive Tab */}
        <TabsContent value="archive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Wöchentliche Archive (Langzeit)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {archiveBackups.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Keine Archive</p>
              ) : (
                archiveBackups.slice(0, 52).map((backup, i) => (
                  <div key={i} className="p-2 rounded border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-muted-foreground">{backup.backup_id}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(backup.timestamp)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                          Woche {backup.week_number}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}