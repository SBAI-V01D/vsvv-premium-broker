import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Eye, EyeOff, Lock, CheckCircle, Shield, FileSearch, Award } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const BG_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/b432ce618_HintergrundbildKundenportal.png'

const TRUST_ITEMS = [
  { icon: Award, text: 'Unabhängige Beratung ohne Interessenskonflikte' },
  { icon: FileSearch, text: 'Volle Transparenz über Ihre Versicherungen' },
  { icon: Shield, text: 'Schweizer Datenschutz & höchste Sicherheitsstandards' },
]

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
  const [focusedField, setFocusedField] = useState(null)

  const inputBase = {
    width: '100%',
    height: 48,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 10,
    padding: '0 14px',
    color: '#EAF1F7',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'Inter, Helvetica, sans-serif',
  }

  const inputFocused = {
    borderColor: 'rgba(79,124,255,0.7)',
    boxShadow: '0 0 0 3px rgba(79,124,255,0.12)',
  }

  const labelStyle = {
    color: '#A8B3C2',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.7px',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 7,
    fontFamily: 'Inter, Helvetica, sans-serif',
  }

  const getInputStyle = (field) => ({
    ...inputBase,
    ...(focusedField === field ? inputFocused : {}),
  })

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
    } catch (err) {
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
    } catch (err) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: 'Inter, Helvetica, sans-serif',
      overflow: 'hidden',
      animation: 'fadeIn 0.4s ease-out',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .login-left { display: none !important; }
          .login-right { width: 100% !important; }
        }
      `}</style>

      {/* LEFT ZONE — 60% — Background Image visible */}
      <div
        className="login-left"
        style={{
          width: '60%',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${BG_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        {/* Subtle vignette only on right edge to blend into right panel */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, rgba(11,31,58,0.15) 0%, rgba(11,31,58,0.55) 100%)',
        }} />

        {/* Bottom left branding */}
        <div style={{ position: 'absolute', bottom: 36, left: 44, zIndex: 10 }}>
          <p style={{ color: 'rgba(234,241,247,0.35)', fontSize: 12, margin: 0, letterSpacing: '0.3px' }}>
            © {new Date().getFullYear()} VSVV Versicherungsbroker · Schweiz
          </p>
        </div>
      </div>

      {/* RIGHT ZONE — 40% — Navy panel */}
      <div
        className="login-right"
        style={{
          width: '40%',
          minWidth: 380,
          background: 'rgba(11,31,58,0.92)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 52px',
          position: 'relative',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Mobile background (only shown on mobile) */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${BG_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'none',
        }} className="mobile-bg" />
        <div style={{ position: 'relative', zIndex: 1 }}>

          {!mustChangePassword ? (
            <>
              {/* Headline block */}
              <div style={{ marginBottom: 44 }}>
                <h1 style={{
                  color: '#EAF1F7',
                  fontSize: 28,
                  fontWeight: 600,
                  margin: '0 0 14px',
                  lineHeight: 1.3,
                  letterSpacing: '-0.3px',
                }}>
                  Willkommen bei VSVV
                </h1>
                <p style={{
                  color: '#A8B3C2',
                  fontSize: 14,
                  lineHeight: 1.65,
                  margin: '0 0 10px',
                  fontWeight: 400,
                }}>
                  Ihre unabhängige Plattform für fundierte Versicherungsentscheidungen – transparent, kompetent und konsequent in Ihrem Interesse.
                </p>
                <p style={{
                  color: 'rgba(168,179,194,0.7)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  Greifen Sie jederzeit sicher auf Ihre Verträge, Dokumente und persönliche Beratung zu.
                </p>
              </div>

              {/* Login form */}
              <div style={{
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 16,
                padding: '32px 28px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                marginBottom: 36,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'rgba(79,124,255,0.15)',
                    border: '1px solid rgba(79,124,255,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Lock size={14} color="rgba(127,168,255,0.9)" />
                  </div>
                  <div>
                    <p style={{ color: '#EAF1F7', fontWeight: 600, fontSize: 15, margin: 0 }}>Sicherer Login</p>
                    <p style={{ color: 'rgba(168,179,194,0.6)', fontSize: 12, margin: 0 }}>Geben Sie Ihre Zugangsdaten ein</p>
                  </div>
                </div>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>E-Mail-Adresse</label>
                    <input
                      type="email" value={email}
                      onChange={e => setEmail(e.target.value)}
                      required autoFocus
                      placeholder="ihre@email.ch"
                      style={getInputStyle('email')}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Passwort</label>
                      <button type="button" style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(168,179,194,0.55)', fontSize: 11, fontFamily: 'inherit',
                        padding: 0, letterSpacing: '0.2px',
                      }}>
                        Passwort vergessen?
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required placeholder="••••••••"
                        style={{ ...getInputStyle('password'), paddingRight: 44 }}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(168,179,194,0.5)', padding: 0, display: 'flex',
                      }}>
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Remember me */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                    <div
                      onClick={() => setRememberMe(!rememberMe)}
                      style={{
                        width: 16, height: 16, borderRadius: 4,
                        border: `1px solid ${rememberMe ? 'rgba(79,124,255,0.7)' : 'rgba(255,255,255,0.2)'}`,
                        background: rememberMe ? 'rgba(79,124,255,0.25)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'all 0.15s',
                      }}
                    >
                      {rememberMe && <CheckCircle size={10} color="#7fa8ff" />}
                    </div>
                    <span style={{ color: 'rgba(168,179,194,0.7)', fontSize: 12 }}>Angemeldet bleiben</span>
                  </label>

                  {/* Error */}
                  {error && (
                    <div style={{
                      background: 'rgba(180,150,100,0.08)',
                      border: '1px solid rgba(200,170,110,0.2)',
                      borderRadius: 8, padding: '10px 14px',
                    }}>
                      <p style={{ color: '#c8a96e', fontSize: 13, margin: 0 }}>{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%', height: 48, borderRadius: 10, border: 'none',
                      background: loading ? 'rgba(44,70,120,0.5)' : 'linear-gradient(135deg, #1C3D5A 0%, #2F5D8A 100%)',
                      color: '#EAF1F7', fontWeight: 600, fontSize: 15,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      marginTop: 4,
                      transition: 'transform 0.15s, box-shadow 0.15s, background 0.2s',
                      boxShadow: loading ? 'none' : '0 4px 20px rgba(28,61,90,0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      fontFamily: 'Inter, Helvetica, sans-serif',
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(28,61,90,0.65)'; e.currentTarget.style.background = 'linear-gradient(135deg, #224670 0%, #376b9e 100%)' } }}
                    onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(28,61,90,0.5)'; e.currentTarget.style.background = 'linear-gradient(135deg, #1C3D5A 0%, #2F5D8A 100%)' } }}
                  >
                    {loading ? (
                      <>
                        <div style={{ width: 16, height: 16, border: '2px solid rgba(234,241,247,0.3)', borderTopColor: '#EAF1F7', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        Anmelden…
                      </>
                    ) : 'Anmelden'}
                  </button>
                </form>
              </div>

              {/* Trust items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {TRUST_ITEMS.map(({ icon: Icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={13} color="rgba(168,179,194,0.7)" />
                    </div>
                    <span style={{ color: 'rgba(168,179,194,0.65)', fontSize: 12.5, lineHeight: 1.4 }}>{text}</span>
                  </div>
                ))}
              </div>

              <p style={{ color: 'rgba(168,179,194,0.3)', fontSize: 11.5, marginTop: 40, marginBottom: 0, textAlign: 'center', letterSpacing: '0.2px' }}>
                Kein Zugang? Kontaktieren Sie Ihren Versicherungsbroker.
              </p>
            </>
          ) : (
            /* Password change view */
            <>
              <div style={{ marginBottom: 30 }}>
                <h1 style={{ color: '#EAF1F7', fontSize: 24, fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.2px' }}>
                  Passwort festlegen
                </h1>
                <p style={{ color: '#A8B3C2', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                  Bitte wählen Sie ein persönliches Passwort für Ihren Zugang.
                </p>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 16, padding: '32px 28px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              }}>
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Neues Passwort</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required autoFocus placeholder="Min. 8 Zeichen"
                        style={{ ...getInputStyle('newpw'), paddingRight: 44 }}
                        onFocus={() => setFocusedField('newpw')}
                        onBlur={() => setFocusedField(null)}
                      />
                      <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(168,179,194,0.5)', padding: 0, display: 'flex' }}>
                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
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
                        required placeholder="Passwort wiederholen"
                        style={{ ...getInputStyle('confirmpw'), paddingRight: 44 }}
                        onFocus={() => setFocusedField('confirmpw')}
                        onBlur={() => setFocusedField(null)}
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(168,179,194,0.5)', padding: 0, display: 'flex' }}>
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div style={{ background: 'rgba(180,150,100,0.08)', border: '1px solid rgba(200,170,110,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                      <p style={{ color: '#c8a96e', fontSize: 13, margin: 0 }}>{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%', height: 48, borderRadius: 10, border: 'none',
                      background: loading ? 'rgba(44,70,120,0.5)' : 'linear-gradient(135deg, #1C3D5A 0%, #2F5D8A 100%)',
                      color: '#EAF1F7', fontWeight: 600, fontSize: 15,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                      boxShadow: loading ? 'none' : '0 4px 20px rgba(28,61,90,0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      fontFamily: 'Inter, Helvetica, sans-serif',
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = 'linear-gradient(135deg, #224670 0%, #376b9e 100%)' } }}
                    onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'linear-gradient(135deg, #1C3D5A 0%, #2F5D8A 100%)' } }}
                  >
                    {loading ? (
                      <>
                        <div style={{ width: 16, height: 16, border: '2px solid rgba(234,241,247,0.3)', borderTopColor: '#EAF1F7', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        Wird gespeichert…
                      </>
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