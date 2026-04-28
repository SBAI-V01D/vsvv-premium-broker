import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Search, Send, Edit, Trash2, MoreHorizontal, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'
import EmailCampaignForm from '../components/email/EmailCampaignForm'

export default function EmailCampaigns() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const { data: campaigns = [] } = useQuery({
    queryKey: ['email-campaigns'],
    queryFn: () => base44.entities.EmailCampaign.list('-created_date'),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EmailCampaign.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] })
      setShowForm(false)
      setEditing(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EmailCampaign.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] })
      setShowForm(false)
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EmailCampaign.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
  })

  const sendMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('sendEmailCampaign', { campaign_id: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-campaigns'] }),
  })

  const filtered = campaigns.filter(c =>
    `${c.name} ${c.subject}`.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data })
    } else {
      createMutation.mutate({ ...data, recipients_count: data.filter_status === 'all' ? customers.length : customers.filter(c => c.status === data.filter_status).length })
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">E-Mail-Kampagnen</h1>
          <p className="text-muted-foreground mt-1">{campaigns.length} Kampagnen insgesamt</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Neue Kampagne
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Kampagnen suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Empfänger</TableHead>
                <TableHead className="hidden lg:table-cell">Geplant für</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Keine Kampagnen gefunden
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(campaign => (
                  <TableRow key={campaign.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm capitalize">{campaign.status}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{campaign.recipients_count || 0}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {campaign.scheduled_at ? format(new Date(campaign.scheduled_at), 'dd.MM.yyyy HH:mm') : '–'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {campaign.status === 'draft' && (
                            <>
                              <DropdownMenuItem onClick={() => { setEditing(campaign); setShowForm(true); }}>
                                <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => sendMutation.mutate(campaign.id)}>
                                <Send className="w-4 h-4 mr-2" /> Jetzt senden
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm('Kampagne wirklich löschen?')) {
                                deleteMutation.mutate(campaign.id)
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Kampagne bearbeiten' : 'Neue Kampagne'}</DialogTitle>
          </DialogHeader>
          <EmailCampaignForm
            campaign={editing}
            customers={customers}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            saving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}