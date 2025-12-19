import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Flame, CheckCircle, Loader2 } from 'lucide-react';
import { PatientLayout } from '@/components/layout/PatientLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { sessionService } from '@/lib/services/sessionService';
import { protocolService } from '@/lib/services/protocolService';
import type { Session, Protocol } from '@/types/api';

function CircularProgress({ value, size = 80 }: { value: number; size?: number }) {
  const strokeWidth = 6;
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
        <span className="text-base md:text-xl font-bold text-foreground">{value}%</span>
      </div>
    </div>
  );
}

function MiniCalendar({ sessions }: { sessions: Session[] }) {
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getStatusForDay = (day: number | null): 'completed' | 'missed' | 'upcoming' | null => {
    if (!day) return null;
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const session = sessions.find((s) => {
      const sessionDate = new Date(s.started_at).toISOString().split('T')[0];
      return sessionDate === dateStr;
    });
    if (!session) return null;
    if (session.status === 'completed') return 'completed';
    if (session.status === 'incomplete') return 'missed';
    if (session.status === 'in_progress') return 'upcoming';
    return null;
  };

  return (
    <div className="grid grid-cols-7 gap-0.5 md:gap-1">
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
        <div key={i} className="text-center text-[10px] md:text-xs text-muted-foreground py-1">
          {d}
        </div>
      ))}
      {days.map((day, idx) => {
        const status = getStatusForDay(day);
        return (
          <div
            key={idx}
            className={`
              w-6 h-6 md:w-8 md:h-8 flex items-center justify-center text-[10px] md:text-xs rounded-md
              ${!day
                ? ''
                : status === 'completed'
                ? 'bg-success/20 text-success'
                : status === 'missed'
                ? 'bg-destructive/20 text-destructive'
                : status === 'upcoming'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground'}
              ${day === today.getDate() ? 'ring-1 md:ring-2 ring-primary' : ''}
            `}
          >
            {day}
          </div>
        );
      })}
    </div>
  );
}

export default function PatientProgress() {
  const [dateRange, setDateRange] = useState('30');
  const [protocolFilter, setProtocolFilter] = useState('all');

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['sessions', 'patient-progress'],
    queryFn: () => sessionService.getAll({}),
  });

  const { data: protocolsData } = useQuery({
    queryKey: ['protocols', 'all'],
    queryFn: () => protocolService.getAll(),
  });

  const sessions: Session[] = sessionsData?.data || [];
  const protocols: Protocol[] = protocolsData?.data || [];

  // Filter sessions by date range and protocol
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Filter by date range
    if (dateRange !== 'all') {
      const days = parseInt(dateRange);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      filtered = filtered.filter((s) => new Date(s.started_at) >= cutoffDate);
    }

    // Filter by protocol
    if (protocolFilter !== 'all') {
      filtered = filtered.filter((s) => s.protocol_id === protocolFilter);
    }

    return filtered.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  }, [sessions, dateRange, protocolFilter]);

  // Calculate overall adherence
  const overallAdherence = useMemo(() => {
    if (!sessions.length) return 0;
    const completed = sessions.filter((s) => s.status === 'completed').length;
    return Math.round((completed / sessions.length) * 100);
  }, [sessions]);

  // Calculate ROM improvement (from last session's rom_delta or compare first vs last)
  const romImprovement = useMemo(() => {
    const completedSessions = filteredSessions.filter((s) => s.status === 'completed' && s.rom_delta !== null);
    if (completedSessions.length === 0) return 0;
    // Average of all ROM deltas
    const avgDelta = completedSessions.reduce((sum, s) => sum + (s.rom_delta || 0), 0) / completedSessions.length;
    return Math.round(avgDelta);
  }, [filteredSessions]);

  // Calculate average pain
  const averagePain = useMemo(() => {
    const sessionsWithPain = filteredSessions.filter((s) => s.pain_score_post !== null);
    if (sessionsWithPain.length === 0) return 0;
    const avg = sessionsWithPain.reduce((sum, s) => sum + (s.pain_score_post || 0), 0) / sessionsWithPain.length;
    return Math.round(avg * 10) / 10;
  }, [filteredSessions]);

  // Calculate pain reduction (compare first vs last)
  const painReduction = useMemo(() => {
    const sessionsWithPain = filteredSessions
      .filter((s) => s.pain_score_post !== null)
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    if (sessionsWithPain.length < 2) return 0;
    const first = sessionsWithPain[0].pain_score_post || 0;
    const last = sessionsWithPain[sessionsWithPain.length - 1].pain_score_post || 0;
    return Math.round((first - last) * 10) / 10;
  }, [filteredSessions]);

  // Generate ROM over time data
  const romOverTimeData = useMemo(() => {
    const completedSessions = filteredSessions
      .filter((s) => s.status === 'completed')
      .map((s) => ({
        date: new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rom: s.rom_delta !== null ? Math.round(60 + (s.rom_delta || 0)) : 60, // Use rom_delta + baseline
      }))
      .slice(-7); // Last 7 sessions
    return completedSessions;
  }, [filteredSessions]);

  // Generate accuracy over time data
  const accuracyOverTimeData = useMemo(() => {
    return filteredSessions
      .filter((s) => s.status === 'completed' && s.accuracy_avg !== null)
      .map((s) => ({
        date: new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        accuracy: Math.round(s.accuracy_avg || 0),
      }))
      .slice(-7); // Last 7 sessions
  }, [filteredSessions]);

  // Generate highlights
  const progressHighlights = useMemo(() => {
    const highlights: string[] = [];
    if (overallAdherence >= 80) highlights.push('Excellent adherence! Keep it up!');
    if (romImprovement > 5) highlights.push(`Great ROM improvement: +${romImprovement}°`);
    if (painReduction > 0) highlights.push(`Pain reduced by ${painReduction} points`);
    const recentCompleted = filteredSessions.filter(
      (s) => s.status === 'completed' && new Date(s.started_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    if (recentCompleted.length > 0) highlights.push(`${recentCompleted.length} sessions completed this week`);
    return highlights.slice(0, 3);
  }, [overallAdherence, romImprovement, painReduction, filteredSessions]);

  if (isLoading) {
    return (
      <PatientLayout title="Progress" subtitle="Track your rehabilitation journey">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout title="Progress" subtitle="Track your rehabilitation journey">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 md:gap-4 mb-4 md:mb-6">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[130px] md:w-[150px] text-xs md:text-sm">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 3 months</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>

        <Select value={protocolFilter} onValueChange={setProtocolFilter}>
          <SelectTrigger className="w-[150px] md:w-[180px] text-xs md:text-sm">
            <SelectValue placeholder="Protocol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Protocols</SelectItem>
            {protocols.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6 mb-4 md:mb-6">
        {/* Overall Adherence */}
        <div className="stat-card flex items-center gap-4 md:gap-6">
          <CircularProgress value={overallAdherence} size={70} />
          <div>
            <h3 className="text-xs md:text-sm text-muted-foreground">Adherence</h3>
            <p className="text-xl md:text-2xl font-bold text-foreground">{overallAdherence}%</p>
            <p className="text-[10px] md:text-xs text-muted-foreground">of sessions</p>
          </div>
        </div>

        {/* ROM Improvement */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1 md:mb-2">
            <h3 className="text-xs md:text-sm text-muted-foreground">ROM Improvement</h3>
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-success" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-foreground">+{romImprovement}°</p>
          <p className="text-xs md:text-sm text-success flex items-center gap-1">
            <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
            vs first session
          </p>
        </div>

        {/* Average Pain Trend */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1 md:mb-2">
            <h3 className="text-xs md:text-sm text-muted-foreground">Average Pain</h3>
            <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-success" />
          </div>
          <p className="text-2xl md:text-3xl font-bold text-foreground">{averagePain}</p>
          <p className="text-xs md:text-sm text-success flex items-center gap-1">
            <TrendingDown className="w-3 h-3 md:w-4 md:h-4" />
            {painReduction > 0 ? `-${painReduction}` : 'No change'}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
        {/* ROM Over Time */}
        <div className="stat-card">
          <h3 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4">ROM Over Time</h3>
          {romOverTimeData.length > 0 ? (
            <div className="h-[180px] md:h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={romOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ fontSize: 10 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[40, 80]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [`${value}°`, 'ROM']}
                  />
                  <Line
                    type="monotone"
                    dataKey="rom"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[180px] md:h-[250px] flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </div>

        {/* Accuracy Over Time */}
        <div className="stat-card">
          <h3 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4">Accuracy Over Time</h3>
          {accuracyOverTimeData.length > 0 ? (
            <div className="h-[180px] md:h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={accuracyOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ fontSize: 10 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[60, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [`${value}%`, 'Accuracy']}
                  />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--accent))', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[180px] md:h-[250px] flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row - Calendar & Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Session Calendar */}
        <div className="stat-card">
          <h3 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4">Session Calendar</h3>
          <MiniCalendar sessions={sessions} />
          <div className="flex items-center gap-3 md:gap-4 mt-3 md:mt-4 pt-3 md:pt-4 border-t border-border flex-wrap">
            <div className="flex items-center gap-1 md:gap-2">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm bg-success/50" />
              <span className="text-[10px] md:text-xs text-muted-foreground">Completed</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm bg-destructive/50" />
              <span className="text-[10px] md:text-xs text-muted-foreground">Missed</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm bg-primary/50" />
              <span className="text-[10px] md:text-xs text-muted-foreground">Upcoming</span>
            </div>
          </div>
        </div>

        {/* Highlights */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <Flame className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            <h3 className="text-base md:text-lg font-semibold text-foreground">Highlights</h3>
          </div>
          {progressHighlights.length > 0 ? (
            <div className="space-y-2 md:space-y-3">
              {progressHighlights.map((highlight, idx) => (
                <div key={idx} className="flex items-start gap-2 md:gap-3 p-2 md:p-3 bg-secondary/30 rounded-lg">
                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-success flex-shrink-0 mt-0.5" />
                  <p className="text-xs md:text-sm text-foreground">{highlight}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Keep working on your sessions to see highlights!</p>
          )}
        </div>
      </div>
    </PatientLayout>
  );
}
