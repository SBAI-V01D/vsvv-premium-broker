import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { FileText, FolderOpen, TrendingUp, Mail, Phone, MapPin, Calendar, ChevronRight, AlertCircle } from 'lucide-react'
import { usePortalCustomer, fetchPortalContracts, yearlyPremium } from '@/hooks/usePortalCustomer'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Link } from 'react-router-dom'

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

function KpiCard({ to, icon: Icon, label, value, accent }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div
        style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 6px rgba(11,28,44,0.07)', borderLeft: `4px solid ${accent}`, display: 'flex', alignItems: 'center', gap: 16, transition: 'box-shadow 0.15s', cursor: 'pointer' }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(11,28,44,0.12)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 6px rgba(11,28,44,0.07)' }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 10, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={20} color={accent} />
        </div>
        <div>
          <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{label}</p>
          <p style={{ color: NAVY, fontSize: 26, fontWeight: 700, margin: '3px 0 0', lineHeight: 1 }}>{value}</p>
        </div>
      </div>
    </Link>
  )
}

export default function PortalDashboard() {
  const { customer, customerId, isLoading } = usePortalCustomer()

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['portal-contracts', customerId],
    queryFn: () => fetchPortalContracts(customerId),
    enabled: !!customerId,
    staleTime: 30_000,
  })

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['portal-documents', customerId],
    queryFn: () => base44.entities.Document.filter({ customer_id: customerId })
      .then(docs => docs.filter(d => d.visible_in_portal !== false)),
    enabled: !!customerId,
    staleTime: 30_000,
  })

  const loading = isLoading || loadingContracts || loadingDocs

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>
      Daten werden geladen…
    </div>
  )
  if (!customer) return null

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Guten Morgen'
    if (h < 18) return 'Guten Tag'
    return 'Guten Abend'
  }

  const activeContracts = contracts.filter(c => ['active', 'aktiv'].includes(c.status))
  const totalMonthly = contracts.reduce((s, c) => s + (c.premium_monthly || 0), 0)
  const totalYearly = contracts.reduce((s, c) => s + yearlyPremium(c), 0)

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: NAVY, fontSize: 26, fontWeight: 700, margin: 0 }}>
          {greeting()}, {customer.first_name} 👋
        </h1>
        <p style={{ color: '#6b7280', marginTop: 4, fontSize: 14 }}>
          Heute ist der {format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })}
        </p>
      </div>

      {/* Debug: show if no data loaded */}
      {contracts.length === 0 && documents.length === 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <AlertCircle size={16} color="#d97706" />
          <p style={{ color: '#92400e', fontSize: 13, margin: 0 }}>
            Keine CRM-Daten geladen. Kunden-ID: <strong>{customerId}</strong> — Bitte prüfen Sie die Datenzuordnung im CRM.
          </p>
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <KpiCard to="/portal/vertraege" icon={FileText} label="Verträge" value={contracts.length} accent={ACCENT} />
        <KpiCard to="/portal/vertraege" icon={TrendingUp} label="Monatsprämie total" value={totalMonthly > 0 ? `CHF ${totalMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}` : '–'} accent="#16a34a" />
        <KpiCard to="/portal/dokumente" icon={FolderOpen} label="Dokumente" value={documents.length} accent="#d97706" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="dashboard-grid">

        {/* Recent Contracts */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 22, boxShadow: '0 1px 6px rgba(11,28,44,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ color: NAVY, fontSize: 15, fontWeight: 700, margin: 0 }}>Meine Verträge</h2>
            <Link to="/portal/vertraege" style={{ color: ACCENT, fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
              Alle <ChevronRight size={14} />
            </Link>
          </div>
          {contracts.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Keine Verträge vorhanden</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contracts.slice(0, 5).map(c => {
                const statusColor = STATUS_COLORS[c.status] || '#6b7280'
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
                    <div>
                      <p style={{ color: NAVY, fontWeight: 600, fontSize: 13, margin: 0 }}>{c.insurer || c.provider || '–'}</p>
                      <p style={{ color: '#6b7280', fontSize: 12, margin: '2px 0 0' }}>
                        {c.insurance_type}{c.product ? ` · ${c.product}` : ''}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                      {c.premium_monthly != null && (
                        <p style={{ color: NAVY, fontWeight: 600, fontSize: 13, margin: 0 }}>
                          CHF {c.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}/Mt.
                        </p>
                      )}
                      <span style={{ background: `${statusColor}18`, color: statusColor, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, marginTop: 2, display: 'inline-block' }}>
                        {c.custom_status || STATUS_LABELS[c.status] || c.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Contact + Yearly */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 22, boxShadow: '0 1px 6px rgba(11,28,44,0.07)' }}>
          <h2 style={{ color: NAVY, fontSize: 15, fontWeight: 700, margin: '0 0 16px' }}>Meine Kontaktdaten</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[
              { icon: Mail, value: customer.email },
              { icon: Phone, value: customer.phone || customer.mobile },
              { icon: MapPin, value: customer.street ? `${customer.street}, ${customer.zip_code} ${customer.city}` : null },
              { icon: Calendar, value: customer.birthdate ? new Date(customer.birthdate).toLocaleDateString('de-CH') : null },
            ].filter(i => i.value).map(({ icon: Icon, value }, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: `${ACCENT}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={13} color={ACCENT} />
                </div>
                <span style={{ color: '#374151', fontSize: 13 }}>{value}</span>
              </div>
            ))}
          </div>

          {totalYearly > 0 && (
            <div style={{ marginTop: 18, padding: '14px 16px', background: `${ACCENT}0d`, borderRadius: 10, border: `1px solid ${ACCENT}22` }}>
              <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Gesamte Jahresprämie</p>
              <p style={{ color: NAVY, fontSize: 20, fontWeight: 700, margin: 0 }}>
                CHF {totalYearly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
              </p>
              <p style={{ color: '#9ca3af', fontSize: 11, margin: '2px 0 0' }}>basierend auf {contracts.length} Vertrag{contracts.length !== 1 ? 'en' : ''}</p>
            </div>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 768px) { .dashboard-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}