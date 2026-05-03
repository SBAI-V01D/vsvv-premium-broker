import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Eye, EyeOff, AlertCircle, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const LOGO_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/daa966436_VSVV.png'

export default function PortalSetup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const inputStyle = {
    width: '100%',
    height: 48,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.13)',
    borderRadius: 8,
    padding: '0 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  const labelStyle = {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 7,
  }

  const handleFocus = e => { e.target.style.borderColor = 'rgba(79,124,255,0.7)' }
  const handleBlur = e => { e.target.style.borderColor = 'rgba(255,255,255,0.13)' }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const lookupResult = await base44.functions.invoke('managePortalPassword', { action: 'lookup_customer', email })
      if (!lookupResult.data?.found) { setError('E-Mail-Adresse nicht gefunden.'); setLoading(false); return }
      const { customer_id, portal_access_enabled, portal_password_must_change } = lookupResult.data
      if (!portal_access_enabled) { setError('Portal-Zugriff nicht aktiviert. Kontaktieren Sie Ihren Broker.'); setLoading(false); return }
      const verifyResult = await base44.functions.invoke('managePortalPassword', { action: 'verify', customer_id, password })
      if (!verifyResult.data?.valid) { setError('E-Mail oder Passwort ist falsch.'); setLoading(false); return }
      if (portal_password_must_change) { setMustChangePassword(true); setLoading(false); return }
      localStorage.setItem('portal_customer_id', customer_id)
      localStorage.setItem('portal_email', email)
      navigate('/portal')
    } catch (err) {
      setError(`Fehler: ${err.message}`)
    }
    setLoading(false)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!newPassword.trim()) { setError('Bitte geben Sie ein neues Passwort ein.'); return }
    if (newPassword !== confirmPassword) { setError('Passwörter stimmen nicht überein.'); return }
    if (newPassword.length < 8) { setError('Passwort muss mindestens 8 Zeichen lang sein.'); return }
    setLoading(true); setError('')
    try {
      const lookupResult = await base44.functions.invoke('managePortalPassword', { action: 'lookup_customer', email })
      const { customer_id } = lookupResult.data
      await base44.functions.invoke('managePortalPassword', { action: 'reset_password', customer_id, password: newPassword })
      localStorage.setItem('portal_customer_id', customer_id)
      localStorage.setItem('portal_email', email)
      navigate('/portal')
    } catch (err) {
      setError(`Fehler: ${err.message}`)
    }
    setLoading(false)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #0B1C2C 0%, #0F2440 50%, #142F4A 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Logo */}
        <img
          src={LOGO_URL}
          alt="VSVV"
          style={{
            height: 80,
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 16px rgba(79,124,255,0.55)) drop-shadow(0 0 5px rgba(79,124,255,0.35))',
            marginBottom: 22,
          }}
        />

        {/* Welcome text */}
        <p
          style={{
            color: '#E6EEF8',
            fontSize: 22,
            fontWeight: 600,
            textAlign: 'center',
            lineHeight: 1.4,
            maxWidth: 340,
            marginBottom: 28,
            letterSpacing: '-0.2px',
          }}
        >
          Herzlich Willkommen auf Ihrem Kundenportal bei VSVV
        </p>

        {/* Login Box */}
        <div
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14,
            padding: '32px 28px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          {!mustChangePassword ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(79,124,255,0.18)', border: '1px solid rgba(79,124,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Lock style={{ width: 16, height: 16, color: '#7fa8ff' }} />
                </div>
                <div>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 17, margin: 0 }}>Anmelden</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>Bitte geben Sie Ihre Zugangsdaten ein</p>
                </div>
              </div>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>E-Mail-Adresse</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="ihre@email.ch"
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Passwort</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      style={{ ...inputStyle, paddingRight: 44 }}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertCircle style={{ width: 14, height: 14, color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: '#fca5a5', fontSize: 13, margin: 0 }}>{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 8,
                    border: 'none',
                    background: loading ? 'rgba(79,124,255,0.35)' : 'linear-gradient(135deg, #4F7CFF 0%, #6AA3FF 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginTop: 4,
                    transition: 'opacity 0.2s',
                    boxShadow: loading ? 'none' : '0 4px 18px rgba(79,124,255,0.35)',
                  }}
                  onMouseEnter={e => { if (!loading) e.target.style.opacity = '0.88' }}
                  onMouseLeave={e => { e.target.style.opacity = '1' }}
                >
                  {loading ? 'Anmelden...' : 'Anmelden'}
                </button>
              </form>

              <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 12, textAlign: 'center', marginTop: 22, marginBottom: 0 }}>
                Kein Zugang? Kontaktieren Sie Ihren Versicherungsbroker.
              </p>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(79,124,255,0.18)', border: '1px solid rgba(79,124,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Lock style={{ width: 16, height: 16, color: '#7fa8ff' }} />
                </div>
                <div>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 17, margin: 0 }}>Passwort ändern</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>Bitte setzen Sie ein neues Passwort</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Neues Passwort</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      autoFocus
                      placeholder="Min. 8 Zeichen"
                      style={{ ...inputStyle, paddingRight: 44 }}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex' }}>
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Passwort bestätigen</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Passwort wiederholen"
                      style={{ ...inputStyle, paddingRight: 44 }}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex' }}>
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertCircle style={{ width: 14, height: 14, color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: '#fca5a5', fontSize: 13, margin: 0 }}>{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    height: 48,
                    borderRadius: 8,
                    border: 'none',
                    background: loading ? 'rgba(79,124,255,0.35)' : 'linear-gradient(135deg, #4F7CFF 0%, #6AA3FF 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginTop: 4,
                    boxShadow: loading ? 'none' : '0 4px 18px rgba(79,124,255,0.35)',
                  }}
                  onMouseEnter={e => { if (!loading) e.target.style.opacity = '0.88' }}
                  onMouseLeave={e => { e.target.style.opacity = '1' }}
                >
                  {loading ? 'Wird gespeichert...' : 'Passwort ändern'}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, marginTop: 24 }}>
          © {new Date().getFullYear()} VSVV Versicherungsbroker · Schweiz
        </p>
      </div>
    </div>
  )
}