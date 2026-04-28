import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNavigate } from 'react-router-dom'

export default function PortalProfile() {
  const navigate = useNavigate()
  const [editMode, setEditMode] = useState(false)

  const { data: user } = useQuery({
    queryKey: ['portal-user'],
    queryFn: () => base44.auth.me(),
  })

  const updateMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      setEditMode(false)
    },
  })

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
  })

  const handleLogout = async () => {
    await base44.auth.logout('/portal/setup')
  }

  const handleSave = () => {
    updateMutation.mutate(form)
  }

  if (!user) {
    return <div>Laden...</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Mein Profil</h1>

      <Card>
        <CardHeader>
          <CardTitle>Kontoinformationen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>E-Mail</Label>
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
          </div>

          <div>
            <Label>Name</Label>
            {editMode ? (
              <Input
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="text-sm text-muted-foreground mt-1">{user.full_name}</p>
            )}
          </div>

          <div className="flex gap-2">
            {editMode ? (
              <>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Speichern...' : 'Speichern'}
                </Button>
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  Abbrechen
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setEditMode(true)}>
                Bearbeiten
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Sicherheit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Dein Konto ist durch Zwei-Faktor-Authentifizierung geschützt.</p>
          <Button variant="outline" onClick={handleLogout}>
            Abmelden
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}