import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useSession } from '@/context/SessionContext';
import { ScheduleSessionDialog } from '@/components/doctor/ScheduleSessionDialog';
import { ChevronLeft, ChevronRight, Loader2, User, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Session } from '@/context/SessionContext';

const Sessions = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const { toast } = useToast();

  // Helper to get YYYY-MM-DD from a local Date object
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get start and end dates for the current month (as date strings YYYY-MM-DD)
  const monthStart = useMemo(() => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    return getLocalDateString(date);
  }, [currentMonth]);

  const monthEnd = useMemo(() => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    return getLocalDateString(date);
  }, [currentMonth]);

  // Fetch sessions from Context (Dummy Data)
  const { sessions: allSessions } = useSession();

  // Filter sessions (in a real app this would be an API call)
  const sessions = useMemo(() => {
    return allSessions.filter(s => {
      const sDate = s.date || s.scheduled_date || (s.started_at ? s.started_at.split('T')[0] : '');
      // Simple filter: include everything for now since we have limited dummy data
      // But strictly we should filter by current month
      return true;
    });
  }, [allSessions]);

  // no-op for now as we just read from context
  const isLoading = false;

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Add days from previous month
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({ date: prevDate, isCurrentMonth: false });
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const getSessionsForDate = (date: Date) => {
    const dateStr = getLocalDateString(date);
    return sessions.filter((s) => {
      // Use scheduled_date if available, otherwise started_at
      const sessionDateStr = s.scheduled_date || (s.started_at ? s.started_at.split('T')[0] : null);
      return sessionDateStr === dateStr;
    });
  };

  // Calculate stats from real data
  const sessionStats = useMemo(() => {
    return {
      completed: sessions.filter((s) => s.status === 'completed').length,
      upcoming: sessions.filter((s) => s.status === 'in_progress' || s.status === 'scheduled').length,
      missed: sessions.filter((s) => s.status === 'missed' || s.status === 'incomplete').length,
    };
  }, [sessions]);

  // Get today's sessions
  const today = new Date();
  const todayStr = getLocalDateString(today);
  const todaysSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Use scheduled_date if available, otherwise started_at
      const sessionDateStr = s.scheduled_date || (s.started_at ? s.started_at.split('T')[0] : null);
      return sessionDateStr === todayStr;
    });
  }, [sessions, todayStr]);

  const getSessionStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'calendar-event-completed';
      case 'in_progress':
      case 'scheduled':
        return 'calendar-event-upcoming';
      case 'incomplete':
      case 'missed':
        return 'calendar-event-missed';
      default:
        return 'calendar-event';
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'Scheduled';
    try {
      return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Scheduled';
    }
  };

  return (
    <MainLayout title="Sessions Calendar" subtitle="Manage your patient appointments.">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setScheduleDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Schedule Session
        </Button>
      </div>

      <ScheduleSessionDialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen} />

      <div className="flex gap-6 animate-fade-in">
        {/* Calendar */}
        <div className="flex-1 stat-card">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
                }
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <h3 className="text-lg font-semibold text-foreground">{monthName}</h3>
              <button
                onClick={() =>
                  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
                }
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <button
              onClick={() => setCurrentMonth(new Date())}
              className="text-primary text-sm font-medium"
            >
              Today
            </button>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
              <div key={day} className="text-center text-xs text-muted-foreground font-medium py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => {
                const daySessions = getSessionsForDate(day.date);
                const today = new Date();
                const isToday =
                  day.date.toDateString() === today.toDateString() && day.isCurrentMonth;

                const isSelected = selectedDate && day.date.toDateString() === selectedDate.toDateString();
                return (
                  <div
                    key={index}
                    onClick={() => day.isCurrentMonth && setSelectedDate(day.date)}
                    className={`calendar-cell ${!day.isCurrentMonth ? 'opacity-40' : 'cursor-pointer hover:bg-secondary/50'} ${isToday ? 'border-primary bg-primary/10' : ''
                      } ${isSelected ? 'ring-2 ring-primary' : ''}`}
                  >
                    <span
                      className={`text-sm ${isToday ? 'text-primary font-bold' : 'text-foreground'}`}
                    >
                      {day.date.getDate()}
                    </span>
                    {daySessions.slice(0, 3).map((session, idx) => (
                      <div
                        key={session.id}
                        className={`calendar-event ${getSessionStatusColor(session.status)}`}
                        title={`${session.started_at ? formatTime(session.started_at) : 'Scheduled'} - ${session.status === 'scheduled' ? 'Scheduled' : 'Session'}`}
                      >
                        {session.status === 'scheduled' ? 'Scheduled' : (session.started_at ? formatTime(session.started_at) : 'Scheduled')}
                      </div>
                    ))}
                    {daySessions.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{daySessions.length - 3} more
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar - Stats and Today's Schedule */}
        <div className="w-80 flex-shrink-0 space-y-6">
          {/* Session Statistics */}
          <div className="stat-card">
            <h3 className="text-lg font-semibold text-foreground mb-4">Session Statistics</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Completed</span>
                <span className="text-lg font-semibold text-foreground">{sessionStats.completed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Progress</span>
                <span className="text-lg font-semibold text-primary">{sessionStats.upcoming}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Missed</span>
                <span className="text-lg font-semibold text-destructive">{sessionStats.missed}</span>
              </div>
            </div>
          </div>

          {/* Selected Date's Schedule */}
          <div className="stat-card">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {selectedDate
                ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                : "Today's Schedule"}
            </h3>
            {(() => {
              const sessionsToShow = selectedDate
                ? getSessionsForDate(selectedDate)
                : todaysSessions;

              return sessionsToShow.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {selectedDate ? 'No sessions scheduled for this date' : 'No sessions scheduled for today'}
                </p>
              ) : (
                <div className="space-y-3">
                  {sessionsToShow.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 border border-border"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          Session
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.status === 'scheduled'
                            ? 'Scheduled'
                            : (session.started_at ? formatTime(session.started_at) : 'Scheduled')}
                        </p>
                      </div>
                      <span
                        className={`pill text-xs ${session.status === 'completed'
                          ? 'pill-success'
                          : session.status === 'in_progress' || session.status === 'scheduled'
                            ? 'pill-primary'
                            : 'pill-danger'
                          }`}
                      >
                        {session.status === 'completed'
                          ? 'Completed'
                          : session.status === 'in_progress'
                            ? 'In Progress'
                            : session.status === 'scheduled'
                              ? 'Scheduled'
                              : 'Missed'}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Show today
              </button>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Sessions;
