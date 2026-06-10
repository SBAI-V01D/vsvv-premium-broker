import React from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom'
import PageNotFound from './lib/PageNotFound'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import UserNotRegisteredError from '@/components/UserNotRegisteredError'
import ErrorBoundary from '@/components/ErrorBoundary'
import ScrollToTop from './lib/ScrollToTop'

import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard.jsx'
import CustomerIntelligenceWorkspace from './pages/CustomerIntelligenceWorkspace'
import CustomerDetail from './pages/CustomerDetail'
import Customer360 from './pages/Customer360'
import NewCustomers from './pages/NewCustomers'
import Contracts from './pages/Contracts'
import Applications from './pages/Applications'
import Tasks from './pages/Tasks.jsx'
import Documents from './pages/Documents'
import EmailTemplates from './pages/EmailTemplates'
import EmailCampaigns from './pages/EmailCampaigns'
import StatusVerwaltung from './pages/StatusVerwaltung'
import CommissionsAndCourtage from './pages/CommissionsAndCourtage.jsx'
import BeratungOrganisation from './pages/BeratungOrganisation'
import SystemLogs from './pages/SystemLogs'
import FinanceDashboard from './pages/FinanceDashboard'
import CEODashboard from './components/ceo/CEODashboard'
import CEOCockpit from './pages/CEOCockpit'
import AdvancedDashboard from './pages/AdvancedDashboard'
import ExecutionMode from './pages/ExecutionMode'
import SalesAutopilot from './pages/SalesAutopilot'
import Leads from './pages/Leads'
import CoverageIntelligence from './pages/CoverageIntelligence'
import AdminLogs from './pages/AdminLogs'
import Partners from './pages/Partners'
import PartnerDetail from './pages/PartnerDetail'
import Verkaufschancen from './pages/Verkaufschancen'
import Vertragsablaeufe from './pages/Vertragsablaeufe'
import AdminTeamAccess from './pages/AdminTeamAccess'
import AdvisoryDossier from './pages/AdvisoryDossier'
import AdminEnterpriseControlCenter from './pages/AdminEnterpriseControlCenter'
import KiAnalyseVerbesserungen from './pages/KiAnalyseVerbesserungen'
import BrokerReporting from './pages/BrokerReporting'
import EnterpriseAudit from './pages/EnterpriseAudit'
import EnterpriseSystemCheck from './pages/EnterpriseSystemCheck'
import InsuranceLearningCenter from './pages/InsuranceLearningCenter'
import DocumentExtractor from './pages/DocumentExtractor'
import Ausschreibungen from './pages/Ausschreibungen'
import AusschreibungDetail from './pages/AusschreibungDetail'
import VersichererDBPage from './pages/VersichererDBPage'
import KrankenkassenVergleich from './pages/KrankenkassenVergleich'
import TestKrankenkassenVergleich from './pages/TestKrankenkassenVergleich'
import ComplianceSchreiben from './pages/ComplianceSchreiben'
import ChatExport from './pages/ChatExport'
import ArchiveDownload from './pages/ArchiveDownload'

// Portal
import PortalRoot from './pages/portal/PortalRoot'
import PortalDashboard from './pages/portal/PortalDashboard.jsx'
import PortalContracts from './pages/portal/PortalContracts.jsx'
import PortalApplications from './pages/portal/PortalApplications.jsx'
import PortalDocuments from './pages/portal/PortalDocuments.jsx'
import PortalProfile from './pages/portal/PortalProfile.jsx'
import PortalSetup from './pages/portal/PortalSetup'
import PortalResetPassword from './pages/portal/PortalResetPassword'

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth()
  const location = useLocation()

  // Portal routes are public — skip Base44 auth entirely
  const isPortalRoute = location.pathname.startsWith('/portal')
  if (isPortalRoute) {
    return (
      <Routes>
        <Route path="/portal/setup" element={<PortalSetup />} />
        <Route path="/portal/reset-password" element={<PortalResetPassword />} />
        <Route path="/portal" element={<PortalRoot />}>
          <Route index element={<PortalDashboard />} />
          <Route path="vertraege" element={<PortalContracts />} />
          <Route path="antraege" element={<PortalApplications />} />
          <Route path="dokumente" element={<PortalDocuments />} />
          <Route path="profil" element={<PortalProfile />} />
          <Route path="dashboard" element={<PortalDashboard />} />
        </Route>
      </Routes>
    )
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Laden...</p>
        </div>
      </div>
    )
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />
    } else if (authError.type === 'auth_required') {
      navigateToLogin()
      return null
    }
    return <UserNotRegisteredError />
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kunden" element={<CustomerIntelligenceWorkspace />} />
        <Route path="/neukunden" element={<NewCustomers />} />
        <Route path="/kunden/:id" element={<CustomerDetail />} />
        <Route path="/kunden/:customerId/360" element={<Customer360 />} />
        <Route path="/vertraege" element={<Contracts />} />
        <Route path="/antraege" element={<Applications />} />
        <Route path="/aufgaben" element={<Tasks />} />
        <Route path="/dokumente" element={<Documents />} />
        <Route path="/email-templates" element={<EmailTemplates />} />
        <Route path="/email-kampagnen" element={<EmailCampaigns />} />
        <Route path="/status-verwaltung" element={<StatusVerwaltung />} />
        <Route path="/provisionen-courtagen" element={<CommissionsAndCourtage />} />
        <Route path="/berater-organisation" element={<BeratungOrganisation />} />
        <Route path="/finanz-dashboard" element={<FinanceDashboard />} />
        <Route path="/ceo-dashboard" element={<CEODashboard />} />
        <Route path="/ceo-cockpit" element={<CEOCockpit />} />
        <Route path="/advanced-dashboard" element={<AdvancedDashboard />} />
        <Route path="/execution-mode" element={<ExecutionMode />} />
        <Route path="/sales-autopilot" element={<SalesAutopilot />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/coverage-intelligence" element={<CoverageIntelligence />} />
        <Route path="/system-logs" element={<SystemLogs />} />
        <Route path="/admin-logs" element={<AdminLogs />} />
        <Route path="/partner" element={<Partners />} />
        <Route path="/partner/:id" element={<PartnerDetail />} />
        <Route path="/verkaufschancen" element={<Verkaufschancen />} />
        <Route path="/vertragsablaeufe" element={<Vertragsablaeufe />} />
        <Route path="/admin/team-zugriffsrechte" element={<AdminTeamAccess />} />
        {/* AdvisoryDossierEngine — Phase 1 — Admin-Only */}
        <Route path="/beratungsdossier" element={<AdvisoryDossier />} />
        <Route path="/admin/enterprise-control-center" element={<AdminEnterpriseControlCenter />} />
        <Route path="/reporting" element={<BrokerReporting />} />
        <Route path="/admin/enterprise-audit" element={<EnterpriseAudit />} />
        <Route path="/admin/insurance-learning" element={<InsuranceLearningCenter />} />
        <Route path="/dokument-extraktor" element={<DocumentExtractor />} />
        <Route path="/ausschreibungen" element={<Ausschreibungen />} />
        <Route path="/ausschreibungen/:id" element={<AusschreibungDetail />} />
        <Route path="/ausschreibungen/versicherer" element={<VersichererDBPage />} />
        <Route path="/krankenkassen-vergleich" element={<KrankenkassenVergleich />} />
        <Route path="/test/kkv" element={<TestKrankenkassenVergleich />} />
        <Route path="/compliance-schreiben" element={<ComplianceSchreiben />} />
        <Route path="/chat-export" element={<ChatExport />} />
        <Route path="/archive-download" element={<ArchiveDownload />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  )
}

function App() {
  React.useEffect(() => {
    // Clear localStorage recovery flags only
    localStorage.removeItem('recovery_mode_enabled')
    localStorage.removeItem('bypass_visibility')
    
    // Force reload Krankenkassenvergleich page cache
    if (window.location.pathname === '/krankenkassen-vergleich') {
      sessionStorage.setItem('kkv_cache_buster', Date.now().toString())
    }
  }, [])

  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <Routes>
              <Route path="*" element={<AuthenticatedApp />} />
            </Routes>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App