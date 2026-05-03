import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { usePortalData } from '@/hooks/usePortalData'
import { base44 } from '@/api/base44Client'
import { User, Mail, Phone, MapPin, Calendar, Briefcase, Globe, Shield, LogOut, Edit2, Check, X, AlertCircle } from 'lucide-react'

const NAVY = '#0B1C2C'
const ACCENT = '#4F7CFF'

const CIVIL_LABELS = {
  single: 'Ledig', married: 'Verheiratet', divorced: 'Geschieden',
  widowed: 'Verwitwet', registered_partnership: 'Eingetragene Partnerschaft',
  dissolved_partnership: 'Aufgelöste Partnerschaft',
}

function InfoRow({ icon: Icon, label, value, accent = ACCENT }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} color={accent} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#9ca3af', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 2px' }}>{label}</p>
        <p style={{ color: NAVY, fontSize: 14, fontWeight: 500, margin: 0 }}>{value}</p>
      </div>
    </div>
  )
}

export default function PortalProfile() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { customer, customerId, isLoading, error } = usePortalData()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState(false)
  const [form, setForm] = useState({})

  const handleLogout = () => {
    localStorage.removeItem('portal_customer_id')
    localStorage.removeItem('portal_email')
    navigate('/portal/setup')
  }

  const startEdit = () => {
    setForm({
      phone: customer.phone || '',
      mobile: customer.mobile || '',
      street: customer.street || '',
      zip_code: customer.zip_code || '',
      city: customer.city || '',
      birthdate: customer.birthdate || '',
      civil_status: customer.civil_status || '',
      nationality: customer.nationality || '',
      profession: customer.profession || '',
      ahv_number: customer.ahv_number || '',
    })
    setEditing(true)
    setSaveError('')
    setSaveOk(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await base44.functions.invoke('getPortalData', {
        customer_id: customerId,
        action: 'update_customer',
        update_data: form,
      })
      queryClient.invalidateQueries({ queryKey: ['portal-all-data', customerId] })
      setSaveOk(true)
      setEditing(false)
      setTimeout(() => setSaveOk(false), 3000)
    } catch (e) {
      setSaveError('Speichern fehlgeschlagen: ' + e.message)
    }
    setSaving(false)
  }

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>Laden…</div>
  )

  if (error || !customer) return (
    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <AlertCircle size={16} color="#dc2626" />
      <p style={{ color: '#991b1b', fontSize: 13, margin: 0 }}>Daten konnten nicht geladen werden.</p>
    </div>
  )

  const inputStyle = {
    width: '100%', height: 40, padding: '0 12px', borderRadius: 8,
    border: '1px solid #d1d5db', fontSize: 14, color: NAVY,
    background: '#fff', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: NAVY, fontSize: 24, fontWeight: 700, margin: 0 }}>Mein Profil</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Ihre persönlichen Daten und Kontaktinformationen</p>
      </div>

      {saveOk && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 9, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#16a34a', fontWeight: 500 }}>
          ✓ Daten erfolgreich gespeichert
        </div>
      )}

      {/* Avatar + Name */}
      <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a3a5c 100%)`, borderRadius: 14, padding: '24px 28px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {customer.first_name?.[0]}{customer.last_name?.[0]}
        </div>
        <div>
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>{customer.first_name} {customer.last_name}</p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, margin: '4px 0 0' }}>{customer.email}</p>
          <span style={{ background: 'rgba(79,124,255,0.25)', color: '#7fa8ff', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, marginTop: 6, display: 'inline-block' }}>
            {customer.status === 'active' ? '✓ Aktiver Kunde' : customer.status || 'Kunde'}
          </span>
        </div>
      </div>

      {/* Personal Data Card */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 6px rgba(11,28,44,0.07)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ color: NAVY, fontSize: 15, fontWeight: 700, margin: 0 }}>Persönliche Daten</h2>
          {!editing && (
            <button onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${ACCENT}12`, border: `1px solid ${ACCENT}22`, color: ACCENT, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 7, cursor: 'pointer' }}>
              <Edit2 size={12} /> Bearbeiten
            </button>
          )}
        </div>

        {!editing ? (
          <>
            <InfoRow icon={Mail} label="E-Mail" value={customer.email} />
            <InfoRow icon={Calendar} label="Geburtsdatum" value={customer.birthdate ? new Date(customer.birthdate).toLocaleDateString('de-CH') : null} />
            <InfoRow icon={Globe} label="Nationalität" value={customer.nationality} />
            <InfoRow icon={Shield} label="Zivilstand" value={CIVIL_LABELS[customer.civil_status] || customer.civil_status} />
            <InfoRow icon={Briefcase} label="Beruf" value={customer.profession} />
            <InfoRow icon={Shield} label="AHV-Nummer" value={customer.ahv_number} accent="#7c3aed" />
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>GEBURTSDATUM</label>
              <input type="date" style={inputStyle} value={form.birthdate} onChange={e => setForm(f => ({ ...f, birthdate: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>ZIVILSTAND</label>
                <select style={inputStyle} value={form.civil_status} onChange={e => setForm(f => ({ ...f, civil_status: e.target.value }))}>
                  <option value="">–</option>
                  <option value="single">Ledig</option>
                  <option value="married">Verheiratet</option>
                  <option value="divorced">Geschieden</option>
                  <option value="widowed">Verwitwet</option>
                  <option value="registered_partnership">Eingetragene Partnerschaft</option>
                  <option value="dissolved_partnership">Aufgelöste Partnerschaft</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>NATIONALITÄT</label>
                <input style={inputStyle} value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} placeholder="z.B. CH, DE, FR" />
              </div>
            </div>
            <div>
              <label style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>BERUF</label>
              <input style={inputStyle} value={form.profession} onChange={e => setForm(f => ({ ...f, profession: e.target.value }))} placeholder="Ihre Berufsbezeichnung" />
            </div>
            <div>
              <label style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>AHV-NUMMER</label>
              <input style={inputStyle} value={form.ahv_number} onChange={e => setForm(f => ({ ...f, ahv_number: e.target.value }))} placeholder="756.1234.5678.90" />
            </div>
            {saveError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dc2626' }}>{saveError}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                <Check size={13} /> {saving ? 'Speichern…' : 'Speichern'}
              </button>
              <button onClick={() => setEditing(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                <X size={13} /> Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contact / Address — Editable */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 6px rgba(11,28,44,0.07)', marginBottom: 16 }}>
        <h2 style={{ color: NAVY, fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Kontakt & Adresse</h2>
        <p style={{ color: '#9ca3af', fontSize: 11, margin: '0 0 12px' }}>Diese Angaben können Sie selbst aktualisieren.</p>

        {!editing ? (
          <>
            <InfoRow icon={Phone} label="Telefon" value={customer.phone} />
            <InfoRow icon={Phone} label="Mobilnummer" value={customer.mobile} accent="#16a34a" />
            <InfoRow icon={MapPin} label="Adresse" value={customer.street ? `${customer.street}, ${customer.zip_code} ${customer.city}${customer.canton ? `, ${customer.canton}` : ''}` : null} />
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>TELEFON</label>
                <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+41 xx xxx xx xx" />
              </div>
              <div>
                <label style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>MOBILNUMMER</label>
                <input style={inputStyle} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="+41 79 xxx xx xx" />
              </div>
            </div>
            <div>
              <label style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>STRASSE</label>
              <input style={inputStyle} value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} placeholder="Musterstrasse 1" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
              <div>
                <label style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>PLZ</label>
                <input style={inputStyle} value={form.zip_code} onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))} placeholder="8000" />
              </div>
              <div>
                <label style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>ORT</label>
                <input style={inputStyle} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Zürich" />
              </div>
            </div>

            {saveError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dc2626' }}>{saveError}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                <Check size={13} /> {saving ? 'Speichern…' : 'Speichern'}
              </button>
              <button onClick={() => setEditing(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                <X size={13} /> Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Account card */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 6px rgba(11,28,44,0.07)' }}>
        <h2 style={{ color: NAVY, fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>Konto</h2>
        <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 16px' }}>
          Für Änderungen Ihrer persönlichen Stammdaten kontaktieren Sie bitte Ihren Versicherungsbroker.
        </p>
        <button
          onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          <LogOut size={14} /> Abmelden
        </button>
      </div>
    </div>
  )
}