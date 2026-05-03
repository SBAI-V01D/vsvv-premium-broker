import React from 'react'
import { usePortalData } from '@/hooks/usePortalData'
import { usePortalCustomer } from '@/hooks/usePortalCustomer'
import { useNavigate } from 'react-router-dom'

const LOGO_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/0cde67ef2_LogoVSVV2.png'

export default function PortalCustomerDashboard() {
  const navigate = useNavigate()
  const { customer } = usePortalCustomer()
  const { contracts = [], documents = [] } = usePortalData()

  const handleLogout = () => {
    localStorage.removeItem('portal_customer_id')
    localStorage.removeItem('portal_email')
    window.location.href = '/portal/setup'
  }

  const activeContracts = contracts.filter(c => c.status === 'active').length
  const totalPremium = contracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'Inter, sans-serif' }}>
      
      {/* HEADER */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '16px 0', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src={LOGO_URL} alt="VSVV" style={{ height: 40 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {customer && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{customer.first_name} {customer.last_name}</p>
                <p style={{ fontSize: 11, margin: '2px 0 0', color: '#666' }}>{customer.email}</p>
              </div>
            )}
            <button onClick={handleLogout} style={{ background: '#f0f0f0', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px' }}>
        
        {/* 1. BEGRÜSSUNG + CTA */}
        <section style={{ marginBottom: 80 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}>
            Willkommen bei VSVV
          </h1>
          <p style={{ fontSize: 15, color: '#666', margin: '0 0 24px', lineHeight: 1.6, maxWidth: 700 }}>
            Ihrem unabhängigen Partner für strukturierte und transparente Versicherungslösungen.
          </p>
          <button style={{ background: '#0066cc', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            💬 Beratung per WhatsApp
          </button>
        </section>

        {/* 2. KUNDENDATEN */}
        {customer && (
          <section style={{ marginBottom: 80, paddingBottom: 40, borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40 }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ color: '#999', fontSize: 11, fontWeight: 600, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</p>
                  <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{customer.first_name} {customer.last_name}</p>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ color: '#999', fontSize: 11, fontWeight: 600, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>E-Mail</p>
                  <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{customer.email}</p>
                </div>
                {customer.street && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ color: '#999', fontSize: 11, fontWeight: 600, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Adresse</p>
                    <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{customer.street}, {customer.zip_code} {customer.city}</p>
                  </div>
                )}
                {customer.phone && (
                  <div>
                    <p style={{ color: '#999', fontSize: 11, fontWeight: 600, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Telefon</p>
                    <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{customer.phone}</p>
                  </div>
                )}
              </div>
              <button style={{ background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 6, padding: '10px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                ✎ Daten bearbeiten
              </button>
            </div>
          </section>
        )}

        {/* 3. ÜBERSICHT (KENNZAHLEN) */}
        <section style={{ marginBottom: 80, paddingBottom: 40, borderBottom: '1px solid #e0e0e0' }}>
          <h2 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 32px', lineHeight: 1.2 }}>Ihre Versicherungsübersicht</h2>
          
          <div>
            <div style={{ marginBottom: 32 }}>
              <p style={{ color: '#999', fontSize: 11, fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Monatsprämie</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>CHF {(totalPremium / 12).toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </div>

            <div style={{ marginBottom: 32 }}>
              <p style={{ color: '#999', fontSize: 11, fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Jahresprämie</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>CHF {totalPremium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}</p>
            </div>

            <div>
              <p style={{ color: '#999', fontSize: 11, fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Aktive Verträge</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{activeContracts}</p>
            </div>
          </div>
        </section>

        {/* 4. VERTRÄGE */}
        <section style={{ marginBottom: 80, paddingBottom: 40, borderBottom: '1px solid #e0e0e0' }}>
          <h2 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 32px', lineHeight: 1.2 }}>Ihre Verträge</h2>
          
          {contracts.length === 0 ? (
            <p style={{ color: '#999', fontSize: 14 }}>Keine Verträge vorhanden</p>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e0e0e0', background: '#fafafa' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Versicherung</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Anbieter</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Jahresprämie</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((contract, idx) => (
                    <tr key={contract.id} style={{ borderBottom: idx < contracts.length - 1 ? '1px solid #e0e0e0' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontSize: 14 }}>{contract.insurance_type}</td>
                      <td style={{ padding: '12px 16px', fontSize: 14 }}>{contract.insurer}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12 }}>
                        <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 4, background: contract.status === 'active' ? '#e8f5e9' : '#f5f5f5', color: contract.status === 'active' ? '#2e7d32' : '#666' }}>
                          {contract.status === 'active' ? 'Aktiv' : contract.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, textAlign: 'right', fontWeight: 600 }}>CHF {(contract.premium_yearly || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 5. DOKUMENTE */}
        <section>
          <h2 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 32px', lineHeight: 1.2 }}>Ihre Dokumente</h2>
          
          {documents.length === 0 ? (
            <p style={{ color: '#999', fontSize: 14 }}>Keine Dokumente vorhanden</p>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {documents.slice(0, 5).map(doc => (
                  <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{doc.name}</p>
                      <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>{doc.created_date ? new Date(doc.created_date).toLocaleDateString('de-CH') : '–'}</p>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <button style={{ background: '#f0f0f0', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        📥 Herunterladen
                      </button>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

      </main>

      {/* FOOTER */}
      <footer style={{ padding: '32px 40px', textAlign: 'center', fontSize: 11, color: '#999', borderTop: '1px solid #e0e0e0', marginTop: 80 }}>
        © 2025 VSVV – Ihre Versicherungsplattform
      </footer>

      {/* FLOATING WHATSAPP BUTTON */}
      <a href="https://wa.me/41787170007" target="_blank" rel="noopener noreferrer" title="Beratung per WhatsApp" style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 100,
        width: 52,
        height: 52,
        background: '#25D366',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)' }}
      >
        <span style={{ fontSize: 24 }}>💬</span>
      </a>
    </div>
  )
}