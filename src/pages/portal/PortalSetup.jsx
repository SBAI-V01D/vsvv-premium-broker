import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Eye, EyeOff, Shield, BarChart2, UserCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const BG_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/469756d65_HintergrundbildKundenportal.png'
const LOGO_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/57d6261ba_VSVV.png'

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

  const inputStyle = (field) => ({
    width: '100%',
    height: 44,
    background: 'rgba(255,255,255,0.08)',
    border: `1px solid ${focused === field ? '#4A8DD4' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 8,
    padding: '0 14px',
    color: '#EAF1F7',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'Inter, Helvetica, sans-serif',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: focused === field ? '0 0 0 3px rgba(74,141,212,0.12)' : 'none',
  })

  const labelStyle = {
    color: '#B8C5D6',
    fontSize: 12,
    fontWeight: 500,
    display: 'block',
    marginBottom: 6,
    fontFamily: 'Inter, Helvetica, sans-serif',
  }

  return (
    <div style={{ height: '100vh', display: 'flex', fontFamily: 'Inter, Helvetica, sans-serif' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        input::placeholder { color: rgba(168,179,194,0.4); }
        @media (max-width: 768px) {
          .left-section { display: none !important; }
          .right-section { width: 100% !important; }
          .content-wrapper { margin-left: 32px !important; margin-right: 32px !important; margin-top: 60px !important; max-width: 100% !important; }
          .footer-section { padding: 20px 32px !important; }
        }
      `}</style>

      {/* LEFT — Background image (flexible width) */}
      <div
        className="left-section"
        style={{
          flex: '1 1 55%',
          minWidth: 0,
          backgroundImage: `url(${BG_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'left center',
          backgroundRepeat: 'no-repeat',
          position: 'relative',
        }}
      >
        {/* Subtle fade to right panel */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 70%, rgba(10,35,75,0.6) 100%)' }} />
        
        {/* Subtile Logo im Hintergrund */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
          <img src={LOGO_URL} alt="VSVV" style={{ height: '28%', maxWidth: '90%', objectFit: 'contain', opacity: 0.12, filter: 'grayscale(1) brightness(0.4)' }} />
        </div>
      </div>

      {/* RIGHT — Login panel */}
      <div
        className="right-section"
        style={{
          flex: '1 1 45%',
          minWidth: 360,
          background: 'linear-gradient(135deg, rgba(15,45,85,0.95) 0%, rgba(10,35,75,0.99) 100%)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '12vh', paddingBottom: '80px' }}>

          <div className="content-wrapper" style={{ marginLeft: 60, marginRight: 50, maxWidth: 420 }}>
            {!mustChangePassword ? (
              <>
                {/* Text block */}
                <div style={{ marginBottom: 28 }}>
                  <h1 style={{ color: '#EAF1F7', fontSize: 30, fontWeight: 700, margin: '0 0 10px', lineHeight: 1.25, letterSpacing: '-0.4px' }}>
                    Willkommen bei VSVV
                  </h1>
                  <p style={{ color: '#4A8DD4', fontSize: 14, fontWeight: 500, margin: '0 0 12px', lineHeight: 1.5 }}>
                    Ihr persönliches Kundenportal für strukturierte und transparente Versicherungslösungen.
                  </p>
                  <p style={{ color: '#8A9BB0', fontSize: 13.5, lineHeight: 1.68, margin: 0 }}>
                    Greifen Sie jederzeit sicher auf Ihre Verträge, Dokumente und persönliche Beratung zu – alles zentral an einem Ort.
                  </p>
                </div>

                {/* Login box */}
                <div style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 14,
                  padding: 28,
                  marginTop: 28,
                  marginBottom: 26,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}>
                  <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Email */}
                    <div>
                      <label style={labelStyle}>E-Mail-Adresse</label>
                      <input
                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                        required autoFocus placeholder="ihre@email.ch"
                        style={inputStyle('email')}
                        onFocus={() => setFocused('email')}
                        onBlur={() => setFocused(null)}
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Passwort</label>
                        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A8DD4', fontSize: 11.5, fontFamily: 'inherit', padding: 0 }}>
                          Vergessen?
                        </button>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? 'text' : 'password'} value={password}
                          onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                          style={{ ...inputStyle('password'), paddingRight: 42 }}
                          onFocus={() => setFocused('password')}
                          onBlur={() => setFocused(null)}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(168,179,194,0.4)', padding: 0, display: 'flex' }}>
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Remember me */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 2 }}>
                      <div
                        onClick={() => setRememberMe(!rememberMe)}
                        style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          border: `1.5px solid ${rememberMe ? '#4A8DD4' : 'rgba(255,255,255,0.18)'}`,
                          background: rememberMe ? 'rgba(74,141,212,0.2)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                      >
                        {rememberMe && <div style={{ width: 8, height: 8, borderRadius: 2, background: '#4A8DD4' }} />}
                      </div>
                      <span style={{ color: '#8A9BB0', fontSize: 12.5 }}>Angemeldet bleiben</span>
                    </label>

                    {/* Error */}
                    {error && (
                      <div style={{ background: 'rgba(160,130,70,0.1)', border: '1px solid rgba(160,130,70,0.22)', borderRadius: 7, padding: '8px 12px' }}>
                        <p style={{ color: '#c8a96e', fontSize: 12, margin: 0 }}>{error}</p>
                      </div>
                    )}

                    {/* Button */}
                    <button
                      type="submit" disabled={loading}
                      style={{
                        width: '100%', height: 44, borderRadius: 8, border: 'none',
                        background: loading ? 'rgba(74,141,212,0.3)' : 'linear-gradient(135deg, #2F5D8A 0%, #4A8DD4 100%)',
                        color: '#EAF1F7', fontWeight: 600, fontSize: 14,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        marginTop: 12,
                        transition: 'transform 0.15s, box-shadow 0.15s, background 0.2s',
                        boxShadow: loading ? 'none' : '0 4px 16px rgba(47,93,138,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        fontFamily: 'Inter, Helvetica, sans-serif',
                      }}
                      onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = 'linear-gradient(135deg, #366a9e 0%, #5598e8 100%)' } }}
                      onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'linear-gradient(135deg, #2F5D8A 0%, #4A8DD4 100%)' } }}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { icon: Shield, title: 'Unabhängige Beratung', text: 'Ohne Interessenskonflikte – nur Ihre Ziele zählen' },
                    { icon: BarChart2, title: 'Volle Transparenz', text: 'Jederzeit vollständiger Überblick über Ihre Policen' },
                    { icon: UserCheck, title: 'Schweizer Datenschutz', text: 'Ihre Daten sind sicher und vertraulich geschützt' },
                  ].map(({ icon: Icon, title, text }) => (
                    <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(74,141,212,0.12)', border: '1px solid rgba(74,141,212,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <Icon size={14} color="rgba(74,141,212,0.7)" />
                      </div>
                      <div>
                        <p style={{ color: '#C8D4E0', fontSize: 12, fontWeight: 600, margin: '0 0 2px' }}>{title}</p>
                        <p style={{ color: '#7A8A9E', fontSize: 12, margin: 0, lineHeight: 1.5 }}>{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* Change password */
              <>
                <div style={{ marginBottom: 24 }}>
                  <h1 style={{ color: '#EAF1F7', fontSize: 24, fontWeight: 600, margin: '0 0 8px' }}>Passwort festlegen</h1>
                  <p style={{ color: '#8A9BB0', fontSize: 13, margin: 0 }}>Bitte wählen Sie ein persönliches Passwort.</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                  <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Neues Passwort</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoFocus placeholder="Min. 8 Zeichen" style={{ ...inputStyle('newpw'), paddingRight: 42 }} onFocus={() => setFocused('newpw')} onBlur={() => setFocused(null)} />
                        <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(168,179,194,0.4)', padding: 0, display: 'flex' }}>
                          {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Passwort bestätigen</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Wiederholen" style={{ ...inputStyle('confirmpw'), paddingRight: 42 }} onFocus={() => setFocused('confirmpw')} onBlur={() => setFocused(null)} />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(168,179,194,0.4)', padding: 0, display: 'flex' }}>
                          {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    {error && (
                      <div style={{ background: 'rgba(160,130,70,0.1)', border: '1px solid rgba(160,130,70,0.22)', borderRadius: 7, padding: '8px 12px' }}>
                        <p style={{ color: '#c8a96e', fontSize: 12, margin: 0 }}>{error}</p>
                      </div>
                    )}
                    <button
                      type="submit" disabled={loading}
                      style={{ width: '100%', height: 44, borderRadius: 8, border: 'none', background: loading ? 'rgba(74,141,212,0.3)' : 'linear-gradient(135deg, #2F5D8A 0%, #4A8DD4 100%)', color: '#EAF1F7', fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 12, transition: 'transform 0.15s, background 0.2s', boxShadow: '0 4px 16px rgba(47,93,138,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, Helvetica, sans-serif' }}
                      onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = 'linear-gradient(135deg, #366a9e 0%, #5598e8 100%)' } }}
                      onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'linear-gradient(135deg, #2F5D8A 0%, #4A8DD4 100%)' } }}
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
        <div className="footer-section" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 60px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
          <span>© 2025 VSVV – Ihre Versicherungsplattform</span>
          <div style={{ display: 'flex', gap: 18 }}>
            {['Impressum', 'Datenschutz', 'AGB'].map((item, i, arr) => (
              <React.Fragment key={item}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 'inherit', fontFamily: 'inherit', padding: 0, transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.8'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>{item}</button>
                {i < arr.length - 1 && <span style={{ color: 'rgba(255,255,255,0.25)' }}>|</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}