import React, { useState, useEffect } from 'react'
import { base44 } from '@/api/base44Client'
import { usePortalData } from '@/hooks/usePortalData'
import { usePortalCustomer } from '@/hooks/usePortalCustomer'

const LOGO_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/10f5c3d63_VSVV.png'

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
    canton: customer?.canton || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    mobile: customer?.mobile || '',
    birthdate: customer?.birthdate || '',
    profession: customer?.profession || '',
    nationality: customer?.nationality || '',
    civil_status: customer?.civil_status || '',
    ahv_number: customer?.ahv_number || '',
  })

  useEffect(() => {
    if (customer && !editingCustomer) {
      setEditForm({
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        street: customer.street || '',
        zip_code: customer.zip_code || '',
        city: customer.city || '',
        canton: customer.canton || '',
        email: customer.email || '',
        phone: customer.phone || '',
        mobile: customer.mobile || '',
        birthdate: customer.birthdate || '',
        profession: customer.profession || '',
        nationality: customer.nationality || '',
        civil_status: customer.civil_status || '',
        ahv_number: customer.ahv_number || '',
      })
    }
  }, [customer, editingCustomer])

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
          canton: editForm.canton,
          email: editForm.email,
          phone: editForm.phone,
          mobile: editForm.mobile,
          birthdate: editForm.birthdate,
          profession: editForm.profession,
          nationality: editForm.nationality,
          civil_status: editForm.civil_status,
          ahv_number: editForm.ahv_number,
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
    <div style={{ background: '#F5F7FA', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif', color: '#1a1a1a' }}>
      
      {/* HEADER */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 0', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src={LOGO_URL} alt="VSVV" style={{ height: 60 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {customer && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{customer.first_name} {customer.last_name}</p>
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



      {/* MAIN CONTENT */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 40px' }}>
        
        {/* 1. BEGRÜSSUNG */}
        <section style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px', lineHeight: 1.2, color: '#0f172a' }}>
              Willkommen bei VSVV
            </h1>
            <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.4 }}>
              Ihre Versicherungen im Überblick.
            </p>
          </div>
          <a href="https://wa.me/41787170007" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, background: '#e0f2f1', border: '1px solid #b2dfdb', borderRadius: 8, padding: '10px 14px', color: '#00796b', cursor: 'pointer', transition: 'all 0.2s', fontSize: 13, fontWeight: 500 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#b2dfdb'; e.currentTarget.style.borderColor = '#80cbc4' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#e0f2f1'; e.currentTarget.style.borderColor = '#b2dfdb' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378c-3.55 2.357-5.748 6.08-5.748 9.89 0 3.393 1.39 6.662 3.905 9.176 2.515 2.513 5.786 3.9 9.177 3.9h.008c3.39 0 6.662-1.39 9.176-3.905 2.514-2.515 3.902-5.786 3.902-9.177 0-3.39-1.388-6.662-3.905-9.176C20.66 2.39 17.39 1 14 1h-.004c-3.39 0-6.662 1.39-9.176 3.905"/></svg>
            Fragen zu Ihrem Versicherungsschutz?
          </a>
        </section>

        {/* 2. KUNDENDATEN */}
        {customer && (
          <section style={{ marginBottom: 48, paddingBottom: 36, borderBottom: '1px solid #e5e7eb' }}>
            {!editingCustomer ? (
              <>
                <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start', background: '#0B1C2C', padding: 32, borderRadius: 10, marginBottom: 24 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 6px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</p>
                      <p style={{ fontSize: 15, fontWeight: 500, margin: 0, color: '#fff' }}>{customer.first_name} {customer.last_name}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 6px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }}>E-Mail</p>
                      <p style={{ fontSize: 15, fontWeight: 500, margin: 0, color: '#fff' }}>{customer.email}</p>
                    </div>
                    {customer.street && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 6px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Adresse</p>
                        <p style={{ fontSize: 15, fontWeight: 500, margin: 0, color: '#fff' }}>
                          {customer.street}, {customer.zip_code} {customer.city}
                        </p>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
                    {customer.phone && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 6px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Telefon</p>
                        <p style={{ fontSize: 15, fontWeight: 500, margin: 0, color: '#fff' }}>{customer.phone}</p>
                      </div>
                    )}
                    {customer.mobile && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 6px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Mobilnummer</p>
                        <p style={{ fontSize: 15, fontWeight: 500, margin: 0, color: '#fff' }}>{customer.mobile}</p>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={startEditCustomer}
                    style={{
                      background: '#4F7CFF',
                      border: 'none',
                      borderRadius: 6,
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s',
                      alignSelf: 'flex-start',
                      marginTop: 0,
                    }}
                    onMouseEnter={e => { e.target.style.background = '#3d63e6' }}
                    onMouseLeave={e => { e.target.style.background = '#4F7CFF' }}
                  >
                    ✎ Bearbeiten
                  </button>
                </div>
              </>
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
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kanton</label>
                    <input
                      type="text"
                      value={editForm.canton}
                      onChange={e => setEditForm(f => ({ ...f, canton: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Geburtsdatum</label>
                    <input
                      type="date"
                      value={editForm.birthdate}
                      onChange={e => setEditForm(f => ({ ...f, birthdate: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Beruf</label>
                    <input
                      type="text"
                      value={editForm.profession}
                      onChange={e => setEditForm(f => ({ ...f, profession: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nationalität</label>
                    <input
                      type="text"
                      value={editForm.nationality}
                      onChange={e => setEditForm(f => ({ ...f, nationality: e.target.value }))}
                      placeholder="z.B. CH, DE, FR"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Zivilstand</label>
                    <select
                      value={editForm.civil_status}
                      onChange={e => setEditForm(f => ({ ...f, civil_status: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                    >
                      <option value="">–</option>
                      <option value="single">Ledig</option>
                      <option value="married">Verheiratet</option>
                      <option value="divorced">Geschieden</option>
                      <option value="widowed">Verwitwet</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>AHV-Nummer</label>
                    <input
                      type="text"
                      value={editForm.ahv_number}
                      onChange={e => setEditForm(f => ({ ...f, ahv_number: e.target.value }))}
                      placeholder="756.1234.5678.90"
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

        {/* 3. VERTRÄGE */}
        <section style={{ marginBottom: 48, paddingBottom: 32, borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 20px', color: '#0f172a' }}>Ihre Verträge</h2>
          
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
                          {(() => {
                            const statusMap = {
                              'active': { bg: '#dcfce7', color: '#166534', label: 'Aktiv' },
                              'cancelled': { bg: '#fee2e2', color: '#991b1b', label: 'Gekündigt' },
                              'pending': { bg: '#fef3c7', color: '#92400e', label: 'Prüfung' },
                              'review': { bg: '#fef3c7', color: '#92400e', label: 'Prüfung' },
                            }
                            const status = statusMap[contract.status] || { bg: '#f3f4f6', color: '#6b7280', label: contract.status }
                            return (
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 10px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                background: status.bg,
                                color: status.color,
                              }}>
                                {status.label}
                              </span>
                            )
                          })()}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>
                          CHF {(contract.premium_monthly || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                          CHF {(contract.premium_yearly || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

        {/* 4. PRÄMIENÜBERSICHT */}
        <section style={{ marginBottom: 48, paddingBottom: 32, borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 24px', color: '#0f172a' }}>Prämienübersicht</h2>
          
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 32, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {/* TOTAL SECTION */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #f3f4f6', maxWidth: 380, margin: '0 auto 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Monatsprämie</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>
                  CHF {totalPremiumMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Jahresprämie</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>
                  CHF {totalPremiumYearly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* SPARTEN SECTION */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {contracts.reduce((acc, c) => {
                const type = c.insurance_type || 'Sonstige'
                const existing = acc.find(x => x.type === type)
                if (existing) {
                  existing.yearly += c.premium_yearly || 0
                } else {
                  acc.push({ type, yearly: c.premium_yearly || 0 })
                }
                return acc
              }, [])
                .sort((a, b) => b.yearly - a.yearly)
                .map((sparte) => (
                  <div key={sparte.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 400, color: '#4b5563' }}>{sparte.type}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>CHF {sparte.yearly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
            </div>
          </div>
        </section>

        {/* 5. DOKUMENTE */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 20px', color: '#0f172a' }}>Ihre Dokumente</h2>
          
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
      <footer style={{ padding: '16px 40px', textAlign: 'center', fontSize: 11, color: '#9ca3af', borderTop: '1px solid #e5e7eb', marginTop: 32 }}>
        © 2025 VSVV
      </footer>


    </div>
  )
}