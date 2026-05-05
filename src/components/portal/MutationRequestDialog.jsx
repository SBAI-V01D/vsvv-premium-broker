import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { AlertCircle, Send } from 'lucide-react'

const REQUEST_TYPES = [
  { key: 'address_change', label: 'Adresse ändern' },
  { key: 'coverage_change', label: 'Deckung ändern' },
  { key: 'vehicle_change', label: 'Fahrzeug ändern' },
  { key: 'other', label: 'Sonstiges' },
]

export default function MutationRequestDialog({ contract, customerId, open, onOpenChange }) {
  const [type, setType] = useState('other')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!type || !description.trim()) {
        throw new Error('Bitte füllen Sie alle Felder aus')
      }
      return base44.entities.MutationRequest.create({
        customer_id: customerId,
        policy_id: contract.id,
        policy_number: contract.policy_number,
        request_type: type,
        description: description.trim(),
        status: 'pending',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-all-data'] })
      setSuccess(true)
      setTimeout(() => {
        onOpenChange(false)
        setType('other')
        setDescription('')
        setSuccess(false)
      }, 2000)
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    await createMutation.mutateAsync()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Änderung beantragen</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold text-green-700">Anfrage eingereicht</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ihr Broker wird sich in Kürze mit Ihnen in Verbindung setzen.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* POLICY INFO */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-900 font-semibold">Police</p>
              <p className="text-sm text-blue-800">{contract.policy_number}</p>
            </div>

            {/* TYPE */}
            <div>
              <Label>Art der Änderung</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map(rt => (
                    <SelectItem key={rt.key} value={rt.key}>{rt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* DESCRIPTION */}
            <div>
              <Label>Beschreibung der gewünschten Änderung</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Erklären Sie detailliert, was geändert werden soll..."
                className="mt-1 h-24"
              />
            </div>

            {/* ERROR */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* INFO */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <p className="font-semibold mb-1">ℹ️ Bearbeitungszeit</p>
              <p>Ihr Broker wird Ihre Anfrage prüfen und Sie kontaktieren.</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                {createMutation.isPending ? 'Wird eingereicht...' : 'Anfrage einreichen'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}