import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PortalLayout from './PortalLayout';

export default function PortalRoot() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(u => setUser(u))
      .catch(() => base44.auth.redirectToLogin('/portal'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Wird geladen...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <PortalLayout user={user} />;
}