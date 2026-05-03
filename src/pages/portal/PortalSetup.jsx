import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Eye, EyeOff, Shield, BarChart2, UserCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const BG_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/cebd2b2f0_VSVV2.png'

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
    height: 38,
    background: 'rgba(255,255,255,0.08)',
    border: `1px solid ${focused === field ? '#5BA3E8' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 8,
    padding: '0 12px',
    color: '#EAF1F7',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'Inter, Helvetica, sans-serif',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: focused === field ? '0 0 0 3px rgba(91,163,232,0.12)' : 'none',
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: 'Inter, Helvetica, sans-serif',
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        input::placeholder { color: rgba(168,179,194,0.4); }
        @media (max-width: 1024px) {
          .image-column { display: none; }
          .login-column { width: 100%; }
        }
      `}</style>

      {/* LEFT COLUMN – IMAGE */}
      <div className="image-column" style={{
        width: '55%',
        flexShrink: 0,
        backgroundColor: '#0B1F3A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <img
          src={BG_URL}
          alt="VSVV Portal"
          style={{
            width: '100%',
            height: '100vh',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>

      {/* RIGHT COLUMN – LOGIN */}
      <div className="login-column" style={{
        width: '45%',
        backgroundColor: '#0B1F3A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        boxSizing: 'border-box',
        position: 'relative',
      }}>

        {/* CONTENT CONTAINER */}
        <div style={{
          maxWidth: 360,
          width: '100%',
          marginRight: 50,
        }}>

          {!mustChangePassword ? (
            <>
              {/* HEADLINE + DESCRIPTION */}
              <div style={{ marginBottom: 20 }}>
                <h1 style={{
                  color: '#EAF1F7',
                  fontSize: 28,
                  fontWeight: 600,
                  margin: '0 0 12px',
                  lineHeight: 1.2,
                  letterSpacing: '-0.5px',
                }}>
                  Willkommen bei VSVV
                </h1>
                <p style={{
                  color: '#5B9FE6',
                  fontSize: 13.5,
                  fontWeight: 500,
                  margin: '0 0 8px',
                  lineHeight: 1.6,
                }}>
                  Ihr persönliches Kundenportal für strukturierte und transparente Versicherungslösungen.
                </p>
                <p style={{
                  color: '#C8D4E3',
                  fontSize: 13,
                  lineHeight: 1.75,
                  margin: 0,
                }}>
                  Greifen Sie jederzeit sicher auf Ihre Verträge und Dokumente zu – zentral und übersichtlich.
                </p>
              </div>

              {/* LOGIN BOX */}
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: 18,
                marginBottom: 20,
              }}>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* EMAIL */}
                  <div>
                    <label style={labelStyle}>E-Mail-Adresse</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                      placeholder="ihre@email.ch"
                      style={inputStyle('email')}
                      onFocus={() => setFocused('email')}
                      onBlur={() => setFocused(null)}
                    />
                  </div>

                  {/* PASSWORD */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Passwort</label>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#5B9FE6',
                          fontSize: 11.5,
                          fontFamily: 'inherit',
                          padding: 0,
                        }}
                      >
                        Vergessen?
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        style={{ ...inputStyle('password'), paddingRight: 42 }}
                        onFocus={() => setFocused('password')}
                        onBlur={() => setFocused(null)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: 13,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'rgba(168,179,194,0.4)',
                          padding: 0,
                          display: 'flex',
                        }}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* REMEMBER ME */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                  }}>
                    <div
                      onClick={() => setRememberMe(!rememberMe)}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        flexShrink: 0,
                        border: `1.5px solid ${rememberMe ? '#5BA3E8' : 'rgba(255,255,255,0.18)'}`,
                        background: rememberMe ? 'rgba(91,163,232,0.2)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                    >
                      {rememberMe && <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: '#5BA3E8',
                      }} />}
                    </div>
                    <span style={{ color: '#8A9BB0', fontSize: 12.5 }}>Angemeldet bleiben</span>
                  </label>

                  {/* ERROR */}
                  {error && (
                    <div style={{
                      background: 'rgba(200,150,100,0.1)',
                      border: '1px solid rgba(200,150,100,0.22)',
                      borderRadius: 7,
                      padding: '8px 12px',
                    }}>
                      <p style={{ color: '#c8a96e', fontSize: 12, margin: 0 }}>{error}</p>
                    </div>
                  )}

                  {/* SUBMIT BUTTON */}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%',
                      height: 40,
                      borderRadius: 8,
                      border: 'none',
                      background: loading
                        ? 'rgba(91,163,232,0.3)'
                        : 'linear-gradient(135deg, #3A6BA8 0%, #5BA3E8 100%)',
                      color: '#EAF1F7',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      marginTop: 6,
                      transition: 'transform 0.2s, box-shadow 0.2s, background 0.2s',
                      boxShadow: loading ? 'none' : '0 4px 18px rgba(91,163,232,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      fontFamily: 'Inter, Helvetica, sans-serif',
                    }}
                    onMouseEnter={e => {
                      if (!loading) {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.background = 'linear-gradient(135deg, #4575B5 0%, #66AFF0 100%)'
                        e.currentTarget.style.boxShadow = '0 6px 24px rgba(91,163,232,0.4)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!loading) {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.background = 'linear-gradient(135deg, #3A6BA8 0%, #5BA3E8 100%)'
                        e.currentTarget.style.boxShadow = '0 4px 18px rgba(91,163,232,0.3)'
                      }
                    }}
                  >
                    {loading ? (
                      <>
                        <div style={{
                          width: 14,
                          height: 14,
                          border: '2px solid rgba(234,241,247,0.25)',
                          borderTopColor: '#EAF1F7',
                          borderRadius: '50%',
                          animation: 'spin 0.7s linear infinite',
                        }} />
                        Anmelden…
                      </>
                    ) : 'Anmelden'}
                  </button>
                </form>
              </div>

              {/* TRUST SECTION */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { icon: Shield, title: 'Unabhängige Beratung', text: 'Ohne Interessenskonflikte – nur Ihre Ziele zählen' },
                  { icon: BarChart2, title: 'Volle Transparenz', text: 'Jederzeit vollständiger Überblick über Ihre Policen' },
                  { icon: UserCheck, title: 'Schweizer Datenschutz', text: 'Ihre Daten sind sicher und vertraulich geschützt' },
                ].map(({ icon: Icon, title, text }) => (
                  <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'rgba(91,163,232,0.12)',
                      border: '1px solid rgba(91,163,232,0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}>
                      <Icon size={14} color="rgba(91,163,232,0.7)" />
                    </div>
                    <div>
                      <p style={{
                        color: '#C8D4E0',
                        fontSize: 12,
                        fontWeight: 600,
                        margin: '0 0 2px',
                      }}>
                        {title}
                      </p>
                      <p style={{
                        color: '#7A8A9E',
                        fontSize: 12,
                        margin: 0,
                        lineHeight: 1.5,
                      }}>
                        {text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* CHANGE PASSWORD VIEW */
            <>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{
                  color: '#EAF1F7',
                  fontSize: 24,
                  fontWeight: 600,
                  margin: '0 0 8px',
                }}>
                  Passwort festlegen
                </h1>
                <p style={{ color: '#8A9BB0', fontSize: 13, margin: 0 }}>
                  Bitte wählen Sie ein persönliches Passwort.
                </p>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 12,
                padding: 18,
                marginBottom: 18,
              }}>
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* NEW PASSWORD */}
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
                        style={{ ...inputStyle('newpw'), paddingRight: 42 }}
                        onFocus={() => setFocused('newpw')}
                        onBlur={() => setFocused(null)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        style={{
                          position: 'absolute',
                          right: 13,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'rgba(168,179,194,0.4)',
                          padding: 0,
                          display: 'flex',
                        }}
                      >
                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* CONFIRM PASSWORD */}
                  <div>
                    <label style={labelStyle}>Passwort bestätigen</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                        placeholder="Wiederholen"
                        style={{ ...inputStyle('confirmpw'), paddingRight: 42 }}
                        onFocus={() => setFocused('confirmpw')}
                        onBlur={() => setFocused(null)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        style={{
                          position: 'absolute',
                          right: 13,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'rgba(168,179,194,0.4)',
                          padding: 0,
                          display: 'flex',
                        }}
                      >
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* ERROR */}
                  {error && (
                    <div style={{
                      background: 'rgba(200,150,100,0.1)',
                      border: '1px solid rgba(200,150,100,0.22)',
                      borderRadius: 7,
                      padding: '8px 12px',
                    }}>
                      <p style={{ color: '#c8a96e', fontSize: 12, margin: 0 }}>{error}</p>
                    </div>
                  )}

                  {/* SUBMIT */}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%',
                      height: 40,
                      borderRadius: 8,
                      border: 'none',
                      background: loading
                        ? 'rgba(91,163,232,0.3)'
                        : 'linear-gradient(135deg, #2F5D8A 0%, #4A8DD4 100%)',
                      color: '#EAF1F7',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      marginTop: 6,
                      transition: 'transform 0.15s, background 0.2s',
                      boxShadow: '0 4px 16px rgba(47,93,138,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      fontFamily: 'Inter, Helvetica, sans-serif',
                    }}
                    onMouseEnter={e => {
                      if (!loading) {
                        e.currentTarget.style.transform = 'translateY(-1px)'
                        e.currentTarget.style.background = 'linear-gradient(135deg, #366a9e 0%, #5598e8 100%)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!loading) {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.background = 'linear-gradient(135deg, #2F5D8A 0%, #4A8DD4 100%)'
                      }
                    }}
                  >
                    {loading ? (
                      <>
                        <div style={{
                          width: 14,
                          height: 14,
                          border: '2px solid rgba(234,241,247,0.25)',
                          borderTopColor: '#EAF1F7',
                          borderRadius: '50%',
                          animation: 'spin 0.7s linear infinite',
                        }} />
                        Wird gespeichert…
                      </>
                    ) : 'Passwort festlegen'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 10.5,
          color: 'rgba(255,255,255,0.55)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span>© 2025 VSVV – Ihre Versicherungsplattform</span>
          <div style={{ display: 'flex', gap: 18 }}>
            {['AGB', 'Impressum', 'Datenschutz'].map((item, i, arr) => (
              <React.Fragment key={item}>
                <button style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  padding: 0,
                  transition: 'opacity 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  {item}
                </button>
                {i < arr.length - 1 && <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}