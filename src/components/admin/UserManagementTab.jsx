import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Edit, MoreHorizontal, Check, X } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export default function UserManagementTab() {
  const [showDialog, setShowDialog] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({})
  const queryClient = useQueryClient()

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  })

  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.list(),
  })

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowDialog(false)
      setEditingUser(null)
      setFormData({})
    }
  })

  const handleEdit = (user) => {
    setEditingUser(user)
    setFormData({ role: user.role })
    setShowDialog(true)
  }

  const handleSave = () => {
    if (editingUser) {
      updateUserMutation.mutate(formData)
    }
  }

  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'admin': return 'bg-red-100 text-red-700'
      case 'broker': return 'bg-blue-100 text-blue-700'
      case 'assistenz': return 'bg-green-100 text-green-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getRoleLabel = (role) => {
    switch(role) {
      case 'admin': return 'Admin'
      case 'broker': return 'Broker/Berater'
      case 'assistenz': return 'Assistenz'
      default: return role
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Benutzerverwaltung</h2>
        <Button onClick={() => { setEditingUser(null); setShowDialog(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          Neuer Benutzer
        </Button>
      </div>

      {/* User List */}
      <div className="space-y-3">
        {users.map(user => {
          const advisorData = advisors.find(a => a.email === user.email)
          return (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {user.full_name?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                      {advisorData && (
                        <Badge variant="outline">
                          {advisorData.firstname} {advisorData.lastname}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(user)}>
                        <Edit className="w-4 h-4 mr-2" /> Rolle ändern
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? `${editingUser.full_name} bearbeiten` : 'Neuer Benutzer'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingUser && (
              <>
                <div>
                  <label className="text-sm font-medium">E-Mail</label>
                  <Input 
                    placeholder="user@example.com"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    disabled
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input 
                    placeholder="John Doe"
                    value={formData.full_name || ''}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </>
            )}
            
            <div>
              <label className="text-sm font-medium">Rolle</label>
              <Select value={formData.role || 'broker'} onValueChange={(value) => setFormData({...formData, role: value})}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin – Vollzugriff</SelectItem>
                  <SelectItem value="broker">Broker/Berater – Zugewiesene Kunden</SelectItem>
                  <SelectItem value="assistenz">Assistenz – Eingeschränkter Zugriff</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                {formData.role === 'admin' && 'Vollzugriff auf alle Funktionen und Daten.'}
                {formData.role === 'broker' && 'Zugriff nur auf zugewiesene Kunden, Verträge und Dokumente.'}
                {formData.role === 'assistenz' && 'Eingeschränkter Zugriff auf Aufgaben, Dokumente und bestimmte Kunden.'}
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={updateUserMutation.isPending}>
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}