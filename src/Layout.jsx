import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Sidebar from './components/sidebar/Sidebar';
import TopBar from './components/sidebar/TopBar';
import MobileInstallBanner from './components/mobile/MobileInstallBanner';
import MobileBottomNav from './components/mobile/MobileBottomNav';

export default function Layout({ children, currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Página pública do funcionário: sem sidebar/topbar
  if (currentPageName === 'ContagemTarefa') {
    return <>{children}</>;
  }

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => setCollapsed(!collapsed);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <style>{`
        :root {
          --sidebar-width: ${collapsed ? '70px' : '260px'};
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .dark .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #475569;
        }
      `}</style>
      
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <TopBar collapsed={collapsed} onToggle={toggleSidebar} />
      <MobileBottomNav currentPage={currentPageName} onMenuClick={toggleSidebar} />
      
      <main className={cn(
        'pt-16 min-h-screen transition-all duration-300',
        collapsed ? 'lg:pl-[70px]' : 'lg:pl-[260px]'
      )}>
        <div className="p-4 lg:p-6 pb-24 lg:pb-6">
          {children}
        </div>
      </main>

      <MobileInstallBanner />
    </div>
  );
}