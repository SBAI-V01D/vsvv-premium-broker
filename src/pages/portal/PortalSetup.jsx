import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PortalSetup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get('email') || '');
  }, []);

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return 'Passwort muss mindestens 8 Zeichen lang sein';
    if (!/[A-Z]/.test(pwd)) return 'Passwort muss mindestens einen Großbuchstaben enthalten';
    if (!/[a-z]/.test(pwd)) return 'Passwort muss mindestens einen Kleinbuchstaben enthalten';
    if (!/[0-9]/.test(pwd)) return 'Passwort muss mindestens eine Ziffer enthalten';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password || !confirmPassword) {
      setError('Alle Felder sind erforderlich');
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    setLoading(true);
    try {
      await base44.auth.updateMe({ password });
      setSuccess(true);
      setTimeout(() => navigate('/portal'), 2000);
    } catch (err) {
      setError(err.message || 'Fehler beim Einrichten des Passworts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center border-b">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
          </div>
          <CardTitle>Kundenportal einrichten</CardTitle>
        </CardHeader>

        <CardContent className="pt-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-center">Passwort eingerichtet!</h3>
              <p className="text-sm text-muted-foreground text-center">
                Sie werden in Kürze zum Portal weitergeleitet...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-sm">E-Mail-Adresse</Label>
                <Input
                  type="email"
                  value={email}
                  disabled
                  className="mt-1 bg-muted"
                />
              </div>

              <div>
                <Label className="text-sm">Passwort *</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mindestens 8 Zeichen"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-sm">Passwort wiederholen *</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Passwort wiederholen"
                  className="mt-1"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
                <p className="text-blue-800 font-medium mb-2">Passwortanforderungen:</p>
                <ul className="space-y-1 text-blue-700">
                  <li>✓ Mindestens 8 Zeichen</li>
                  <li>✓ Mindestens ein Großbuchstabe (A-Z)</li>
                  <li>✓ Mindestens ein Kleinbuchstabe (a-z)</li>
                  <li>✓ Mindestens eine Ziffer (0-9)</li>
                </ul>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Wird eingerichtet...' : 'Passwort einrichten'}
              </Button>
            </form>
          )}

          <p className="text-xs text-center text-muted-foreground mt-6">
            Der Link ist 24 Stunden lang gültig. Danach müssen Sie ihn neu anfordern.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}