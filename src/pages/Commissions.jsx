import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Download } from 'lucide-react'
import { jsPDF } from 'jspdf'

export default function Commissions() {
  const [search, setSearch] = useState('')
  const [filterBroker, setFilterBroker] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const { data: commissions = [] } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => base44.entities.Commission.list('-date'),
  })

  const { data: brokers = [] } = useQuery({
    queryKey: ['brokers'],
    queryFn: () => base44.entities.Broker.filter({ is_active: true }),
  })

  const uniqueBrokers = [...new Set(commissions.map(c => c.broker_email).filter(Boolean))]
  
  // Filterung
  const filtered = commissions.filter(c => {
    const searchStr = `${c.customer_name} ${c.provider} ${c.insurance_type}`.toLowerCase()
    const matchSearch = !search.trim() || searchStr.includes(search.toLowerCase())
    const matchBroker = filterBroker === 'all' || c.broker_email === filterBroker
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    return matchSearch && matchBroker && matchStatus
  })

  // Auswertung nach Gesellschaft und Berater
  const providerSummary = {}
  commissions.forEach(c => {
    if (!providerSummary[c.provider]) {
      providerSummary[c.provider] = {}
    }
    if (!providerSummary[c.provider][c.broker_email]) {
      providerSummary[c.provider][c.broker_email] = {
        broker_name: c.broker_name,
        gross_amount: 0,
        deductions: 0,
        net_amount: 0,
        count: 0,
      }
    }
    const gross = c.amount || 0
    const deduction = gross * 0.1
    providerSummary[c.provider][c.broker_email].gross_amount += gross
    providerSummary[c.provider][c.broker_email].deductions += deduction
    providerSummary[c.provider][c.broker_email].net_amount += (gross - deduction)
    providerSummary[c.provider][c.broker_email].count += 1
  })

  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    return new Date(dateStr).toLocaleDateString('de-CH')
  }

  const handleExportPDF = () => {
    const doc = new jsPDF()
    const pageHeight = doc.internal.pageSize.getHeight()
    const pageWidth = doc.internal.pageSize.getWidth()
    let yPos = 20

    doc.setFontSize(18)
    doc.text('Provisionsauswertung', pageWidth / 2, yPos, { align: 'center' })
    yPos += 15

    // Nach Gesellschaft gruppiert
    Object.entries(providerSummary).forEach(([provider, brokerData]) => {
      if (yPos > pageHeight - 40) {
        doc.addPage()
        yPos = 10
      }

      doc.setFontSize(13)
      doc.text(`Gesellschaft: ${provider}`, 10, yPos)
      yPos += 8

      doc.setFontSize(10)
      const headers = ['Berater', 'Brutto', 'Abzug (10%)', 'Netto']
      const colWidths = [70, 30, 30, 30]
      let xPos = 10

      // Header
      doc.setFont(undefined, 'bold')
      headers.forEach((header, i) => {
        doc.text(header, xPos, yPos)
        xPos += colWidths[i]
      })
      yPos += 8
      doc.setFont(undefined, 'normal')

      // Daten
      let totalGross = 0, totalDeduction = 0, totalNet = 0
      Object.entries(brokerData).forEach(([email, data]) => {
        if (yPos > pageHeight - 10) {
          doc.addPage()
          yPos = 10
        }

        xPos = 10
        doc.text(data.broker_name || email, xPos, yPos)
        xPos += colWidths[0]
        doc.text(`CHF ${data.gross_amount.toFixed(2)}`, xPos, yPos)
        xPos += colWidths[1]
        doc.text(`CHF ${data.deductions.toFixed(2)}`, xPos, yPos)
        xPos += colWidths[2]
        doc.text(`CHF ${data.net_amount.toFixed(2)}`, xPos, yPos)
        yPos += 6

        totalGross += data.gross_amount
        totalDeduction += data.deductions
        totalNet += data.net_amount
      })

      // Summe pro Gesellschaft
      yPos += 2
      doc.setFont(undefined, 'bold')
      xPos = 10
      doc.text('Summe', xPos, yPos)
      xPos += colWidths[0]
      doc.text(`CHF ${totalGross.toFixed(2)}`, xPos, yPos)
      xPos += colWidths[1]
      doc.text(`CHF ${totalDeduction.toFixed(2)}`, xPos, yPos)
      xPos += colWidths[2]
      doc.text(`CHF ${totalNet.toFixed(2)}`, xPos, yPos)
      yPos += 12
      doc.setFont(undefined, 'normal')
    })

    doc.save('Provisionsauswertung.pdf')
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Provisionen</h1>
          <p className="text-muted-foreground mt-1">Übersicht abgerechneter Provisionen und Courtagen</p>
        </div>
        <Button onClick={handleExportPDF} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" /> PDF
        </Button>
      </div>

      {/* Auswertung nach Gesellschaft */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Auswertung nach Gesellschaft</h2>
        {Object.entries(providerSummary).map(([provider, brokerData]) => {
          const totalGross = Object.values(brokerData).reduce((sum, d) => sum + d.gross_amount, 0)
          const totalDeduction = Object.values(brokerData).reduce((sum, d) => sum + d.deductions, 0)
          const totalNet = Object.values(brokerData).reduce((sum, d) => sum + d.net_amount, 0)

          return (
            <Card key={provider}>
              <CardHeader>
                <CardTitle className="text-lg">{provider}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-semibold">Berater</th>
                        <th className="text-right py-2 px-3 font-semibold">Anteil Brutto</th>
                        <th className="text-right py-2 px-3 font-semibold">Abzug Stornokonto (10%)</th>
                        <th className="text-right py-2 px-3 font-semibold">Nettoprovision (Auszahlung)</th>
                        <th className="text-center py-2 px-3 font-semibold">Provisionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(brokerData).map(([email, data]) => (
                        <tr key={email} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-3">{data.broker_name || email}</td>
                          <td className="text-right py-3 px-3 font-semibold">CHF {data.gross_amount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="text-right py-3 px-3 text-destructive font-semibold">CHF {data.deductions.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="text-right py-3 px-3 text-green-600 font-bold">CHF {data.net_amount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="text-center py-3 px-3 text-muted-foreground">{data.count}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/30 font-bold">
                        <td className="py-3 px-3">Summe {provider}</td>
                        <td className="text-right py-3 px-3">CHF {totalGross.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right py-3 px-3 text-destructive">CHF {totalDeduction.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right py-3 px-3 text-green-600">CHF {totalNet.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Filter und Detailliste */}
      <div>
        <h2 className="text-xl font-bold mb-4">Alle Provisionen</h2>
        
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suche (Kunde, Gesellschaft, Versicherungsart...)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {uniqueBrokers.length > 0 && (
            <Select value={filterBroker} onValueChange={setFilterBroker}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Alle Berater" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Berater</SelectItem>
                {uniqueBrokers.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Alle Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="offen">Offen</SelectItem>
              <SelectItem value="bezahlt">Bezahlt</SelectItem>
              <SelectItem value="storniert">Storniert</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left py-3 px-4 font-semibold">Datum</th>
                    <th className="text-left py-3 px-4 font-semibold">Kunde</th>
                    <th className="text-left py-3 px-4 font-semibold">Gesellschaft</th>
                    <th className="text-left py-3 px-4 font-semibold">Versicherungsart</th>
                    <th className="text-left py-3 px-4 font-semibold">Berater</th>
                    <th className="text-right py-3 px-4 font-semibold">Betrag</th>
                    <th className="text-center py-3 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-muted-foreground">
                        Keine Provisionen gefunden
                      </td>
                    </tr>
                  ) : (
                    filtered.map(c => (
                      <tr key={c.id} className="border-b hover:bg-muted/30">
                        <td className="py-3 px-4">{formatDate(c.date)}</td>
                        <td className="py-3 px-4">{c.customer_name}</td>
                        <td className="py-3 px-4">{c.provider}</td>
                        <td className="py-3 px-4">{c.insurance_type}</td>
                        <td className="py-3 px-4">{c.broker_name}</td>
                        <td className="text-right py-3 px-4 font-semibold">CHF {c.amount?.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-center py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            c.status === 'bezahlt' ? 'bg-green-100 text-green-700' :
                            c.status === 'offen' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {c.status === 'bezahlt' ? 'Bezahlt' : c.status === 'offen' ? 'Offen' : 'Storniert'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}