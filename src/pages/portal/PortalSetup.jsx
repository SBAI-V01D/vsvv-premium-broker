import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Eye, EyeOff, AlertCircle, ShieldCheck, Handshake, TrendingUp, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const LOGO_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/daa966436_VSVV.png'
const BG_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/3704c4574_BildohneLogo.png'

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

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const lookupResult = await base44.functions.invoke('managePortalPassword', {
        action: 'lookup_customer',
        email,
      })

      if (!lookupResult.data?.found) {
        setError('E-Mail-Adresse nicht gefunden.')
        setLoading(false)
        return
      }

      const { customer_id, portal_access_enabled, portal_password_must_change } = lookupResult.data

      if (!portal_access_enabled) {
        setError('Portal-Zugriff nicht aktiviert. Kontaktieren Sie Ihren Broker.')
        setLoading(false)
        return
      }

      const verifyResult = await base44.functions.invoke('managePortalPassword', {
        action: 'verify',
        customer_id,
        password,
      })

      if (!verifyResult.data?.valid) {
        setError('E-Mail oder Passwort ist falsch.')
        setLoading(false)
        return
      }

      if (portal_password_must_change) {
        setMustChangePassword(true)
        setLoading(false)
        return
      }

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
    setLoading(true)
    setError('')

    try {
      const lookupResult = await base44.functions.invoke('managePortalPassword', {
        action: 'lookup_customer',
        email,
      })
      const { customer_id } = lookupResult.data

      await base44.functions.invoke('managePortalPassword', {
        action: 'reset_password',
        customer_id,
        password: newPassword,
      })

      localStorage.setItem('portal_customer_id', customer_id)
      localStorage.setItem('portal_email', email)
      navigate('/portal')
    } catch (err) {
      setError(`Fehler: ${err.message}`)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 40%, #102040 100%)' }}>

      {/* Background image overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${BG_URL})`,
          opacity: 0.18,
        }}
      />

      {/* Subtle gradient overlay */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(10,22,40,0.85) 0%, rgba(13,31,60,0.5) 50%, rgba(10,22,40,0.9) 100%)' }} />

      {/* LEFT SIDE */}
      <div className="relative z-10 flex-1 flex flex-col justify-between p-10 md:p-16 hidden md:flex">

        {/* Logo */}
        <div>
          <img
            src={LOGO_URL}
            alt="VSVV Logo"
            style={{ height: '90px', filter: 'drop-shadow(0 0 18px rgba(59,130,246,0.6)) drop-shadow(0 0 6px rgba(59,130,246,0.4))' }}
            className="object-contain"
          />
        </div>

        {/* Welcome text */}
        <div className="mb-16">
          <h1 style={{ fontSize: '30px', fontWeight: 700, lineHeight: 1.3, maxWidth: '480px', color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.3px' }}>
            Herzlich Willkommen auf Ihrem Kundenportal bei VSVV
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginTop: '16px', fontSize: '15px', maxWidth: '400px', lineHeight: 1.6 }}>
            Ihr persönlicher Bereich für Verträge, Dokumente und direkten Kontakt mit Ihrem Versicherungsbroker.
          </p>

          {/* Trust pillars */}
          <div className="mt-12 space-y-5">
            {[
              { icon: ShieldCheck, title: 'Kompetent', text: 'Fachwissen, Erfahrung und Netzwerk für Ihre besten Interessen.' },
              { icon: Handshake, title: 'Zuverlässig', text: 'Neutral und frei von Bindungen – ausschliesslich für Sie da.' },
              { icon: TrendingUp, title: 'Zukunftsorientiert', text: 'Wir setzen uns heute für Ihre Sicherheit von morgen ein.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-4">
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', flexShrink: 0 }} className="flex items-center justify-center">
                  <Icon style={{ width: 18, height: 18, color: '#60a5fa' }} />
                </div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 600, fontSize: 14 }}>{title}</p>
                  <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13, marginTop: 2 }}>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
          © {new Date().getFullYear()} VSVV Versicherungsbroker · Schweiz
        </p>
      </div>

      {/* RIGHT SIDE – Login Box */}
      <div className="relative z-10 flex items-center justify-center w-full md:w-auto md:min-w-[480px] p-6 md:p-12">

        {/* Mobile logo */}
        <div className="absolute top-8 left-6 md:hidden">
          <img src={LOGO_URL} alt="VSVV" style={{ height: 60, filter: 'drop-shadow(0 0 12px rgba(59,130,246,0.5))' }} />
        </div>

        <div
          className="w-full"
          style={{
            maxWidth: 400,
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20,
            padding: '44px 40px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.08) inset',
          }}
        >
          {!mustChangePassword ? (
            <>
              {/* Lock icon */}
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.3)', marginBottom: 24 }} className="flex items-center justify-center">
                <Lock style={{ width: 22, height: 22, color: '#60a5fa' }} />
              </div>

              <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Login</h2>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 32 }}>Melden Sie sich mit Ihren Zugangsdaten an</p>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    E-Mail-Adresse
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="ihre@email.ch"
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8,
                      padding: '12px 14px',
                      color: '#fff',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(96,165,250,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  />
                </div>

                {/* Password */}
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    Passwort
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8,
                        padding: '12px 44px 12px 14px',
                        color: '#fff',
                        fontSize: 14,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={e => e.target.style.borderColor = 'rgba(96,165,250,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0 }}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertCircle style={{ width: 15, height: 15, color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: '#fca5a5', fontSize: 13 }}>{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '13px',
                    borderRadius: 8,
                    border: 'none',
                    background: loading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginTop: 8,
                    transition: 'all 0.2s',
                    boxShadow: loading ? 'none' : '0 4px 20px rgba(37,99,235,0.4)',
                  }}
                  onMouseEnter={e => { if (!loading) e.target.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)' }}
                  onMouseLeave={e => { if (!loading) e.target.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}
                >
                  {loading ? 'Anmelden...' : 'Anmelden'}
                </button>
              </form>

              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', marginTop: 28 }}>
                Kein Zugang? Kontaktieren Sie Ihren Versicherungsbroker.
              </p>
            </>
          ) : (
            <>
              {/* Password change screen */}
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.3)', marginBottom: 24 }} className="flex items-center justify-center">
                <Lock style={{ width: 22, height: 22, color: '#60a5fa' }} />
              </div>

              <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Passwort ändern</h2>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 32 }}>Bitte setzen Sie beim ersten Login ein neues Passwort.</p>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    Neues Passwort
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      autoFocus
                      placeholder="Min. 8 Zeichen"
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '12px 44px 12px 14px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(96,165,250,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0 }}>
                      {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    Passwort bestätigen
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Passwort wiederholen"
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '12px 44px 12px 14px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(96,165,250,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0 }}>
                      {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertCircle style={{ width: 15, height: 15, color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: '#fca5a5', fontSize: 13 }}>{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '13px',
                    borderRadius: 8,
                    border: 'none',
                    background: loading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginTop: 8,
                    boxShadow: loading ? 'none' : '0 4px 20px rgba(37,99,235,0.4)',
                  }}
                >
                  {loading ? 'Wird gespeichert...' : 'Passwort ändern'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}