import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

/**
 * Role-based route protection
 * allowedRoles: ['admin', 'manager', 'advisor']
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { currentUser, isLoadingAuth } = useAuth()

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Authentifizierung...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center p-6 bg-destructive/10 rounded-lg border border-destructive/20">
          <p className="font-semibold text-destructive mb-2">Zugriff verweigert</p>
          <p className="text-sm text-muted-foreground">
            Ihre Rolle ({currentUser.role}) hat keine Berechtigung für diese Seite.
          </p>
        </div>
      </div>
    )
  }

  return children
}