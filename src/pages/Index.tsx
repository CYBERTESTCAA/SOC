import { useState } from 'react';
import { Header } from '@/components/soc/Header';
import { Sidebar } from '@/components/soc/Sidebar';
import { GlobalFilterBar } from '@/components/soc/GlobalFilterBar';
import { DashboardView } from '@/components/soc/DashboardView';
import { IncidentsView } from '@/components/soc/IncidentsView';
import { SignInsView } from '@/components/soc/SignInsView';
import { DevicesView } from '@/components/soc/DevicesView';
import { ExchangeView } from '@/components/soc/ExchangeView';
import { ReportsView } from '@/components/soc/ReportsView';
import { SettingsView } from '@/components/soc/SettingsView';
import { ProfileView } from '@/components/soc/ProfileView';
import { InvestigationView } from '@/components/soc/InvestigationView';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSOC } from '@/context/SOCContext';

const Index = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const { refreshAll } = useSOC();
  
  // Raccourcis clavier globaux
  useKeyboardShortcuts(setActiveView, refreshAll);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView onViewChange={setActiveView} />;
      case 'incidents':
        return <IncidentsView />;
      case 'signins':
        return <SignInsView />;
      case 'devices':
        return <DevicesView />;
      case 'exchange':
        return <ExchangeView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      case 'profile':
        return <ProfileView />;
      case 'investigation':
        return <InvestigationView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-background scrollbar-soc">
      <Header onViewChange={setActiveView} />
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      
      <div className="lg:ml-64">
        {/* Global Filter Bar - visible on data views */}
        {['incidents', 'signins', 'devices', 'exchange'].includes(activeView) && (
          <GlobalFilterBar />
        )}
        
        <main className="pt-4 pb-8 px-4 lg:px-8">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default Index;
