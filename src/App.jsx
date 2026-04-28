import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Contracts from './pages/Contracts';
import Tasks from './pages/Tasks';
import Commissions from './pages/Commissions';
import Messages from './pages/Messages';
import Claims from './pages/Claims';
import Notifications from './pages/Notifications';
import Marketing from './pages/Marketing';
import Pipeline from './pages/Pipeline';
import PipelinePerformance from './pages/PipelinePerformance';
import Wiedervorlage from './pages/Wiedervorlage';
import EmailTemplates from './pages/EmailTemplates';

// Customer Portal
import PortalRoot from './pages/portal/PortalRoot';
import PortalOverview from './pages/portal/PortalOverview';
import PortalContracts from './pages/portal/PortalContracts';
import PortalClaims from './pages/portal/PortalClaims';
import PortalDocuments from './pages/portal/PortalDocuments';
import PortalMessages from './pages/portal/PortalMessages';
import PortalProfile from './pages/portal/PortalProfile';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kunden" element={<Customers />} />
        <Route path="/kunden/:id" element={<CustomerDetail />} />
        <Route path="/vertraege" element={<Contracts />} />
        <Route path="/aufgaben" element={<Tasks />} />
        <Route path="/provisionen" element={<Commissions />} />
        <Route path="/nachrichten" element={<Messages />} />
        <Route path="/schaden" element={<Claims />} />
        <Route path="/benachrichtigungen" element={<Notifications />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/pipeline-performance" element={<PipelinePerformance />} />
        <Route path="/wiedervorlage" element={<Wiedervorlage />} />
        <Route path="/email-templates" element={<EmailTemplates />} />
      </Route>
      {/* Customer Portal – separate layout, no broker sidebar */}
      <Route path="/portal" element={<PortalRoot />}>
        <Route index element={<PortalOverview />} />
        <Route path="vertraege" element={<PortalContracts />} />
        <Route path="schaden" element={<PortalClaims />} />
        <Route path="dokumente" element={<PortalDocuments />} />
        <Route path="nachrichten" element={<PortalMessages />} />
        <Route path="profil" element={<PortalProfile />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App