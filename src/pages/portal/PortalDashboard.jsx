import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { usePortalData } from '@/hooks/usePortalData'
import { usePortalCustomer } from '@/hooks/usePortalCustomer'

const LOGO_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/0cde67ef2_LogoVSVV2.png'

export default function PortalDashboard() {
  const { customer } = usePortalCustomer()
  const { contracts = [], documents = [] } = usePortalData()
  const [showUpload, setShowUpload] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [customerError, setCustomerError] = useState('')
  const [customerSuccess, setCustomerSuccess] = useState(false)
  const [editForm, setEditForm] = useState({
    first_name: customer?.first_name || '',
    last_name: customer?.last_name || '',
    street: customer?.street || '',
    zip_code: customer?.zip_code || '',
    city: customer?.city || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    mobile: customer?.mobile || '',
  })

  const handleLogout = () => {
    localStorage.removeItem('portal_customer_id')
    localStorage.removeItem('portal_email')
    window.location.href = '/portal/setup'
  }

  const startEditCustomer = () => {
    setEditForm({
      first_name: customer?.first_name || '',
      last_name: customer?.last_name || '',
      street: customer?.street || '',
      zip_code: customer?.zip_code || '',
      city: customer?.city || '',
      email: customer?.email || '',
      phone: customer?.phone || '',
      mobile: customer?.mobile || '',
    })
    setEditingCustomer(true)
    setCustomerError('')
    setCustomerSuccess(false)
  }

  const saveCustomerData = async () => {
    setSavingCustomer(true)
    setCustomerError('')
    try {
      await base44.functions.invoke('updatePortalCustomer', {
        customer_id: localStorage.getItem('portal_customer_id'),
        data: {
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          street: editForm.street,
          zip_code: editForm.zip_code,
          city: editForm.city,
          phone: editForm.phone,
          mobile: editForm.mobile,
        },
      })
      setCustomerSuccess(true)
      setEditingCustomer(false)
      // Reload page to reflect changes
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setCustomerError('Fehler beim Speichern: ' + err.message)
    }
    setSavingCustomer(false)
  }

  const activeContracts = contracts.filter(c => c.status === 'active').length
  const totalPremiumMonthly = contracts.reduce((sum, c) => sum + (c.premium_monthly || 0), 0)
  const totalPremiumYearly = contracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0)

  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    return new Date(dateStr).toLocaleDateString('de-CH')
  }

  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif', color: '#1a1a1a' }}>
      
      {/* HEADER */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 0', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src={LOGO_URL} alt="VSVV" style={{ height: 40 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {customer && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{customer.first_name} {customer.last_name}</p>
                <p style={{ fontSize: 11, margin: '3px 0 0', color: '#6b7280' }}>{customer.email}</p>
              </div>
            )}
            <button 
              onClick={handleLogout}
              style={{
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '8px 14px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.background = '#e5e7eb' }}
              onMouseLeave={e => { e.target.style.background = '#f3f4f6' }}
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* TEST HEADER */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 40px', background: '#fff3cd', borderBottom: '1px solid #ffeaa7' }}>
        <h2 style={{ margin: 0, color: '#856404', fontSize: 14, fontWeight: 700 }}>TEST VSVV SICHTBAR</h2>
      </div>

      {/* MAIN CONTENT */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 40px' }}>
        
        {/* 1. BEGRÜSSUNG */}
        <section style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 10px', lineHeight: 1.2, color: '#0f172a' }}>
            Willkommen bei VSVV
          </h1>
          <p style={{ fontSize: 14, color: '#4b5563', margin: '0 0 18px', lineHeight: 1.5, maxWidth: 700 }}>
            Ihrem Partner für transparente und strukturierte Versicherungslösungen. Behalten Sie jederzeit den Überblick über Ihre Versicherungen.
          </p>
          <a href="https://wa.me/41787170007" target="_blank" rel="noopener noreferrer">
            <button style={{
              background: '#25D366',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '14px 32px',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 700,
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-3px)'; e.target.style.boxShadow = '0 6px 16px rgba(37, 211, 102, 0.35)' }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.25)' }}
            >
              💬 Beratung per WhatsApp
            </button>
          </a>
        </section>

        {/* 2. KUNDENDATEN */}
        {customer && (
          <section style={{ marginBottom: 80, paddingBottom: 60, borderBottom: '1px solid #e5e7eb' }}>
            {!editingCustomer ? (
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
                <button 
                  onClick={startEditCustomer}
                  style={{
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
            ) : (
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: '#0f172a' }}>Daten bearbeiten</h3>
                {customerSuccess && (
                  <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#166534', fontWeight: 500 }}>
                    ✓ Daten erfolgreich gespeichert
                  </div>
                )}
                {customerError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
                    {customerError}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Vorname</label>
                    <input
                      type="text"
                      value={editForm.first_name}
                      onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nachname</label>
                    <input
                      type="text"
                      value={editForm.last_name}
                      onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Strasse</label>
                    <input
                      type="text"
                      value={editForm.street}
                      onChange={e => setEditForm(f => ({ ...f, street: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>PLZ</label>
                      <input
                        type="text"
                        value={editForm.zip_code}
                        onChange={e => setEditForm(f => ({ ...f, zip_code: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ort</label>
                      <input
                        type="text"
                        value={editForm.city}
                        onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>E-Mail</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Telefon</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mobilnummer</label>
                    <input
                      type="tel"
                      value={editForm.mobile}
                      onChange={e => setEditForm(f => ({ ...f, mobile: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={saveCustomerData}
                    disabled={savingCustomer}
                    style={{
                      background: '#0f172a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '12px 24px',
                      cursor: savingCustomer ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      opacity: savingCustomer ? 0.6 : 1,
                    }}
                  >
                    {savingCustomer ? 'Speichert...' : '✓ Speichern'}
                  </button>
                  <button
                    onClick={() => setEditingCustomer(false)}
                    disabled={savingCustomer}
                    style={{
                      background: '#f3f4f6',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: '12px 24px',
                      cursor: savingCustomer ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#6b7280',
                      opacity: savingCustomer ? 0.6 : 1,
                    }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 3. VERSICHERUNGSÜBERSICHT */}
        <section style={{ marginBottom: 70, paddingBottom: 40, borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 28px', color: '#0f172a' }}>Ihre Versicherungsübersicht</h2>
          
          <div style={{ background: '#0f172a', color: '#fff', borderRadius: 10, padding: 32 }}>
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 10, fontWeight: 700, margin: '0 0 10px', color: '#a1aab8', textTransform: 'uppercase', letterSpacing: 0.8 }}>Monatsprämie</p>
              <p style={{ fontSize: 42, fontWeight: 800, margin: 0, lineHeight: 1 }}>
                CHF {totalPremiumMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 10, fontWeight: 700, margin: '0 0 10px', color: '#a1aab8', textTransform: 'uppercase', letterSpacing: 0.8 }}>Jahresprämie</p>
              <p style={{ fontSize: 42, fontWeight: 800, margin: 0, lineHeight: 1 }}>
                CHF {totalPremiumYearly.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div>
              <p style={{ fontSize: 10, fontWeight: 700, margin: '0 0 10px', color: '#a1aab8', textTransform: 'uppercase', letterSpacing: 0.8 }}>Aktive Verträge</p>
              <p style={{ fontSize: 42, fontWeight: 800, margin: 0, lineHeight: 1 }}>
                {activeContracts}
              </p>
            </div>
          </div>
        </section>

        {/* 4. VERTRÄGE */}
        <section style={{ marginBottom: 70, paddingBottom: 40, borderBottom: '1px solid #e5e7eb' }}>
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
                      <th style={{ padding: '18px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Versicherung</th>
                      <th style={{ padding: '18px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Anbieter</th>
                      <th style={{ padding: '18px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</th>
                      <th style={{ padding: '18px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Monatsprämie</th>
                      <th style={{ padding: '18px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Jahresprämie</th>
                      <th style={{ padding: '18px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((contract, idx) => (
                      <tr key={contract.id} style={{ borderBottom: idx < contracts.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{contract.insurance_type || '–'}</td>
                        <td style={{ padding: '14px 20px', fontSize: 13, color: '#4b5563' }}>{contract.insurer || '–'}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: contract.status === 'active' ? '#dcfce7' : '#f3f4f6',
                            color: contract.status === 'active' ? '#166534' : '#6b7280',
                          }}>
                            {contract.status === 'active' ? 'Aktiv' : contract.status === 'cancelled' ? 'Gekündigt' : contract.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>
                          CHF {(contract.premium_monthly || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                          CHF {(contract.premium_yearly || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 12, color: '#6b7280' }}>
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

        {/* 5. DOKUMENTE */}
        <section style={{ marginBottom: 60 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 24px', color: '#0f172a' }}>Ihre Dokumente</h2>
          
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
      </main>

      {/* FOOTER */}
      <footer style={{ padding: '32px', textAlign: 'center', fontSize: 11, color: '#9ca3af', borderTop: '1px solid #e5e7eb', marginTop: 60 }}>
        © 2025 VSVV – Ihre Versicherungsplattform
      </footer>

      {/* FLOATING WHATSAPP BUTTON */}
      <a
        href="https://wa.me/41787170007"
        target="_blank"
        rel="noopener noreferrer"
        title="Schnelle Beratung via WhatsApp"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 100,
          width: 44,
          height: 44,
          background: '#25D366',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(37, 211, 102, 0.18)',
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontSize: 20,
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(37, 211, 102, 0.25)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 211, 102, 0.18)' }}
      >
        💬
      </a>
    </div>
  )
}