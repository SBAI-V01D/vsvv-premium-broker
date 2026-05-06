import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function FinanceWidget() {
  const navigate = useNavigate()
  const { data: commissions = [] } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => base44.entities.CommissionEntry.list(null, 1000),
  })

  const { data: accountingEntries = [] } = useQuery({
    queryKey: ['accounting_entries'],
    queryFn: () => base44.entities.AccountingEntry.list(null, 1000),
  })

  // ─── KPIs ───
  const totalCommission = commissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
  const earnedCommission = commissions
    .filter(c => c.status === 'earned')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0)
  const pendingCommission = commissions
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0)
  const cancelledCommission = commissions
    .filter(c => c.status === 'cancelled')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0)

  const paidAmount = accountingEntries
    .filter(e => e.entry_type === 'commission' && e.status === 'paid')
    .reduce((sum, e) => sum + (e.amount || 0), 0)

  const stornoLoss = Math.abs(
    accountingEntries
      .filter(e => e.entry_type === 'storno')
      .reduce((sum, e) => sum + (e.amount || 0), 0)
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Total Commission */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/provisionen-courtagen')}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Provision</p>
              <p className="text-2xl font-bold">
                CHF {totalCommission.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      {/* Earned Commission */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/provisionen-courtagen')}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Verdient (earned)</p>
              <p className="text-2xl font-bold">
                CHF {earnedCommission.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
        </CardContent>
      </Card>

      {/* Pending Commission */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/provisionen-courtagen')}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ausstehend (pending)</p>
              <p className="text-2xl font-bold">
                CHF {pendingCommission.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
        </CardContent>
      </Card>

      {/* Storno Loss */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/provisionen-courtagen')}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Stornoverlust</p>
              <p className="text-2xl font-bold">
                CHF {stornoLoss.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-red-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}