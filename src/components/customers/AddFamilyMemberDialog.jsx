import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, Loader2 } from 'lucide-react'

export default function AddFamilyMemberDialog({ customer, open, onOpenChange }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: customer?.last_name || '',
    email: customer?.email || '',
    street: customer?.street || '',
    zip_code: customer?.zip_code || '',
    city: customer?.city || '',
    familyRole: '',
    birthdate: '',
    gender: '',
  })
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Backend-Funktion aufrufen
      const response = await base44.functions.invoke('createFamilyMember', {
        primaryCustomerId: customer.id,
        primaryCustomerName: `${customer.first_name} ${customer.last_name}`,
        firstName: data.firstName,
        lastName: data.lastName || customer.last_name,
        email: data.email || null,
        street: data.street || null,
        zip_code: data.zip_code || null,
        city: data.city || null,
        familyRole: data.familyRole,
        birthdate: data.birthdate || null,
        gender: data.gender || null,
      })
      return response.data
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        onOpenChange(false)
        // Weiterleitung zum neuen Familienmitglied
        navigate(`/kunden/${result.familyMemberId}`)
      } else {
        setError(result.error || 'Fehler beim Erstellen des Familienmitglieds')
      }
    },
    onError: (err) => {
      setError(err.message || 'Fehler beim Erstellen des Familienmitglieds')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    // Validierung
    if (!formData.firstName.trim()) {
      setError('Vorname ist erforderlich')
      return
    }
    if (!formData.familyRole) {
      setError('Beziehung ist erforderlich')
      return
    }

    createMutation.mutate(formData)
  }

  const handleClose = () => {
    setFormData({ firstName: '', lastName: customer?.last_name || '', email: customer?.email || '', street: customer?.street || '', zip_code: customer?.zip_code || '', city: customer?.city || '', familyRole: '', birthdate: '', gender: '' })
    setError('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Familienmitglied hinzufügen</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">Vorname *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData(p => ({ ...p, firstName: e.target.value }))}
                placeholder="z.B. Anna"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Nachname *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData(p => ({ ...p, lastName: e.target.value }))}
                placeholder="Nachname"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
              placeholder="E-Mail"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="street">Strasse</Label>
            <Input
              id="street"
              value={formData.street}
              onChange={(e) => setFormData(p => ({ ...p, street: e.target.value }))}
              placeholder="Strasse"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="zip_code">PLZ</Label>
              <Input
                id="zip_code"
                value={formData.zip_code}
                onChange={(e) => setFormData(p => ({ ...p, zip_code: e.target.value }))}
                placeholder="PLZ"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="city">Ort</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData(p => ({ ...p, city: e.target.value }))}
                placeholder="Ort"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="familyRole">Beziehung *</Label>
            <Select value={formData.familyRole} onValueChange={(v) => setFormData(p => ({ ...p, familyRole: v }))}>
              <SelectTrigger id="familyRole" className="mt-1">
                <SelectValue placeholder="Beziehung auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spouse">Ehepartner / Lebenspartner</SelectItem>
                <SelectItem value="child">Kind</SelectItem>
                <SelectItem value="parent">Elternteil</SelectItem>
                <SelectItem value="other">Anderes Familienmitglied</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="birthdate">Geburtsdatum (optional)</Label>
            <Input
              id="birthdate"
              type="date"
              value={formData.birthdate}
              onChange={(e) => setFormData(p => ({ ...p, birthdate: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="gender">Geschlecht (optional)</Label>
            <Select value={formData.gender} onValueChange={(v) => setFormData(p => ({ ...p, gender: v }))}>
              <SelectTrigger id="gender" className="mt-1">
                <SelectValue placeholder="Geschlecht auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Männlich</SelectItem>
                <SelectItem value="female">Weiblich</SelectItem>
                <SelectItem value="other">Anderes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
            ✓ Folgende Daten werden übernommen: Adresse, Telefon, E-Mail, Familienname, Berater
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={createMutation.isPending}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}