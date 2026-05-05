import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertCircle, Shield, Key, Check } from 'lucide-react'

export default function PortalActivationPanel({ customer }) {
  const [showActivate, setShowActivate] = useState(false)
  const [initialPassword, setInitialPassword] = useState('')
  const queryClient = useQueryClient()

  const activateMutation = useMutation({
    mutationFn: async () => {
      // Aktiviere Portal + setze Initialpasswort
      await base44.entities.Customer.update(customer.id, {
        portal_enabled: true,
        portal_password_hash: initialPassword, // In production: bcrypt hash
        portal_must_change_password: true,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setShowActivate(false)
      setInitialPassword('')
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Customer.update(customer.id, {
        portal_enabled: false,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })

  const status = customer.portal_enabled
  const passwordRotation = customer.portal_password_last_changed
    ? Math.floor((new Date() - new Date(customer.portal_password_last_changed)) / (1000 * 60 * 60 * 24))
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Portal-Zugriff (Admin-Kontrolle)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className={`p-3 rounded-lg border-l-4 ${status ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
          <p className="text-sm font-medium">
            {status ? '✅ Portal aktiviert' : '❌ Portal deaktiviert'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {status
              ? passwordRotation && passwordRotation > 28
                ? `⚠️ Passwort ${passwordRotation} Tage alt – Wechsel nötig`
                : `Passwort-Rotation: ${passwordRotation || 0} Tage`
              : 'Kunde hat keinen Zugriff'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {!status ? (
            <Button
              size="sm"
              onClick={() => setShowActivate(true)}
              className="gap-2"
            >
              <Key className="w-4 h-4" />
              Portal aktivieren
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowActivate(true)}
                className="gap-2"
              >
                <Key className="w-4 h-4" />
                Passwort zurücksetzen
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deactivateMutation.mutate()}
                disabled={deactivateMutation.isPending}
              >
                Portal deaktivieren
              </Button>
            </>
          )}
        </div>

        {/* Info */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-blue-900">
            <strong>Admin-Kontrolle:</strong> Du entscheidest, welche Kunden Portal-Zugang bekommen. Nach Aktivierung erzwingt das System Passwortänderung beim ersten Login.
          </p>
        </div>
      </CardContent>

      {/* Activation Dialog */}
      <Dialog open={showActivate} onOpenChange={setShowActivate}>
       <DialogContent>
         <DialogHeader>
           <DialogTitle>
             {status ? 'Passwort zurücksetzen' : 'Portal aktivieren'} für {customer.first_name} {customer.last_name}
           </DialogTitle>
         </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Initialpasswort setzen</Label>
              <Input
                type="password"
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Kunde muss beim ersten Login sein Passwort ändern.
              </p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <strong>Regeln nach Aktivierung:</strong>
              <ul className="mt-2 space-y-1 ml-4 list-disc">
                <li>Kunde sieht nur seine Daten (customer_id filter)</li>
                <li>Passwort muss beim Login geändert werden</li>
                <li>Alle 28 Tage Passwortänderung erforderlich</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivate(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => activateMutation.mutate()}
              disabled={initialPassword.length < 8 || activateMutation.isPending}
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              Aktivieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}