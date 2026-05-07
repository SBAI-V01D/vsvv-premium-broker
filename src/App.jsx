import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom'
import PageNotFound from './lib/PageNotFound'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import UserNotRegisteredError from '@/components/UserNotRegisteredError'

import AppLayout from './components/layout/AppLayout'
import RecoveryAppShell from './components/layout/RecoveryAppShell'
import UltraMinimalSafe from './pages/UltraMinimalSafe'
import Dashboard from './pages/Dashboard.jsx'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Customer360 from './pages/Customer360'
import Contracts from './pages/Contracts'
import Applications from './pages/Applications'
import Tasks from './pages/Tasks'
import Documents from './pages/Documents'
import EmailTemplates from './pages/EmailTemplates'
import EmailCampaigns from './pages/EmailCampaigns'
import StatusVerwaltung from './pages/StatusVerwaltung'
import CommissionsAndCourtage from './pages/CommissionsAndCourtage'
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

// Portal
import PortalRoot from './pages/portal/PortalRoot'
import PortalDashboard from './pages/portal/PortalDashboard.jsx'
import PortalContracts from './pages/portal/PortalContracts.jsx'
import PortalApplications from './pages/portal/PortalApplications.jsx'
import PortalDocuments from './pages/portal/PortalDocuments.jsx'
import PortalProfile from './pages/portal/PortalProfile.jsx'
import PortalSetup from './pages/portal/PortalSetup'
import PortalResetPassword from './pages/portal/PortalResetPassword'

const PortalRoutes = () => (
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

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth()
  const location = useLocation()

  // Portal routes are public — skip Base44 auth entirely
  const isPortalRoute = location.pathname.startsWith('/portal')
  if (isPortalRoute) {
    return <PortalRoutes />
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
    // For other auth errors, render recovery mode
    return <RecoveryRoutes />
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kunden" element={<Customers />} />
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
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  )
}

const RecoveryRoutes = () => {
  return (
    <Routes>
      <Route element={<RecoveryAppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kunden" element={<Customers />} />
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
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            {/* ULTRA-MINIMAL - ZERO DEPENDENCIES */}
            <Route path="/safe" element={<UltraMinimalSafe />} />
            
            {/* Portal routes - public, no auth required */}
            <PortalRoutes />
            
            {/* Main authenticated app with sidebar */}
            <AuthenticatedApp />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App