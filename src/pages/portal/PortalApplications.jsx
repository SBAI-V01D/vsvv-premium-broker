import React from 'react'
import { ClipboardList, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { usePortalData } from '@/hooks/usePortalData'

const NAVY = '#0B1C2C'
const ACCENT = '#4F7CFF'

const STATUS_COLORS = {
  angenommen: '#16a34a', policiert: '#16a34a', approved: '#16a34a',
  eingereicht: '#2563eb', submitted: '#2563eb',
  in_bearbeitung: '#7c3aed', under_review: '#d97706',
  draft: '#6b7280', rejected: '#dc2626', abgelehnt: '#dc2626',
}
const STATUS_LABELS = {
  angenommen: 'Angenommen', policiert: 'Policiert', approved: 'Genehmigt',
  eingereicht: 'Eingereicht', submitted: 'Eingereicht',
  in_bearbeitung: 'In Bearbeitung', under_review: 'In Prüfung',
  draft: 'Entwurf', rejected: 'Abgelehnt', abgelehnt: 'Abgelehnt',
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

export default function PortalApplications() {
  const { applications, isLoading, error } = usePortalData()

  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>Laden…</div>
  }

  if (error) return (
    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <AlertCircle size={16} color="#dc2626" />
      <p style={{ color: '#991b1b', fontSize: 13, margin: 0 }}>Fehler beim Laden: {error.message}</p>
    </div>
  )

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: NAVY, fontSize: 24, fontWeight: 700, margin: 0 }}>Meine Anträge</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>{applications.length} Antrag{applications.length !== 1 ? 'träge' : ''} gefunden</p>
      </div>

      {applications.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 1px 6px rgba(11,28,44,0.07)' }}>
          <ClipboardList size={36} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p style={{ color: '#9ca3af', margin: 0 }}>Keine Anträge vorhanden</p>
          <p style={{ color: '#c4c9d1', fontSize: 12, marginTop: 6 }}>Ihr Broker hat noch keine Anträge für Sie erfasst.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {applications.map(app => {
            const statusKey = app.custom_status || app.status
            const statusColor = STATUS_COLORS[statusKey] || '#6b7280'
            const statusLabel = STATUS_LABELS[statusKey] || statusKey
            const premiumMonthly = app.estimated_premium_monthly
            const premiumYearly = app.estimated_premium_yearly || (premiumMonthly ? Math.round(premiumMonthly * 12) : null)

            return (
              <div key={app.id} style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 6px rgba(11,28,44,0.07)', borderLeft: `4px solid ${statusColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h3 style={{ color: NAVY, fontWeight: 700, fontSize: 16, margin: 0 }}>{app.insurer || '–'}</h3>
                      <span style={{ background: `${statusColor}18`, color: statusColor, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
                        {statusLabel}
                      </span>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
                      {app.sparte || app.insurance_type}{app.product ? ` · ${app.product}` : ''}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {premiumMonthly && (
                      <p style={{ color: NAVY, fontWeight: 700, fontSize: 16, margin: 0 }}>
                        CHF {premiumMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                        <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>/Mt.</span>
                      </p>
                    )}
                    {premiumYearly && (
                      <p style={{ color: '#6b7280', fontSize: 12, margin: '2px 0 0' }}>
                        CHF {premiumYearly.toLocaleString('de-CH', { minimumFractionDigits: 0 })} / Jahr (gesch.)
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
                  <Field label="Startdatum" value={app.contract_start_date ? format(new Date(app.contract_start_date), 'dd.MM.yyyy') : null} />
                  <Field label="Gewünschter Start" value={app.requested_start_date ? format(new Date(app.requested_start_date), 'dd.MM.yyyy') : null} />
                  <Field label="Policen-Nr." value={app.policy_number} />
                  {app.sparte_data?.franchise && <Field label="Franchise" value={`CHF ${app.sparte_data.franchise}`} />}
                  {app.sparte_data?.model && <Field label="Modell" value={app.sparte_data.model} />}
                  {app.notes && <div style={{ gridColumn: '1/-1' }}><Field label="Notizen" value={app.notes} /></div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}