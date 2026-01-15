import React from 'react';
import { Bell, Settings, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import { messageService } from '@/lib/services/messageService';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Get unread messages count with polling for notifications
  const { data: messagesData } = useQuery({
    queryKey: ['messages', 'unread-count', user?.id],
    queryFn: () => messageService.getAll({ limit: 200 }),
    enabled: !!user,
    refetchInterval: 30000, // Poll every 30 seconds for new messages
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retry: 1, // Retry once on failure
  });

  const unreadCount = React.useMemo(() => {
    if (!messagesData?.data || !user?.id) return 0;
    return messagesData.data.filter((m) => m.to_user === user.id && !m.read_at).length;
  }, [messagesData?.data, user?.id]);

  const handleNotifications = () => {
    navigate('/messages');
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  const handleProfile = () => {
    navigate('/settings');
  };

  const handleLogout = async () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-14 md:h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg md:text-xl font-semibold text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm text-muted-foreground truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs md:text-sm text-muted-foreground mr-2 md:mr-4 hidden sm:block">
          Hello, {user?.email?.split('@')[0] || 'Doctor'}
        </span>

        {/* AI Insights Notifications */}
        <NotificationBell />

        {/* Messages */}
        <button
          onClick={handleNotifications}
          className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors relative"
        >
          <Bell className="w-4 h-4 md:w-5 md:h-5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full text-[10px] font-bold flex items-center justify-center text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={handleSettings}
          className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors hidden sm:flex"
        >
          <Settings className="w-4 h-4 md:w-5 md:h-5 text-foreground" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-primary ml-1 md:ml-2 hover:opacity-80 transition-opacity">
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleProfile}>
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSettings}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
