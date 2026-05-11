import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Search, Edit, MoreHorizontal, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

export default function CustomerAssignmentsTab() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedAdvisors, setSelectedAdvisors] = useState([])
  const queryClient = useQueryClient()

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.list(),
  })

  const updateCustomerMutation = useMutation({
    mutationFn: ({ customerId, data }) => base44.entities.Customer.update(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setShowDialog(false)
      setSelectedCustomer(null)
      setSelectedAdvisors([])
    }
  })

  const handleEdit = (customer) => {
    setSelectedCustomer(customer)
    setSelectedAdvisors(customer.assigned_advisors || [])
    setShowDialog(true)
  }

  const handleSave = () => {
    if (!selectedCustomer) return
    const primaryAdvisor = selectedAdvisors[0] || null
    updateCustomerMutation.mutate({
      customerId: selectedCustomer.id,
      data: {
        primary_advisor_id: primaryAdvisor,
        assigned_advisors: selectedAdvisors,
      }
    })
  }

  const toggleAdvisor = (advisorId) => {
    if (selectedAdvisors.includes(advisorId)) {
      setSelectedAdvisors(selectedAdvisors.filter(id => id !== advisorId))
    } else {
      setSelectedAdvisors([...selectedAdvisors, advisorId])
    }
  }

  const filteredCustomers = customers.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-4">Kundenzuweisungen</h2>
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Kunde suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredCustomers.map(customer => (
          <Card key={customer.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">{customer.first_name} {customer.last_name}</p>
                  <p className="text-xs text-muted-foreground">{customer.email}</p>
                  
                  <div className="mt-3 flex flex-wrap gap-2">
                    {customer.primary_advisor_id && (() => {
                      const advisor = advisors.find(a => a.id === customer.primary_advisor_id)
                      return advisor ? (
                        <Badge key={advisor.id} className="bg-primary">
                          {advisor.firstname} {advisor.lastname} (Hauptberater)
                        </Badge>
                      ) : null
                    })()}
                    
                    {customer.assigned_advisors?.filter(id => id !== customer.primary_advisor_id).map(advisorId => {
                      const advisor = advisors.find(a => a.id === advisorId)
                      return advisor ? (
                        <Badge key={advisor.id} variant="outline">
                          {advisor.firstname} {advisor.lastname}
                        </Badge>
                      ) : null
                    })}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(customer)}>
                      <Edit className="w-4 h-4 mr-2" /> Berater zuweisen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Berater zuweisen: {selectedCustomer?.first_name} {selectedCustomer?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wähle einen Hauptberater und optional Co-Berater. Der erste wird als Hauptberater definiert.
            </p>
            
            <div className="space-y-3 max-h-60 overflow-y-auto border rounded p-3">
              {advisors.map(advisor => (
                <div key={advisor.id} className="flex items-center gap-2">
                  <Checkbox
                    id={advisor.id}
                    checked={selectedAdvisors.includes(advisor.id)}
                    onCheckedChange={() => toggleAdvisor(advisor.id)}
                  />
                  <label htmlFor={advisor.id} className="flex-1 cursor-pointer text-sm">
                    {advisor.firstname} {advisor.lastname}
                    {selectedAdvisors[0] === advisor.id && (
                      <Badge className="ml-2 bg-primary text-xs">Hauptberater</Badge>
                    )}
                  </label>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={updateCustomerMutation.isPending}>
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}