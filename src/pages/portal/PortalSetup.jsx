import React from 'react'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PortalSetup() {
  const handleLogin = () => {
    base44.auth.redirectToLogin('/portal')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Kundenportal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Melden Sie sich an, um auf Ihre Verträge, Anträge und Dokumente zuzugreifen.
          </p>

          <Button onClick={handleLogin} className="w-full">
            Anmelden
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Sie haben noch kein Konto? Kontaktieren Sie bitte Ihren Versicherungsbroker.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}