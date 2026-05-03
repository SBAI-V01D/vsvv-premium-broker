import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Eye, EyeOff, Shield, FileText, Award } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const BG_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/84e333c35_HintergrundbildKundenportal.png'

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
    border: `1px solid ${focused === field ? 'rgba(100,160,255,0.6)' : 'rgba(255,255,255,0.13)'}`,
    borderRadius: 8,
    padding: '0 14px',
    color: '#EAF1F7',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'Inter, Helvetica, sans-serif',
    boxShadow: focused === field ? '0 0 0 3px rgba(100,160,255,0.1)' : 'none',
  })

  const labelStyle = {
    color: '#A8B3C2',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
    fontFamily: 'Inter, Helvetica, sans-serif',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, Helvetica, sans-serif', overflow: 'hidden', animation: 'fadeIn 0.4s ease' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @media (max-width: 768px) {
          .left-panel { display: none !important; }
          .right-panel { width: 100% !important; min-width: unset !important; }
          .right-panel-inner { padding: 40px 28px !important; }
        }
        input::placeholder { color: rgba(168,179,194,0.45); }
      `}</style>

      {/* LEFT — image */}
      <div className="left-panel" style={{ flex: '0 0 60%', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${BG_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }} />
        {/* subtle right-edge fade into right panel */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 50%, rgba(10,22,40,0.7) 100%)' }} />
      </div>

      {/* RIGHT — navy panel */}
      <div
        className="right-panel"
        style={{
          flex: '0 0 40%',
          minWidth: 400,
          background: 'rgba(10,22,40,0.91)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Mobile bg */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${BG_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} className="mobile-bg-overlay" />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,22,40,0.88)', zIndex: 0 }} />

        <div className="right-panel-inner" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: '60px 44px' }}>

          {!mustChangePassword ? (
            <>
              {/* Text block */}
              <div style={{ marginBottom: 36 }}>
                <h1 style={{ color: '#EAF1F7', fontSize: 26, fontWeight: 600, margin: '0 0 12px', lineHeight: 1.3, letterSpacing: '-0.2px' }}>
                  Willkommen bei VSVV
                </h1>
                <p style={{ color: '#A8B3C2', fontSize: 13.5, lineHeight: 1.65, margin: '0 0 10px', fontWeight: 400 }}>
                  Ihre unabhängige Plattform für fundierte Versicherungsentscheidungen – transparent, kompetent und in Ihrem Interesse.
                </p>
                <p style={{ color: 'rgba(168,179,194,0.55)', fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                  Sicherer Zugriff auf Ihre Verträge, Dokumente und persönliche Beratung.
                </p>
              </div>

              {/* Login box */}
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 14,
                padding: '28px 24px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                marginBottom: 28,
              }}>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Passwort</label>
                      <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(168,179,194,0.45)', fontSize: 11, fontFamily: 'inherit', padding: 0 }}>
                        Passwort vergessen?
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
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Remember me */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: -2 }}>
                    <div
                      onClick={() => setRememberMe(!rememberMe)}
                      style={{
                        width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                        border: `1px solid ${rememberMe ? 'rgba(100,160,255,0.6)' : 'rgba(255,255,255,0.18)'}`,
                        background: rememberMe ? 'rgba(100,160,255,0.2)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                    >
                      {rememberMe && <div style={{ width: 7, height: 7, borderRadius: 2, background: 'rgba(140,190,255,0.9)' }} />}
                    </div>
                    <span style={{ color: 'rgba(168,179,194,0.55)', fontSize: 12 }}>Angemeldet bleiben</span>
                  </label>

                  {/* Error */}
                  {error && (
                    <div style={{ background: 'rgba(180,145,80,0.09)', border: '1px solid rgba(180,145,80,0.2)', borderRadius: 7, padding: '9px 12px' }}>
                      <p style={{ color: '#c8a96e', fontSize: 12.5, margin: 0 }}>{error}</p>
                    </div>
                  )}

                  <button
                    type="submit" disabled={loading}
                    style={{
                      width: '100%', height: 44, borderRadius: 9, border: 'none',
                      background: loading ? 'rgba(44,75,120,0.4)' : 'linear-gradient(135deg, #1C3D5A 0%, #2F5D8A 100%)',
                      color: '#EAF1F7', fontWeight: 600, fontSize: 14,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      marginTop: 4,
                      transition: 'transform 0.15s, box-shadow 0.15s, background 0.2s',
                      boxShadow: loading ? 'none' : '0 4px 18px rgba(20,50,90,0.45)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                      fontFamily: 'Inter, Helvetica, sans-serif',
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = 'linear-gradient(135deg, #224972 0%, #376b9e 100%)' } }}
                    onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'linear-gradient(135deg, #1C3D5A 0%, #2F5D8A 100%)' } }}
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

              {/* Trust items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[
                  { icon: Award, text: 'Unabhängige Beratung ohne Interessenskonflikte' },
                  { icon: FileText, text: 'Volle Transparenz über Ihre Versicherungen' },
                  { icon: Shield, text: 'Schweizer Datenschutz & höchste Sicherheitsstandards' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={12} color="rgba(168,179,194,0.4)" style={{ flexShrink: 0 }} />
                    <span style={{ color: 'rgba(168,179,194,0.45)', fontSize: 11.5 }}>{text}</span>
                  </div>
                ))}
              </div>

              <p style={{ color: 'rgba(168,179,194,0.25)', fontSize: 11, marginTop: 36, marginBottom: 0, textAlign: 'center' }}>
                © {new Date().getFullYear()} VSVV Versicherungsbroker · Schweiz
              </p>
            </>
          ) : (
            /* Password change */
            <>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ color: '#EAF1F7', fontSize: 24, fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.2px' }}>Passwort festlegen</h1>
                <p style={{ color: '#A8B3C2', fontSize: 13, margin: 0, lineHeight: 1.6 }}>Bitte wählen Sie ein persönliches Passwort für Ihren Zugang.</p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Neues Passwort</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoFocus placeholder="Min. 8 Zeichen" style={{ ...inputStyle('newpw'), paddingRight: 42 }} onFocus={() => setFocused('newpw')} onBlur={() => setFocused(null)} />
                      <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(168,179,194,0.4)', padding: 0, display: 'flex' }}>
                        {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Passwort bestätigen</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Passwort wiederholen" style={{ ...inputStyle('confirmpw'), paddingRight: 42 }} onFocus={() => setFocused('confirmpw')} onBlur={() => setFocused(null)} />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(168,179,194,0.4)', padding: 0, display: 'flex' }}>
                        {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div style={{ background: 'rgba(180,145,80,0.09)', border: '1px solid rgba(180,145,80,0.2)', borderRadius: 7, padding: '9px 12px' }}>
                      <p style={{ color: '#c8a96e', fontSize: 12.5, margin: 0 }}>{error}</p>
                    </div>
                  )}

                  <button
                    type="submit" disabled={loading}
                    style={{ width: '100%', height: 44, borderRadius: 9, border: 'none', background: loading ? 'rgba(44,75,120,0.4)' : 'linear-gradient(135deg, #1C3D5A 0%, #2F5D8A 100%)', color: '#EAF1F7', fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', transition: 'transform 0.15s, background 0.2s', boxShadow: '0 4px 18px rgba(20,50,90,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontFamily: 'Inter, Helvetica, sans-serif' }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = 'linear-gradient(135deg, #224972 0%, #376b9e 100%)' } }}
                    onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'linear-gradient(135deg, #1C3D5A 0%, #2F5D8A 100%)' } }}
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
    </div>
  )
}