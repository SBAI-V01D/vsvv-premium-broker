import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { FileText } from 'lucide-react'
import { format } from 'date-fns'
import { usePortalCustomer } from '@/hooks/usePortalCustomer'

const NAVY = '#0B1C2C'
const ACCENT = '#4F7CFF'

const STATUS_COLORS = {
  active: '#16a34a', aktiv: '#16a34a',
  cancelled: '#dc2626', gekuendigt: '#dc2626',
  paused: '#d97706', expired: '#6b7280',
}
const STATUS_LABELS = {
  active: 'Aktiv', aktiv: 'Aktiv',
  cancelled: 'Gekündigt', gekuendigt: 'Gekündigt',
  paused: 'Pausiert', expired: 'Abgelaufen',
}

export default function PortalContracts() {
  const { customerId, isLoading } = usePortalCustomer()

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['portal-contracts', customerId],
    queryFn: () => base44.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId,
  })

  if (isLoading || loadingContracts) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280' }}>Laden...</div>
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: NAVY, fontSize: 24, fontWeight: 700, margin: 0 }}>Meine Verträge</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>{contracts.length} Vertrag{contracts.length !== 1 ? 'e' : ''} gefunden</p>
      </div>

      {contracts.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 1px 6px rgba(11,28,44,0.07)' }}>
          <FileText size={36} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p style={{ color: '#9ca3af', margin: 0 }}>Keine Verträge vorhanden</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {contracts.map(c => {
            const statusColor = STATUS_COLORS[c.status] || '#6b7280'
            const statusLabel = c.custom_status || STATUS_LABELS[c.status] || c.status
            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 6px rgba(11,28,44,0.07)', borderLeft: `4px solid ${statusColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <h3 style={{ color: NAVY, fontWeight: 700, fontSize: 16, margin: 0 }}>{c.insurer || c.provider || '–'}</h3>
                      <span style={{ background: `${statusColor}18`, color: statusColor, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
                        {statusLabel}
                      </span>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                      {c.insurance_type}{c.product ? ` · ${c.product}` : ''}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {c.premium_monthly != null && (
                      <p style={{ color: NAVY, fontWeight: 700, fontSize: 17, margin: 0 }}>
                        CHF {c.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}<span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>/Mt.</span>
                      </p>
                    )}
                    {c.premium_yearly != null && (
                      <p style={{ color: '#6b7280', fontSize: 12, margin: '2px 0 0' }}>
                        CHF {c.premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 2 })} / Jahr
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
                  {[
                    { label: 'Policen-Nr.', value: c.policy_number || '–' },
                    { label: 'Vertragsbeginn', value: c.start_date ? format(new Date(c.start_date), 'dd.MM.yyyy') : '–' },
                    { label: 'Vertragsende', value: c.end_date ? format(new Date(c.end_date), 'dd.MM.yyyy') : '–' },
                    { label: 'Kündigungsfrist', value: c.cancellation_deadline ? format(new Date(c.cancellation_deadline), 'dd.MM.yyyy') : '–' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p style={{ color: '#9ca3af', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 3px' }}>{label}</p>
                      <p style={{ color: NAVY, fontSize: 13, fontWeight: 500, margin: 0 }}>{value}</p>
                    </div>
                  ))}
                </div>

                {(c.sparte_data?.franchise || c.sparte_data?.model) && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
                    {c.sparte_data.franchise && <span style={{ color: '#6b7280', fontSize: 12 }}>Franchise: <strong>CHF {c.sparte_data.franchise}</strong></span>}
                    {c.sparte_data.model && <span style={{ color: '#6b7280', fontSize: 12 }}>Modell: <strong>{c.sparte_data.model}</strong></span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}