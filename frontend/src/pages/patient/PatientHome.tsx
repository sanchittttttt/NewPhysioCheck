import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Clock, Flame, ChevronRight, MessageSquare, Loader2, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PatientLayout } from '@/components/layout/PatientLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { useProtocol } from '@/context/ProtocolContext';
import { useMessages } from '@/context/MessageContext';
import { useMemo, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Session, Protocol, Message, Assignment } from '@/types/api';

function CircularProgress({ value, size = 120 }: { value: number; size?: number }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-secondary"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="text-primary transition-all duration-500"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl md:text-2xl font-bold text-foreground">{value}%</span>
      </div>
    </div>
  );
}

export default function PatientHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { sessions: allSessions, updateSession } = useSession();
  const { protocols: allProtocols } = useProtocol();
  const { messages } = useMessages();

  // Filter sessions for this patient
  const sessions = useMemo(() => {
    return allSessions.filter(s => s.patient_id === user?.id);
  }, [allSessions, user?.id]);

  // Get protocol map for quick lookup
  const protocolMap = useMemo(() => {
    const map = new Map<string, Protocol>();
    // We can access all protocols in context because they are public/shared in this dummy mode
    allProtocols.forEach((p) => map.set(p.id, p));
    return map;
  }, [allProtocols]);

  // Derived data
  const protocols = allProtocols;
  const sessionsLoading = false; // Sync data

  // Fetch assignments from Supabase
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!user?.id) {
        setAssignments([]);
        setAssignmentsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('assignments')
          .select('*')
          .eq('patient_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[PatientHome] Assignments fetch error:', error);
          setAssignments([]);
        } else {
          // Map to Assignment type
          const mapped: Assignment[] = (data || []).map((a: any) => ({
            id: a.id,
            patient_id: a.patient_id,
            doctor_id: a.doctor_id,
            protocol_id: a.protocol_id,
            start_date: a.start_date,
            end_date: a.end_date,
            frequency_per_week: a.frequency_per_week,
            status: a.status,
            notes: a.notes,
            created_at: a.created_at,
          }));
          setAssignments(mapped);
        }
      } catch (e) {
        console.error('[PatientHome] Assignments exception:', e);
        setAssignments([]);
      } finally {
        setAssignmentsLoading(false);
      }
    };

    fetchAssignments();
  }, [user?.id]);

  // Find today's session (scheduled for today or in progress)
  // Priority: in_progress > scheduled (for today) > completed (today)
  const todaysSession = useMemo(() => {
    if (!sessions.length) return null;

    // Correctly get local date string YYYY-MM-DD
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Find sessions scheduled for today or in progress
    const todaysSessions = sessions
      .filter((s) => {
        // Primary check: scheduled_date is today
        if (s.scheduled_date) {
          const scheduledDateStr = s.scheduled_date.split('T')[0]; // handles both date and datetime
          if (scheduledDateStr === todayStr) {
            return s.status === 'scheduled' || s.status === 'in_progress' || s.status === 'completed';
          }
        }

        // Fallback: started today (for in_progress or completed sessions without a scheduled_date)
        if (s.started_at) {
          const started = new Date(s.started_at);
          const startedY = started.getFullYear();
          const startedM = String(started.getMonth() + 1).padStart(2, '0');
          const startedD = String(started.getDate()).padStart(2, '0');
          const startedStr = `${startedY}-${startedM}-${startedD}`;

          return startedStr === todayStr && (s.status === 'in_progress' || s.status === 'completed');
        }

        return false;
      })
      .sort((a, b) => {
        // Sort by status priority: in_progress > scheduled > completed
        const statusPriority = { 'in_progress': 0, 'scheduled': 1, 'completed': 2 };
        const priorityDiff = (statusPriority[a.status] || 3) - (statusPriority[b.status] || 3);
        if (priorityDiff !== 0) return priorityDiff;
        // Then by scheduled_date or started_at (string compare YYYY-MM-DD)
        const aDate = a.scheduled_date ? a.scheduled_date.split('T')[0] : (a.started_at ? a.started_at.split('T')[0] : '');
        const bDate = b.scheduled_date ? b.scheduled_date.split('T')[0] : (b.started_at ? b.started_at.split('T')[0] : '');
        return aDate.localeCompare(bDate);
      });

    return todaysSessions[0] || null;
  }, [sessions]);

  // Calculate overall progress (adherence)
  const progress = useMemo(() => {
    if (!sessions.length) return 0;
    const completed = sessions.filter((s) => s.status === 'completed').length;
    return Math.round((completed / sessions.length) * 100);
  }, [sessions]);

  // Calculate sessions this week
  const sessionsThisWeek = useMemo(() => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekSessions = sessions.filter((s) => {
      const sessionDate = new Date(s.started_at);
      return sessionDate >= weekStart;
    });

    return {
      completed: weekSessions.filter((s) => s.status === 'completed').length,
      total: weekSessions.length,
    };
  }, [sessions]);

  // Calculate streak (consecutive days with completed sessions)
  const streak = useMemo(() => {
    if (!sessions.length) return 0;

    const completedSessions = sessions
      .filter((s) => s.status === 'completed')
      .map((s) => new Date(s.started_at).toDateString())
      .filter((date, index, arr) => arr.indexOf(date) === index) // Unique dates
      .sort()
      .reverse();

    if (!completedSessions.length) return 0;

    let count = 0;
    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    for (let i = 0; i < completedSessions.length; i++) {
      const targetDate =
        i === 0
          ? today
          : new Date(yesterday.getTime() - i * 24 * 60 * 60 * 1000).toDateString();
      if (completedSessions[i] === targetDate) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }, [sessions]);

  // Get active protocols from assignments and sessions
  const activeProtocols = useMemo(() => {
    // Get protocol IDs from assignments
    const assignmentProtocolIds = assignments.map(a => a.protocol_id);

    // Also get protocol IDs from sessions as fallback
    const sessionProtocolIds = sessions.map(s => s.protocol_id);

    // Combine and dedupe
    const allIds = [...new Set([...assignmentProtocolIds, ...sessionProtocolIds])];

    return protocols
      .filter(p => allIds.includes(p.id))
      .slice(0, 3);
  }, [sessions, protocols, assignments]);

  // Get upcoming sessions (next 4) - includes scheduled and in_progress
  // Use scheduled_date if available, otherwise started_at
  const upcomingSessions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return sessions
      .filter((s) => {
        // Use scheduled_date if available, otherwise started_at
        const sessionDateStr = s.scheduled_date || (s.started_at ? s.started_at.split('T')[0] : null);
        if (!sessionDateStr) return false;

        const sessionDate = new Date(sessionDateStr);
        sessionDate.setHours(0, 0, 0, 0);

        // Include scheduled or in_progress sessions for today or future
        return sessionDate >= today && (s.status === 'scheduled' || s.status === 'in_progress');
      })
      .sort((a, b) => {
        const aDate = a.scheduled_date || (a.started_at ? a.started_at.split('T')[0] : '');
        const bDate = b.scheduled_date || (b.started_at ? b.started_at.split('T')[0] : '');
        return aDate.localeCompare(bDate);
      })
      .slice(0, 4);
  }, [sessions]);

  // Get all completed sessions (for history) - sorted by date, newest first
  const completedSessions = useMemo(() => {
    return sessions
      .filter((s) => s.status === 'completed')
      .sort((a, b) => {
        const aDate = a.started_at || a.created_at || '';
        const bDate = b.started_at || b.created_at || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .slice(0, 10); // Show last 10 completed sessions
  }, [sessions]);

  // Choose a session to start: today's session if present, otherwise the next upcoming
  const sessionToStart = useMemo(() => {
    if (todaysSession) return todaysSession;
    if (upcomingSessions.length) return upcomingSessions[0];
    return null;
  }, [todaysSession, upcomingSessions]);

  // Get recent messages from doctor
  const recentMessages = useMemo(() => {
    if (!messages.length || !user?.id) return [];

    // Get messages not from current user (doctor messages)
    return messages
      .filter((m) => m.from_user !== user.id)
      .slice(0, 3)
      .reverse();
  }, [messages, user?.id]);

  const handleStartSession = async () => {
    if (sessionToStart) {
      const target = sessionToStart;
      // If session is scheduled, start it first
      if (target.status === 'scheduled') {
        try {
          // Use context update instead of service
          updateSession(target.id, {
            status: 'in_progress',
            started_at: new Date().toISOString()
          });

          navigate(
            `/patient/session/active?protocol_id=${target.protocol_id}&session_id=${target.id}`
          );
        } catch (error) {
          console.error('Failed to start session:', error);
          navigate(
            `/patient/session/active?protocol_id=${target.protocol_id}&session_id=${target.id}`
          );
        }
      } else {
        navigate(
          `/patient/session/active?protocol_id=${target.protocol_id}&session_id=${target.id}`
        );
      }
    } else {
      navigate('/patient/sessions');
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sessionDate = new Date(date);
      sessionDate.setHours(0, 0, 0, 0);

      if (sessionDate.getTime() === today.getTime()) {
        return 'Today';
      }

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (sessionDate.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
      }

      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  if (sessionsLoading) {
    return (
      <PatientLayout title="Loading..." subtitle="Please wait">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PatientLayout>
    );
  }

  const protocol = todaysSession ? protocolMap.get(todaysSession.protocol_id) : null;
  const protocolTitle = todaysSession
    ? (protocol?.title || 'Unknown Protocol')
    : 'No session scheduled';

  return (
    <PatientLayout title={`Hello, ${user?.email?.split('@')[0] || 'Patient'}`} subtitle="Here's your rehab plan for today">
      {/* Top row - Today's Session & Overall Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
        {/* Today's Session */}
        <div className="stat-card-highlight flex flex-col">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h3 className="text-base md:text-lg font-semibold text-foreground">Today's Session</h3>
            <span
              className={`pill text-[10px] md:text-xs ${todaysSession
                ? todaysSession.status === 'completed'
                  ? 'pill-success'
                  : 'pill-primary'
                : 'pill-neutral'
                }`}
            >
              {todaysSession ? (todaysSession.status === 'completed' ? 'Completed' : 'Due') : 'None'}
            </span>
          </div>

          <div className="flex-1">
            {todaysSession ? (
              <>
                <p className="text-xs md:text-sm text-muted-foreground mb-1">
                  {formatDate(todaysSession.scheduled_date || todaysSession.started_at || '')}
                </p>
                <p className="text-lg md:text-xl font-semibold text-foreground mb-1">{protocolTitle}</p>
                <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 mb-3 md:mb-4">
                  <Clock className="w-3 h-3 md:w-4 md:h-4" />
                  {todaysSession.started_at ? formatTime(todaysSession.started_at) : 'Scheduled'}
                </p>
              </>
            ) : sessionToStart ? (
              <>
                <p className="text-xs md:text-sm text-muted-foreground mb-1">
                  Next: {formatDate(sessionToStart.scheduled_date || sessionToStart.started_at || '')}
                </p>
                <p className="text-lg md:text-xl font-semibold text-foreground mb-1">
                  {protocolMap.get(sessionToStart.protocol_id)?.title || 'Upcoming Session'}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 mb-3 md:mb-4">
                  <Clock className="w-3 h-3 md:w-4 md:h-4" />
                  Scheduled
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mb-3 md:mb-4">No session scheduled for today</p>
            )}
          </div>

          <Button
            className="w-full mt-auto gap-2"
            size="lg"
            onClick={handleStartSession}
            disabled={!sessionToStart || sessionToStart.status === 'completed'}
          >
            <Play className="w-4 h-4 md:w-5 md:h-5" />
            {sessionToStart && sessionToStart.status === 'completed' ? 'Session Completed' : 'Start Session'}
          </Button>
        </div>

        {/* Overall Progress */}
        <div className="stat-card flex flex-col items-center justify-center py-6">
          <h3 className="text-base md:text-lg font-semibold text-foreground mb-4 self-start">Overall Progress</h3>

          <CircularProgress value={progress} size={100} />

          <div className="mt-4 text-center space-y-1">
            <p className="text-xs md:text-sm text-muted-foreground">
              Sessions this week:{' '}
              <span className="text-foreground font-medium">
                {sessionsThisWeek.completed} / {sessionsThisWeek.total}
              </span>
            </p>
            <p className="text-xs md:text-sm text-primary flex items-center justify-center gap-1">
              <Flame className="w-3 h-3 md:w-4 md:h-4" />
              Streak: {streak} days
            </p>
          </div>
        </div>
      </div>

      {/* Middle row - Active Protocols & Upcoming Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
        {/* Active Protocols */}
        <div className="stat-card">
          <h3 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4">Active Protocols</h3>

          {activeProtocols.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active protocols</p>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {activeProtocols.map((protocol) => {
                const protocolSessions = sessions.filter((s) => s.protocol_id === protocol.id);
                const completed = protocolSessions.filter((s) => s.status === 'completed').length;
                const total = protocolSessions.length;

                return (
                  <div key={protocol.id} className="bg-secondary/50 rounded-lg p-3 md:p-4 border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-foreground text-sm md:text-base truncate">{protocol.title}</h4>
                        <p className="text-xs md:text-sm text-muted-foreground">{protocol.notes || 'No description'}</p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>
                          {completed} / {total}
                        </span>
                      </div>
                      <Progress value={total > 0 ? (completed / total) * 100 : 0} className="h-1.5 md:h-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Sessions */}
        <div className="stat-card">
          <h3 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4">Upcoming Sessions</h3>

          {upcomingSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming sessions</p>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {upcomingSessions.map((session) => {
                const protocol = protocolMap.get(session.protocol_id);
                const sessionDate = session.scheduled_date || (session.started_at ? session.started_at.split('T')[0] : '');
                return (
                  <div key={session.id} className="flex items-center justify-between py-2 md:py-3 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs md:text-sm font-medium text-foreground">
                          {formatDate(sessionDate)}
                        </span>
                        <span className="text-xs md:text-sm text-muted-foreground">
                          {session.started_at ? formatTime(session.started_at) : 'Scheduled'}
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">{protocol?.title || 'Unknown Protocol'}</p>
                    </div>
                    <span
                      className={`pill text-[10px] md:text-xs ml-2 ${session.status === 'completed'
                        ? 'pill-success'
                        : session.status === 'in_progress'
                          ? 'pill-primary'
                          : session.status === 'scheduled'
                            ? 'pill-neutral'
                            : 'pill-warning'
                        }`}
                    >
                      {session.status === 'completed'
                        ? 'Completed'
                        : session.status === 'in_progress'
                          ? 'In Progress'
                          : session.status === 'scheduled'
                            ? 'Scheduled'
                            : session.status === 'missed'
                              ? 'Missed'
                              : 'Upcoming'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Session History - All Completed Sessions */}
      <div className="stat-card mb-4 md:mb-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="text-base md:text-lg font-semibold text-foreground">Session History</h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary text-xs md:text-sm"
            onClick={() => navigate('/patient/sessions')}
          >
            <span className="hidden sm:inline">View all sessions</span>
            <span className="sm:hidden">View all</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {completedSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed sessions yet. Complete your first session to see it here!</p>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {completedSessions.map((session) => {
              const protocol = protocolMap.get(session.protocol_id);
              const sessionDate = session.started_at ? session.started_at.split('T')[0] : session.created_at?.split('T')[0] || '';
              return (
                <div key={session.id} className="flex items-center justify-between py-2 md:py-3 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs md:text-sm font-medium text-foreground">
                        {formatDate(sessionDate)}
                      </span>
                      {session.started_at && (
                        <span className="text-xs md:text-sm text-muted-foreground">
                          {formatTime(session.started_at)}
                        </span>
                      )}
                      {session.pain_score_post !== null && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/50 text-muted-foreground">
                          Pain: {session.pain_score_post}/10
                        </span>
                      )}
                      {session.rom_delta !== null && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success">
                          ROM: +{session.rom_delta}°
                        </span>
                      )}
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">
                      {protocol?.title || 'Unknown Protocol'}
                    </p>
                  </div>
                  <span className="pill pill-success text-[10px] md:text-xs ml-2">
                    Completed
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom row - Recent Feedback */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="text-base md:text-lg font-semibold text-foreground">Recent Feedback</h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary text-xs md:text-sm"
            onClick={() => navigate('/patient/messages')}
          >
            <span className="hidden sm:inline">View all messages</span>
            <span className="sm:hidden">View all</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {recentMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent messages</p>
        ) : (
          <div className="space-y-3">
            {recentMessages.map((message) => (
              <div key={message.id} className="flex gap-2 md:gap-3">
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3 md:w-4 md:h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="message-bubble message-bubble-incoming">
                    <p className="text-xs md:text-sm text-foreground">{message.text}</p>
                  </div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 md:p-4 bg-primary/10 rounded-lg border border-primary/20 text-center">
          <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-primary mx-auto mb-2" />
          <p className="text-xs md:text-sm text-foreground font-medium">Keep up the great work!</p>
          <p className="text-[10px] md:text-xs text-muted-foreground">Stay consistent with your exercises.</p>
        </div>
      </div>
    </PatientLayout>
  );
}
