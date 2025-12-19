import { ReactNode } from 'react';
import { PatientSidebar, usePatientSidebarWidth } from './PatientSidebar';
import { PatientTopBar } from './PatientTopBar';

interface PatientLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function PatientLayout({ children, title, subtitle }: PatientLayoutProps) {
  const sidebarWidth = usePatientSidebarWidth();

  return (
    <div className="min-h-screen bg-background">
      <PatientSidebar />
      <div 
        className="transition-all duration-300 pb-20 md:pb-0"
        style={{ marginLeft: sidebarWidth }}
      >
        <PatientTopBar title={title} subtitle={subtitle} />
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
