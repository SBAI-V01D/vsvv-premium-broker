import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Eye, EyeOff, ShieldCheck, BarChart2, UserCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const BG_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/0ce798d8e_HintergrundbildKundenportal.png'

export default function PortalSetup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [focused, setFocused] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const lookupResult = await base44.functions.invoke('managePortalPassword', { action: 'lookup_customer', email })
      if (!lookupResult.data?.found) { setError('Bitte überprüfen Sie Ihre Eingaben.'); setLoading(false); return }
      const { customer_id, portal_access_enabled, portal_password_must_change } = lookupResult.data
      if (!portal_access_enabled) { setError('Portal-Zugriff nicht aktiviert. Kontaktieren Sie Ihren Broker.'); setLoading(false); return }
      const verifyResult = await base44.functions.invoke('managePortalPassword', { action: 'verify', customer_id, password })
      if (!verifyResult.data?.valid) { setError('Bitte überprüfen Sie Ihre Eingaben.'); setLoading(false); return }
      if (portal_password_must_change) { setMustChangePassword(true); setLoading(false); return }
      localStorage.setItem('portal_customer_id', customer_id)
      localStorage.setItem('portal_email', email)
      navigate('/portal')
    } catch {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
    }
    setLoading(false)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!newPassword.trim()) { setError('Bitte geben Sie ein neues Passwort ein.'); return }
    if (newPassword !== confirmPassword) { setError('Die Passwörter stimmen nicht überein.'); return }
    if (newPassword.length < 8) { setError('Das Passwort muss mindestens 8 Zeichen lang sein.'); return }
    setLoading(true); setError('')
    try {
      const lookupResult = await base44.functions.invoke('managePortalPassword', { action: 'lookup_customer', email })
      const { customer_id } = lookupResult.data
      await base44.functions.invoke('managePortalPassword', { action: 'reset_password', customer_id, password: newPassword })
      localStorage.setItem('portal_customer_id', customer_id)
      localStorage.setItem('portal_email', email)
      navigate('/portal')
    } catch {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
    }
    setLoading(false)
  }

  const getInputStyle = (field) => ({
    width: '100%',
    height: 44,
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${focused === field ? '#3A7BD5' : 'rgba(255,255,255,0.11)'}`,
    borderRadius: 8,
    padding: '0 14px',
    color: '#EAF1F7',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'Inter, Helvetica, sans-serif',
    boxShadow: focused === field ? '0 0 0 3px rgba(58,123,213,0.15)' : 'none',
  })

  const labelStyle = {
    color: '#C8D4E0',
    fontSize: 12.5,
    fontWeight: 500,
    display: 'block',
    marginBottom: 7,
    fontFamily: 'Inter, Helvetica, sans-serif',
  }

  const trustItems = [
    { icon: ShieldCheck, title: 'Unabhängige Beratung', sub: 'Ohne Interessenskonflikte – nur Ihre Ziele zählen' },
    { icon: BarChart2, title: 'Volle Transparenz', sub: 'Jederzeit vollständiger Überblick über Ihre Policen' },
    { icon: UserCheck, title: 'Schweizer Datenschutz', sub: 'Ihre Daten sind sicher und vertraulich geschützt' },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      display: 'flex',
      fontFamily: 'Inter, Helvetica, sans-serif',
      overflow: 'hidden',
      animation: 'fadeIn 0.45s ease',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        input::placeholder { color: rgba(168,179,194,0.4); }
        @media (max-width: 768px) {
          .right-overlay { width: 100% !important; padding: 40px 24px 80px !important; }
          .content-box { margin-right: 0 !important; margin-left: 0 !important; max-width: 100% !important; }
        }
      `}</style>

      {/* Fullscreen background */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `url(${BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'left center',
        backgroundRepeat: 'no-repeat',
      }} />

      {/* Right overlay panel */}
      <div
        className="right-overlay"
        style={{
          position: 'absolute',
          right: 0, top: 0, bottom: 0,
          width: '46%',
          minWidth: 420,
          background: 'linear-gradient(160deg, rgba(11,31,58,0.88) 0%, rgba(11,31,58,0.97) 100%)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 1,
          padding: '0 0 0 0',
        }}
      >
        {/* Vertical center content */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '60px 0' }}>
          <div
            className="content-box"
            style={{ width: '100%', maxWidth: 340, marginLeft: '10%', marginRight: '12%' }}
          >
            {!mustChangePassword ? (
              <>
                {/* Headline block */}
                <div style={{ marginBottom: 32 }}>
                  <h1 style={{ color: '#EAF1F7', fontSize: 28, fontWeight: 600, margin: '0 0 14px', lineHeight: 1.25, letterSpacing: '-0.3px' }}>
                    Willkommen bei VSVV
                  </h1>
                  <p style={{ color: '#3A7BD5', fontSize: 14, fontWeight: 500, margin: '0 0 14px' }}>
                    Ihr persönliches Kundenportal für strukturierte, transparente und professionelle Versicherungsbetreuung.
                  </p>
                  <p style={{ color: '#8A9BB0', fontSize: 13, lineHeight: 1.65, margin: '0 0 16px' }}>
                    Behalten Sie jederzeit den Überblick über Ihre Verträge, Dokumente und Lösungen – zentral, sicher und auf höchstem Beratungsniveau.
                  </p>
                  <p style={{ color: '#3A7BD5', fontSize: 12.5, fontWeight: 500, fontStyle: 'italic', margin: 0 }}>
                    „Alles an einem Ort. Klar strukturiert. Für Sie optimiert."
                  </p>
                </div>

                {/* Login box */}
                <div style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 14,
                  padding: '26px 24px',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
                  marginTop: 28,
                  marginBottom: 28,
                }}>
                  <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Email */}
                    <div>
                      <label style={labelStyle}>E-Mail-Adresse</label>
                      <input
                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                        required autoFocus placeholder="Ihre E-Mail-Adresse"
                        style={getInputStyle('email')}
                        onFocus={() => setFocused('email')}
                        onBlur={() => setFocused(null)}
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label style={labelStyle}>Passwort</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? 'text' : 'password'} value={password}
                          onChange={e => setPassword(e.target.value)} required placeholder="Ihr Passwort"
                          style={{ ...getInputStyle('password'), paddingRight: 44 }}
                          onFocus={() => setFocused('password')}
                          onBlur={() => setFocused(null)}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(168,179,194,0.45)', padding: 0, display: 'flex' }}>
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Remember + forgot */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <div
                          onClick={() => setRememberMe(!rememberMe)}
                          style={{
                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                            border: `1.5px solid ${rememberMe ? '#3A7BD5' : 'rgba(255,255,255,0.2)'}`,
                            background: rememberMe ? 'rgba(58,123,213,0.25)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                          }}
                        >
                          {rememberMe && <div style={{ width: 8, height: 8, borderRadius: 2, background: '#3A7BD5' }} />}
                        </div>
                        <span style={{ color: '#8A9BB0', fontSize: 12.5 }}>Angemeldet bleiben</span>
                      </label>
                      <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3A7BD5', fontSize: 12.5, fontFamily: 'inherit', padding: 0, opacity: 0.8 }}>
                        Passwort vergessen?
                      </button>
                    </div>

                    {/* Error */}
                    {error && (
                      <div style={{ background: 'rgba(160,130,70,0.1)', border: '1px solid rgba(160,130,70,0.22)', borderRadius: 7, padding: '9px 12px' }}>
                        <p style={{ color: '#c8a96e', fontSize: 12.5, margin: 0 }}>{error}</p>
                      </div>
                    )}

                    {/* Button */}
                    <button
                      type="submit" disabled={loading}
                      style={{
                        width: '100%', height: 46, borderRadius: 8, border: 'none',
                        background: loading ? 'rgba(47,93,138,0.45)' : 'linear-gradient(135deg, #2F5D8A 0%, #3A7BD5 100%)',
                        color: '#EAF1F7', fontWeight: 600, fontSize: 14.5,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'transform 0.15s, box-shadow 0.15s, background 0.2s',
                        boxShadow: loading ? 'none' : '0 4px 18px rgba(47,93,138,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                        fontFamily: 'Inter, Helvetica, sans-serif',
                        marginTop: 4,
                        letterSpacing: '0.1px',
                      }}
                      onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = 'linear-gradient(135deg, #366a9e 0%, #4589e3 100%)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(47,93,138,0.5)' } }}
                      onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'linear-gradient(135deg, #2F5D8A 0%, #3A7BD5 100%)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(47,93,138,0.4)' } }}
                    >
                      {loading ? (
                        <>
                          <div style={{ width: 14, height: 14, border: '2px solid rgba(234,241,247,0.25)', borderTopColor: '#EAF1F7', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                          Anmelden…
                        </>
                      ) : 'Anmelden'}
                    </button>
                  </form>
                </div>

                {/* Trust section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {trustItems.map(({ icon: Icon, title, sub }) => (
                    <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(58,123,213,0.1)', border: '1px solid rgba(58,123,213,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={15} color="#4A8DD4" />
                      </div>
                      <div>
                        <p style={{ color: '#C8D4E0', fontSize: 12.5, fontWeight: 600, margin: '0 0 2px' }}>{title}</p>
                        <p style={{ color: '#6A7D92', fontSize: 12, margin: 0, lineHeight: 1.5 }}>{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* Change password */
              <>
                <div style={{ marginBottom: 28 }}>
                  <h1 style={{ color: '#EAF1F7', fontSize: 24, fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.2px' }}>Passwort festlegen</h1>
                  <p style={{ color: '#8A9BB0', fontSize: 13, margin: 0, lineHeight: 1.6 }}>Bitte wählen Sie ein persönliches Passwort für Ihren Zugang.</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '26px 24px', boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }}>
                  <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label style={labelStyle}>Neues Passwort</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoFocus placeholder="Min. 8 Zeichen" style={{ ...getInputStyle('newpw'), paddingRight: 44 }} onFocus={() => setFocused('newpw')} onBlur={() => setFocused(null)} />
                        <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(168,179,194,0.45)', padding: 0, display: 'flex' }}>
                          {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Passwort bestätigen</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Passwort wiederholen" style={{ ...getInputStyle('confirmpw'), paddingRight: 44 }} onFocus={() => setFocused('confirmpw')} onBlur={() => setFocused(null)} />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(168,179,194,0.45)', padding: 0, display: 'flex' }}>
                          {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    {error && (
                      <div style={{ background: 'rgba(160,130,70,0.1)', border: '1px solid rgba(160,130,70,0.22)', borderRadius: 7, padding: '9px 12px' }}>
                        <p style={{ color: '#c8a96e', fontSize: 12.5, margin: 0 }}>{error}</p>
                      </div>
                    )}
                    <button
                      type="submit" disabled={loading}
                      style={{ width: '100%', height: 46, borderRadius: 8, border: 'none', background: loading ? 'rgba(47,93,138,0.45)' : 'linear-gradient(135deg, #2F5D8A 0%, #3A7BD5 100%)', color: '#EAF1F7', fontWeight: 600, fontSize: 14.5, cursor: loading ? 'not-allowed' : 'pointer', transition: 'transform 0.15s, background 0.2s', boxShadow: '0 4px 18px rgba(47,93,138,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontFamily: 'Inter, Helvetica, sans-serif' }}
                      onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = 'linear-gradient(135deg, #366a9e 0%, #4589e3 100%)' } }}
                      onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'linear-gradient(135deg, #2F5D8A 0%, #3A7BD5 100%)' } }}
                    >
                      {loading ? (
                        <><div style={{ width: 14, height: 14, border: '2px solid rgba(234,241,247,0.25)', borderTopColor: '#EAF1F7', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Wird gespeichert…</>
                      ) : 'Passwort festlegen'}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 10% 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5 }}>© {new Date().getFullYear()} VSVV – Ihre Versicherungsplattform</span>
          <div style={{ display: 'flex', gap: 16 }}>
            {['Impressum', 'Datenschutz', 'AGB'].map((item, i, arr) => (
              <React.Fragment key={item}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(106,125,146,0.6)', fontSize: 11, fontFamily: 'inherit', padding: 0 }}>{item}</button>
                {i < arr.length - 1 && <span style={{ color: 'rgba(106,125,146,0.3)', fontSize: 11 }}>|</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}