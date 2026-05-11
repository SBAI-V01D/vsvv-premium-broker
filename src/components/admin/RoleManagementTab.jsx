import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, Shield } from 'lucide-react'

export default function RoleManagementTab() {
  const roles = [
    {
      name: 'Admin',
      id: 'admin',
      color: 'text-red-700 bg-red-100',
      permissions: [
        'Alle Kunden sehen',
        'Alle Verträge sehen',
        'Alle Dokumente sehen',
        'Alle Aufgaben sehen',
        'Benutzer verwalten',
        'Rollen ändern',
        'Zugriffsrechte verwalten',
        'Reports und Analytics',
        'System-Einstellungen',
      ]
    },
    {
      name: 'Broker / Berater',
      id: 'broker',
      color: 'text-blue-700 bg-blue-100',
      permissions: [
        'Nur zugewiesene Kunden',
        'Nur zugewiesene Verträge',
        'Nur zugewiesene Dokumente',
        'Nur eigene Aufgaben',
        'Eigene Leads verwalten',
        'Teilweise Reports (eigene Kunden)',
        'Keine Benutzerverwaltung',
        'Keine Systemeinstellungen',
      ]
    },
    {
      name: 'Assistenz',
      id: 'assistenz',
      color: 'text-green-700 bg-green-100',
      permissions: [
        'Zugeteilte Aufgaben',
        'Bestimmte Kunden',
        'Dokumente (mit Berechtigung)',
        'Keine sensiblen Managementdaten',
        'Keine Kundenverwaltung',
        'Keine Vertragsverwaltung',
        'Keine Systemeinstellungen',
      ]
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Rollendefinitionen</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Die Rollenverwaltung erfolgt zentral. Alle Rechte werden durch Backend-Funktionen (guardDataAccess) durchgesetzt.
        </p>
      </div>

      <div className="grid gap-6">
        {roles.map(role => (
          <Card key={role.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5" />
                <div className="flex-1">
                  <Badge className={role.color}>{role.name}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {role.permissions.map((perm, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{perm}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong>Hinweis:</strong> Rollen sind global definiert. Sie können pro Benutzer zugewiesen werden. Spezielle Zugriffe auf einzelne Kunden/Verträge werden in den Zuweis-Tabs verwaltet.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}