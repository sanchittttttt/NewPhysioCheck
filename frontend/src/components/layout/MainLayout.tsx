import { ReactNode } from 'react';
import { Sidebar, useSidebarWidth } from './Sidebar';
import { TopBar } from './TopBar';

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  const sidebarWidth = useSidebarWidth();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div 
        className="transition-all duration-300 pb-20 md:pb-0"
        style={{ marginLeft: sidebarWidth }}
      >
        <TopBar title={title} subtitle={subtitle} />
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
