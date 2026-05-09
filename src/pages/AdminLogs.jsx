import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, CheckCircle, Clock, Search, RotateCcw } from 'lucide-react'

export default function AdminLogs() {
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => base44.entities.AuditLog.list('-changed_at', 100),
  })

  const { data: errorLogs = [] } = useQuery({
    queryKey: ['errorLogs'],
    queryFn: () => base44.entities.ErrorLog.list('-occurred_at', 100),
  })

  const { data: duplicateAlerts = [] } = useQuery({
    queryKey: ['duplicateAlerts'],
    queryFn: () => base44.entities.DuplicateAlert.list('-detected_at', 100),
  })

  const filteredErrors = errorLogs.filter(e => {
    const typeMatch = filterType === 'all' || e.error_type === filterType
    const statusMatch = filterStatus === 'all' || e.status === filterStatus
    const searchMatch = !search || e.error_message.toLowerCase().includes(search.toLowerCase())
    return typeMatch && statusMatch && searchMatch
  })

  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    return new Date(dateStr).toLocaleDateString('de-CH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">System Logs & Audit Trail</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-600">{auditLogs.length}</p>
            <p className="text-sm text-muted-foreground">Audit Events</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-600">{errorLogs.filter(e => e.status === 'new').length}</p>
            <p className="text-sm text-muted-foreground">New Errors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-amber-600">{duplicateAlerts.filter(d => d.status === 'new').length}</p>
            <p className="text-sm text-muted-foreground">Duplicate Alerts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">{errorLogs.filter(e => e.status === 'resolved').length}</p>
            <p className="text-sm text-muted-foreground">Resolved Errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Error Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Error Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search errors..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="upload_failed">Upload Failed</SelectItem>
                <SelectItem value="automation_failed">Automation Failed</SelectItem>
                <SelectItem value="ocr_error">OCR Error</SelectItem>
                <SelectItem value="loading_error">Loading Error</SelectItem>
                <SelectItem value="sync_error">Sync Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredErrors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No errors found</p>
            ) : (
              filteredErrors.map(error => (
                <div key={error.id} className="p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3">
                    {error.status === 'resolved' ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : error.status === 'new' ? (
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{error.error_type}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {error.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{error.error_message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(error.occurred_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Duplicate Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Duplicate Detection Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {duplicateAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No duplicates detected</p>
            ) : (
              duplicateAlerts.map(alert => (
                <div key={alert.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{alert.entity_type} - {alert.confidence_score}% match</p>
                      <p className="text-xs text-muted-foreground">
                        {alert.match_criteria.join(', ')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(alert.detected_at)}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      {alert.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit Trail */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {auditLogs.slice(0, 20).map(log => (
              <div key={log.id} className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {log.action.toUpperCase()} - {log.entity_type}
                    </p>
                    <p className="text-xs text-muted-foreground">{log.summary}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      By {log.changed_by} • {formatDate(log.changed_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}