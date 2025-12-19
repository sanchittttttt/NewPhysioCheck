import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { sessionService } from '@/lib/services/sessionService';
import { useMemo } from 'react';
import type { Session } from '@/types/api';

export function RomPainChart() {
  const { data: sessionsData } = useQuery({
    queryKey: ['sessions', 'rom-pain'],
    queryFn: () => sessionService.getAll({}),
  });

  const sessions: Session[] = sessionsData?.data || [];

  // Generate ROM & Pain trend data (last 30 days)
  const romPainData = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSessions = sessions
      .filter((s) => new Date(s.started_at) >= thirtyDaysAgo && s.status === 'completed')
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

    // Group by day and calculate averages
    const dayMap = new Map<
      number,
      { romDeltas: number[]; painScores: number[] }
    >();

    recentSessions.forEach((s) => {
      const day = Math.floor((Date.now() - new Date(s.started_at).getTime()) / (24 * 60 * 60 * 1000));
      if (!dayMap.has(day)) {
        dayMap.set(day, { romDeltas: [], painScores: [] });
      }
      const dayData = dayMap.get(day)!;
      if (s.rom_delta !== null) dayData.romDeltas.push(s.rom_delta);
      if (s.pain_score_post !== null) dayData.painScores.push(s.pain_score_post);
    });

    // Convert to chart format (last 7 days)
    return Array.from(dayMap.entries())
      .slice(-7)
      .map(([day, data]) => {
        const romAvg = data.romDeltas.length > 0 ? data.romDeltas.reduce((a, b) => a + b, 0) / data.romDeltas.length : 0;
        const painAvg = data.painScores.length > 0 ? data.painScores.reduce((a, b) => a + b, 0) / data.painScores.length : 0;

        return {
          day: 7 - day,
          rom: Math.round(60 + romAvg * 2), // Scale ROM for display (baseline 60 + delta*2)
          pain: Math.round(painAvg * 10) / 10,
        };
      })
      .sort((a, b) => a.day - b.day);
  }, [sessions]);

  // Calculate average values
  const avgRom = useMemo(() => {
    if (romPainData.length === 0) return 0;
    const sum = romPainData.reduce((acc, d) => acc + d.rom, 0);
    return Math.round(sum / romPainData.length);
  }, [romPainData]);

  const avgPain = useMemo(() => {
    if (romPainData.length === 0) return 0;
    const sum = romPainData.reduce((acc, d) => acc + d.pain, 0);
    return Math.round((sum / romPainData.length) * 10) / 10;
  }, [romPainData]);

  // Calculate trend
  const romTrend = useMemo(() => {
    if (romPainData.length < 2) return 0;
    const last = romPainData[romPainData.length - 1].rom;
    const first = romPainData[0].rom;
    return Math.round(((last - first) / first) * 100 * 10) / 10;
  }, [romPainData]);

  return (
    <div className="stat-card h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">ROM & Pain Trends</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">ROM</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-muted-foreground">Pain</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <span className="text-3xl font-bold text-foreground">
          {avgRom}° / {avgPain}{' '}
        </span>
        <span className="text-lg text-muted-foreground">avg</span>
        <div className="flex items-center gap-2 text-sm mt-1">
          <span className="text-muted-foreground">Last 30 Days</span>
          <span className={romTrend >= 0 ? 'text-success' : 'text-destructive'}>
            {romTrend >= 0 ? '↑' : '↓'} {Math.abs(romTrend).toFixed(1)}%
          </span>
        </div>
      </div>

      {romPainData.length > 0 ? (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={romPainData}>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }}
              />
              <YAxis hide />
              <Line type="monotone" dataKey="rom" stroke="hsl(168 76% 42%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="pain" stroke="hsl(187 92% 69%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data available</div>
      )}
    </div>
  );
}
