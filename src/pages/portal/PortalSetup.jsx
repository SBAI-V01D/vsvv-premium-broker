import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function PortalSetup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Lookup customer by email via backend (no auth required)
      const lookupResult = await base44.functions.invoke('managePortalPassword', {
        action: 'lookup_customer',
        email,
      })

      if (!lookupResult.data?.found) {
        setError('E-Mail-Adresse nicht gefunden')
        setLoading(false)
        return
      }

      const { customer_id, portal_access_enabled, portal_password_must_change } = lookupResult.data

      if (!portal_access_enabled) {
        setError('Portal-Zugriff ist nicht aktiviert. Kontaktieren Sie Ihren Broker.')
        setLoading(false)
        return
      }

      // Verify password
      const verifyResult = await base44.functions.invoke('managePortalPassword', {
        action: 'verify',
        customer_id,
        password,
      })

      if (!verifyResult.data?.valid) {
        setError('E-Mail oder Passwort ist falsch')
        setLoading(false)
        return
      }

      // Check if password must be changed
      if (portal_password_must_change) {
        setMustChangePassword(true)
        setLoading(false)
        return
      }

      // Login successful
      localStorage.setItem('portal_customer_id', customer_id)
      localStorage.setItem('portal_email', email)
      navigate('/portal')
    } catch (err) {
      setError(`Fehler: ${err.message}`)
    }
    setLoading(false)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!newPassword.trim()) {
      setError('Neues Passwort erforderlich')
      return
    }
    setLoading(true)

    try {
      const lookupResult = await base44.functions.invoke('managePortalPassword', {
        action: 'lookup_customer',
        email,
      })

      if (!lookupResult.data?.found) {
        setError('Kunde nicht gefunden')
        setLoading(false)
        return
      }

      const { customer_id } = lookupResult.data

      await base44.functions.invoke('managePortalPassword', {
        action: 'reset_password',
        customer_id,
        password: newPassword,
      })

      localStorage.setItem('portal_customer_id', customer_id)
      localStorage.setItem('portal_email', email)
      navigate('/portal')
    } catch (err) {
      setError(`Fehler: ${err.message}`)
    }
    setLoading(false)
  }

  // Password change screen
  if (mustChangePassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Passwort ändern</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-muted-foreground mb-6">
              Sie müssen Ihr Passwort beim ersten Login ändern
            </p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label>E-Mail</Label>
                <Input value={email} disabled className="mt-1" />
              </div>
              <div>
                <Label>Neues Passwort</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Min. 8 Zeichen"
                    className="pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Wird gespeichert...' : 'Passwort ändern'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Login screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Kundenportal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground mb-6">
            Melden Sie sich mit Ihrer E-Mail und Ihrem Passwort an
          </p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>E-Mail-Adresse</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="z.B. info@example.com"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label>Passwort</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Wird angemeldet...' : 'Anmelden'}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-6">
            Sie haben noch kein Konto? Kontaktieren Sie Ihren Versicherungsbroker.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}