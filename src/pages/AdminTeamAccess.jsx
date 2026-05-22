import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Shield, Users, Building2, Lock, LogOut, Settings } from 'lucide-react'
import UserManagementTab from '@/components/admin/UserManagementTab'
import RoleManagementTab from '@/components/admin/RoleManagementTab'
import CustomerAssignmentsTab from '@/components/admin/CustomerAssignmentsTab'
import DocumentAccessTab from '@/components/admin/DocumentAccessTab'
import AuditLogTab from '@/components/admin/AuditLogTab'

export default function AdminTeamAccess() {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  })

  // Admin-only
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="font-bold text-lg mb-2">Zugriff verweigert</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Diese Seite ist nur für Administratoren zugänglich.
            </p>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Zurück zum Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-4xl font-bold mb-2 text-[hsl(var(--primary))]">Team & Zugriffsrechte</h1>
        <p className="text-muted-foreground">
          Zentrale Verwaltung von Benutzern, Rollen und Zugriffsverwaltung
        </p>
      </div>

      {/* Admin Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Admin-Panel</p>
            <p className="text-xs text-muted-foreground mt-1">
              Alle Änderungen werden im Audit-Log protokolliert. Die Backend-Sicherheit durch guardDataAccess() und getUserVisibleData() bleibt immer aktiv.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Benutzer</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">Rollen</span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Kunden</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Dokumente</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Audit</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <UserManagementTab />
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <RoleManagementTab />
        </TabsContent>

        <TabsContent value="customers" className="mt-6">
          <CustomerAssignmentsTab />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <DocumentAccessTab />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}