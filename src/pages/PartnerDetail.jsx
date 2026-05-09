import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { ArrowLeft, Edit, Globe, Mail, Phone, MapPin, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import PartnerDocumentsPanel from '@/components/partner/PartnerDocumentsPanel'
import PartnerActivitiesPanel from '@/components/partner/PartnerActivitiesPanel'

const CATEGORY_LABELS = {
  versicherung: '🏢 Versicherung',
  bank: '🏦 Bank',
  finanzierungspartner: '💰 Finanzierungspartner',
  vorsorgepartner: '📊 Vorsorgepartner',
  rechtsschutz: '⚖️ Rechtsschutz',
  krankenkasse: '🏥 Krankenkasse',
  sonstige: '📋 Sonstige'
}

export default function PartnerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [showEdit, setShowEdit] = useState(false)
  const queryClient = useQueryClient()

  const { data: allPartners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => base44.entities.Partner.list(),
  })

  const partner = allPartners.find(p => p.id === id)



  if (!partner) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Partner nicht gefunden</p>
      </div>
    )
  }

  return (
    <div>
      <Link to="/partner" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Zurück
      </Link>

      <div className="flex justify-between items-start mb-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">{partner.name}</h1>
          <div className="flex gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${partner.status === 'aktiv' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
              {partner.status}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {CATEGORY_LABELS[partner.category]}
            </span>
          </div>
        </div>
        <Button onClick={() => setShowEdit(true)}>
          <Edit className="w-4 h-4 mr-2" /> Bearbeiten
        </Button>
      </div>

      {/* Stammdaten */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 space-y-3">
            {partner.contact_person && <div className="flex gap-2"><span className="text-muted-foreground">👤</span><div><p className="text-xs text-muted-foreground">Ansprechpartner</p><p className="font-semibold">{partner.contact_person}</p></div></div>}
            {partner.email && <div className="flex gap-2"><Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" /><div><p className="text-xs text-muted-foreground">Email</p><p className="font-semibold text-sm">{partner.email}</p></div></div>}
            {partner.phone && <div className="flex gap-2"><Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" /><div><p className="text-xs text-muted-foreground">Telefon</p><p className="font-semibold text-sm">{partner.phone}</p></div></div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            {partner.street && <div><p className="text-xs text-muted-foreground">Adresse</p><p className="font-semibold text-sm">{partner.street}</p></div>}
            {partner.zip_code && <p className="font-semibold text-sm">{partner.zip_code} {partner.city}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            {partner.website && <div><p className="text-xs text-muted-foreground">Website</p><a href={partner.website} target="_blank" rel="noopener" className="text-primary hover:underline text-sm font-semibold">{partner.website}</a></div>}
            {partner.notes && <div><p className="text-xs text-muted-foreground">Bemerkungen</p><p className="text-sm italic">{partner.notes}</p></div>}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dokumente">
        <TabsList className="mb-4">
          <TabsTrigger value="dokumente">Dokumente</TabsTrigger>
          <TabsTrigger value="aktivitaeten">Aktivitäten</TabsTrigger>
        </TabsList>

        <TabsContent value="dokumente">
          <PartnerDocumentsPanel partnerId={id} partnerName={partner.name} />
        </TabsContent>

        <TabsContent value="aktivitaeten">
          <PartnerActivitiesPanel partnerId={id} />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partner bearbeiten</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Bearbeitungsformular wird hier angezeigt</p>
        </DialogContent>
      </Dialog>
    </div>
  )
}