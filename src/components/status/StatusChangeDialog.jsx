import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import StatusSelect from './StatusSelect'

export default function StatusChangeDialog({ open, onOpenChange, statusDefinitions, currentStatus, onSave, title = 'Status ändern' }) {
  const [newStatus, setNewStatus] = useState(currentStatus || '')
  const [note, setNote] = useState('')
  const [metadata, setMetadata] = useState({ date: '', reason: '' })

  const selectedDef = statusDefinitions.find(s => s.key === newStatus)
  const needsDate = selectedDef?.metadata_fields?.includes('date')
  const needsReason = selectedDef?.metadata_fields?.includes('reason')

  const handleSave = () => {
    onSave({
      status: newStatus,
      statusDef: selectedDef,
      note,
      metadata,
    })
    onOpenChange(false)
    setNote('')
    setMetadata({ date: '', reason: '' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Neuer Status</Label>
            <StatusSelect
              value={newStatus}
              onChange={setNewStatus}
              statusDefinitions={statusDefinitions}
            />
          </div>

          {needsDate && (
            <div>
              <Label>Datum</Label>
              <Input
                type="date"
                value={metadata.date}
                onChange={e => setMetadata(m => ({ ...m, date: e.target.value }))}
                className="mt-1"
              />
            </div>
          )}

          {needsReason && (
            <div>
              <Label>Grund</Label>
              <Textarea
                value={metadata.reason}
                onChange={e => setMetadata(m => ({ ...m, reason: e.target.value }))}
                className="mt-1"
                rows={2}
                placeholder="Grund angeben..."
              />
            </div>
          )}

          <div>
            <Label>Notiz (optional)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              className="mt-1"
              rows={2}
              placeholder="Interne Notiz zur Statusänderung..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={!newStatus}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}