/**
 * Notification Context
 * 
 * Manages notifications for critical AI insights and other alerts.
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { aiInsightsService, type AIInsight } from '@/lib/services/aiInsightsService';
import { getDemoUser } from '@/lib/demoAuth';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: 'critical-insight' | 'warning-insight' | 'info';
  title: string;
  message: string;
  patientId?: string;
  insightId?: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  criticalCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch critical insights and convert to notifications
  const refreshNotifications = async () => {
    const user = getDemoUser();
    if (!user) {
      setNotifications([]);
      return;
    }

    try {
      let patientIds: string[] = [];

      if (user.role === 'doctor') {
        // Get all patients for this doctor
        const { data: relationships } = await supabase
          .from('doctor_patients')
          .select('patient_id')
          .eq('doctor_id', user.id);
        
        patientIds = (relationships || []).map((r: any) => r.patient_id);
      } else {
        // Patient only sees their own insights
        patientIds = [user.id];
      }

      // Fetch critical and warning insights
      const allInsights: AIInsight[] = [];
      for (const patientId of patientIds) {
        const { data: critical } = await aiInsightsService.getAll({
          patient_id: patientId,
          severity: 'critical',
          include_read: false,
          limit: 10,
        });
        const { data: warnings } = await aiInsightsService.getAll({
          patient_id: patientId,
          severity: 'warning',
          include_read: false,
          limit: 5,
        });
        
        if (critical) allInsights.push(...critical);
        if (warnings) allInsights.push(...warnings);
      }

      // Convert insights to notifications
      const newNotifications: Notification[] = allInsights.map((insight) => ({
        id: `insight-${insight.id}`,
        type: insight.severity === 'critical' ? 'critical-insight' : 'warning-insight',
        title: insight.title,
        message: insight.description,
        patientId: insight.patient_id,
        insightId: insight.id,
        timestamp: new Date(insight.generated_at),
        read: insight.is_read,
      }));

      // Sort by timestamp (newest first)
      newNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setNotifications(newNotifications);
    } catch (error) {
      console.error('[NotificationContext] Error refreshing notifications:', error);
    }
  };

  // Listen for critical insight events
  useEffect(() => {
    const handleCriticalInsight = (event: CustomEvent) => {
      const { patientId, insights } = event.detail;
      
      // Create notifications for critical insights
      const newNotifications: Notification[] = insights.map((insight: AIInsight) => ({
        id: `insight-${insight.id}`,
        type: 'critical-insight' as const,
        title: insight.title,
        message: insight.description,
        patientId,
        insightId: insight.id,
        timestamp: new Date(),
        read: false,
      }));

      setNotifications((prev) => {
        // Avoid duplicates
        const existingIds = new Set(prev.map(n => n.id));
        const unique = newNotifications.filter(n => !existingIds.has(n.id));
        return [...unique, ...prev].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      });

      // Show toast notification
      insights.forEach((insight: AIInsight) => {
        toast.error(insight.title, {
          description: insight.description,
          duration: 8000,
          action: {
            label: 'View',
            onClick: () => {
              // Could navigate to patient detail page
              window.location.href = `/patients/${patientId}`;
            },
          },
        });
      });
    };

    window.addEventListener('critical-insight-generated', handleCriticalInsight as EventListener);

    return () => {
      window.removeEventListener('critical-insight-generated', handleCriticalInsight as EventListener);
    };
  }, []);

  // Initialize notifications on mount
  useEffect(() => {
    if (!isInitialized) {
      refreshNotifications();
      setIsInitialized(true);
    }

    // Refresh notifications every 30 seconds
    const interval = setInterval(() => {
      refreshNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [isInitialized]);

  const markAsRead = async (id: string) => {
    const notification = notifications.find(n => n.id === id);
    if (notification?.insightId) {
      await aiInsightsService.markAsRead(notification.insightId);
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = async () => {
    const user = getDemoUser();
    if (!user) return;

    // Mark all insights as read
    const unreadNotifications = notifications.filter(n => !n.read);
    for (const notif of unreadNotifications) {
      if (notif.insightId) {
        await aiInsightsService.markAsRead(notif.insightId);
      }
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const criticalCount = notifications.filter((n) => !n.read && n.type === 'critical-insight').length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        criticalCount,
        markAsRead,
        markAllAsRead,
        removeNotification,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

