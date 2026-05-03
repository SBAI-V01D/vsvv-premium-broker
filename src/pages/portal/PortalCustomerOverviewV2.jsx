import React, { useState } from 'react'
import { usePortalData } from '@/hooks/usePortalData'
import { usePortalCustomer } from '@/hooks/usePortalCustomer'

export default function PortalCustomerOverviewV2() {
  const { customer } = usePortalCustomer()
  const { contracts = [], documents = [] } = usePortalData()
  const [showUpload, setShowUpload] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('portal_customer_id')
    localStorage.removeItem('portal_email')
    window.location.href = '/portal/setup'
  }

  const activeContracts = contracts.filter(c => c.status === 'active').length
  const totalPremiumMonthly = contracts.reduce((sum, c) => sum + (c.premium_monthly || 0), 0)
  const totalPremiumYearly = contracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0)

  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    return new Date(dateStr).toLocaleDateString('de-CH')
  }

  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh' }}>
      {/* TEST ÜBERSCHRIFT */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 40px', background: '#fff3cd', borderBottom: '1px solid #ffeaa7' }}>
        <h2 style={{ margin: 0, color: '#856404', fontSize: 14, fontWeight: 700 }}>TEST VSVV – ÄNDERUNG AKTIV</h2>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 40px' }}>
        {/* BEGRÜSSUNG */}
        <section>
          <h1 style={{ fontSize: 36, fontWeight: 700, margin: '0 0 16px', lineHeight: 1.2, color: '#0f172a' }}>
            Willkommen bei VSVV
          </h1>
          <p style={{ fontSize: 16, color: '#4b5563', margin: '0 0 8px', lineHeight: 1.6 }}>
            Ihrem unabhängigen Partner für strukturierte und transparente Versicherungslösungen.
          </p>
          <p style={{ fontSize: 16, color: '#6b7280', margin: '0 0 32px', lineHeight: 1.6 }}>
            Behalten Sie jederzeit den Überblick über Ihre Versicherungen und Dokumente.
          </p>
          <a href="https://wa.me/41787170007" target="_blank" rel="noopener noreferrer">
            <button style={{
              background: '#25D366',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(37, 211, 102, 0.2)',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.3)' }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 2px 8px rgba(37, 211, 102, 0.2)' }}
            >
              💬 Beratung per WhatsApp
            </button>
          </a>
        </section>

        {/* KUNDENDATEN */}
        {customer && (
          <section style={{ marginBottom: 80, paddingBottom: 60, borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40 }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 8px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</p>
                  <p style={{ fontSize: 16, fontWeight: 500, margin: 0, color: '#1a1a1a' }}>{customer.first_name} {customer.last_name}</p>
                </div>
                {customer.street && (
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 8px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Adresse</p>
                    <p style={{ fontSize: 16, fontWeight: 500, margin: 0, color: '#1a1a1a' }}>
                      {customer.street}, {customer.zip_code} {customer.city}
                    </p>
                  </div>
                )}
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 8px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>E-Mail</p>
                  <p style={{ fontSize: 16, fontWeight: 500, margin: 0, color: '#1a1a1a' }}>{customer.email}</p>
                </div>
                {customer.phone && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 8px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Telefon</p>
                    <p style={{ fontSize: 16, fontWeight: 500, margin: 0, color: '#1a1a1a' }}>{customer.phone}</p>
                  </div>
                )}
              </div>
              <button style={{
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: '#1f2937',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.background = '#e5e7eb' }}
              onMouseLeave={e => { e.target.style.background = '#f3f4f6' }}
              >
                ✎ Daten bearbeiten
              </button>
            </div>
          </section>
        )}

        {/* VERSICHERUNGSÜBERSICHT */}
        <section style={{ marginBottom: 80, paddingBottom: 60, borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 40px', color: '#0f172a' }}>Ihre Versicherungsübersicht</h2>
          
          <div style={{ background: '#0f172a', color: '#fff', borderRadius: 8, padding: 40 }}>
            <div style={{ marginBottom: 48 }}>
              <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>Monatsprämie</p>
              <p style={{ fontSize: 42, fontWeight: 800, margin: 0, lineHeight: 1 }}>
                CHF {totalPremiumMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div style={{ marginBottom: 48 }}>
              <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>Jahresprämie</p>
              <p style={{ fontSize: 42, fontWeight: 800, margin: 0, lineHeight: 1 }}>
                CHF {totalPremiumYearly.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div>
              <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>Aktive Verträge</p>
              <p style={{ fontSize: 42, fontWeight: 800, margin: 0, lineHeight: 1 }}>
                {activeContracts}
              </p>
            </div>
          </div>
        </section>

        {/* VERTRÄGE */}
        <section style={{ marginBottom: 80, paddingBottom: 60, borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 32px', color: '#0f172a' }}>Ihre Verträge</h2>
          
          {contracts.length === 0 ? (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 40, textAlign: 'center', color: '#6b7280' }}>
              Keine Verträge vorhanden
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Versicherung</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Anbieter</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</th>
                      <th style={{ padding: '16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Monatsprämie</th>
                      <th style={{ padding: '16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Jahresprämie</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((contract, idx) => (
                      <tr key={contract.id} style={{ borderBottom: idx < contracts.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <td style={{ padding: '16px', fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{contract.insurance_type || '–'}</td>
                        <td style={{ padding: '16px', fontSize: 14, color: '#4b5563' }}>{contract.insurer || '–'}</td>
                        <td style={{ padding: '16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            background: contract.status === 'active' ? '#dcfce7' : '#f3f4f6',
                            color: contract.status === 'active' ? '#166534' : '#6b7280',
                          }}>
                            {contract.status === 'active' ? 'Aktiv' : contract.status === 'cancelled' ? 'Gekündigt' : contract.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>
                          CHF {(contract.premium_monthly || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                          CHF {(contract.premium_yearly || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '16px', fontSize: 13, color: '#6b7280' }}>
                          {contract.start_date ? formatDate(contract.start_date) : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* DOKUMENTE */}
        <section style={{ marginBottom: 80 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 32px', color: '#0f172a' }}>Ihre Dokumente</h2>
          
          {documents.length === 0 ? (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 40, textAlign: 'center', color: '#6b7280' }}>
              Keine Dokumente vorhanden
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {documents.map((doc, idx) => (
                  <div key={doc.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 0',
                    borderBottom: idx < documents.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px', color: '#1a1a1a' }}>{doc.name}</p>
                      <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{formatDate(doc.created_date)}</p>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <button style={{
                        background: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#1f2937',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.target.style.background = '#e5e7eb' }}
                      onMouseLeave={e => { e.target.style.background = '#f3f4f6' }}
                      >
                        📥 Herunterladen
                      </button>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* FOOTER */}
      <footer style={{ padding: '40px', textAlign: 'center', fontSize: 12, color: '#9ca3af', borderTop: '1px solid #e5e7eb', marginTop: 80 }}>
        © 2025 VSVV – Ihre Versicherungsplattform
      </footer>

      {/* FLOATING WHATSAPP BUTTON */}
      <a
        href="https://wa.me/41787170007"
        target="_blank"
        rel="noopener noreferrer"
        title="Beratung per WhatsApp"
        style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          zIndex: 100,
          width: 56,
          height: 56,
          background: '#25D366',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontSize: 24,
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(37, 211, 102, 0.4)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.3)' }}
      >
        💬
      </a>
    </div>
  )
}