import { useState, useEffect } from 'react';
import { Home, Users, FileText, Calendar, MessageSquare, BarChart3, Settings, Menu, X } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const navItems = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: Users, label: 'Patients', path: '/patients' },
  { icon: FileText, label: 'Protocol Builder', path: '/protocol-builder' },
  { icon: Calendar, label: 'Sessions', path: '/sessions' },
  { icon: MessageSquare, label: 'Messages', path: '/messages' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      } else if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-sidebar border-t border-sidebar-border flex items-center justify-around z-50 md:hidden">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex flex-col items-center gap-1 px-2 py-2 text-muted-foreground transition-colors"
            activeClassName="text-primary"
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px]">{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>

      {/* Desktop/Tablet Sidebar */}
      <aside className={`
        fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex-col z-50
        hidden md:flex transition-all duration-300
        ${isCollapsed ? 'w-16' : 'w-60'}
      `}>
        {/* Logo */}
        <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary-foreground" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-semibold text-foreground">PhysioCheck</h1>
              <p className="text-xs text-muted-foreground">Care Home Portal</p>
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`mx-auto mb-2 ${isCollapsed ? '' : 'ml-auto mr-3'}`}
        >
          {isCollapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </Button>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={`nav-item ${isCollapsed ? 'justify-center px-2' : ''}`}
              activeClassName="nav-item-active"
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Settings at bottom */}
        <div className="px-2 pb-4">
          <NavLink
            to="/settings"
            className={`nav-item ${isCollapsed ? 'justify-center px-2' : ''}`}
            activeClassName="nav-item-active"
            title={isCollapsed ? 'Settings' : undefined}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span>Settings</span>}
          </NavLink>
        </div>
      </aside>
    </>
  );
}

export function useSidebarWidth() {
  const [width, setWidth] = useState(240);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setWidth(0);
      } else if (window.innerWidth < 1024) {
        setWidth(64);
      } else {
        setWidth(240);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
}
