import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { sessionService } from '@/lib/services/sessionService';
import { useMemo } from 'react';
import type { Session } from '@/types/api';

export function AdherenceChart() {
  const { data: sessionsData } = useQuery({
    queryKey: ['sessions', 'adherence'],
    queryFn: () => sessionService.getAll({}),
  });

  const sessions: Session[] = sessionsData?.data || [];

  // Calculate adherence data grouped by week
  const adherenceData = useMemo(() => {
    if (!sessions.length) return [];

    // Group sessions by week
    const weekMap = new Map<string, { completed: number; total: number }>();

    sessions.forEach((session) => {
      const date = new Date(session.started_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { completed: 0, total: 0 });
      }

      const weekData = weekMap.get(weekKey)!;
      weekData.total++;
      if (session.status === 'completed') {
        weekData.completed++;
      }
    });

    // Convert to chart format and get last 4 weeks
    return Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-4)
      .map(([weekKey, data], index) => ({
        week: `Week ${index + 1}`,
        completed: data.completed,
        total: data.total,
      }));
  }, [sessions]);

  // Calculate overall adherence percentage
  const overallAdherence = useMemo(() => {
    if (!sessions.length) return 0;
    const completed = sessions.filter((s) => s.status === 'completed').length;
    return Math.round((completed / sessions.length) * 100);
  }, [sessions]);

  // Calculate trend (compare last week vs previous week)
  const trend = useMemo(() => {
    if (adherenceData.length < 2) return 0;
    const lastWeek = adherenceData[adherenceData.length - 1];
    const prevWeek = adherenceData[adherenceData.length - 2];
    const lastPct = lastWeek.total > 0 ? (lastWeek.completed / lastWeek.total) * 100 : 0;
    const prevPct = prevWeek.total > 0 ? (prevWeek.completed / prevWeek.total) * 100 : 0;
    return Math.round((lastPct - prevPct) * 10) / 10;
  }, [adherenceData]);

  return (
    <div className="stat-card h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Adherence Overview</h3>
        <div className="flex gap-2">
          <button className="filter-pill filter-pill-active text-xs py-1 px-3">Week</button>
          <button className="filter-pill text-xs py-1 px-3" disabled>
            Month
          </button>
        </div>
      </div>

      <div className="mb-4">
        <span className="text-3xl font-bold text-foreground">{overallAdherence}% </span>
        <span className="text-lg text-muted-foreground">avg</span>
        <div className="flex items-center gap-2 text-sm mt-1">
          <span className="text-muted-foreground">This Month</span>
          <span className={trend >= 0 ? 'text-success' : 'text-destructive'}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        </div>
      </div>

      {adherenceData.length > 0 ? (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={adherenceData} barGap={8}>
              <XAxis
                dataKey="week"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }}
              />
              <YAxis hide />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="hsl(217 33% 30%)">
                {adherenceData.map((_, index) => (
                  <Cell key={`total-${index}`} />
                ))}
              </Bar>
              <Bar dataKey="completed" radius={[4, 4, 0, 0]} fill="hsl(168 76% 42%)">
                {adherenceData.map((_, index) => (
                  <Cell key={`completed-${index}`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data available</div>
      )}
    </div>
  );
}
