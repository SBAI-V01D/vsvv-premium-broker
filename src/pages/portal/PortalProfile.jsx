import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { usePortalCustomer } from '@/hooks/usePortalCustomer'
import { Mail, Phone, MapPin, Calendar, User, LogOut } from 'lucide-react'

export default function PortalProfile() {
  const navigate = useNavigate()
  const { customer, isLoading } = usePortalCustomer()

  const handleLogout = () => {
    localStorage.removeItem('portal_customer_id')
    localStorage.removeItem('portal_email')
    navigate('/portal/setup')
  }

  if (isLoading) return <div className="flex items-center justify-center h-40 text-muted-foreground">Laden...</div>
  if (!customer) return null

  const fields = [
    { label: 'Vorname', value: customer.first_name },
    { label: 'Nachname', value: customer.last_name },
    { label: 'E-Mail', value: customer.email },
    { label: 'Telefon', value: customer.phone },
    { label: 'Mobilnummer', value: customer.mobile },
    { label: 'Adresse', value: customer.street ? `${customer.street}, ${customer.zip_code} ${customer.city}` : null },
    { label: 'Kanton', value: customer.canton },
    { label: 'Geburtsdatum', value: customer.birthdate ? new Date(customer.birthdate).toLocaleDateString('de-CH') : null },
    { label: 'Beruf', value: customer.profession },
    { label: 'Nationalität', value: customer.nationality },
    { label: 'Zivilstand', value: customer.civil_status },
    { label: 'AHV-Nummer', value: customer.ahv_number },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Mein Profil</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Persönliche Daten
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.filter(f => f.value).map(f => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{f.label}</p>
              <p className="text-sm font-medium">{f.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Konto</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Für Änderungen Ihrer persönlichen Daten kontaktieren Sie bitte Ihren Versicherungsbroker.
          </p>
          <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            Abmelden
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}