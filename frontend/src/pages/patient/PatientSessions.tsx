import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Eye, Activity, Target, TrendingUp, Loader2 } from 'lucide-react';
import { PatientLayout } from '@/components/layout/PatientLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { sessionService } from '@/lib/services/sessionService';
import { protocolService } from '@/lib/services/protocolService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Session, Protocol } from '@/types/api';

export default function PatientSessions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('30');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Fetch all sessions for current patient
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['sessions', 'patient-all'],
    queryFn: () => sessionService.getAll({}),
  });

  // Fetch protocols for protocol names - use getById for each session's protocol
  // (patients can access protocols via getById if they're assigned)
  const { data: protocolsData } = useQuery({
    queryKey: ['protocols', 'sessions', sessionsData?.data?.map((s: Session) => s.protocol_id).join(',') || ''],
    queryFn: async () => {
      if (!sessionsData?.data || sessionsData.data.length === 0) return [];
      // Get unique protocol IDs from sessions
      const protocolIds = [...new Set(sessionsData.data.map((s: Session) => s.protocol_id))];
      // Fetch each protocol by ID
      const protocolPromises = protocolIds.map(protocolId =>
        protocolService.getById(protocolId).catch(() => null)
      );
      const protocols = (await Promise.all(protocolPromises)).filter((p): p is Protocol => p !== null);
      return protocols;
    },
    enabled: !!sessionsData?.data && sessionsData.data.length > 0,
  });

  const sessions: Session[] = useMemo(() => sessionsData?.data || [], [sessionsData?.data]);
  const protocols: Protocol[] = useMemo(() => protocolsData || [], [protocolsData]);

  // Create protocol map
  const protocolMap = useMemo(() => {
    const map = new Map<string, Protocol>();
    protocols.forEach((p) => map.set(p.id, p));
    return map;
  }, [protocols]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((session) => {
        const protocol = protocolMap.get(session.protocol_id);
        return protocol?.title.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((session) => {
        if (statusFilter === 'completed') return session.status === 'completed';
        if (statusFilter === 'upcoming') return session.status === 'in_progress' || session.status === 'scheduled';
        if (statusFilter === 'missed') return session.status === 'missed' || session.status === 'incomplete';
        return true;
      });
    }

    // Apply time filter
    if (timeFilter !== 'all') {
      const days = parseInt(timeFilter);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      filtered = filtered.filter((session) => {
        const sessionDate = session.scheduled_date || (session.started_at ? session.started_at.split('T')[0] : null);
        if (!sessionDate) return false;
        return new Date(sessionDate) >= cutoffDate;
      });
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => {
      const aDate = a.scheduled_date || (a.started_at ? a.started_at.split('T')[0] : '');
      const bDate = b.scheduled_date || (b.started_at ? b.started_at.split('T')[0] : '');
      return bDate.localeCompare(aDate);
    });
  }, [sessions, searchTerm, statusFilter, timeFilter, protocolMap]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Generate accuracy chart data from session reps
  const getSessionChartData = (session: Session) => {
    if (!session.reps || session.reps.length === 0) {
      return [{ rep: 1, accuracy: 0 }];
    }

    // Group reps by exercise and calculate accuracy per rep
    return session.reps.map((rep, index) => ({
      rep: index + 1,
      accuracy: rep.form_quality || rep.accuracy_score || 0,
    }));
  };

  if (isLoading) {
    return (
      <PatientLayout title="Sessions" subtitle="View your past and upcoming sessions">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout title="Sessions" subtitle="View your past and upcoming sessions">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search sessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] md:w-[150px] text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[120px] md:w-[150px] text-sm">
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sessions - Cards on mobile, Table on desktop */}
      <div className="stat-card overflow-hidden">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No sessions found</p>
          </div>
        ) : (
          <>
            {/* Mobile: Card view */}
            <div className="md:hidden space-y-3">
              {filteredSessions.map((session) => {
                const protocol = protocolMap.get(session.protocol_id);
                return (
                  <div key={session.id} className="bg-secondary/30 rounded-lg p-3 border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{formatDate(session.started_at)}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(session.started_at)}</p>
                      </div>
                      <span
                        className={`pill text-[10px] ${session.status === 'completed'
                            ? 'pill-success'
                            : session.status === 'in_progress'
                              ? 'pill-primary'
                              : 'pill-danger'
                          }`}
                      >
                        {session.status === 'completed'
                          ? 'Completed'
                          : session.status === 'in_progress'
                            ? 'In Progress'
                            : 'Missed'}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mb-2">{protocol?.title || 'Unknown Protocol'}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {session.accuracy_avg !== null && <span>Accuracy: {Math.round(session.accuracy_avg)}%</span>}
                        {session.pain_score_post !== null && <span>Pain: {session.pain_score_post}/10</span>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSession(session)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: Table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="bg-secondary/30">
                    <th>Date</th>
                    <th>Time</th>
                    <th>Protocol</th>
                    <th>Status</th>
                    <th>Accuracy</th>
                    <th>Pain</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session) => {
                    const protocol = protocolMap.get(session.protocol_id);
                    const sessionDate = session.scheduled_date || (session.started_at ? session.started_at.split('T')[0] : '');
                    return (
                      <tr key={session.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="text-foreground font-medium">
                          {sessionDate ? formatDate(sessionDate) : 'N/A'}
                        </td>
                        <td className="text-muted-foreground">
                          {session.started_at ? formatTime(session.started_at) : 'Scheduled'}
                        </td>
                        <td className="text-foreground">{protocol?.title || 'Unknown Protocol'}</td>
                        <td>
                          <span
                            className={`pill ${session.status === 'completed'
                                ? 'pill-success'
                                : session.status === 'in_progress'
                                  ? 'pill-primary'
                                  : session.status === 'scheduled'
                                    ? 'pill-neutral'
                                    : 'pill-danger'
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
                                    : 'Missed'}
                          </span>
                        </td>
                        <td className="text-foreground">
                          {session.accuracy_avg !== null ? `${Math.round(session.accuracy_avg)}%` : '—'}
                        </td>
                        <td className="text-foreground">
                          {session.pain_score_post !== null ? `${session.pain_score_post} / 10` : '—'}
                        </td>
                        <td>
                          <Button variant="ghost" size="icon" onClick={() => setSelectedSession(session)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Session Details Modal */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-4 md:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-foreground">
                    {protocolMap.get(selectedSession.protocol_id)?.title || 'Unknown Protocol'}
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {formatDate(selectedSession.started_at)} at {formatTime(selectedSession.started_at)}
                  </p>
                </div>
                <span
                  className={`pill self-start ${selectedSession.status === 'completed' ? 'pill-success' : 'pill-danger'
                    }`}
                >
                  {selectedSession.status === 'completed' ? 'Completed' : 'Missed'}
                </span>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-2 md:gap-4">
                <div className="bg-secondary/50 rounded-lg p-3 md:p-4 text-center">
                  <Target className="w-5 h-5 md:w-6 md:h-6 text-primary mx-auto mb-1 md:mb-2" />
                  <p className="text-lg md:text-2xl font-bold text-foreground">
                    {selectedSession.accuracy_avg !== null ? Math.round(selectedSession.accuracy_avg) : 0}%
                  </p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">Accuracy</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3 md:p-4 text-center">
                  <Activity className="w-5 h-5 md:w-6 md:h-6 text-accent mx-auto mb-1 md:mb-2" />
                  <p className="text-lg md:text-2xl font-bold text-foreground">{selectedSession.reps?.length || 0}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">Reps</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3 md:p-4 text-center">
                  <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-success mx-auto mb-1 md:mb-2" />
                  <p className="text-lg md:text-2xl font-bold text-foreground">
                    {selectedSession.rom_delta !== null ? `${selectedSession.rom_delta > 0 ? '+' : ''}${Math.round(selectedSession.rom_delta)}°` : 'N/A'}
                  </p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">ROM</p>
                </div>
              </div>

              {/* Accuracy Chart */}
              {selectedSession.reps && selectedSession.reps.length > 0 && (
                <div>
                  <h4 className="text-xs md:text-sm font-medium text-muted-foreground mb-2">Accuracy Over Session</h4>
                  <div className="h-[150px] md:h-[200px] bg-secondary/30 rounded-lg p-2 md:p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getSessionChartData(selectedSession)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="rep"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={10}
                          tickFormatter={(v) => `${v}`}
                        />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[60, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="accuracy"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PatientLayout>
  );
}
