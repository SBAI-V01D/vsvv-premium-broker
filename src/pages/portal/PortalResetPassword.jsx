import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PortalResetPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email'); // 'email' oder 'password'
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Verify email exists in system
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: 'Passwort zurücksetzen - Kundenportal',
        body: `Hallo,

Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.

Bitte öffnen Sie den Link in Ihrer E-Mail oder besuchen Sie das Portal erneut und geben Sie Ihr neues Passwort ein.

Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.

Viele Grüße,
Ihr Versicherungsmakler-Team`,
        from_name: 'Kundenportal'
      });
      
      setSuccess(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (err) {
      setError(err.message || 'Fehler beim Versenden der E-Mail');
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
          <CardTitle>Passwort zurücksetzen</CardTitle>
        </CardHeader>

        <CardContent className="pt-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-center">E-Mail versendet!</h3>
              <p className="text-sm text-muted-foreground text-center">
                Prüfen Sie Ihr E-Mail-Postfach auf Anweisungen zum Zurücksetzen Ihres Passworts.
              </p>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Geben Sie die E-Mail-Adresse ein, die mit Ihrem Konto verknüpft ist. Wir senden Ihnen Anweisungen zum Zurücksetzen Ihres Passworts.
                </p>
              </div>

              <div>
                <Label className="text-sm">E-Mail-Adresse *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ihre@email.de"
                  className="mt-1"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Wird versendet...' : 'Passwort-Reset-Link anfordern'}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center space-y-2">
            <Link to="/portal" className="text-sm text-primary hover:underline block">
              ← Zurück zum Portal
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}