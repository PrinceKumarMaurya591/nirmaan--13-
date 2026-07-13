import { SubcontractorView } from './components/SubcontractorView';
import React from 'react';
import { AppProvider, useAppContext } from './store';
import { Layout } from './components/Layout';
import { MobileLayout } from './components/MobileLayout';
import { AdminDashboard } from './components/AdminDashboard';
import { ProjectView } from './components/ProjectView';
import { MunshiEntry } from './components/MunshiEntry';
import { MobileHome } from './components/MobileHome';
import { MobileSettings } from './components/MobileSettings';
import { CreateProject } from './components/CreateProject';
import { UserManagement } from './components/UserManagement';
import { PaymentDashboard } from './components/PaymentDashboard';
import { Login } from './components/Login';
import { UserManual } from './components/UserManual';
import { RecycleBinView } from './components/RecycleBinView';
import { ApprovalDashboard } from './components/ApprovalDashboard';
import { DocumentLedgerView } from './components/DocumentLedgerView';
import { MobileSitePhotosView } from './components/MobileSitePhotosView';

import { ToastManager } from './components/ToastManager';
import { InstallPrompt } from './components/InstallPrompt';

function MainContent() {
  const { state } = useAppContext();
  
  if (state.currentView === 'dashboard') return <AdminDashboard />;
  if (state.currentView === 'project') return <ProjectView />;
  if (state.currentView === 'create_project') return <CreateProject />;
  if (state.currentView === 'user_management') return <UserManagement />;
  if (state.currentView === 'payment_dashboard') return <PaymentDashboard />;
  if (state.currentView === 'munshi_entry') return <MunshiEntry />;
  if (state.currentView === 'mobile_home') return <MobileHome />;
  if (state.currentView === 'mobile_settings') return <MobileSettings />;
  if (state.currentView === 'user_manual') return <UserManual />;
  if (state.currentView === 'recycle_bin') return <RecycleBinView />;
  if (state.currentView === 'approval_requests') return <ApprovalDashboard />;
  if (state.currentView === 'document_ledger') return <DocumentLedgerView />;
  if (state.currentView === 'site_photos') return <MobileSitePhotosView />;
  if (state.currentView === 'subcontractor_view') return <SubcontractorView />;
  
  return null;
}

function AppContent() {
  const { state } = useAppContext();
  const [isMobileScreen, setIsMobileScreen] = React.useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);


    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (!state.currentUser) {
    return <Login />;
  }

  const isMobileRole = state.currentRole === 'Munshi' || state.currentRole === 'Site Incharge';

  // Determine layout based on auto detection
  const useMobileLayout = isMobileScreen || isMobileRole;

  if (useMobileLayout) {
    return (
      <MobileLayout>
        <MainContent />
      </MobileLayout>
    );
  }

  return (
    <Layout>
      <MainContent />
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
      <ToastManager />
      <InstallPrompt />
    </AppProvider>
  );
}
