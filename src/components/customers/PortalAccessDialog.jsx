import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function PortalAccessDialog({ open, onOpenChange, customer }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleInvite = async () => {
    setLoading(true);
    setError(null);
    try {
      await base44.functions.invoke('inviteCustomerToPortal', {
        customer_email: customer.email,
        customer_name: `${customer.first_name} ${customer.last_name}`,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
      }, 2000);
    } catch (err) {
      setError(err.message || 'Fehler beim Versenden der Einladung');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kundenportal freischalten</DialogTitle>
          <DialogDescription>
            {customer.first_name} {customer.last_name} erhält Zugang zum Portal
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            <p className="text-sm font-medium text-center">Einladung versendet!</p>
            <p className="text-xs text-muted-foreground text-center">
              {customer.first_name} erhält eine E-Mail mit dem Einladungslink
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-2">
              <div>
                <p className="text-blue-800 font-medium">Einladungs-E-Mail</p>
                <p className="text-blue-700 text-xs mt-1">
                  Eine Einladungs-E-Mail wird an <strong>{customer.email}</strong> versendet mit:
                </p>
              </div>
              <ul className="text-blue-700 text-xs space-y-1 ml-3">
                <li>✓ Link zum Passwort-Setup (gültig 24h)</li>
                <li>✓ Link zum Passwort-Reset</li>
                <li>✓ Zugang zu Verträgen, Dokumenten & mehr</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Abbrechen
              </Button>
              <Button 
                onClick={handleInvite}
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Einladung versenden
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}