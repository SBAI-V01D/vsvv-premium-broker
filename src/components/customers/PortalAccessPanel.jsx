import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertCircle, Eye, EyeOff, Key, Shield } from 'lucide-react'

export default function PortalAccessPanel({ customer, onUpdate }) {
  const [portalEnabled, setPortalEnabled] = useState(customer?.portal_access_enabled || false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleTogglePortal = async (enabled) => {
    if (!customer?.id) return
    setPortalEnabled(enabled)
    await base44.entities.Customer.update(customer.id, {
      portal_access_enabled: enabled,
    })
    onUpdate?.()
  }

  const handleSetPassword = async () => {
    if (!customer?.id || !password.trim()) {
      setMessage('Passwort erforderlich')
      return
    }
    setLoading(true)
    try {
      await base44.functions.invoke('managePortalPassword', {
        action: 'set_password',
        customer_id: customer.id,
        password,
      })
      setMessage('✓ Passwort gesetzt – Kunde muss es beim nächsten Login ändern')
      setPassword('')
      setTimeout(() => { setShowPasswordDialog(false); setMessage('') }, 2000)
      onUpdate?.()
    } catch (error) {
      setMessage(`Fehler: ${error.message}`)
    }
    setLoading(false)
  }

  const handleResetPassword = async () => {
    if (!customer?.id || !password.trim()) {
      setMessage('Neues Passwort erforderlich')
      return
    }
    setLoading(true)
    try {
      await base44.functions.invoke('managePortalPassword', {
        action: 'reset_password',
        customer_id: customer.id,
        password,
      })
      setMessage('✓ Passwort zurückgesetzt – Kunde muss es beim nächsten Login ändern')
      setPassword('')
      setTimeout(() => { setShowPasswordDialog(false); setMessage('') }, 2000)
      onUpdate?.()
    } catch (error) {
      setMessage(`Fehler: ${error.message}`)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Kundenportal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
            <div>
              <p className="font-semibold text-sm">Portal-Zugriff</p>
              <p className="text-xs text-muted-foreground mt-1">E-Mail: {customer.email}</p>
            </div>
            <button
              onClick={() => handleTogglePortal(!portalEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                portalEnabled ? 'bg-green-500' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  portalEnabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {portalEnabled && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                Passwort-Verwaltung
              </p>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowPasswordDialog(true)}
              >
                <Key className="w-4 h-4 mr-2" />
                {customer.portal_password_hash ? 'Passwort zurücksetzen' : 'Passwort setzen'}
              </Button>
              {customer.portal_password_must_change && (
                <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <p>Kunde muss Passwort beim nächsten Login ändern</p>
                </div>
              )}
              {customer.portal_last_login && (
                <p className="text-xs text-muted-foreground">
                  Letzter Login: {new Date(customer.portal_last_login).toLocaleDateString('de-CH')}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {customer.portal_password_hash ? 'Passwort zurücksetzen' : 'Passwort setzen'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Neues Passwort</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="z.B. SecurePass123!"
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Min. 8 Zeichen empfohlen</p>
            </div>

            {message && (
              <div className={`text-xs p-2 rounded-lg ${
                message.startsWith('✓') 
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPasswordDialog(false)}
              disabled={loading}
            >
              Abbrechen
            </Button>
            <Button
              onClick={customer.portal_password_hash ? handleResetPassword : handleSetPassword}
              disabled={loading || !password.trim()}
            >
              {loading ? 'Wird gespeichert...' : customer.portal_password_hash ? 'Zurücksetzen' : 'Setzen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}