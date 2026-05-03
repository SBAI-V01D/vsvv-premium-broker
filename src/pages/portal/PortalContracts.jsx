import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { format } from 'date-fns'
import { usePortalCustomer, fetchPortalContracts, yearlyPremium } from '@/hooks/usePortalCustomer'

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

function Field({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p style={{ color: '#9ca3af', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 3px' }}>{label}</p>
      <p style={{ color: NAVY, fontSize: 13, fontWeight: 500, margin: 0 }}>{value}</p>
    </div>
  )
}

export default function PortalContracts() {
  const { customerId, isLoading } = usePortalCustomer()

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['portal-contracts', customerId],
    queryFn: () => fetchPortalContracts(customerId),
    enabled: !!customerId,
    staleTime: 30_000,
  })

  if (isLoading || loadingContracts) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>Laden…</div>
  }

  const totalMonthly = contracts.reduce((s, c) => s + (c.premium_monthly || 0), 0)
  const totalYearly = contracts.reduce((s, c) => s + yearlyPremium(c), 0)

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: NAVY, fontSize: 24, fontWeight: 700, margin: 0 }}>Meine Verträge</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>{contracts.length} Vertrag{contracts.length !== 1 ? 'e' : ''} gefunden</p>
      </div>

      {/* Summary bar */}
      {contracts.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: '12px 18px', boxShadow: '0 1px 4px rgba(11,28,44,0.07)', borderLeft: `3px solid ${ACCENT}` }}>
            <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 3px' }}>Total Monatsprämie</p>
            <p style={{ color: NAVY, fontSize: 18, fontWeight: 700, margin: 0 }}>CHF {totalMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: '12px 18px', boxShadow: '0 1px 4px rgba(11,28,44,0.07)', borderLeft: '3px solid #16a34a' }}>
            <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 3px' }}>Total Jahresprämie</p>
            <p style={{ color: NAVY, fontSize: 18, fontWeight: 700, margin: 0 }}>CHF {totalYearly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

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
            const yearly = yearlyPremium(c)
            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 6px rgba(11,28,44,0.07)', borderLeft: `4px solid ${statusColor}` }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h3 style={{ color: NAVY, fontWeight: 700, fontSize: 16, margin: 0 }}>{c.insurer || c.provider || '–'}</h3>
                      <span style={{ background: `${statusColor}18`, color: statusColor, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
                        {statusLabel}
                      </span>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
                      {c.insurance_type}{c.product ? ` · ${c.product}` : ''}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {c.premium_monthly != null && (
                      <p style={{ color: NAVY, fontWeight: 700, fontSize: 18, margin: 0 }}>
                        CHF {c.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                        <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>/Mt.</span>
                      </p>
                    )}
                    {yearly > 0 && (
                      <p style={{ color: '#6b7280', fontSize: 12, margin: '2px 0 0' }}>
                        CHF {yearly.toLocaleString('de-CH', { minimumFractionDigits: 2 })} / Jahr
                      </p>
                    )}
                  </div>
                </div>

                {/* Details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
                  <Field label="Policen-Nr." value={c.policy_number} />
                  <Field label="Vertragsbeginn" value={c.start_date ? format(new Date(c.start_date), 'dd.MM.yyyy') : null} />
                  <Field label="Vertragsende" value={c.end_date ? format(new Date(c.end_date), 'dd.MM.yyyy') : null} />
                  <Field label="Kündigungsfrist" value={c.cancellation_deadline ? format(new Date(c.cancellation_deadline), 'dd.MM.yyyy') : null} />
                  {c.sparte_data?.franchise && <Field label="Franchise" value={`CHF ${c.sparte_data.franchise}`} />}
                  {c.sparte_data?.model && <Field label="Modell" value={c.sparte_data.model} />}
                  {c.notes && <div style={{ gridColumn: '1/-1' }}><Field label="Notizen" value={c.notes} /></div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}